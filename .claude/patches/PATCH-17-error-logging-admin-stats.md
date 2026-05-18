# PATCH-17 — Error Logging Table + Admin Stats Endpoint

## Problem
1. No visibility into backend errors — flying blind
2. No revenue/usage dashboard — can't make decisions

## Files Affected
- `apps/backend/src/database/init.ts`
- `apps/backend/src/admin/admin.controller.ts` (new)
- `apps/backend/src/admin/admin.service.ts` (new)
- `apps/backend/src/admin/admin.module.ts` (new)
- `apps/backend/src/app.module.ts`
- `apps/backend/src/main.ts`

## Risk Level
🟢 LOW — Purely additive. New module, new table, new endpoints.

---

## Claude Code Prompt

```
Read .claude/BACKEND.md and .claude/DATABASE.md first.

I need to add error logging and an admin stats endpoint.
This is purely additive — do not change any existing code.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — Add error_logs table to init.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In apps/backend/src/database/init.ts,
add this CREATE TABLE at the end of initDB(),
before the console.log('ZoomGuru DB initialized'):

  await sql`
    CREATE TABLE IF NOT EXISTS error_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      endpoint TEXT,
      method TEXT,
      error_message TEXT NOT NULL,
      stack_trace TEXT,
      user_id UUID,
      status_code INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_error_logs_created 
    ON error_logs(created_at DESC)
  `;

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — Create admin module files
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Create apps/backend/src/admin/admin.service.ts:

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

    const [referrals] = await sql`
      SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN status = 'earned' THEN 1 END) AS converted,
        COALESCE(SUM(CASE WHEN status = 'pending' 
          THEN commission_amount END), 0) AS pending_payouts_ngn
      FROM referrals
    `;

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

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Create apps/backend/src/admin/admin.controller.ts:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { Controller, Get, UseGuards, Headers, ForbiddenException } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  async getStats(@Headers('x-admin-key') adminKey: string) {
    // Simple secret key auth — not JWT (no user account needed)
    if (adminKey !== process.env.ADMIN_SECRET_KEY) {
      throw new ForbiddenException('Unauthorized');
    }
    return this.adminService.getStats();
  }
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Create apps/backend/src/admin/admin.module.ts:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — Register AdminModule in app.module.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In apps/backend/src/app.module.ts:
- Add: import { AdminModule } from './admin/admin.module';
- Add AdminModule to the imports array

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — Global error handler in main.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In apps/backend/src/main.ts, after app is created
but before app.listen(), add:

  // Global unhandled error catcher
  process.on('uncaughtException', async (err) => {
    const { AdminService } = await import('./admin/admin.service');
    const adminService = app.get(AdminService);
    await adminService.logError({
      errorMessage: err.message,
      stackTrace: err.stack,
    });
    console.error('Uncaught exception:', err);
  });

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — Add ADMIN_SECRET_KEY to env
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In apps/backend/.env, add:
ADMIN_SECRET_KEY=generate_a_random_32_char_string_here

Also add it to the REQUIRED_ENV array in main.ts validation.

Show me all created and modified files.
```

---

## Usage

```bash
# Check your stats anytime
curl https://api.zoomguru.com/admin/stats \
  -H "x-admin-key: your_admin_secret_key"

# Returns:
# {
#   revenue: { today: 45000, thisWeek: 180000, thisMonth: 720000, total: 1440000 },
#   users: { total: 124, pro: 48, free: 76 },
#   plans: [...],
#   sessions: { today: 23, avgDurationSeconds: 2400, avgQuestions: 11 },
#   referrals: { total: 31, converted: 12, pendingPayoutsNgn: 45000 },
#   recentErrors: [...]
# }
```

## Rollback
Delete admin/ folder.
Remove AdminModule from app.module.ts.
Remove error_logs CREATE TABLE from init.ts.
Remove uncaughtException handler from main.ts.
Remove ADMIN_SECRET_KEY from env + validation.
