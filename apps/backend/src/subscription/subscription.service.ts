import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { getDB } from '../database/db';
import { EmailService } from '../email/email.service';

type SubscriptionStatus = 'inactive' | 'active' | 'past_due' | 'cancelled';

export interface StatusResponse {
  status: SubscriptionStatus;
  plan: 'monthly' | 'lifetime' | null;
  daysRemaining: number | null;
  currentPeriodEnd: string | null;
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

interface PaystackVerifyCustomer {
  customer_code: string;
}

interface PaystackVerifyPlan {
  interval?: string;
}

interface PaystackVerifyData {
  status: string;
  amount: number;
  plan: PaystackVerifyPlan | string | null;
  plan_object?: { interval?: string } | null;
  customer: PaystackVerifyCustomer;
}

interface PaystackVerifyResponse {
  status: boolean;
  data: PaystackVerifyData;
}

interface DeviceCacheEntry {
  allowed: boolean;
  expiresAt: number;
}

const DEVICE_CACHE_TTL_MS = 60_000;
const deviceCache = new Map<string, DeviceCacheEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of deviceCache.entries()) {
    if (entry.expiresAt <= now) deviceCache.delete(key);
  }
}, 5 * 60_000);

const PAYSTACK_BASE = 'https://api.paystack.co';

@Injectable()
export class SubscriptionService {
  constructor(private readonly emailService: EmailService) {}

  async getStatus(userId: string): Promise<StatusResponse> {
    const pool = getDB();
    const result = await pool.query<SubscriptionRow>(
      `SELECT status, plan, current_period_end
       FROM subscriptions WHERE user_id = $1 LIMIT 1`,
      [userId],
    );

    if (result.rows.length === 0) {
      return { status: 'inactive', plan: null, daysRemaining: null, currentPeriodEnd: null };
    }

    const row = result.rows[0];
    let daysRemaining: number | null = null;
    if (row.current_period_end) {
      daysRemaining = Math.max(
        0,
        Math.ceil((new Date(row.current_period_end).getTime() - Date.now()) / 86400000),
      );
    }

    return {
      status: row.status as SubscriptionStatus,
      plan: row.plan as 'monthly' | 'lifetime' | null,
      daysRemaining,
      currentPeriodEnd: row.current_period_end
        ? new Date(row.current_period_end).toISOString()
        : null,
    };
  }

  async checkDevice(userId: string, deviceId: string | undefined): Promise<boolean> {
    if (!deviceId || !/^[a-f0-9]{64}$/.test(deviceId)) return true;

    const cacheKey = `${userId}:${deviceId}`;
    const now = Date.now();
    const cached = deviceCache.get(cacheKey);
    if (cached && cached.expiresAt > now) return cached.allowed;

    const pool = getDB();
    const result = await pool.query<{
      status: string;
      locked_device_id: string | null;
      locked_device_id_2: string | null;
    }>(
      `SELECT status, locked_device_id, locked_device_id_2
       FROM subscriptions WHERE user_id = $1 LIMIT 1`,
      [userId],
    );

    let allowed: boolean;
    if (result.rows.length === 0) {
      allowed = true;
    } else {
      const row = result.rows[0];
      if (row.status !== 'active') {
        allowed = true;
      } else if (row.locked_device_id === deviceId || row.locked_device_id_2 === deviceId) {
        allowed = true;
      } else if (!row.locked_device_id) {
        // First device slot empty — lock it.
        await pool.query(
          `UPDATE subscriptions SET locked_device_id = $1, updated_at = NOW()
           WHERE user_id = $2 AND locked_device_id IS NULL`,
          [deviceId, userId],
        );
        this.invalidateDeviceCache(userId);
        allowed = true;
      } else if (!row.locked_device_id_2) {
        // Second device slot empty — lock it.
        await pool.query(
          `UPDATE subscriptions SET locked_device_id_2 = $1, updated_at = NOW()
           WHERE user_id = $2 AND locked_device_id_2 IS NULL`,
          [deviceId, userId],
        );
        this.invalidateDeviceCache(userId);
        allowed = true;
      } else {
        // Both slots taken by different devices.
        allowed = false;
      }
    }

    deviceCache.set(cacheKey, { allowed, expiresAt: now + DEVICE_CACHE_TTL_MS });
    return allowed;
  }

  invalidateDeviceCache(userId: string): void {
    for (const key of deviceCache.keys()) {
      if (key.startsWith(`${userId}:`)) deviceCache.delete(key);
    }
  }

  async verify(userId: string, reference: string, deviceId?: string): Promise<{ success: boolean }> {
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
    const planCode = typeof txData.plan === 'string' ? txData.plan.trim() : '';
    const planInterval =
      typeof txData.plan === 'object' && txData.plan !== null
        ? (txData.plan.interval ?? '').trim()
        : (txData.plan_object?.interval ?? '').trim();
    const isLifetime = !planCode && !planInterval;
    if (isLifetime && txData.amount < 100_000_000) {
      throw new BadRequestException('Invalid payment amount for lifetime plan');
    }
    const plan: 'monthly' | 'lifetime' = isLifetime ? 'lifetime' : 'monthly';
    const pool = getDB();

    const lockedDeviceId = (deviceId && /^[a-f0-9]{64}$/.test(deviceId)) ? deviceId : null;

    if (isLifetime) {
      await pool.query(
        `INSERT INTO subscriptions (user_id, paystack_customer_code, status, plan, current_period_end, locked_device_id, updated_at)
         VALUES ($1, $2, 'active', $3, $4, $5, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           paystack_customer_code = $2,
           status = 'active',
           plan = $3,
           current_period_end = $4,
           locked_device_id = $5,
           updated_at = NOW()`,
        [userId, txData.customer.customer_code, plan, '2099-12-31T23:59:59.000Z', lockedDeviceId],
      );
    } else {
      const provisionalEnd = new Date();
      provisionalEnd.setDate(provisionalEnd.getDate() + 30);
      await pool.query(
        `INSERT INTO subscriptions (user_id, paystack_customer_code, status, plan, current_period_end, locked_device_id, updated_at)
         VALUES ($1, $2, 'active', $3, $4, $5, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           paystack_customer_code = $2,
           status = 'active',
           plan = $3,
           current_period_end = $4,
           locked_device_id = $5,
           updated_at = NOW()`,
        [userId, txData.customer.customer_code, plan, provisionalEnd.toISOString(), lockedDeviceId],
      );
    }

    this.invalidateDeviceCache(userId);

    const userResult = await pool.query<{ email: string; name: string | null }>(
      `SELECT email, name FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    const user = userResult.rows[0];
    if (user) {
      void this.emailService.sendPaymentConfirmation(user.email, user.name ?? 'there', plan);
    }

    return { success: true };
  }

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) throw new InternalServerErrorException('Paystack not configured');

    const hash = createHmac('sha512', secretKey).update(rawBody).digest('hex');
    if (hash !== signature) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = JSON.parse(rawBody.toString()) as WebhookEvent;
    const pool = getDB();

    if (event.event === 'subscription.create') {
      const data = event.data as SubscriptionCreateData;
      const plan = 'monthly';
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
        throw new BadRequestException('Subscription row not found; Paystack will retry');
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
      await pool.query(
        `UPDATE subscriptions SET
           status = 'active',
           current_period_start = $1,
           current_period_end = $2,
           updated_at = NOW()
         WHERE paystack_customer_code = $3`,
        [
          new Date(data.paid_at).toISOString(),
          new Date(data.subscription.next_payment_date).toISOString(),
          data.subscription.customer.customer_code,
        ],
      );
    } else if (event.event === 'invoice.payment_failed') {
      const data = event.data as InvoicePaymentFailedData;
      const upd = await pool.query<{ user_id: string }>(
        `UPDATE subscriptions SET status = 'past_due', updated_at = NOW()
         WHERE paystack_customer_code = $1
         RETURNING user_id`,
        [data.subscription.customer.customer_code],
      );
      if (upd.rows[0]) {
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
