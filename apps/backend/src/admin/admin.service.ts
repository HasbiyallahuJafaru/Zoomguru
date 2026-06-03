import { Injectable } from '@nestjs/common';
import { getDB } from '../database/db';

// Keep in sync with apps/admin/src/types.ts
export interface StatsResult {
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

@Injectable()
export class AdminService {
  async getStats(): Promise<StatsResult> {
    const pool = getDB();
    const [users, downloads, monthlySubs, lifetimeSubs, sessions] = await Promise.all([
      pool.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM users'),
      pool.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM downloads'),
      pool.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM subscriptions WHERE status = 'active' AND plan = 'monthly'`,
      ),
      pool.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM subscriptions WHERE status = 'active' AND plan = 'yearly'`,
      ),
      pool.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM ai_sessions'),
    ]);
    return {
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

  async getUsers(offset = 0): Promise<UserRow[]> {
    const pool = getDB();
    const result = await pool.query<UserRow>(
      `SELECT u.id, u.email, u.name, u.created_at::text AS created_at, s.plan, s.status
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id
       ORDER BY u.created_at DESC
       LIMIT 50 OFFSET $1`,
      [offset],
    );
    return result.rows;
  }
}
