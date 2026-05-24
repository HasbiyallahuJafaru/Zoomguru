import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { getDB, getPool } from '../database/db';

// Expected amounts in kobo (NGN × 100) — source of truth for plan validation
const PLAN_AMOUNTS_KOBO: Record<string, number> = {
  monthly: 1_500_000,
  lifetime: 10_000_000,
};

@Injectable()
export class PaystackService {

  private get secretKey(): string {
    return process.env.PAYSTACK_SECRET_KEY || '';
  }

  private get webhookSecret(): string {
    // Fall back to secretKey if a separate webhook secret is not configured.
    // Paystack signs webhooks with the API secret key by default.
    return process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY || '';
  }

  async initializeTransaction(params: {
    userId: string;
    email: string;
    plan: 'monthly' | 'lifetime';
  }) {
    const { userId, email, plan } = params;

    const isMonthly = plan === 'monthly';

    // Paystack uses kobo (1 NGN = 100 kobo)
    const amount = isMonthly ? 1500000 : 10000000;

    const body: any = {
      email,
      amount,
      currency: 'NGN',
      metadata: {
        user_id: userId,
        plan,
        cancel_action: 'https://zoomguru.xyz/pricing',
      },
      callback_url: 'https://zoomguru.xyz/payment/success',
    };

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!data.status) {
      throw new BadRequestException(data.message || 'Paystack initialization failed');
    }

    // Record pending payment in DB
    const sql = getDB();
    await sql`
      INSERT INTO payments (user_id, paystack_reference, amount, currency, plan, status)
      VALUES (
        ${userId},
        ${data.data.reference},
        ${amount / 100},
        'NGN',
        ${plan},
        'pending'
      )
      ON CONFLICT (paystack_reference) DO NOTHING
    `;

    return {
      authorizationUrl: data.data.authorization_url,
      reference: data.data.reference,
    };
  }

  async verifyAndActivate(reference: string, userId: string) {
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${this.secretKey}` } }
    );
    const data = await response.json();

    if (!data.status || data.data?.status !== 'success') {
      throw new BadRequestException(data.message || 'Payment verification failed');
    }

    // Verify the payment belongs to the authenticated user — never override with caller's userId
    const metaUserId = data.data?.metadata?.user_id;
    if (!metaUserId || metaUserId !== userId) {
      throw new BadRequestException('Payment does not belong to this account');
    }

    await this.activateLicense(data.data);
    return { success: true };
  }

  async handleWebhook(signature: string, body: any, rawBody?: Buffer) {
    // Verify Paystack HMAC SHA512 signature against raw bytes (Paystack signs raw request body)
    const payload = rawBody ?? Buffer.from(JSON.stringify(body));
    const hash = crypto
      .createHmac('sha512', this.webhookSecret)
      .update(payload)
      .digest('hex');

    if (hash !== signature) {
      throw new BadRequestException('Invalid webhook signature');
    }

    // Idempotency check — block replayed webhooks
    const sql = getDB();
    const reference = body?.data?.reference;

    if (reference) {
      const [existing] = await sql`
        SELECT id FROM payments
        WHERE paystack_reference = ${reference}
        AND status = 'success'
        LIMIT 1
      `;

      if (existing) {
        return { received: true, duplicate: true };
      }
    }

    const event = body.event;
    const data = body.data;

    if (event === 'charge.success' || event === 'subscription.create') {
      await this.activateLicense(data);
    }

    if (event === 'invoice.payment_failed') {
      console.warn(`Payment failed for reference: ${data.reference}`);
    }

    return { received: true };
  }

  private async activateLicense(data: any) {
    const userId = data.metadata?.user_id;
    const reference = data.reference;
    const paidKobo: number = data.amount || 0;

    if (!userId) {
      console.error('Webhook: no user_id in metadata');
      return;
    }

    // Derive plan from the verified paid amount — never trust metadata.plan
    const plan = paidKobo >= PLAN_AMOUNTS_KOBO.lifetime ? 'lifetime' : 'monthly';

    // Validate the paid amount meets the minimum expected for this plan
    if (paidKobo < PLAN_AMOUNTS_KOBO[plan]) {
      console.error(`Payment amount ${paidKobo} kobo insufficient for plan ${plan}`);
      return;
    }

    const amountNGN = paidKobo / 100;
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Atomic idempotency: only proceed if this reference is still pending.
      // Two concurrent calls compete here — only one gets a returned row.
      const idempotencyResult = await client.query(
        `UPDATE payments
         SET status = 'success', paystack_event = 'charge.success', updated_at = NOW()
         WHERE paystack_reference = $1 AND status = 'pending'
         RETURNING id`,
        [reference],
      );

      if (idempotencyResult.rowCount === 0) {
        // Already processed (webhook retry or concurrent call)
        await client.query('ROLLBACK');
        return;
      }

      await client.query(
        `UPDATE users
         SET is_pro = true, plan = $1, currency = 'NGN', updated_at = NOW()
         WHERE id = $2`,
        [plan, userId],
      );

      const expiresAt = plan === 'monthly'
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        : null;

      await client.query(
        `INSERT INTO licenses (user_id, plan, currency, amount, paystack_reference, status, expires_at, device_fingerprint)
         VALUES ($1, $2, 'NGN', $3, $4, 'active', $5, null)
         ON CONFLICT (paystack_reference) DO NOTHING`,
        [userId, plan, amountNGN, reference, expiresAt],
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Commission runs after the transaction commits to avoid nested transactions.
    // If it fails, the license is already activated — commission can be retried separately.
    await this.processReferralCommission(userId, amountNGN);
  }

  private async processReferralCommission(
    referredUserId: string,
    amountNGN: number,
  ): Promise<void> {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Atomic: claim the referral by moving it from pending→earned in one statement.
      // If two concurrent calls race here, only one gets a returned row.
      const commissionKobo = Math.round(amountNGN * 100 * 0.25); // stay integer, no float drift
      const commissionNGN = commissionKobo / 100;

      const referralResult = await client.query(
        `UPDATE referrals
         SET commission_amount = $1, currency = 'NGN', status = 'earned'
         WHERE referred_id = $2 AND status = 'pending'
         AND referrer_id != $2
         RETURNING referrer_id`,
        [commissionNGN, referredUserId],
      );

      if (referralResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return;
      }

      const referrerId = referralResult.rows[0].referrer_id;

      await client.query(
        `INSERT INTO referral_balances (user_id, total_earned, pending_balance, currency)
         VALUES ($1, $2, $2, 'NGN')
         ON CONFLICT (user_id) DO UPDATE SET
           total_earned = referral_balances.total_earned + $2,
           pending_balance = referral_balances.pending_balance + $2,
           updated_at = NOW()`,
        [referrerId, commissionNGN],
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

}
