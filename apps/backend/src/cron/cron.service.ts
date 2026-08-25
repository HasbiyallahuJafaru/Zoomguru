import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EmailService } from '../email/email.service';
import { QuotaService } from '../quota/quota.service';
import { getDB } from '../database/db';
import { getRedis } from '../redis/redis';

interface ReminderRow {
  email: string;
  name: string | null;
  current_period_end: string;
  days_remaining: number;
}

interface FollowUpRow {
  email: string;
  name: string | null;
}

interface UsageResetRow {
  user_id: string;
  plan: string;
  current_period_start: string | null;
  created_at: string;
}

@Injectable()
export class CronService {
  constructor(
    private readonly emailService: EmailService,
    private readonly quotaService: QuotaService,
  ) {}

  // Settle lapsed subscriptions once a day, shortly after midnight UTC.
  //
  // Nothing else moves a subscription off 'active' — that only happens when
  // Paystack delivers a webhook, so a missed delivery leaves a row 'active'
  // forever. Every read path then has to re-derive expiry from the date, and
  // any path that forgets reports a lapsed customer as active. That is what
  // made expired users show as active in the admin table.
  //
  // Expiring the row makes the stored state true, so no future query needs to
  // know the rule. The read-time checks in subscription.service.ts stay as
  // defence in depth: this job can fail, and access must not depend on it.
  //
  // Safe to run concurrently despite the crons having no distributed lock —
  // the WHERE clause excludes rows it has already updated, so a second run is
  // a no-op rather than a double-charge or a duplicate email.
  @Cron('15 0 * * *', { timeZone: 'UTC' })
  async expireLapsedSubscriptions(): Promise<void> {
    try {
      const pool = getDB();
      const result = await pool.query(
        `UPDATE subscriptions
            SET status = 'inactive', updated_at = NOW()
          WHERE status = 'active'
            AND current_period_end IS NOT NULL
            AND current_period_end <= NOW()`,
      );
      if (result.rowCount) {
        console.log(`[CronService] expired ${result.rowCount} lapsed subscription(s)`);
      }
    } catch (err) {
      console.error('[CronService] expireLapsedSubscriptions failed:', err);
    }
  }

  @Cron('0 11 * * *', { timeZone: 'UTC' })
  async sendNoPaymentFollowUps(): Promise<void> {
    const pool = getDB();
    try {
      const result = await pool.query<FollowUpRow>(`
        SELECT u.email, u.name
        FROM users u
        LEFT JOIN subscriptions s ON s.user_id = u.id
        WHERE u.created_at BETWEEN NOW() - INTERVAL '48 hours' AND NOW() - INTERVAL '24 hours'
          AND (s.status IS NULL OR s.status NOT IN ('active'))
      `);
      for (const row of result.rows) {
        void this.emailService.sendFollowUp(row.email, row.name ?? 'there');
      }
    } catch (err) {
      console.error('[CronService] sendNoPaymentFollowUps failed:', err);
    }
  }

  @Cron('0 9 * * *', { timeZone: 'UTC' })
  async sendExpiryReminders(): Promise<void> {
    const pool = getDB();
    try {
      const result = await pool.query<ReminderRow>(`
        SELECT u.email, u.name, s.current_period_end,
               EXTRACT(DAY FROM (s.current_period_end - NOW()))::int AS days_remaining
        FROM subscriptions s
        JOIN users u ON u.id = s.user_id
        WHERE s.status = 'active'
          AND s.plan = 'monthly'
          AND s.current_period_end IS NOT NULL
          AND s.current_period_end > NOW()
          AND s.current_period_end <= NOW() + INTERVAL '3 days 1 hour'
      `);

      for (const row of result.rows) {
        if (row.days_remaining == null) continue;
        const days = row.days_remaining;
        const name = row.name ?? 'there';
        const periodEnd = row.current_period_end;
        if (days >= 3) {
          void this.emailService.sendExpiryReminder(row.email, name, 3, periodEnd);
        } else {
          void this.emailService.sendExpiryReminder(row.email, name, 1, periodEnd);
        }
      }
    } catch (err) {
      console.error('[CronService] sendExpiryReminders failed:', err);
    }
  }

  // Resets weekly usage for users whose 7-day window has elapsed.
  @Cron('0 1 * * *', { timeZone: 'UTC' })
  async resetWeeklyUsage(): Promise<void> {
    const pool = getDB();
    try {
      const result = await pool.query<UsageResetRow>(`
        SELECT s.user_id, s.plan, s.current_period_start, s.created_at
        FROM subscriptions s
        JOIN usage u ON u.user_id = s.user_id
        WHERE s.status = 'active'
          AND s.plan = 'weekly'
          AND u.period_start + INTERVAL '7 days' <= NOW()
      `);
      for (const row of result.rows) {
        const periodStart = row.current_period_start
          ? new Date(row.current_period_start)
          : new Date(row.created_at);
        await this.quotaService.resetUserUsage(row.user_id, 'weekly', periodStart);
      }
    } catch (err) {
      console.error('[CronService] resetWeeklyUsage failed:', err);
    }
  }

  // Resets monthly/yearly usage for users whose 30-day window has elapsed.
  // Yearly plans use rolling monthly windows internally.
  @Cron('0 2 * * *', { timeZone: 'UTC' })
  async resetMonthlyUsage(): Promise<void> {
    const pool = getDB();
    try {
      const result = await pool.query<UsageResetRow>(`
        SELECT s.user_id, s.plan, s.current_period_start, s.created_at
        FROM subscriptions s
        JOIN usage u ON u.user_id = s.user_id
        WHERE s.status = 'active'
          AND s.plan IN ('monthly', 'yearly')
          AND u.period_start + INTERVAL '30 days' <= NOW()
      `);
      for (const row of result.rows) {
        const planType = row.plan as 'monthly' | 'yearly';
        const periodStart = row.current_period_start
          ? new Date(row.current_period_start)
          : new Date(row.created_at);
        await this.quotaService.resetUserUsage(row.user_id, planType, periodStart);
      }
    } catch (err) {
      console.error('[CronService] resetMonthlyUsage failed:', err);
    }
  }

  @Cron('*/30 * * * * *')
  async flushSessionLogQueue(): Promise<void> {
    const redis = getRedis();
    const BATCH = 100;
    try {
      const entries = await redis.lrange('session_log_queue', -BATCH, -1);
      if (entries.length === 0) return;
      await redis.ltrim('session_log_queue', 0, -(entries.length + 1));

      type Entry = { userId: string; type: string; ts: number };
      const rows: Entry[] = [];
      for (const raw of entries) {
        try { rows.push(JSON.parse(raw) as Entry); } catch { /* skip malformed */ }
      }
      if (rows.length === 0) return;

      const values: unknown[] = [];
      const placeholders = rows.map((r, i) => {
        values.push(r.userId, r.type, new Date(r.ts));
        const base = i * 3;
        return `($${base + 1}, $${base + 2}, $${base + 3})`;
      });
      await getDB().query(
        `INSERT INTO ai_sessions (user_id, type, created_at) VALUES ${placeholders.join(',')} ON CONFLICT DO NOTHING`,
        values,
      );
    } catch (err) {
      console.error('[CronService] flushSessionLogQueue failed:', err);
    }
  }
}
