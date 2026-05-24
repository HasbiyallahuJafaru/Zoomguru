import { Injectable, BadRequestException } from '@nestjs/common';
import { getDB } from '../database/db';

// In-memory bank list cache — refreshed every 24 hours
let banksCache: { id: number; name: string; code: string }[] | null = null;
let banksCachedAt = 0;

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
      referralLink: user?.referral_code ? `https://zoomguru.xyz/?ref=${user.referral_code}` : null,
      balance: balance ?? { total_earned: 0, pending_balance: 0, total_paid: 0, currency: 'NGN' },
      referrals,
    };
  }

  async getBanks(): Promise<{ id: number; name: string; code: string }[]> {
    const TTL = 24 * 60 * 60 * 1000;
    if (banksCache && Date.now() - banksCachedAt < TTL) return banksCache;

    const res = await fetch('https://api.paystack.co/bank?country=nigeria&perPage=100&use_cursor=false', {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    });
    const data = await res.json();
    if (!data.status) throw new BadRequestException('Could not fetch bank list');

    banksCache = (data.data as any[]).map(b => ({ id: b.id, name: b.name, code: b.code }));
    banksCachedAt = Date.now();
    return banksCache!;
  }

  async verifyBankAccount(accountNumber: string, bankCode: string): Promise<{ accountName: string; accountNumber: string; bankCode: string }> {
    if (!/^\d{10}$/.test(accountNumber)) {
      throw new BadRequestException('Account number must be exactly 10 digits');
    }

    const res = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } },
    );
    const data = await res.json();

    if (!data.status) {
      throw new BadRequestException(data.message || 'Account could not be verified. Check the number and bank.');
    }

    return {
      accountName: data.data.account_name,
      accountNumber: data.data.account_number,
      bankCode,
    };
  }

  async requestPayout(userId: string, params: {
    amount: number;
    currency: string;
    bankName: string;
    bankCode: string;
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
      INSERT INTO payout_requests (user_id, amount, currency, bank_name, bank_code, account_number, account_name)
      VALUES (${userId}, ${params.amount}, ${params.currency}, ${params.bankName}, ${params.bankCode}, ${params.accountNumber}, ${params.accountName})
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
