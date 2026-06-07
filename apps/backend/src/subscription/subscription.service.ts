import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getDB } from '../database/db';
import { getRedis } from '../redis/redis';
import { EmailService } from '../email/email.service';
import { QuotaService, PlanType, QuotaFeature, getPlanLimits, windowDaysForPlan } from '../quota/quota.service';

type SubscriptionStatus = 'inactive' | 'active' | 'past_due' | 'cancelled';

export interface FeatureUsage {
  used: number;
  limit: number;
  resetAt: string;
}

export interface UsageResponse {
  planType: PlanType | null;
  copilot_requests: FeatureUsage;
  interviewer_sessions: FeatureUsage;
  scorer_reports: FeatureUsage;
  doc_copilot_requests: FeatureUsage;
}

export interface StatusResponse {
  status: SubscriptionStatus;
  plan: 'weekly' | 'monthly' | 'yearly' | null;
  daysRemaining: number | null;
  currentPeriodEnd: string | null;
  trialStartedAt: string | null;
  trialEndAt: string | null;
  trialActive: boolean;
  isAdmin: boolean;
}

interface SubscriptionRow {
  status: string;
  plan: string | null;
  current_period_end: string | null;
}

interface SubscriptionCreateData {
  subscription_code: string;
  createdAt: string;
  next_payment_date: string;
  plan: { interval: string };
  customer: { customer_code: string };
}

interface SubscriptionCancelData {
  customer: { customer_code: string };
}

interface InvoiceUpdateData {
  paid_at: string | null;
  subscription: {
    next_payment_date: string;
    customer: { customer_code: string };
  };
}

interface InvoicePaymentFailedData {
  subscription: {
    customer: { customer_code: string };
  };
}

interface WebhookEvent {
  event: string;
  data: unknown;
}

interface PaystackVerifyData {
  status: string;
  amount: number;
  reference?: string;
  customer: { customer_code: string; email: string };
}

interface PaystackVerifyResponse {
  status: boolean;
  data: PaystackVerifyData;
}

const KEY_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEVICE_CACHE_TTL_SEC = 10;
const SUB_CACHE_TTL_SEC = 30;
const TRIAL_DURATION_MS = 30 * 60_000;

async function getDeviceCache(cacheKey: string): Promise<boolean | null> {
  try {
    const val = await getRedis().get(`dc:${cacheKey}`);
    if (val === null) return null;
    return val === '1';
  } catch {
    return null;
  }
}

async function setDeviceCache(cacheKey: string, allowed: boolean): Promise<void> {
  try {
    await getRedis().set(`dc:${cacheKey}`, allowed ? '1' : '0', 'EX', DEVICE_CACHE_TTL_SEC);
  } catch {
    // Redis unavailable — skip cache write, device check falls back to DB every request
  }
}

interface SubCacheEntry {
  status: string | null;
  plan: string | null;
  lockedKeyId: string | null;
  lockedKeyId2: string | null;
  periodStart: string | null;
  trialStartedAt: string | null;
}

async function getSubCache(userId: string): Promise<SubCacheEntry | null> {
  try {
    const val = await getRedis().get(`sc:${userId}`);
    if (!val) return null;
    return JSON.parse(val) as SubCacheEntry;
  } catch {
    return null;
  }
}

async function setSubCache(userId: string, entry: SubCacheEntry): Promise<void> {
  try {
    await getRedis().set(`sc:${userId}`, JSON.stringify(entry), 'EX', SUB_CACHE_TTL_SEC);
  } catch {
    // Redis unavailable — cache write skipped
  }
}

async function delSubCache(userId: string): Promise<void> {
  try {
    await getRedis().del(`sc:${userId}`);
  } catch {
    // ignore
  }
}

const PAYSTACK_BASE = 'https://api.paystack.co';

const PAYSTACK_PLAN_AMOUNTS: Array<{
  kobo: number;
  plan: 'weekly' | 'monthly' | 'yearly';
  addDays?: number;
  addYears?: number;
}> = [
  { kobo: 45_000_000, plan: 'yearly',  addYears: 1 },
  { kobo:  4_500_000, plan: 'monthly', addDays: 30 },
  { kobo:  1_500_000, plan: 'weekly',  addDays:  7 },
];

function resolvePlan(
  amount: number,
): { plan: 'weekly' | 'monthly' | 'yearly'; periodEnd: string } | null {
  const match = PAYSTACK_PLAN_AMOUNTS.find((p) => p.kobo === amount);
  if (!match) return null;
  const end = new Date();
  if (match.addYears) end.setFullYear(end.getFullYear() + match.addYears);
  else if (match.addDays) end.setDate(end.getDate() + match.addDays);
  return { plan: match.plan, periodEnd: end.toISOString() };
}

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly emailService: EmailService,
    private readonly quotaService: QuotaService,
  ) {}

  async getStatus(userId: string): Promise<StatusResponse> {
    const pool = getDB();

    const [subResult, userResult] = await Promise.all([
      pool.query<SubscriptionRow>(
        `SELECT status, plan, current_period_end
         FROM subscriptions WHERE user_id = $1 LIMIT 1`,
        [userId],
      ),
      pool.query<{ trial_started_at: string | null; email: string }>(
        `SELECT trial_started_at, email FROM users WHERE id = $1 LIMIT 1`,
        [userId],
      ),
    ]);

    const adminEmails = (process.env.ADMIN_EMAIL ?? '').split(',').map(e => e.trim().toLowerCase()).filter(e => e.includes('@') && e.split('@')[1]?.includes('.'));
    const isAdmin = adminEmails.includes((userResult.rows[0]?.email ?? '').toLowerCase());

    const trialStartedAt = userResult.rows[0]?.trial_started_at ?? null;
    const trialEndAt = trialStartedAt
      ? new Date(new Date(trialStartedAt).getTime() + TRIAL_DURATION_MS).toISOString()
      : null;
    const trialActive = trialEndAt !== null && Date.now() < new Date(trialEndAt).getTime();

    if (subResult.rows.length === 0) {
      return {
        status: 'inactive',
        plan: null,
        daysRemaining: null,
        currentPeriodEnd: null,
        trialStartedAt: trialStartedAt ? new Date(trialStartedAt).toISOString() : null,
        trialEndAt,
        trialActive,
        isAdmin,
      };
    }

    const row = subResult.rows[0];
    let daysRemaining: number | null = null;
    if (row.current_period_end) {
      daysRemaining = Math.max(
        0,
        Math.ceil((new Date(row.current_period_end).getTime() - Date.now()) / 86400000),
      );
    }

    return {
      status: row.status as SubscriptionStatus,
      plan: row.plan as 'weekly' | 'monthly' | 'yearly' | null,
      daysRemaining,
      currentPeriodEnd: row.current_period_end
        ? new Date(row.current_period_end).toISOString()
        : null,
      trialStartedAt: trialStartedAt ? new Date(trialStartedAt).toISOString() : null,
      trialEndAt,
      trialActive,
      isAdmin,
    };
  }

  async startTrial(userId: string, keyId: string | undefined): Promise<{ trialStartedAt: string }> {
    if (!keyId || !KEY_ID_RE.test(keyId)) {
      throw new BadRequestException('Valid device key required to start trial');
    }

    const pool = getDB();

    // Check if any account has already used this device for a trial
    const deviceUsed = await pool.query<{ id: string }>(
      `SELECT id FROM users WHERE trial_key_id = $1 LIMIT 1`,
      [keyId],
    );
    if (deviceUsed.rows.length > 0) {
      throw new BadRequestException('trial_device_used');
    }

    // Atomically set trial only if not already set for this user
    const result = await pool.query<{ trial_started_at: string }>(
      `UPDATE users
       SET trial_started_at = NOW(), trial_key_id = $2
       WHERE id = $1 AND trial_started_at IS NULL
       RETURNING trial_started_at`,
      [userId, keyId],
    );

    if (result.rows.length === 0) {
      throw new BadRequestException('trial_already_used');
    }

    return { trialStartedAt: new Date(result.rows[0].trial_started_at).toISOString() };
  }

  async getUsage(userId: string): Promise<UsageResponse> {
    const pool = getDB();

    const [planInfo, usageResult, subResult] = await Promise.all([
      this.quotaService.getPlanType(userId),
      pool.query<{
        plan_type: string;
        copilot_requests: number;
        interviewer_sessions: number;
        scorer_reports: number;
        doc_copilot_requests: number;
        period_start: string;
      }>(
        `SELECT plan_type, copilot_requests, interviewer_sessions,
                scorer_reports, doc_copilot_requests, period_start
         FROM usage WHERE user_id = $1 LIMIT 1`,
        [userId],
      ),
      pool.query<{ current_period_start: string | null; created_at: string }>(
        `SELECT current_period_start, created_at FROM subscriptions WHERE user_id = $1 LIMIT 1`,
        [userId],
      ),
    ]);

    const planType = (planInfo?.planType ?? null) as PlanType | null;
    const resolvedPlan: PlanType = planType ?? 'monthly';
    const limits = getPlanLimits(resolvedPlan);
    const windowDays = windowDaysForPlan(resolvedPlan);

    const row = usageResult.rows[0];
    const subRow = subResult.rows[0];
    const subPeriodStart = subRow?.current_period_start
      ? new Date(subRow.current_period_start)
      : subRow?.created_at
        ? new Date(subRow.created_at)
        : new Date();
    const periodStart = row?.period_start
      ? new Date(row.period_start)
      : (planInfo?.periodStart ?? subPeriodStart);
    const resetAt = new Date(periodStart.getTime() + windowDays * 86_400_000).toISOString();

    const features: QuotaFeature[] = [
      'copilot_requests',
      'interviewer_sessions',
      'scorer_reports',
      'doc_copilot_requests',
    ];

    const result: Partial<Record<QuotaFeature, FeatureUsage>> = {};
    for (const f of features) {
      result[f] = {
        used: row?.[f] ?? 0,
        limit: limits[f],
        resetAt,
      };
    }

    return {
      planType,
      ...(result as Record<QuotaFeature, FeatureUsage>),
    };
  }

  async canUseAI(userId: string): Promise<boolean> {
    const pool = getDB();

    const [subResult, userResult] = await Promise.all([
      pool.query<{ status: string }>(
        `SELECT status FROM subscriptions WHERE user_id = $1 LIMIT 1`,
        [userId],
      ),
      pool.query<{ trial_started_at: string | null }>(
        `SELECT trial_started_at FROM users WHERE id = $1 LIMIT 1`,
        [userId],
      ),
    ]);

    if (subResult.rows.length > 0 && subResult.rows[0].status === 'active') {
      return true;
    }

    const trialStartedAt = userResult.rows[0]?.trial_started_at ?? null;
    if (trialStartedAt !== null) {
      return Date.now() < new Date(trialStartedAt).getTime() + TRIAL_DURATION_MS;
    }

    return false;
  }

  // Combines canUseAI + checkDevice into a single DB round trip (JOIN query).
  // Returns { canUse, deviceAllowed, plan, periodStart } so the controller can
  // gate on all checks and skip a separate getPlanType() call.
  // Subscription status is cached in Redis for 30s to eliminate DB queries on
  // warm requests; device locking uses a separate 10s dc: cache.
  async checkAccess(
    userId: string,
    keyId: string | undefined,
  ): Promise<{ canUse: boolean; deviceAllowed: boolean; plan: string | null; periodStart: Date | null }> {
    const pool = getDB();

    // Try subscription status cache first
    let cached = await getSubCache(userId);

    if (!cached) {
      // Single JOIN — replaces 2 parallel queries
      const result = await pool.query<{
        status: string | null;
        plan: string | null;
        locked_key_id: string | null;
        locked_key_id_2: string | null;
        current_period_start: string | null;
        sub_created_at: string | null;
        trial_started_at: string | null;
      }>(
        `SELECT s.status, s.plan, s.locked_key_id, s.locked_key_id_2,
                s.current_period_start, s.created_at AS sub_created_at,
                u.trial_started_at
         FROM users u
         LEFT JOIN subscriptions s ON s.user_id = u.id
         WHERE u.id = $1
         LIMIT 1`,
        [userId],
      );

      const row = result.rows[0];
      const periodStartRaw = row?.current_period_start ?? row?.sub_created_at ?? null;
      cached = {
        status: row?.status ?? null,
        plan: row?.plan ?? null,
        lockedKeyId: row?.locked_key_id ?? null,
        lockedKeyId2: row?.locked_key_id_2 ?? null,
        periodStart: periodStartRaw,
        trialStartedAt: row?.trial_started_at ?? null,
      };
      void setSubCache(userId, cached);
    }

    const { status, plan, lockedKeyId, lockedKeyId2, trialStartedAt, periodStart: periodStartStr } = cached;

    // Determine canUse
    let canUse = false;
    if (status === 'active') {
      canUse = true;
    } else if (trialStartedAt !== null) {
      canUse = Date.now() < new Date(trialStartedAt).getTime() + TRIAL_DURATION_MS;
    }

    // Determine deviceAllowed
    let deviceAllowed = true;
    if (status === 'active' && (lockedKeyId || lockedKeyId2) && (!keyId || !KEY_ID_RE.test(keyId))) {
      deviceAllowed = false;
    } else if (keyId && KEY_ID_RE.test(keyId) && status === 'active') {
      const cacheKey = `${userId}:${keyId}`;
      const dcCached = await getDeviceCache(cacheKey);
      if (dcCached !== null) {
        deviceAllowed = dcCached;
      } else if (lockedKeyId === keyId || lockedKeyId2 === keyId) {
        deviceAllowed = true;
        await setDeviceCache(cacheKey, true);
      } else if (!lockedKeyId) {
        const lockResult = await pool.query(
          `UPDATE subscriptions SET locked_key_id = $1, updated_at = NOW()
           WHERE user_id = $2 AND locked_key_id IS NULL`,
          [keyId, userId],
        );
        if ((lockResult.rowCount ?? 0) === 0) {
          const recheck = await pool.query<{ locked_key_id: string | null }>(
            `SELECT locked_key_id FROM subscriptions WHERE user_id = $1 LIMIT 1`,
            [userId],
          );
          const winner = recheck.rows[0]?.locked_key_id ?? null;
          deviceAllowed = winner === keyId;
          await setDeviceCache(cacheKey, deviceAllowed);
        } else {
          await Promise.all([this.invalidateDeviceCache(userId, keyId), delSubCache(userId)]);
          deviceAllowed = true;
        }
      } else if (!lockedKeyId2) {
        const lockResult = await pool.query(
          `UPDATE subscriptions SET locked_key_id_2 = $1, updated_at = NOW()
           WHERE user_id = $2 AND locked_key_id_2 IS NULL`,
          [keyId, userId],
        );
        if ((lockResult.rowCount ?? 0) === 0) {
          deviceAllowed = false;
          await setDeviceCache(cacheKey, false);
        } else {
          await Promise.all([this.invalidateDeviceCache(userId, keyId), delSubCache(userId)]);
          deviceAllowed = true;
        }
      } else {
        deviceAllowed = false;
        await setDeviceCache(cacheKey, false);
      }
    }

    const periodStart = periodStartStr ? new Date(periodStartStr) : null;
    return { canUse, deviceAllowed, plan, periodStart };
  }

  async invalidateDeviceCache(userId: string, keyId?: string): Promise<void> {
    try {
      const redis = getRedis();
      if (keyId) {
        await redis.del(`dc:${userId}:${keyId}`);
        return;
      }
      let cursor = '0';
      do {
        const [next, keys] = await redis.scan(cursor, 'MATCH', `dc:${userId}:*`, 'COUNT', 100);
        cursor = next;
        if (keys.length > 0) await redis.del(...keys);
      } while (cursor !== '0');
    } catch (err) {
      console.warn('invalidateDeviceCache failed (Redis down?):', err);
    }
  }

  async verify(userId: string, userEmail: string, reference: string, keyId?: string): Promise<{ success: boolean }> {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) throw new InternalServerErrorException('Paystack not configured');

    const res = await fetch(
      `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );

    if (!res.ok) throw new BadRequestException('Could not reach Paystack');

    const body = (await res.json()) as PaystackVerifyResponse;
    if (!body.status || body.data.status !== 'success') {
      throw new BadRequestException('Payment not successful');
    }

    const txData = body.data;

    // Guard: transaction must belong to the authenticated user
    if (txData.customer.email.toLowerCase() !== userEmail.toLowerCase()) {
      throw new BadRequestException('Payment reference does not belong to this account');
    }

    // Guard: reject exact amount mismatches (prevents cross-product reference abuse)
    const resolved = resolvePlan(txData.amount);
    if (!resolved) throw new BadRequestException('Invalid payment amount');
    const { plan, periodEnd } = resolved;

    const pool = getDB();

    // Guard: reject replayed references
    const existing = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM subscriptions WHERE paystack_reference = $1 LIMIT 1`,
      [reference],
    );
    if (existing.rows.length > 0) {
      throw new BadRequestException('Payment reference already used');
    }

    const lockedKeyId = (keyId && KEY_ID_RE.test(keyId)) ? keyId : null;

    await pool.query(
      `INSERT INTO subscriptions
         (user_id, paystack_customer_code, paystack_reference, status, plan, current_period_end, locked_key_id, updated_at)
       VALUES ($1, $2, $3, 'active', $4, $5, $6, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         paystack_customer_code = $2,
         paystack_reference      = $3,
         status                  = 'active',
         plan                    = $4,
         current_period_end      = $5,
         locked_key_id           = COALESCE(subscriptions.locked_key_id, $6),
         updated_at              = NOW()`,
      [userId, txData.customer.customer_code, reference, plan, periodEnd, lockedKeyId],
    );

    await Promise.all([this.invalidateDeviceCache(userId), delSubCache(userId)]);
    await this.quotaService.resetUserUsage(userId, plan as PlanType, new Date());

    const userResult = await pool.query<{ email: string; name: string | null; referred_by_user_id: string | null }>(
      `SELECT email, name, referred_by_user_id FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    const user = userResult.rows[0];
    if (user) {
      void this.emailService.sendPaymentConfirmation(user.email, user.name ?? 'there', plan);
    }

    // Commission: 10% of first payment to the referrer
    if (user?.referred_by_user_id) {
      const existingCommission = await pool.query<{ id: string }>(
        `SELECT id FROM referral_commissions WHERE referred_user_id = $1 LIMIT 1`,
        [userId],
      );
      if (existingCommission.rows.length === 0) {
        const commissionKobo = Math.floor(txData.amount * 0.1);
        await pool.query(
          `INSERT INTO referral_commissions
             (referrer_user_id, referred_user_id, amount_kobo, payment_reference)
           VALUES ($1, $2, $3, $4)`,
          [user.referred_by_user_id, userId, commissionKobo, reference],
        );
      }
    }

    return { success: true };
  }

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) throw new InternalServerErrorException('Paystack not configured');

    const hash = createHmac('sha512', secretKey).update(rawBody).digest('hex');
    const a = Buffer.from(hash);
    const b = Buffer.from(signature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = JSON.parse(rawBody.toString()) as WebhookEvent;
    const pool = getDB();

    if (event.event === 'charge.success') {
      const data = event.data as PaystackVerifyData;
      if (data.status !== 'success') return;

      const ref = data.reference ?? '';

      // Only act if this reference hasn't been processed yet
      const refCheck = await pool.query<{ user_id: string }>(
        `SELECT user_id FROM subscriptions WHERE paystack_reference = $1 LIMIT 1`,
        [ref],
      );
      if (refCheck.rows.length > 0) return;

      // Find the user by email
      const userRow = await pool.query<{ id: string }>(
        `SELECT id FROM users WHERE email = $1 LIMIT 1`,
        [data.customer.email.toLowerCase()],
      );
      if (!userRow.rows[0]) return;
      const uid = userRow.rows[0].id;

      const resolved = resolvePlan(data.amount);
      if (!resolved) return;
      const { plan, periodEnd } = resolved;

      await pool.query(
        `INSERT INTO subscriptions
           (user_id, paystack_customer_code, paystack_reference, status, plan, current_period_end, updated_at)
         VALUES ($1, $2, $3, 'active', $4, $5, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           paystack_customer_code = $2,
           paystack_reference      = $3,
           status                  = 'active',
           plan                    = $4,
           current_period_end      = $5,
           updated_at              = NOW()`,
        [uid, data.customer.customer_code, ref, plan, periodEnd],
      );
      await Promise.all([this.invalidateDeviceCache(uid), delSubCache(uid)]);
    } else if (event.event === 'subscription.create') {
      const data = event.data as SubscriptionCreateData;
      const intervalMap: Record<string, 'weekly' | 'monthly' | 'yearly'> = {
        weekly: 'weekly',
        monthly: 'monthly',
        annually: 'yearly',
        yearly: 'yearly',
      };
      const plan: 'weekly' | 'monthly' | 'yearly' = intervalMap[data.plan.interval] ?? 'monthly';
      const updateResult = await pool.query(
        `UPDATE subscriptions SET
           status = 'active',
           plan = $1,
           paystack_subscription_code = $2,
           current_period_start = $3,
           current_period_end = $4,
           updated_at = NOW()
         WHERE paystack_customer_code = $5`,
        [
          plan,
          data.subscription_code,
          new Date(data.createdAt).toISOString(),
          new Date(data.next_payment_date).toISOString(),
          data.customer.customer_code,
        ],
      );
      if ((updateResult.rowCount ?? 0) === 0) {
        // Row not found yet — verify() hasn't run. Return silently; Paystack will retry naturally.
        return;
      }
    } else if (
      event.event === 'subscription.disable' ||
      event.event === 'subscription.not_renew'
    ) {
      const data = event.data as SubscriptionCancelData;
      await pool.query(
        `UPDATE subscriptions SET status = 'cancelled', updated_at = NOW()
         WHERE paystack_customer_code = $1`,
        [data.customer.customer_code],
      );
    } else if (event.event === 'invoice.update') {
      const data = event.data as InvoiceUpdateData;
      if (!data.paid_at) return;
      const paidAt = new Date(data.paid_at);
      const renewResult = await pool.query<{ user_id: string; plan: string | null }>(
        `UPDATE subscriptions SET
           status = 'active',
           current_period_start = $1,
           current_period_end = $2,
           updated_at = NOW()
         WHERE paystack_customer_code = $3
         RETURNING user_id, plan`,
        [
          paidAt.toISOString(),
          new Date(data.subscription.next_payment_date).toISOString(),
          data.subscription.customer.customer_code,
        ],
      );
      const renewed = renewResult.rows[0];
      if (renewed?.plan && ['weekly', 'monthly', 'yearly'].includes(renewed.plan)) {
        void delSubCache(renewed.user_id);
        await this.quotaService.resetUserUsage(
          renewed.user_id, renewed.plan as PlanType, paidAt,
        );
      }
    } else if (event.event === 'invoice.payment_failed') {
      const data = event.data as InvoicePaymentFailedData;
      const upd = await pool.query<{ user_id: string }>(
        `UPDATE subscriptions SET status = 'past_due', updated_at = NOW()
         WHERE paystack_customer_code = $1
         RETURNING user_id`,
        [data.subscription.customer.customer_code],
      );
      if (upd.rows[0]) {
        void delSubCache(upd.rows[0].user_id);
        const ur = await pool.query<{ email: string; name: string | null }>(
          `SELECT email, name FROM users WHERE id = $1 LIMIT 1`,
          [upd.rows[0].user_id],
        );
        const u = ur.rows[0];
        if (u) void this.emailService.sendPaymentFailed(u.email, u.name ?? 'there');
      }
    }
  }
}
