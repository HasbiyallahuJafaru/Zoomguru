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
        COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '30 days' - INTERVAL '30 days'
          AND created_at < NOW() - INTERVAL '30 days'
          THEN amount END), 0) AS prev_month,
        COALESCE(SUM(amount), 0) AS total
      FROM payments
      WHERE status = 'success'
    `;

    const [users] = await sql`
      SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN is_pro THEN 1 END) AS pro,
        COUNT(CASE WHEN NOT is_pro THEN 1 END) AS free,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) AS new_7d,
        COUNT(CASE WHEN is_pro AND created_at >= NOW() - INTERVAL '7 days' THEN 1 END) AS converted_7d
      FROM users
    `;

    const [subscribers] = await sql`
      SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN plan = 'monthly' THEN 1 END) AS monthly,
        COUNT(CASE WHEN plan = 'lifetime' THEN 1 END) AS lifetime
      FROM users
      WHERE is_pro = true
    `;

    const [churn] = await sql`
      SELECT COUNT(*) AS churned_this_month
      FROM licenses
      WHERE status = 'expired'
      AND expires_at >= NOW() - INTERVAL '30 days'
      AND expires_at < NOW()
    `;

    let pendingPayouts = { count: 0, total: 0 };
    try {
      const [row] = await sql`
        SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
        FROM payout_requests
        WHERE status = 'pending'
      `;
      pendingPayouts = row;
    } catch { /* table may not exist */ }

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
    } catch { /* table may not exist */ }

    const recentSignups = await sql`
      SELECT id, email, name, username, plan, is_pro, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 10
    `;

    const recentErrors = await sql`
      SELECT endpoint, error_message, status_code, created_at
      FROM error_logs
      ORDER BY created_at DESC
      LIMIT 5
    `;

    return {
      revenue,
      users,
      subscribers,
      churn,
      pendingPayouts,
      plans,
      sessions,
      referrals,
      recentSignups,
      recentErrors,
      generatedAt: new Date().toISOString(),
    };
  }

  async getUsers(opts: { page: number; limit: number; search: string; plan: string; role: string }) {
    const sql = getDB();
    const offset = (opts.page - 1) * opts.limit;
    const search = `%${opts.search}%`;

    const users = await sql`
      SELECT
        u.id, u.email, u.name, u.username, u.is_pro, u.plan,
        u.role, u.avatar_url, u.created_at, u.last_login_at, u.login_count,
        uu.sessions_used, uu.responses_used
      FROM users u
      LEFT JOIN user_usage uu ON uu.user_id = u.id
      WHERE (
        ${opts.search} = ''
        OR u.email ILIKE ${search}
        OR u.name ILIKE ${search}
        OR u.username ILIKE ${search}
      )
      AND (${opts.plan} = '' OR u.plan = ${opts.plan})
      AND (${opts.role} = '' OR u.role = ${opts.role})
      ORDER BY u.created_at DESC
      LIMIT ${opts.limit} OFFSET ${offset}
    `;

    const [{ count }] = await sql`
      SELECT COUNT(*) AS count FROM users
      WHERE (
        ${opts.search} = ''
        OR email ILIKE ${search}
        OR name ILIKE ${search}
        OR username ILIKE ${search}
      )
      AND (${opts.plan} = '' OR plan = ${opts.plan})
      AND (${opts.role} = '' OR role = ${opts.role})
    `;

    return { users, total: parseInt(count), page: opts.page, limit: opts.limit };
  }

  async getUserDetail(id: string) {
    const sql = getDB();

    const [user] = await sql`
      SELECT
        u.id, u.email, u.name, u.username, u.is_pro, u.plan, u.currency,
        u.role, u.avatar_url, u.created_at, u.last_login_at, u.login_count,
        u.referral_code,
        uu.sessions_used, uu.responses_used, uu.reset_at
      FROM users u
      LEFT JOIN user_usage uu ON uu.user_id = u.id
      WHERE u.id = ${id}
    `;

    const licenses = await sql`
      SELECT plan, status, device_fingerprint, activated_at, expires_at, amount, currency
      FROM licenses
      WHERE user_id = ${id}
      ORDER BY activated_at DESC
    `;

    const payments = await sql`
      SELECT paystack_reference, amount, currency, plan, status, created_at
      FROM payments
      WHERE user_id = ${id}
      ORDER BY created_at DESC
      LIMIT 20
    `;

    const sessions = await sql`
      SELECT id, interview_type, total_questions, started_at, ended_at, duration_seconds
      FROM interview_sessions
      WHERE user_id = ${id}
      ORDER BY started_at DESC
      LIMIT 10
    `;

    return { user, licenses, payments, sessions };
  }

  async updateUserRole(id: string, role: 'user' | 'admin') {
    const sql = getDB();
    const [user] = await sql`
      UPDATE users SET role = ${role}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, email, role
    `;
    return user;
  }

  async toggleUserLicense(id: string, active: boolean) {
    const sql = getDB();
    const status = active ? 'active' : 'suspended';
    await sql`
      UPDATE licenses SET status = ${status}
      WHERE user_id = ${id} AND status != 'expired'
    `;
    await sql`
      UPDATE users SET is_pro = ${active}
      WHERE id = ${id}
    `;
    return { success: true, userId: id, active };
  }

  async getPayouts(status: string) {
    const sql = getDB();

    // Summary stats always returned alongside rows
    const [stats] = await sql`
      SELECT
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount END), 0) AS pending_total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_count,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount END), 0) AS paid_total,
        COALESCE(AVG(CASE WHEN status = 'paid' THEN amount END), 0) AS avg_payout
      FROM payout_requests
    `;

    const payouts = status === 'all'
      ? await sql`
          SELECT
            pr.id, pr.amount, pr.currency, pr.bank_name,
            pr.account_number, pr.account_name,
            pr.status, pr.requested_at, pr.processed_at,
            u.email, u.name, u.username
          FROM payout_requests pr
          JOIN users u ON u.id = pr.user_id
          ORDER BY pr.requested_at DESC
          LIMIT 100
        `
      : await sql`
          SELECT
            pr.id, pr.amount, pr.currency, pr.bank_name,
            pr.account_number, pr.account_name,
            pr.status, pr.requested_at, pr.processed_at,
            u.email, u.name, u.username
          FROM payout_requests pr
          JOIN users u ON u.id = pr.user_id
          WHERE pr.status = ${status}
          ORDER BY pr.requested_at DESC
        `;

    return { payouts, stats };
  }

  async processPayout(id: string, status: 'paid' | 'rejected', note?: string) {
    const sql = getDB();
    const [payout] = await sql`
      UPDATE payout_requests
      SET status = ${status}, processed_at = NOW()
      WHERE id = ${id}
      RETURNING id, user_id, amount, currency, status
    `;

    if (status === 'paid') {
      await sql`
        UPDATE referral_balances
        SET total_paid = total_paid + ${payout.amount},
            pending_balance = GREATEST(pending_balance - ${payout.amount}, 0),
            updated_at = NOW()
        WHERE user_id = ${payout.user_id}
      `;
    }

    return payout;
  }

  async getRevenueAnalytics(period: number) {
    const sql = getDB();

    // Daily revenue split by currency
    const dailyRevenue = await sql`
      SELECT
        DATE(created_at) AS date,
        COALESCE(SUM(CASE WHEN currency = 'ngn' THEN amount ELSE 0 END), 0) AS ngn,
        COALESCE(SUM(CASE WHEN currency = 'usd' THEN amount ELSE 0 END), 0) AS usd,
        COUNT(*) AS count
      FROM payments
      WHERE status = 'success'
        AND created_at >= NOW() - (${period} || ' days')::INTERVAL
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    // Revenue by plan + currency
    const planBreakdown = await sql`
      SELECT plan, currency, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
      FROM payments
      WHERE status = 'success'
        AND created_at >= NOW() - (${period} || ' days')::INTERVAL
      GROUP BY plan, currency
      ORDER BY total DESC
    `;

    // KPIs
    const [kpiRow] = await sql`
      SELECT
        -- MRR: sum of last 30d from active monthly subscribers
        COALESCE((
          SELECT SUM(p.amount)
          FROM payments p
          JOIN licenses l ON l.user_id = p.user_id
          WHERE p.status = 'success' AND p.plan = 'monthly'
            AND l.status = 'active'
            AND p.created_at >= NOW() - INTERVAL '30 days'
        ), 0) AS mrr,

        -- Total revenue all time
        COALESCE((SELECT SUM(amount) FROM payments WHERE status = 'success'), 0) AS total_revenue,

        -- Net revenue: total minus 1.5% Paystack fee minus referral commissions
        COALESCE((
          SELECT SUM(amount) * 0.985 FROM payments WHERE status = 'success'
        ), 0)
        - COALESCE((
          SELECT SUM(commission_amount) FROM referrals WHERE status = 'earned'
        ), 0) AS net_revenue,

        -- ARPU: total revenue / distinct paying users
        COALESCE((
          SELECT SUM(amount)::float / NULLIF(COUNT(DISTINCT user_id), 0)
          FROM payments WHERE status = 'success'
        ), 0) AS arpu,

        -- LTV: net revenue / distinct paying users
        COALESCE((
          SELECT (SUM(amount) * 0.985)::float / NULLIF(COUNT(DISTINCT user_id), 0)
          FROM payments WHERE status = 'success'
        ), 0) AS ltv
    `;

    const kpis = {
      mrr: Number(kpiRow.mrr),
      arr: Number(kpiRow.mrr) * 12,
      totalRevenue: Number(kpiRow.total_revenue),
      netRevenue: Number(kpiRow.net_revenue),
      arpu: Number(kpiRow.arpu),
      ltv: Number(kpiRow.ltv),
    };

    // Cohort retention — for each calendar month, what % of monthly subscribers
    // from that cohort are still on an active license
    const cohortRetention = await sql`
      WITH cohorts AS (
        SELECT
          TO_CHAR(DATE_TRUNC('month', u.created_at), 'Mon YYYY') AS cohort,
          DATE_TRUNC('month', u.created_at) AS cohort_month,
          u.id AS user_id
        FROM users u
        WHERE u.plan = 'monthly' AND u.is_pro = true
      ),
      base AS (
        SELECT cohort, cohort_month, COUNT(*) AS total FROM cohorts GROUP BY cohort, cohort_month
      )
      SELECT
        b.cohort,
        ROUND(COUNT(CASE WHEN l.status = 'active' AND l.activated_at < b.cohort_month + INTERVAL '1 month' THEN 1 END)::numeric / NULLIF(b.total, 0), 3) AS month1,
        ROUND(COUNT(CASE WHEN l.status = 'active' AND l.activated_at < b.cohort_month + INTERVAL '2 months' THEN 1 END)::numeric / NULLIF(b.total, 0), 3) AS month2,
        ROUND(COUNT(CASE WHEN l.status = 'active' AND l.activated_at < b.cohort_month + INTERVAL '3 months' THEN 1 END)::numeric / NULLIF(b.total, 0), 3) AS month3,
        ROUND(COUNT(CASE WHEN l.status = 'active' AND l.activated_at < b.cohort_month + INTERVAL '6 months' THEN 1 END)::numeric / NULLIF(b.total, 0), 3) AS month6,
        ROUND(COUNT(CASE WHEN l.status = 'active' AND l.activated_at < b.cohort_month + INTERVAL '12 months' THEN 1 END)::numeric / NULLIF(b.total, 0), 3) AS month12
      FROM base b
      JOIN cohorts c ON c.cohort = b.cohort
      LEFT JOIN licenses l ON l.user_id = c.user_id AND l.plan = 'monthly'
      GROUP BY b.cohort, b.cohort_month, b.total
      ORDER BY b.cohort_month DESC
      LIMIT 12
    `;

    // Monthly churn rate — expired monthly licenses per month / active at start
    const churnData = await sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', expires_at), 'Mon YYYY') AS month,
        COUNT(*) AS count,
        ROUND(
          COUNT(*)::numeric / NULLIF(
            (SELECT COUNT(*) FROM licenses WHERE plan = 'monthly' AND status IN ('active','expired')), 0
          ), 4
        ) AS rate
      FROM licenses
      WHERE plan = 'monthly' AND status = 'expired'
        AND expires_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', expires_at)
      ORDER BY DATE_TRUNC('month', expires_at) ASC
    `;

    // Users who churned this month
    const churnedUsers = await sql`
      SELECT
        u.username,
        l.plan,
        l.amount AS amount_lost,
        EXTRACT(DAY FROM (l.expires_at - l.activated_at))::int AS days_since_activation
      FROM licenses l
      JOIN users u ON u.id = l.user_id
      WHERE l.status = 'expired'
        AND l.plan = 'monthly'
        AND l.expires_at >= DATE_TRUNC('month', NOW())
        AND l.expires_at < DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
      ORDER BY l.expires_at DESC
      LIMIT 50
    `;

    return { kpis, dailyRevenue, planBreakdown, cohortRetention, churnData, churnedUsers, period };
  }

  async getUserAnalytics(period: number) {
    const sql = getDB();

    const daily = await sql`
      SELECT DATE(created_at) AS date, COUNT(*) AS signups
      FROM users
      WHERE created_at >= NOW() - (${period} || ' days')::INTERVAL
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    const [totals] = await sql`
      SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN is_pro THEN 1 END) AS pro,
        COUNT(CASE WHEN NOT is_pro THEN 1 END) AS free,
        COUNT(CASE WHEN created_at >= NOW() - (${period} || ' days')::INTERVAL THEN 1 END) AS new_this_period
      FROM users
    `;

    return { daily, totals, period };
  }

  async getSessionAnalytics(period: number) {
    const sql = getDB();

    // KPIs
    const [kpiRow] = await sql`
      SELECT
        COUNT(*) AS total,
        ROUND(COUNT(*)::numeric / NULLIF(${period}, 0), 1) AS daily_avg,
        ROUND(AVG(duration_seconds)) AS avg_duration,
        ROUND(AVG(total_questions), 1) AS avg_questions,
        ROUND(
          COUNT(CASE WHEN messages::text ILIKE '%screenshot%' THEN 1 END)::numeric
          / NULLIF(COUNT(*), 0) * 100, 1
        ) AS screenshot_pct
      FROM interview_sessions
      WHERE started_at >= NOW() - (${period} || ' days')::INTERVAL
        AND ended_at IS NOT NULL
    `;

    const [mostPopular] = await sql`
      SELECT interview_type
      FROM interview_sessions
      WHERE started_at >= NOW() - (${period} || ' days')::INTERVAL
        AND ended_at IS NOT NULL
      GROUP BY interview_type
      ORDER BY COUNT(*) DESC
      LIMIT 1
    `;

    const kpis = {
      total: Number(kpiRow.total),
      dailyAvg: Number(kpiRow.daily_avg),
      avgDuration: Number(kpiRow.avg_duration),
      avgQuestions: Number(kpiRow.avg_questions),
      screenshotPct: Number(kpiRow.screenshot_pct),
      topType: mostPopular?.interview_type ?? 'general',
    };

    // Daily sessions stacked by interview type
    const dailySessions = await sql`
      SELECT
        DATE(started_at) AS date,
        COALESCE(SUM(CASE WHEN interview_type = 'behavioral' THEN 1 ELSE 0 END), 0) AS behavioral,
        COALESCE(SUM(CASE WHEN interview_type = 'technical' THEN 1 ELSE 0 END), 0) AS technical,
        COALESCE(SUM(CASE WHEN interview_type = 'coding' THEN 1 ELSE 0 END), 0) AS coding,
        COALESCE(SUM(CASE WHEN interview_type = 'system_design' THEN 1 ELSE 0 END), 0) AS systemdesign,
        COALESCE(SUM(CASE WHEN interview_type NOT IN ('behavioral','technical','coding','system_design') THEN 1 ELSE 0 END), 0) AS general,
        COUNT(*) AS total
      FROM interview_sessions
      WHERE started_at >= NOW() - (${period} || ' days')::INTERVAL
        AND ended_at IS NOT NULL
      GROUP BY DATE(started_at)
      ORDER BY date ASC
    `;

    // Type breakdown with percentages
    const typeRows = await sql`
      SELECT
        interview_type AS type,
        COUNT(*) AS count
      FROM interview_sessions
      WHERE started_at >= NOW() - (${period} || ' days')::INTERVAL
        AND ended_at IS NOT NULL
      GROUP BY interview_type
      ORDER BY count DESC
    `;
    const typeTotal = typeRows.reduce((s: number, r: any) => s + Number(r.count), 0);
    const typeBreakdown = typeRows.map((r: any) => ({
      type: r.type,
      count: Number(r.count),
      pct: typeTotal > 0 ? Math.round((Number(r.count) / typeTotal) * 1000) / 10 : 0,
    }));

    // Hourly usage (0-23)
    const hourlyUsage = await sql`
      SELECT
        EXTRACT(HOUR FROM started_at)::int AS hour,
        COUNT(*) AS count,
        ROUND(COUNT(*)::numeric / NULLIF(${period}, 0), 2) AS avg_sessions
      FROM interview_sessions
      WHERE started_at >= NOW() - (${period} || ' days')::INTERVAL
        AND ended_at IS NOT NULL
      GROUP BY EXTRACT(HOUR FROM started_at)
      ORDER BY hour ASC
    `;

    // Platform split — not tracked yet in schema, return empty
    const platformSplit: { platform: string; count: number }[] = [];

    // Recent 20 completed sessions
    const recentSessions = await sql`
      SELECT
        s.id,
        u.username,
        s.interview_type AS type,
        s.duration_seconds AS duration,
        s.total_questions AS questions,
        s.summary,
        s.started_at AS date
      FROM interview_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.ended_at IS NOT NULL
      ORDER BY s.started_at DESC
      LIMIT 20
    `;

    return { kpis, dailySessions, typeBreakdown, hourlyUsage, platformSplit, recentSessions, period };
  }

  async getReferralAnalytics() {
    const sql = getDB();

    // KPI summary
    const [summary] = await sql`
      SELECT
        COUNT(*) AS total_referrals,
        COUNT(CASE WHEN status IN ('earned','paid') THEN 1 END) AS converted,
        COALESCE(SUM(commission_amount), 0) AS total_commissions,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN commission_amount END), 0) AS total_paid_out,
        (SELECT COUNT(*) FROM users WHERE referral_code IS NOT NULL) AS total_links
      FROM referrals
    `;

    // Funnel: links → signups → paid → retained (still pro)
    const [funnel] = await sql`
      SELECT
        (SELECT COUNT(*) FROM users WHERE referral_code IS NOT NULL) AS links,
        COUNT(*) AS signups,
        COUNT(CASE WHEN r.status IN ('earned','paid') THEN 1 END) AS paid,
        COUNT(CASE WHEN r.status IN ('earned','paid') AND u2.is_pro = true THEN 1 END) AS retained
      FROM referrals r
      JOIN users u2 ON u2.id = r.referred_id
    `;

    // Top referrers with pending balance
    const topReferrers = await sql`
      SELECT
        u.username, u.email,
        COUNT(r.id) AS referred,
        COUNT(CASE WHEN r.status IN ('earned','paid') THEN 1 END) AS converted,
        COALESCE(SUM(r.commission_amount), 0) AS total_earned,
        COALESCE(rb.pending_balance, 0) AS pending
      FROM referrals r
      JOIN users u ON u.id = r.referrer_id
      LEFT JOIN referral_balances rb ON rb.user_id = r.referrer_id
      GROUP BY u.id, u.username, u.email, rb.pending_balance
      ORDER BY total_earned DESC
      LIMIT 20
    `;

    // All referrals detail
    const allReferrals = await sql`
      SELECT
        ur.username AS referrer_username,
        ue.username AS referred_username,
        r.status,
        r.commission_amount,
        r.currency,
        ue.plan,
        r.created_at
      FROM referrals r
      JOIN users ur ON ur.id = r.referrer_id
      JOIN users ue ON ue.id = r.referred_id
      ORDER BY r.created_at DESC
      LIMIT 200
    `;

    return { summary, funnel, topReferrers, allReferrals };
  }

  async getErrors(opts: { page: number; limit: number; search: string; endpoint: string; statusCode: string }) {
    const sql = getDB();
    const offset = (opts.page - 1) * opts.limit;
    const search = `%${opts.search}%`;
    const ep = `%${opts.endpoint}%`;
    const sc = opts.statusCode ? parseInt(opts.statusCode) : null;

    const rows = await sql`
      SELECT
        id, endpoint, method, error_message, stack_trace,
        user_id, status_code, created_at
      FROM error_logs
      WHERE (${opts.search} = '' OR error_message ILIKE ${search})
        AND (${opts.endpoint} = '' OR endpoint ILIKE ${ep})
        AND (${sc}::int IS NULL OR status_code = ${sc})
      ORDER BY created_at DESC
      LIMIT ${opts.limit} OFFSET ${offset}
    `;

    const [{ count }] = await sql`
      SELECT COUNT(*) AS count
      FROM error_logs
      WHERE (${opts.search} = '' OR error_message ILIKE ${search})
        AND (${opts.endpoint} = '' OR endpoint ILIKE ${ep})
        AND (${sc}::int IS NULL OR status_code = ${sc})
    `;

    const [summary] = await sql`
      SELECT
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 day' THEN 1 END)  AS last_24h,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END)  AS last_7d,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) AS last_30d
      FROM error_logs
    `;

    const topEndpoints = await sql`
      SELECT endpoint, COUNT(*) AS count
      FROM error_logs
      WHERE endpoint IS NOT NULL
        AND created_at >= NOW() - INTERVAL '7 days'
      GROUP BY endpoint
      ORDER BY count DESC
      LIMIT 5
    `;

    return {
      rows,
      total: parseInt(count),
      page: opts.page,
      limit: opts.limit,
      summary,
      topEndpoints,
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
