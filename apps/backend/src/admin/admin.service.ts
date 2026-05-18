import { Injectable } from '@nestjs/common';
import { getDB } from '../database/db';

@Injectable()
export class AdminService {

  async getStats() {
    const sql = getDB();

    const [revenue] = await sql`
      SELECT
        COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '1 day'
          THEN amount END), 0) AS today,
        COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days'
          THEN amount END), 0) AS this_week,
        COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '30 days'
          THEN amount END), 0) AS this_month,
        COALESCE(SUM(amount), 0) AS total
      FROM payments
      WHERE status = 'success'
    `;

    const [users] = await sql`
      SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN is_pro THEN 1 END) AS pro,
        COUNT(CASE WHEN NOT is_pro THEN 1 END) AS free
      FROM users
    `;

    const plans = await sql`
      SELECT plan, currency, COUNT(*) AS count, SUM(amount) AS revenue
      FROM payments
      WHERE status = 'success'
      GROUP BY plan, currency
      ORDER BY revenue DESC
    `;

    const [sessions] = await sql`
      SELECT
        COUNT(CASE WHEN started_at >= NOW() - INTERVAL '1 day'
          THEN 1 END) AS today,
        ROUND(AVG(duration_seconds)) AS avg_duration_seconds,
        ROUND(AVG(total_questions)) AS avg_questions
      FROM interview_sessions
      WHERE ended_at IS NOT NULL
    `;

    // Referrals table may not exist yet — fail gracefully
    let referrals = { total: 0, converted: 0, pending_payouts_ngn: 0 };
    try {
      const [row] = await sql`
        SELECT
          COUNT(*) AS total,
          COUNT(CASE WHEN status = 'earned' THEN 1 END) AS converted,
          COALESCE(SUM(CASE WHEN status = 'pending'
            THEN commission_amount END), 0) AS pending_payouts_ngn
        FROM referrals
      `;
      referrals = row;
    } catch {
      // Table doesn't exist yet — return zeroes
    }

    const recentErrors = await sql`
      SELECT endpoint, error_message, created_at
      FROM error_logs
      ORDER BY created_at DESC
      LIMIT 10
    `;

    return {
      revenue,
      users,
      plans,
      sessions,
      referrals,
      recentErrors,
      generatedAt: new Date().toISOString(),
    };
  }

  async logError(data: {
    endpoint?: string;
    method?: string;
    errorMessage: string;
    stackTrace?: string;
    userId?: string;
    statusCode?: number;
  }): Promise<void> {
    try {
      const sql = getDB();
      await sql`
        INSERT INTO error_logs
          (endpoint, method, error_message, stack_trace, user_id, status_code)
        VALUES
          (${data.endpoint || null}, ${data.method || null},
           ${data.errorMessage}, ${data.stackTrace || null},
           ${data.userId || null}, ${data.statusCode || null})
      `;
    } catch {
      // Never throw from error logger
    }
  }
}
