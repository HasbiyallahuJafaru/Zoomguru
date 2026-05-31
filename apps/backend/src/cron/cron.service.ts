import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EmailService } from '../email/email.service';
import { getDB } from '../database/db';

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

@Injectable()
export class CronService {
  constructor(private readonly emailService: EmailService) {}

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
        const days = row.days_remaining;
        const name = row.name ?? 'there';
        const periodEnd = row.current_period_end;
        if (days >= 2) {
          void this.emailService.sendExpiryReminder(row.email, name, 3, periodEnd);
        } else {
          void this.emailService.sendExpiryReminder(row.email, name, 1, periodEnd);
        }
      }
    } catch (err) {
      console.error('[CronService] sendExpiryReminders failed:', err);
    }
  }
}
