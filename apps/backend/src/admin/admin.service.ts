import { Injectable } from '@nestjs/common';
import { getDB } from '../database/db';
import { getRedis } from '../redis/redis';
import { apiUsageKey, apiBillingFailKey } from '../ai/ai.service';
import { countOnline } from '../auth/sessions';

// Keep in sync with apps/admin/src/types.ts
export interface StatsResult {
  online_now: number;
  total_users: number;
  total_downloads: number;
  active_subscriptions: number;
  yearly_subscriptions: number;
  total_ai_sessions: number;
}

export interface DailyCount {
  date: string;
  count: number;
}

export interface DailyPayments {
  date: string;
  monthly: number;
  yearly: number;
}

export interface DailyUsage {
  date: string;
  stream: number;
  screenshot: number;
  transcribe: number;
}

// Outbound calls per upstream AI provider, per day.
export interface DailyApiUsage {
  date: string;
  gemini: number;
  openrouter: number;
  groq: number;
  openai: number;
  lemonfox: number;
  other: number;
}

export const API_PROVIDERS = [
  'gemini',
  'openrouter',
  'groq',
  'openai',
  'lemonfox',
  'other',
] as const;

// One row per provider: what it cost you in calls, and whether it is currently
// refusing to serve. `balanceUsd` is always null now that DeepSeek is gone —
// no remaining provider publishes a balance — so billingFailures is the only
// warning that payment is due. The field is kept so the dashboard contract
// does not change.
export interface ApiHealthRow {
  provider: string;
  calls30d: number;
  callsToday: number;
  billingFailures30d: number;
  billingFailuresToday: number;
  balanceUsd: string | null;
  balanceNote: string;
}

export interface DailyDownloads {
  date: string;
  windows: number;
  mac: number;
}

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
  plan: string | null;
  status: string | null;
}

export interface ReferralCommissionRow {
  referrer_email: string;
  referrer_name: string | null;
  referral_count: number;
  total_naira: number;
  pending_naira: number;
  account_name: string | null;
  account_number: string | null;
  bank_name: string | null;
  bank_code: string | null;
}

// SQL mirror of isSubActive() in subscription.service.ts.
//
// A subscription can sit at status 'active' with an elapsed period, because
// nothing expires it on a timer — status only moves when Paystack delivers a
// webhook. The API paths already re-check the date at read time; these admin
// queries are raw SQL and would otherwise keep reporting those rows as active,
// which is exactly what made expired users appear active in the users table
// and inflated the subscription tiles.
//
// A null period_end counts as active so lifetime plans are not excluded.
const subActiveSql = (alias = ''): string => {
  const p = alias ? `${alias}.` : '';
  return `(${p}status = 'active' AND (${p}current_period_end IS NULL OR ${p}current_period_end > NOW()))`;
};

@Injectable()
export class AdminService {
  async getStats(): Promise<StatsResult> {
    const pool = getDB();
    const [users, downloads, monthlySubs, lifetimeSubs, sessions, online] = await Promise.all([
      pool.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM users'),
      pool.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM downloads'),
      // Every active plan, not just monthly. This counted `plan = 'monthly'`
      // only, so weekly subscribers — the most common plan — were missing from
      // the "Active Subs" tile entirely.
      pool.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM subscriptions WHERE ${subActiveSql()}`,
      ),
      pool.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM subscriptions WHERE ${subActiveSql()} AND plan = 'yearly'`,
      ),
      pool.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM ai_sessions'),
      // Redis, not Postgres: who is online is live state the session cap
      // already keeps. Nothing writes it for this — see countOnline().
      countOnline(),
    ]);
    return {
      online_now: online,
      total_users: users.rows[0].count,
      total_downloads: downloads.rows[0].count,
      active_subscriptions: monthlySubs.rows[0].count,
      yearly_subscriptions: lifetimeSubs.rows[0].count,
      total_ai_sessions: sessions.rows[0].count,
    };
  }

  async getSignups(days: number): Promise<DailyCount[]> {
    const pool = getDB();
    const result = await pool.query<{ date: string; count: number }>(
      `SELECT DATE(created_at)::text AS date, COUNT(*)::int AS count
       FROM users
       WHERE created_at >= NOW() - INTERVAL '1 day' * $1
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [days],
    );
    return result.rows;
  }

  async getPayments(days: number): Promise<DailyPayments[]> {
    const pool = getDB();
    const result = await pool.query<{ date: string; plan: string; count: number }>(
      `SELECT DATE(current_period_start)::text AS date, plan, COUNT(*)::int AS count
       FROM subscriptions
       WHERE status = 'active'
         AND current_period_start IS NOT NULL
         AND current_period_start >= NOW() - INTERVAL '1 day' * $1
       GROUP BY DATE(current_period_start), plan
       ORDER BY date`,
      [days],
    );
    const map = new Map<string, DailyPayments>();
    for (const row of result.rows) {
      if (!map.has(row.date)) {
        map.set(row.date, { date: row.date, monthly: 0, yearly: 0 });
      }
      const entry = map.get(row.date)!;
      if (row.plan === 'monthly') entry.monthly = row.count;
      else if (row.plan === 'yearly') entry.yearly = row.count;
    }
    return Array.from(map.values());
  }

  async getUsage(days: number): Promise<DailyUsage[]> {
    const pool = getDB();
    const result = await pool.query<{ date: string; type: string; count: number }>(
      `SELECT DATE(created_at)::text AS date, type, COUNT(*)::int AS count
       FROM ai_sessions
       WHERE created_at >= NOW() - INTERVAL '1 day' * $1
       GROUP BY DATE(created_at), type
       ORDER BY date`,
      [days],
    );
    const map = new Map<string, DailyUsage>();
    for (const row of result.rows) {
      if (!map.has(row.date)) {
        map.set(row.date, { date: row.date, stream: 0, screenshot: 0, transcribe: 0 });
      }
      const entry = map.get(row.date)!;
      if (row.type === 'stream') entry.stream = row.count;
      else if (row.type === 'screenshot') entry.screenshot = row.count;
      else if (row.type === 'transcribe') entry.transcribe = row.count;
    }
    return Array.from(map.values());
  }

  // Outbound calls per AI provider, read straight from the Redis counters that
  // trackedFetch() writes. One MGET covers the whole window.
  //
  // A missing key means no calls that day, not an error — days before this was
  // deployed simply read as zero rather than being hidden, so the chart does
  // not imply usage stopped. History is capped at 90 days by the key TTL.
  async getApiUsage(days: number): Promise<DailyApiUsage[]> {
    const dates: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      dates.push(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10));
    }

    const keys = dates.flatMap((d) => API_PROVIDERS.map((p) => apiUsageKey(d, p)));
    if (keys.length === 0) return [];

    let values: Array<string | null>;
    try {
      values = await getRedis().mget(...keys);
    } catch {
      // Redis unavailable — report an empty series rather than 500ing the
      // whole admin dashboard over a secondary metric.
      return [];
    }

    return dates.map((date, dayIndex) => {
      const row = { date } as DailyApiUsage;
      API_PROVIDERS.forEach((provider, providerIndex) => {
        const raw = values[dayIndex * API_PROVIDERS.length + providerIndex];
        row[provider] = raw ? parseInt(raw, 10) || 0 : 0;
      });
      return row;
    });
  }

  // Answers "which APIs am I using, and which one needs paying?" in one call.
  //
  // No provider left exposes a balance endpoint, so the honest answer is that
  // no balance exists to read and billingFailures is what tells you an account
  // has run dry.
  async getApiHealth(): Promise<ApiHealthRow[]> {
    const today = new Date().toISOString().slice(0, 10);
    const days: string[] = [];
    for (let i = 29; i >= 0; i--) {
      days.push(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10));
    }

    let usage: Array<string | null> = [];
    let fails: Array<string | null> = [];
    try {
      const redis = getRedis();
      [usage, fails] = await Promise.all([
        redis.mget(...days.flatMap((d) => API_PROVIDERS.map((p) => apiUsageKey(d, p)))),
        redis.mget(...days.flatMap((d) => API_PROVIDERS.map((p) => apiBillingFailKey(d, p)))),
      ]);
    } catch {
      /* fall through with zeroes rather than failing the dashboard */
    }

    const sum = (arr: Array<string | null>, providerIndex: number, onlyDay?: string): number => {
      let total = 0;
      days.forEach((d, dayIndex) => {
        if (onlyDay && d !== onlyDay) return;
        const raw = arr[dayIndex * API_PROVIDERS.length + providerIndex];
        total += raw ? parseInt(raw, 10) || 0 : 0;
      });
      return total;
    };

    return API_PROVIDERS.filter((p) => p !== 'other').map((provider, index) => ({
      provider,
      calls30d: sum(usage, index),
      callsToday: sum(usage, index, today),
      billingFailures30d: sum(fails, index),
      billingFailuresToday: sum(fails, index, today),
      balanceUsd: null,
      balanceNote: 'No balance API — watch billing failures',
    }));
  }

  async getDownloads(days: number): Promise<DailyDownloads[]> {
    const pool = getDB();
    const result = await pool.query<{ date: string; platform: string; count: number }>(
      `SELECT DATE(created_at)::text AS date, platform, COUNT(*)::int AS count
       FROM downloads
       WHERE created_at >= NOW() - INTERVAL '1 day' * $1
       GROUP BY DATE(created_at), platform
       ORDER BY date`,
      [days],
    );
    const map = new Map<string, DailyDownloads>();
    for (const row of result.rows) {
      if (!map.has(row.date)) {
        map.set(row.date, { date: row.date, windows: 0, mac: 0 });
      }
      const entry = map.get(row.date)!;
      if (row.platform === 'windows') entry.windows = row.count;
      else if (row.platform === 'mac') entry.mac = row.count;
    }
    return Array.from(map.values());
  }

  async getReferrals(): Promise<ReferralCommissionRow[]> {
    const pool = getDB();
    const result = await pool.query<ReferralCommissionRow>(
      `SELECT
         u.email                                       AS referrer_email,
         u.name                                        AS referrer_name,
         COUNT(rc.id)::int                             AS referral_count,
         (SUM(rc.amount_kobo) / 100)::int              AS total_naira,
         (SUM(CASE WHEN rc.status IN ('pending','requested')
                   THEN rc.amount_kobo ELSE 0 END) / 100)::int AS pending_naira,
         rba.account_name,
         rba.account_number,
         rba.bank_name,
         rba.bank_code
       FROM referral_commissions rc
       JOIN users u ON u.id = rc.referrer_user_id
       LEFT JOIN referral_bank_accounts rba ON rba.user_id = rc.referrer_user_id
       GROUP BY u.id, u.email, u.name, rba.account_name, rba.account_number, rba.bank_name, rba.bank_code
       ORDER BY pending_naira DESC, total_naira DESC`,
    );
    return result.rows;
  }

  async getUsers(offset = 0): Promise<UserRow[]> {
    const pool = getDB();
    const result = await pool.query<UserRow>(
      `SELECT u.id, u.email, u.name, u.created_at::text AS created_at, s.plan,
              CASE
                WHEN ${subActiveSql('s')}    THEN s.status
                WHEN s.status = 'active'     THEN 'inactive'
                ELSE s.status
              END AS status
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id
       ORDER BY u.created_at DESC
       LIMIT 50 OFFSET $1`,
      [offset],
    );
    return result.rows;
  }
}
