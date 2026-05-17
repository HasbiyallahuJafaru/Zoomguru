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
    currency: 'NGN' | 'USD';
  }) {
    const { userId, email, plan, currency } = params;

    const isMonthly = plan === 'monthly';

    // Paystack uses kobo for NGN, cents for USD
    const amount = currency === 'NGN'
      ? (isMonthly ? 1500000 : 10000000)
      : (isMonthly ? 1200 : 7900);

    const body: any = {
      email,
      amount,
      currency,
      metadata: {
        user_id: userId,
        plan,
        cancel_action: 'https://zoomguru.com/pricing',
      },
      callback_url: 'https://zoomguru.com/payment/success',
    };

    // Monthly plans — attach Paystack plan code for subscriptions
    if (isMonthly) {
      body.plan = currency === 'NGN'
        ? process.env.PAYSTACK_NGN_MONTHLY_PLAN
        : process.env.PAYSTACK_USD_MONTHLY_PLAN;
    }

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
        ${currency},
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

  async handleWebhook(signature: string, body: any) {
    // 1. Verify Paystack HMAC SHA512 signature
    const hash = crypto
      .createHmac('sha512', this.webhookSecret)
      .update(JSON.stringify(body))
      .digest('hex');

    if (hash !== signature) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = body.event;
    const data = body.data;

    // 2. Route events
    if (event === 'charge.success' || event === 'subscription.create') {
      await this.activateLicense(data);
    }

    if (event === 'subscription.disable' || event === 'subscription.not_renew') {
      await this.deactivateLicense(data);
    }

    if (event === 'invoice.payment_failed') {
      // Log but don't deactivate immediately — Paystack will retry
      console.warn(`Payment failed for reference: ${data.reference}`);
    }

    return { received: true };
  }

  private async activateLicense(data: any) {
    const sql = getDB();

    const userId = data.metadata?.user_id;
    const reference = data.reference;
    const plan = data.metadata?.plan || 'monthly';
    const currency = data.currency;
    const amount = (data.amount || 0) / 100;

    if (!userId) {
      console.error('Webhook: no user_id in metadata', data);
      return;
    }

    // Activate user as Pro
    await sql`
      UPDATE users
      SET is_pro = true, plan = ${plan}, updated_at = NOW()
      WHERE id = ${userId}
    `;

    // Insert license record (device_fingerprint will be bound on first login)
    await sql`
      INSERT INTO licenses (
        user_id, plan, currency, amount, paystack_reference,
        status, expires_at, device_fingerprint
      )
      VALUES (
        ${userId},
        ${plan},
        ${currency},
        ${amount},
        ${reference},
        'active',
        ${plan === 'monthly' ? sql`NOW() + INTERVAL '30 days'` : null},
        ''
      )
      ON CONFLICT (paystack_reference) DO NOTHING
    `;

    // Update payment record
    await sql`
      UPDATE payments
      SET status = 'success', paystack_event = 'charge.success', updated_at = NOW()
      WHERE paystack_reference = ${reference}
    `;

    console.log(`License activated for user ${userId}, plan: ${plan}`);
  }

  private async deactivateLicense(data: any) {
    const sql = getDB();
    const reference = data.subscription_code || data.reference;

    await sql`
      UPDATE licenses
      SET status = 'cancelled'
      WHERE paystack_reference = ${reference}
    `;

    // Check if user still has another active license
    const [active] = await sql`
      SELECT l2.id FROM licenses l1
      JOIN licenses l2 ON l2.user_id = l1.user_id
      WHERE l1.paystack_reference = ${reference}
      AND l2.status = 'active'
      LIMIT 1
    `;

    if (!active) {
      await sql`
        UPDATE users
        SET is_pro = false
        WHERE id = (
          SELECT user_id FROM licenses WHERE paystack_reference = ${reference} LIMIT 1
        )
      `;
    }
  }
}
