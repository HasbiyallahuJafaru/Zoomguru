import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { getDB } from '../database/db';

const PAYSTACK_BASE = 'https://api.paystack.co';

interface PaystackBankEntry {
  code: string;
  name: string;
}

interface PaystackBanksResponse {
  status: boolean;
  data: PaystackBankEntry[];
}

interface PaystackResolveResponse {
  status: boolean;
  data: {
    account_name: string;
    account_number: string;
  };
}

interface DashboardRow {
  referral_code: string | null;
  pending_kobo: string | null;
}

interface BankAccountRow {
  account_number: string;
  bank_code: string;
  bank_name: string;
  account_name: string;
}

@Injectable()
export class ReferralService {
  async getDashboard(userId: string): Promise<{
    referralCode: string | null;
    thisMonthCount: number;
    allTimeCount: number;
    pendingCommissionKobo: number;
    bank: { accountNumber: string; bankName: string; accountName: string } | null;
  }> {
    const pool = getDB();

    const [userResult, thisMonthResult, allTimeResult, bankResult] = await Promise.all([
      pool.query<DashboardRow>(
        `SELECT referral_code,
                COALESCE((
                  SELECT SUM(amount_kobo)::text
                  FROM referral_commissions
                  WHERE referrer_user_id = $1 AND status = 'pending'
                ), '0') AS pending_kobo
         FROM users WHERE id = $1 LIMIT 1`,
        [userId],
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM referral_commissions
         WHERE referrer_user_id = $1
           AND created_at >= DATE_TRUNC('month', NOW())`,
        [userId],
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM referral_commissions
         WHERE referrer_user_id = $1`,
        [userId],
      ),
      pool.query<BankAccountRow>(
        `SELECT account_number, bank_code, bank_name, account_name
         FROM referral_bank_accounts WHERE user_id = $1 LIMIT 1`,
        [userId],
      ),
    ]);

    const row = userResult.rows[0];
    const bankRow = bankResult.rows[0] ?? null;

    return {
      referralCode: row?.referral_code ?? null,
      thisMonthCount: parseInt(thisMonthResult.rows[0]?.count ?? '0', 10),
      allTimeCount: parseInt(allTimeResult.rows[0]?.count ?? '0', 10),
      pendingCommissionKobo: parseInt(row?.pending_kobo ?? '0', 10),
      bank: bankRow
        ? {
            accountNumber: bankRow.account_number,
            bankName: bankRow.bank_name,
            accountName: bankRow.account_name,
          }
        : null,
    };
  }

  async listBanks(): Promise<{ code: string; name: string }[]> {
    const secretKey = process.env['PAYSTACK_SECRET_KEY'];
    if (!secretKey) throw new InternalServerErrorException('Paystack not configured');

    const res = await fetch(`${PAYSTACK_BASE}/bank?country=nigeria&per_page=100`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    if (!res.ok) throw new InternalServerErrorException('Could not fetch banks');

    const body = (await res.json()) as PaystackBanksResponse;
    return body.data.map((b) => ({ code: b.code, name: b.name }));
  }

  async verifyAccount(
    accountNumber: string,
    bankCode: string,
  ): Promise<{ accountName: string; accountNumber: string; bankCode: string }> {
    const secretKey = process.env['PAYSTACK_SECRET_KEY'];
    if (!secretKey) throw new InternalServerErrorException('Paystack not configured');

    const url = `${PAYSTACK_BASE}/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });

    if (!res.ok) throw new BadRequestException('Could not verify account. Check account number and bank.');

    const body = (await res.json()) as PaystackResolveResponse;
    if (!body.status || !body.data?.account_name) {
      throw new BadRequestException('Account not found');
    }

    return {
      accountName: body.data.account_name,
      accountNumber: body.data.account_number,
      bankCode,
    };
  }

  async saveBank(
    userId: string,
    accountNumber: string,
    bankCode: string,
    bankName: string,
    accountName: string,
  ): Promise<void> {
    const pool = getDB();
    await pool.query(
      `INSERT INTO referral_bank_accounts
         (user_id, account_number, bank_code, bank_name, account_name, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         account_number = $2,
         bank_code      = $3,
         bank_name      = $4,
         account_name   = $5,
         updated_at     = NOW()`,
      [userId, accountNumber, bankCode, bankName, accountName],
    );
  }

  async requestPayout(userId: string): Promise<{ message: string }> {
    const pool = getDB();

    const pendingResult = await pool.query<{ total: string }>(
      `SELECT COALESCE(SUM(amount_kobo), 0)::text AS total
       FROM referral_commissions
       WHERE referrer_user_id = $1 AND status = 'pending'`,
      [userId],
    );
    const totalKobo = parseInt(pendingResult.rows[0]?.total ?? '0', 10);

    if (totalKobo === 0) {
      throw new BadRequestException('No pending commission to request');
    }

    const bankResult = await pool.query<{ id: string }>(
      `SELECT id FROM referral_bank_accounts WHERE user_id = $1 LIMIT 1`,
      [userId],
    );
    if (!bankResult.rows[0]) {
      throw new BadRequestException('Add a bank account before requesting a payout');
    }

    await pool.query(
      `UPDATE referral_commissions
       SET status = 'requested'
       WHERE referrer_user_id = $1 AND status = 'pending'`,
      [userId],
    );

    return { message: 'Payout request submitted. We will process it within 2 business days.' };
  }
}
