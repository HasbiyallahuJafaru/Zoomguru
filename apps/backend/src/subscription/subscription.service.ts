import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
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
const SESSION_TOKEN_RE = /^[0-9a-f]{64}$/i;
const DEVICE_CACHE_TTL_SEC = 10;
const SUB_CACHE_TTL_SEC = 30;
const TRIAL_DURATION_MS = 30 * 60_000;
// Checkout session tokens are single-use and expire so an abandoned link can't
// be replayed later. 30 minutes is comfortably longer than a Paystack flow.
const CHECKOUT_TTL_SEC = 30 * 60;

interface CheckoutSession {
  userId: string;
  email: string;
  plan: 'weekly' | 'monthly' | 'yearly';
  amount: number;
  createdAt: number;
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

// Fetches sub cache and (optionally) device cache in one pipeline round trip.
async function fetchAccessCaches(
  userId: string,
  keyId: string | null,
): Promise<{ cached: SubCacheEntry | null; dcCached: boolean | null }> {
  try {
    const redis = getRedis();
    const pl = redis.pipeline().get(`sc:${userId}`);
    if (keyId) pl.get(`dc:${userId}:${keyId}`);
    const results = (await pl.exec()) as Array<[Error | null, string | null]>;

    const scVal = results[0]?.[1] ?? null;
    const dcVal = keyId ? (results[1]?.[1] ?? null) : null;

    const cached: SubCacheEntry | null = scVal ? (JSON.parse(scVal) as SubCacheEntry) : null;
    const dcCached: boolean | null = dcVal !== null ? dcVal === '1' : null;
    return { cached, dcCached };
  } catch {
    return { cached: null, dcCached: null };
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

    const { rows } = await pool.query<{
      plan: string | null;
      sub_period_start: string | null;
      sub_created_at: string | null;
      plan_type: string | null;
      copilot_requests: number | null;
      interviewer_sessions: number | null;
      scorer_reports: number | null;
      doc_copilot_requests: number | null;
      usage_period_start: string | null;
    }>(
      `SELECT
         s.plan,
         s.current_period_start  AS sub_period_start,
         s.created_at            AS sub_created_at,
         u.plan_type,
         u.copilot_requests,
         u.interviewer_sessions,
         u.scorer_reports,
         u.doc_copilot_requests,
         u.period_start          AS usage_period_start
       FROM subscriptions s
       LEFT JOIN usage u ON u.user_id = s.user_id
       WHERE s.user_id = $1 AND s.status = 'active'
       LIMIT 1`,
      [userId],
    );

    const row = rows[0];
    const rawPlan = row?.plan ?? null;
    const planType = (rawPlan && ['weekly', 'monthly', 'yearly'].includes(rawPlan)
      ? rawPlan
      : null) as PlanType | null;
    const resolvedPlan: PlanType = planType ?? 'monthly';
    const limits = getPlanLimits(resolvedPlan);
    const windowDays = windowDaysForPlan(resolvedPlan);

    const subPeriodStart = row?.sub_period_start
      ? new Date(row.sub_period_start)
      : row?.sub_created_at
        ? new Date(row.sub_created_at)
        : new Date();
    const periodStart = row?.usage_period_start
      ? new Date(row.usage_period_start)
      : subPeriodStart;
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
  ): Promise<{ canUse: boolean; deviceAllowed: boolean; plan: string | null; periodStart: Date | null; subActive: boolean }> {
    const pool = getDB();
    const validKeyId = keyId && KEY_ID_RE.test(keyId) ? keyId : null;

    // Fetch sub cache + device cache in a single pipeline round trip
    let { cached, dcCached: prefetchedDc } = await fetchAccessCaches(userId, validKeyId);

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
    if (status === 'active' && (lockedKeyId || lockedKeyId2) && !validKeyId) {
      deviceAllowed = false;
    } else if (validKeyId && status === 'active') {
      const cacheKey = `${userId}:${validKeyId}`;
      const dcCached = prefetchedDc;
      if (dcCached !== null) {
        deviceAllowed = dcCached;
      } else if (lockedKeyId === validKeyId || lockedKeyId2 === validKeyId) {
        deviceAllowed = true;
        await setDeviceCache(cacheKey, true);
      } else if (!lockedKeyId) {
        const lockResult = await pool.query(
          `UPDATE subscriptions SET locked_key_id = $1, updated_at = NOW()
           WHERE user_id = $2 AND locked_key_id IS NULL`,
          [validKeyId, userId],
        );
        if ((lockResult.rowCount ?? 0) === 0) {
          const recheck = await pool.query<{ locked_key_id: string | null }>(
            `SELECT locked_key_id FROM subscriptions WHERE user_id = $1 LIMIT 1`,
            [userId],
          );
          const winner = recheck.rows[0]?.locked_key_id ?? null;
          deviceAllowed = winner === validKeyId;
          await setDeviceCache(cacheKey, deviceAllowed);
        } else {
          await Promise.all([this.invalidateDeviceCache(userId, validKeyId), delSubCache(userId)]);
          deviceAllowed = true;
        }
      } else if (!lockedKeyId2) {
        const lockResult = await pool.query(
          `UPDATE subscriptions SET locked_key_id_2 = $1, updated_at = NOW()
           WHERE user_id = $2 AND locked_key_id_2 IS NULL`,
          [validKeyId, userId],
        );
        if ((lockResult.rowCount ?? 0) === 0) {
          deviceAllowed = false;
          await setDeviceCache(cacheKey, false);
        } else {
          await Promise.all([this.invalidateDeviceCache(userId, validKeyId), delSubCache(userId)]);
          deviceAllowed = true;
        }
      } else {
        deviceAllowed = false;
        await setDeviceCache(cacheKey, false);
      }
    }

    const periodStart = periodStartStr ? new Date(periodStartStr) : null;
    // subActive distinguishes a paid, active subscription from a trial/inactive
    // user — used to grant a higher AI rate limit to paying customers.
    return { canUse, deviceAllowed, plan, periodStart, subActive: status === 'active' };
  }

  async invalidateDeviceCache(userId: string, keyId?: string): Promise<void> {
    try {
      const redis = getRedis();
      if (keyId) {
        await redis.del(`dc:${userId}:${keyId}`);
        return;
      }
      // No keyId on payment verify — let the 10 s TTL expire naturally.
    } catch (err) {
      console.warn('invalidateDeviceCache failed (Redis down?):', err);
    }
  }

  // Verifies a reference with Paystack, retrying transient failures (network
  // errors, 5xx, 429) with a short backoff and a 5s per-attempt timeout. A
  // single blip on Paystack's side would otherwise drop the user onto the slow
  // webhook path; this keeps the authoritative confirm fast and reliable.
  private async paystackVerify(reference: string, secretKey: string): Promise<PaystackVerifyResponse> {
    const url = `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        let res: Response;
        try {
          res = await fetch(url, {
            headers: { Authorization: `Bearer ${secretKey}` },
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }

        if (res.ok) return (await res.json()) as PaystackVerifyResponse;

        // 4xx (other than rate-limit) won't change on retry — fail fast.
        if (res.status < 500 && res.status !== 429) {
          throw new BadRequestException('Could not verify payment');
        }
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        // network/abort error — fall through to retry
      }
      if (attempt < 2) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
    throw new BadRequestException('Could not reach Paystack');
  }

  async verify(userId: string, userEmail: string, reference: string, keyId?: string): Promise<{ success: boolean }> {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) throw new InternalServerErrorException('Paystack not configured');

    const body = await this.paystackVerify(reference, secretKey);
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

    await this.activatePaidSubscription({
      userId,
      customerCode: txData.customer.customer_code,
      reference,
      amount: txData.amount,
      plan,
      periodEnd,
      lockedKeyId,
    });

    return { success: true };
  }

  // Shared activation path for a confirmed Paystack payment. Used both by the
  // legacy in-app verify() and the hosted-checkout confirmCheckout(). Writes the
  // subscription, busts caches, resets quota, emails the receipt, and records a
  // first-payment referral commission. Device binding is optional: in-app verify
  // passes the device key; hosted checkout passes null and the device locks on
  // first AI use (checkAccess) exactly as the webhook path already does.
  private async activatePaidSubscription(params: {
    userId: string;
    customerCode: string;
    reference: string;
    amount: number;
    plan: 'weekly' | 'monthly' | 'yearly';
    periodEnd: string;
    lockedKeyId: string | null;
  }): Promise<void> {
    const { userId, customerCode, reference, amount, plan, periodEnd, lockedKeyId } = params;
    const pool = getDB();

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
      [userId, customerCode, reference, plan, periodEnd, lockedKeyId],
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
        const commissionKobo = Math.floor(amount * 0.1);
        await pool.query(
          `INSERT INTO referral_commissions
             (referrer_user_id, referred_user_id, amount_kobo, payment_reference)
           VALUES ($1, $2, $3, $4)`,
          [user.referred_by_user_id, userId, commissionKobo, reference],
        );
      }
    }
  }

  // ── Hosted checkout (zoomguru.xyz) ──────────────────────────────────────────
  // The desktop app no longer initialises Paystack. Instead it asks the backend
  // to mint a single-use session token, then opens https://zoomguru.xyz/checkout
  // which runs Paystack InlineJS so transactions originate from the registered
  // domain rather than a file:/// path.

  async createCheckout(
    userId: string,
    email: string,
    plan: string,
  ): Promise<{ checkout_url: string }> {
    const match = PAYSTACK_PLAN_AMOUNTS.find((p) => p.plan === plan);
    if (!match) throw new BadRequestException('Invalid plan');

    const token = randomBytes(32).toString('hex');
    const session: CheckoutSession = {
      userId,
      email,
      plan: match.plan,
      amount: match.kobo,
      createdAt: Date.now(),
    };

    try {
      await getRedis().set(`ps:${token}`, JSON.stringify(session), 'EX', CHECKOUT_TTL_SEC);
    } catch {
      throw new InternalServerErrorException('Could not start checkout');
    }

    const base = (process.env.CHECKOUT_URL ?? 'https://zoomguru.xyz').replace(/\/$/, '');
    return { checkout_url: `${base}/checkout.html?session=${token}` };
  }

  // Public endpoint hit by the checkout page. Returns only what the browser
  // needs to render Paystack — never the secret key.
  async getCheckout(
    token: string,
  ): Promise<{ email: string; amount: number; plan: string; publicKey: string }> {
    if (!token || !SESSION_TOKEN_RE.test(token)) {
      throw new BadRequestException('Invalid session');
    }

    let raw: string | null;
    try {
      raw = await getRedis().get(`ps:${token}`);
    } catch {
      throw new InternalServerErrorException('Checkout unavailable');
    }
    if (!raw) throw new BadRequestException('Session expired');

    const session = JSON.parse(raw) as CheckoutSession;
    const publicKey = process.env.PAYSTACK_PUBLIC_KEY ?? '';
    if (!publicKey) throw new InternalServerErrorException('Paystack public key not configured');

    return { email: session.email, amount: session.amount, plan: session.plan, publicKey };
  }

  // Public endpoint hit by the checkout page after Paystack returns a reference.
  // Verifies server-side, activates the subscription, and consumes the token so
  // it cannot be replayed. Idempotent if the webhook already activated.
  async confirmCheckout(
    token: string,
    reference: string,
  ): Promise<{ success: boolean; status: 'active' }> {
    if (!token || !SESSION_TOKEN_RE.test(token)) {
      throw new BadRequestException('Invalid session');
    }
    if (!reference || typeof reference !== 'string') {
      throw new BadRequestException('reference is required');
    }

    const redis = getRedis();
    let raw: string | null;
    try {
      raw = await redis.get(`ps:${token}`);
    } catch {
      throw new InternalServerErrorException('Checkout unavailable');
    }
    if (!raw) throw new BadRequestException('Session expired');
    const session = JSON.parse(raw) as CheckoutSession;

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) throw new InternalServerErrorException('Paystack not configured');

    const pool = getDB();

    // Fast path: if the webhook (or a prior confirm) already recorded this
    // reference for this user, the subscription is active — skip the Paystack
    // round trip and return immediately.
    const pre = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM subscriptions WHERE paystack_reference = $1 LIMIT 1`,
      [reference],
    );
    if (pre.rows.length > 0 && pre.rows[0].user_id === session.userId) {
      try { await redis.del(`ps:${token}`); } catch { /* TTL will expire it */ }
      return { success: true, status: 'active' };
    }

    const body = await this.paystackVerify(reference, secretKey);
    if (!body.status || body.data.status !== 'success') {
      throw new BadRequestException('Payment not successful');
    }
    const txData = body.data;

    // Guard: the paid transaction must match the session it claims to fulfil.
    if (txData.customer.email.toLowerCase() !== session.email.toLowerCase()) {
      throw new BadRequestException('Payment does not match this checkout');
    }
    const resolved = resolvePlan(txData.amount);
    if (!resolved || txData.amount !== session.amount) {
      throw new BadRequestException('Invalid payment amount');
    }
    const { plan, periodEnd } = resolved;

    // Replay guard: covers a webhook landing between the pre-check and now.
    const existing = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM subscriptions WHERE paystack_reference = $1 LIMIT 1`,
      [reference],
    );
    if (existing.rows.length > 0) {
      try { await redis.del(`ps:${token}`); } catch { /* TTL will expire it */ }
      return { success: true, status: 'active' };
    }

    await this.activatePaidSubscription({
      userId: session.userId,
      customerCode: txData.customer.customer_code,
      reference,
      amount: txData.amount,
      plan,
      periodEnd,
      lockedKeyId: null,
    });

    try { await redis.del(`ps:${token}`); } catch { /* TTL will expire it */ }
    return { success: true, status: 'active' };
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
