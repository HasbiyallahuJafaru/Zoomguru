import { Injectable, BadRequestException } from '@nestjs/common';
import { getDB } from '../database/db';

@Injectable()
export class ReferralService {
  async getStats(userId: string) {
    const sql = getDB();

    const [balance] = await sql`
      SELECT total_earned, pending_balance, total_paid, currency
      FROM referral_balances
      WHERE user_id = ${userId}
    `;

    const referrals = await sql`
      SELECT r.status, r.commission_amount, r.currency, r.created_at,
             u.email AS referred_email
      FROM referrals r
      JOIN users u ON u.id = r.referred_id
      WHERE r.referrer_id = ${userId}
      ORDER BY r.created_at DESC
      LIMIT 50
    `;

    const [user] = await sql`
      SELECT referral_code FROM users WHERE id = ${userId}
    `;

    return {
      referralCode: user?.referral_code ?? null,
      referralLink: user?.referral_code ? `https://zoomguru.com/?ref=${user.referral_code}` : null,
      balance: balance ?? { total_earned: 0, pending_balance: 0, total_paid: 0, currency: 'NGN' },
      referrals,
    };
  }

  async requestPayout(userId: string, params: {
    amount: number;
    currency: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
  }) {
    const sql = getDB();

    const [balance] = await sql`
      SELECT pending_balance, currency FROM referral_balances WHERE user_id = ${userId}
    `;

    if (!balance || balance.pending_balance < params.amount) {
      throw new BadRequestException('Insufficient balance for payout');
    }

    if (params.amount < 1000) {
      throw new BadRequestException('Minimum payout is ₦1,000');
    }

    await sql`
      INSERT INTO payout_requests (user_id, amount, currency, bank_name, account_number, account_name)
      VALUES (${userId}, ${params.amount}, ${params.currency}, ${params.bankName}, ${params.accountNumber}, ${params.accountName})
    `;

    // Deduct from pending balance immediately (hold state)
    await sql`
      UPDATE referral_balances
      SET pending_balance = pending_balance - ${params.amount},
          updated_at = NOW()
      WHERE user_id = ${userId}
    `;

    return { success: true, message: 'Payout request submitted. Processing within 2-3 business days.' };
  }
}
