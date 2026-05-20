import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { getDB } from '../database/db';

@Injectable()
export class PaystackService {

  private get secretKey(): string {
    return process.env.PAYSTACK_SECRET_KEY || '';
  }

  private get webhookSecret(): string {
    return process.env.PAYSTACK_WEBHOOK_SECRET || '';
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
        cancel_action: 'https://zoomguru.com/pricing',
      },
      callback_url: 'https://zoomguru.com/payment/success',
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

    // Inject the authenticated userId — don't trust metadata from the browser
    const txData = {
      ...data.data,
      metadata: { ...data.data.metadata, user_id: userId },
    };

    await this.activateLicense(txData);
    return { success: true };
  }

  async handleWebhook(signature: string, body: any) {
    // Verify Paystack HMAC SHA512 signature
    const hash = crypto
      .createHmac('sha512', this.webhookSecret)
      .update(JSON.stringify(body))
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
    const sql = getDB();

    const userId = data.metadata?.user_id;
    const reference = data.reference;
    const plan = data.metadata?.plan || 'monthly';
    const amount = (data.amount || 0) / 100;

    if (!userId) {
      console.error('Webhook: no user_id in metadata', data);
      return;
    }

    await sql`
      UPDATE users
      SET is_pro = true, plan = ${plan}, currency = 'NGN', updated_at = NOW()
      WHERE id = ${userId}
    `;

    await sql`
      INSERT INTO licenses (
        user_id, plan, currency, amount, paystack_reference,
        status, expires_at, device_fingerprint
      )
      VALUES (
        ${userId},
        ${plan},
        'NGN',
        ${amount},
        ${reference},
        'active',
        ${plan === 'monthly' ? sql`NOW() + INTERVAL '30 days'` : null},
        ''
      )
      ON CONFLICT (paystack_reference) DO NOTHING
    `;

    await sql`
      UPDATE payments
      SET status = 'success', paystack_event = 'charge.success', updated_at = NOW()
      WHERE paystack_reference = ${reference}
    `;

    await this.processReferralCommission(userId, amount);

    console.log(`License activated for user ${userId}, plan: ${plan}`);
  }

  private async processReferralCommission(
    referredUserId: string,
    amount: number,
  ): Promise<void> {
    const sql = getDB();

    const [referral] = await sql`
      SELECT id, referrer_id FROM referrals
      WHERE referred_id = ${referredUserId}
      AND status = 'pending'
      LIMIT 1
    `;

    if (!referral) return;

    const commission = parseFloat((amount * 0.25).toFixed(2));

    await sql`
      UPDATE referrals
      SET commission_amount = ${commission},
          currency = 'NGN',
          status = 'earned'
      WHERE id = ${referral.id}
    `;

    await sql`
      INSERT INTO referral_balances (user_id, total_earned, pending_balance, currency)
      VALUES (${referral.referrer_id}, ${commission}, ${commission}, 'NGN')
      ON CONFLICT (user_id) DO UPDATE SET
        total_earned = referral_balances.total_earned + ${commission},
        pending_balance = referral_balances.pending_balance + ${commission},
        updated_at = NOW()
    `;
  }

}
