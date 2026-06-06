import { Injectable } from '@nestjs/common';
import { getDB } from '../database/db';

export type QuotaFeature =
  | 'copilot_requests'
  | 'interviewer_sessions'
  | 'scorer_reports'
  | 'doc_copilot_requests';

export type PlanType = 'weekly' | 'monthly' | 'yearly';

// Limits per billing period by plan.
// yearly uses rolling monthly windows, so limits match a monthly window.
const LIMITS: Record<PlanType, Record<QuotaFeature, number>> = {
  weekly: {
    copilot_requests:     30,
    interviewer_sessions:  3,
    scorer_reports:        3,
    doc_copilot_requests:  5,
  },
  monthly: {
    copilot_requests:     120,
    interviewer_sessions:  10,
    scorer_reports:        10,
    doc_copilot_requests:  20,
  },
  yearly: {
    copilot_requests:     400,
    interviewer_sessions:  40,
    scorer_reports:        40,
    doc_copilot_requests:  80,
  },
};

export interface QuotaResult {
  allowed: boolean;
  planType: PlanType;
  feature: QuotaFeature;
  limit: number;
  used: number;
  resetAt: string;
}

function windowDays(plan: PlanType): number {
  if (plan === 'weekly') return 7;
  return 30;
}

export function getPlanLimits(planType: PlanType): Record<QuotaFeature, number> {
  return LIMITS[planType];
}

export function windowDaysForPlan(planType: PlanType): number {
  return windowDays(planType);
}

@Injectable()
export class QuotaService {
  // Ensures a usage row exists for the user, seeding plan_type and period_start.
  // Called inside checkQuota — the upsert is idempotent.
  private async ensureRow(
    userId: string,
    planType: PlanType,
    periodStart: Date,
  ): Promise<void> {
    const pool = getDB();
    await pool.query(
      `INSERT INTO usage (user_id, plan_type, period_start)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, planType, periodStart.toISOString()],
    );
  }

  // Atomically increments the feature counter and returns whether the request
  // is allowed. Uses a single UPDATE with a WHERE guard so concurrent requests
  // cannot race past the limit.
  async checkQuota(
    userId: string,
    feature: QuotaFeature,
    planType: PlanType,
    periodStart: Date,
  ): Promise<QuotaResult> {
    const ALLOWED: readonly string[] = ['copilot_requests', 'interviewer_sessions', 'scorer_reports', 'doc_copilot_requests'];
    if (!ALLOWED.includes(feature)) throw new Error(`Invalid feature: ${feature}`);

    await this.ensureRow(userId, planType, periodStart);

    const pool = getDB();
    const limit = LIMITS[planType][feature];
    const days = windowDays(planType);
    const resetAt = new Date(periodStart.getTime() + days * 86_400_000).toISOString();

    // Atomic increment: only succeeds if we are below the limit.
    const result = await pool.query<{ val: number }>(
      `UPDATE usage
       SET ${feature} = ${feature} + 1, updated_at = NOW()
       WHERE user_id = $1 AND ${feature} < $2
       RETURNING ${feature} AS val`,
      [userId, limit],
    );

    if (result.rows.length === 0) {
      // Already at or above limit — read current count without modifying.
      const cur = await pool.query<{ val: number }>(
        `SELECT ${feature} AS val FROM usage WHERE user_id = $1 LIMIT 1`,
        [userId],
      );
      return {
        allowed: false,
        planType,
        feature,
        limit,
        used: cur.rows[0]?.val ?? limit,
        resetAt,
      };
    }

    return {
      allowed: true,
      planType,
      feature,
      limit,
      used: result.rows[0].val,
      resetAt,
    };
  }

  // Resets usage counters for a specific user (called after a new billing period
  // starts via webhook or cron).
  async resetUserUsage(
    userId: string,
    planType: PlanType,
    periodStart: Date,
  ): Promise<void> {
    const pool = getDB();
    await pool.query(
      `INSERT INTO usage
         (user_id, plan_type, period_start,
          copilot_requests, interviewer_sessions, scorer_reports, doc_copilot_requests)
       VALUES ($1, $2, $3, 0, 0, 0, 0)
       ON CONFLICT (user_id) DO UPDATE SET
         plan_type            = $2,
         period_start         = $3,
         copilot_requests     = 0,
         interviewer_sessions = 0,
         scorer_reports       = 0,
         doc_copilot_requests = 0,
         updated_at           = NOW()`,
      [userId, planType, periodStart.toISOString()],
    );
  }

  // Returns plan type from subscription or null if none.
  async getPlanType(userId: string): Promise<{ planType: PlanType; periodStart: Date } | null> {
    const pool = getDB();
    const row = await pool.query<{
      plan: string | null;
      current_period_start: string | null;
      created_at: string;
    }>(
      `SELECT plan, current_period_start, created_at
       FROM subscriptions WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [userId],
    );

    if (row.rows.length === 0) return null;

    const plan = row.rows[0].plan;
    if (!plan || !['weekly', 'monthly', 'yearly'].includes(plan)) return null;

    const periodStart = row.rows[0].current_period_start
      ? new Date(row.rows[0].current_period_start)
      : new Date(row.rows[0].created_at);

    return { planType: plan as PlanType, periodStart };
  }
}
