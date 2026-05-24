# AUTH-18 â€” Admin Revenue Analytics

## Prompt

```
Create apps/admin/app/revenue/page.tsx

AdminLayout wrapper. Pure light theme. Heavy use of Recharts.

Page title: "Revenue Analytics"
Period selector: Last 7 / 30 / 90 / 365 days

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
ROW 1 â€” Revenue KPIs (6 stat cards):
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  MRR (Monthly Recurring Revenue) â€” from active monthly subs
  ARR (Annual Run Rate) â€” MRR Ã— 12
  Total Revenue â€” all time
  Net Revenue â€” after Paystack fees + referral commissions
  Average Revenue Per User (ARPU)
  Lifetime Value (LTV) â€” avg revenue per paying user

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
ROW 2 â€” Revenue over time (full width):
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  Area chart: Daily revenue in NGN
  Toggle: Show NGN / USD / Combined
  Hover tooltip: date + amount + transaction count
  Color: accent blue fill, gradient fade

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
ROW 3 â€” Two charts side by side:
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  Left: Revenue by plan type (Bar chart)
    Bars: NGN Monthly | NGN Lifetime | USD Monthly | USD Lifetime
    X axis: weeks or months
    Stacked bars

  Right: NGN vs USD split (Pie chart)
    Donut chart showing revenue % by currency
    Center: Total in NGN

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
ROW 4 â€” Cohort Retention Table:
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  Rows: Cohort month (users who joined in Month X)
  Columns: Month 1 | Month 2 | Month 3 | Month 6 | Month 12
  Values: % still subscribed
  Color: green (>80%) â†’ amber (50-80%) â†’ red (<50%)
  Header explanation: "Monthly subscribers who are still active"

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
ROW 5 â€” Churn analysis:
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
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

# AUTH-19 â€” Admin Sessions Analytics

## Prompt

```
Create apps/admin/app/sessions/page.tsx

AdminLayout. Light theme.

Page title: "Session Analytics"
Period selector: 7 / 30 / 90 days

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
ROW 1 â€” Session KPIs:
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  Total sessions (period) | Daily average
  Avg duration | Avg questions per session
  Screenshot sessions % | Listen-only sessions %
  Most popular interview type

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
ROW 2 â€” Sessions over time:
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  Bar chart: Sessions per day
  Color coded by interview type (stacked bars)
  Behavioral=blue, Technical=green, Coding=purple, Design=amber

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
ROW 3 â€” Two charts:
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  Left: Interview type breakdown (Pie chart)
    Behavioral | Technical | Coding | System Design | General

  Right: Peak usage hours (Bar chart)
    X axis: Hour of day (0-23)
    Y axis: Average sessions
    Highlight: top 3 hours

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
ROW 4 â€” Platform breakdown:
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  Mac vs Windows users (donut chart)
  Avg session duration by platform
  Questions per session by platform

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
ROW 5 â€” Recent sessions table:
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
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

# AUTH-20 â€” Admin Referrals + Payouts

## Prompt

```
Create two files:
  apps/admin/app/referrals/page.tsx
  apps/admin/app/payouts/page.tsx

Both use AdminLayout. Light theme.

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
REFERRALS PAGE
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

KPI cards:
  Total referral links | Total clicks (approx from GA)
  Total referrals signed up | Converted to paid
  Total commissions earned | Total commissions paid out

Funnel visualization:
  Horizontal funnel showing:
    Shared links â†’ Signups â†’ Paid â†’ Retained
  Show conversion % at each step

Top referrers table:
  Rank | Username | Referred | Converted | Earned | Pending
  Color the top 3 with gold/silver/bronze accent

All referrals table:
  Referrer username | Referred username | Plan | Commission
  Status (pending/earned/paid) | Date

Data from:
  GET ${API_URL}/admin/analytics/referrals

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
PAYOUTS PAGE
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

Summary cards:
  Total pending payouts (â‚¦) | Number of pending requests
  Total paid out all time | Average payout amount

Pending Payouts section (priority display):
  Each request as a card:
    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
    â”‚ @username                    â‚¦XX,XXX    â”‚
    â”‚ Bank: First Bank             Requested: â”‚
    â”‚ Account: 01234xxxxx          2 days ago â”‚
    â”‚ Name: John Doe                          â”‚
    â”‚ [âœ“ Mark as Paid]  [âœ— Reject]           â”‚
    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

  Clicking Mark as Paid:
    â†’ Confirmation modal
    â†’ POST ${API_URL}/admin/payouts/[id] { status: 'paid' }
    â†’ Updates payout_requests status
    â†’ Deducts from user's referral_balances.pending_balance
    â†’ Adds to referral_balances.total_paid
    â†’ Card disappears from pending list

  Clicking Reject:
    â†’ Modal asking for reason
    â†’ POST ${API_URL}/admin/payouts/[id] { status: 'rejected', note: '...' }

Payout history table:
  Username | Amount | Bank | Requested | Processed | Status | Note

Data from:
  GET ${API_URL}/admin/payouts?status=pending
  GET ${API_URL}/admin/payouts?status=all
  PATCH ${API_URL}/admin/payouts/[id]

Show me both page files.
```

---

# AUTH-21 â€” Admin Error Log Viewer

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
    Severity icon (ðŸ”´ 500 / ðŸŸ¡ 400s / âšª other)
    Endpoint (method + path)
    Error message (truncated to 80 chars)
    User ID (link to user if available)
    Status code
    Time (relative: "3 minutes ago")
    [Details] button â†’ expands stack trace inline

  Stack trace expansion:
    Monospace code block
    Full error message
    Full stack trace
    Copy button

  Real-time: Auto-refresh every 30 seconds
    Show "X new errors" banner if new errors arrive

  Pagination: 50 per page

  Empty state: "No errors logged. ðŸŽ‰"

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

# AUTH-22 â€” Admin Settings

## Prompt

```
Create apps/admin/app/settings/page.tsx

AdminLayout. Light theme. Simple settings page.

Sections:

SECTION 1 â€” Your Admin Account:
  Avatar (initials circle, no upload needed)
  Name (editable)
  Email (read-only)
  [Change Password] form:
    Current password
    New password
    Confirm new password
    [Update Password] button

SECTION 2 â€” Admin Management:
  Table: All admin users
    Columns: Username | Email | Last Login | Actions
    [Remove Admin] button on each row
    (Cannot remove yourself)

  [Add Admin] form:
    Search existing user by email or username
    [Grant Admin Role] button
    Warning: "This gives full access to all user data
    and financial information."

SECTION 3 â€” System Configuration (read-only display):
  Backend URL: api.zoomguru.xyz
  Landing app: zoomguru.xyz
  Admin app: admin.zoomguru.xyz
  Database: Neon PostgreSQL
  AI Models: DeepSeek V3 + R1, Qwen VL
  Payments: Paystack
  Hosting: Render + Netlify
  Protection: Cloudflare Free

SECTION 4 â€” Pricing Configuration (display only for now):
  NGN Monthly: â‚¦15,000
  NGN Lifetime: â‚¦100,000
  USD Monthly: $12
  USD Lifetime: $79
  Note: "To update pricing, modify Paystack plans
  and update PRICES constant in Pricing.tsx"

API calls:
  GET ${API_URL}/admin/users?role=admin (to list admins)
  PATCH ${API_URL}/admin/users/[id]/role (to add/remove admin)

Show me the created file.
```

