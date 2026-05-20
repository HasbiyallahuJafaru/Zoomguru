# AUTH-18 — Admin Revenue Analytics

## Prompt

```
Create apps/admin/app/revenue/page.tsx

AdminLayout wrapper. Pure light theme. Heavy use of Recharts.

Page title: "Revenue Analytics"
Period selector: Last 7 / 30 / 90 / 365 days

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROW 1 — Revenue KPIs (6 stat cards):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  MRR (Monthly Recurring Revenue) — from active monthly subs
  ARR (Annual Run Rate) — MRR × 12
  Total Revenue — all time
  Net Revenue — after Paystack fees + referral commissions
  Average Revenue Per User (ARPU)
  Lifetime Value (LTV) — avg revenue per paying user

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROW 2 — Revenue over time (full width):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Area chart: Daily revenue in NGN
  Toggle: Show NGN / USD / Combined
  Hover tooltip: date + amount + transaction count
  Color: accent blue fill, gradient fade

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROW 3 — Two charts side by side:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Left: Revenue by plan type (Bar chart)
    Bars: NGN Monthly | NGN Lifetime | USD Monthly | USD Lifetime
    X axis: weeks or months
    Stacked bars

  Right: NGN vs USD split (Pie chart)
    Donut chart showing revenue % by currency
    Center: Total in NGN

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROW 4 — Cohort Retention Table:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Rows: Cohort month (users who joined in Month X)
  Columns: Month 1 | Month 2 | Month 3 | Month 6 | Month 12
  Values: % still subscribed
  Color: green (>80%) → amber (50-80%) → red (<50%)
  Header explanation: "Monthly subscribers who are still active"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROW 5 — Churn analysis:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Line chart: Monthly churn rate over time
  Stat: Avg churn rate, best month, worst month
  Table: Users who cancelled this month
    Username | Plan | Amount lost | Days since activation

Data from:
  GET ${API_URL}/admin/analytics/revenue?period=30
  This endpoint must return:
    dailyRevenue: [{date, ngn, usd, count}]
    planBreakdown: [{plan, currency, total, count}]
    cohortRetention: [{cohort, month1, month2, month3, month6}]
    churnData: [{month, rate, count}]
    kpis: {mrr, arr, totalRevenue, netRevenue, arpu, ltv}

Expand the admin analytics/revenue endpoint in admin.service.ts
to return all these fields from Neon queries.

Show me the page file and updated service method.
```

---

# AUTH-19 — Admin Sessions Analytics

## Prompt

```
Create apps/admin/app/sessions/page.tsx

AdminLayout. Light theme.

Page title: "Session Analytics"
Period selector: 7 / 30 / 90 days

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROW 1 — Session KPIs:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total sessions (period) | Daily average
  Avg duration | Avg questions per session
  Screenshot sessions % | Listen-only sessions %
  Most popular interview type

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROW 2 — Sessions over time:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Bar chart: Sessions per day
  Color coded by interview type (stacked bars)
  Behavioral=blue, Technical=green, Coding=purple, Design=amber

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROW 3 — Two charts:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Left: Interview type breakdown (Pie chart)
    Behavioral | Technical | Coding | System Design | General

  Right: Peak usage hours (Bar chart)
    X axis: Hour of day (0-23)
    Y axis: Average sessions
    Highlight: top 3 hours

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROW 4 — Platform breakdown:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Mac vs Windows users (donut chart)
  Avg session duration by platform
  Questions per session by platform

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROW 5 — Recent sessions table:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Last 20 sessions across all users
  Columns: User | Type | Duration | Questions | Date
  Expandable row: shows AI summary on click

Data from:
  GET ${API_URL}/admin/analytics/sessions?period=30
  Must return:
    kpis: {total, dailyAvg, avgDuration, avgQuestions, screenshotPct}
    dailySessions: [{date, behavioral, technical, coding, systemdesign}]
    typeBreakdown: [{type, count, pct}]
    hourlyUsage: [{hour, avgSessions}]
    platformSplit: [{platform, count}]
    recentSessions: [{id, username, type, duration, questions, summary, date}]

Add these fields to admin analytics/sessions endpoint.
Show me page and service method.
```

---

# AUTH-20 — Admin Referrals + Payouts

## Prompt

```
Create two files:
  apps/admin/app/referrals/page.tsx
  apps/admin/app/payouts/page.tsx

Both use AdminLayout. Light theme.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REFERRALS PAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

KPI cards:
  Total referral links | Total clicks (approx from GA)
  Total referrals signed up | Converted to paid
  Total commissions earned | Total commissions paid out

Funnel visualization:
  Horizontal funnel showing:
    Shared links → Signups → Paid → Retained
  Show conversion % at each step

Top referrers table:
  Rank | Username | Referred | Converted | Earned | Pending
  Color the top 3 with gold/silver/bronze accent

All referrals table:
  Referrer username | Referred username | Plan | Commission
  Status (pending/earned/paid) | Date

Data from:
  GET ${API_URL}/admin/analytics/referrals

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAYOUTS PAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Summary cards:
  Total pending payouts (₦) | Number of pending requests
  Total paid out all time | Average payout amount

Pending Payouts section (priority display):
  Each request as a card:
    ┌─────────────────────────────────────────┐
    │ @username                    ₦XX,XXX    │
    │ Bank: First Bank             Requested: │
    │ Account: 01234xxxxx          2 days ago │
    │ Name: John Doe                          │
    │ [✓ Mark as Paid]  [✗ Reject]           │
    └─────────────────────────────────────────┘

  Clicking Mark as Paid:
    → Confirmation modal
    → POST ${API_URL}/admin/payouts/[id] { status: 'paid' }
    → Updates payout_requests status
    → Deducts from user's referral_balances.pending_balance
    → Adds to referral_balances.total_paid
    → Card disappears from pending list

  Clicking Reject:
    → Modal asking for reason
    → POST ${API_URL}/admin/payouts/[id] { status: 'rejected', note: '...' }

Payout history table:
  Username | Amount | Bank | Requested | Processed | Status | Note

Data from:
  GET ${API_URL}/admin/payouts?status=pending
  GET ${API_URL}/admin/payouts?status=all
  PATCH ${API_URL}/admin/payouts/[id]

Show me both page files.
```

---

# AUTH-21 — Admin Error Log Viewer

## Prompt

```
Create apps/admin/app/errors/page.tsx

AdminLayout. Light theme. Critical for debugging.

Layout:

Summary row:
  Errors last 24h | Last 7 days | Last 30 days
  Most common endpoint with errors
  Error rate % (errors / total requests estimate)

Filters:
  Search (error message text)
  Filter by endpoint
  Date range picker
  Status code filter (400 / 401 / 403 / 404 / 500)

Error log table:
  Columns:
    Severity icon (🔴 500 / 🟡 400s / ⚪ other)
    Endpoint (method + path)
    Error message (truncated to 80 chars)
    User ID (link to user if available)
    Status code
    Time (relative: "3 minutes ago")
    [Details] button → expands stack trace inline

  Stack trace expansion:
    Monospace code block
    Full error message
    Full stack trace
    Copy button

  Real-time: Auto-refresh every 30 seconds
    Show "X new errors" banner if new errors arrive

  Pagination: 50 per page

  Empty state: "No errors logged. 🎉"

Data from:
  GET ${API_URL}/admin/errors?page=1&limit=50&search=&endpoint=

Add this endpoint to admin.controller.ts:
  @Get('errors')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getErrors(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('search') search = '',
    @Query('endpoint') endpoint = '',
  )

In admin.service.ts:
  async getErrors({ page, limit, search, endpoint }) {
    const sql = getDB();
    const offset = (page - 1) * limit;
    return sql`
      SELECT * FROM error_logs
      WHERE (${search} = '' OR error_message ILIKE ${'%' + search + '%'})
      AND (${endpoint} = '' OR endpoint ILIKE ${'%' + endpoint + '%'})
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

Show me the page and backend additions.
```

---

# AUTH-22 — Admin Settings

## Prompt

```
Create apps/admin/app/settings/page.tsx

AdminLayout. Light theme. Simple settings page.

Sections:

SECTION 1 — Your Admin Account:
  Avatar (initials circle, no upload needed)
  Name (editable)
  Email (read-only)
  [Change Password] form:
    Current password
    New password
    Confirm new password
    [Update Password] button

SECTION 2 — Admin Management:
  Table: All admin users
    Columns: Username | Email | Last Login | Actions
    [Remove Admin] button on each row
    (Cannot remove yourself)

  [Add Admin] form:
    Search existing user by email or username
    [Grant Admin Role] button
    Warning: "This gives full access to all user data
    and financial information."

SECTION 3 — System Configuration (read-only display):
  Backend URL: api.zoomguru.com
  Landing app: zoomguru.com
  Admin app: admin.zoomguru.com
  Database: Neon PostgreSQL
  AI Models: DeepSeek V3 + R1, Qwen VL
  Payments: Paystack
  Hosting: Render + Netlify
  Protection: Cloudflare Free

SECTION 4 — Pricing Configuration (display only for now):
  NGN Monthly: ₦15,000
  NGN Lifetime: ₦100,000
  USD Monthly: $12
  USD Lifetime: $79
  Note: "To update pricing, modify Paystack plans
  and update PRICES constant in Pricing.tsx"

API calls:
  GET ${API_URL}/admin/users?role=admin (to list admins)
  PATCH ${API_URL}/admin/users/[id]/role (to add/remove admin)

Show me the created file.
```
