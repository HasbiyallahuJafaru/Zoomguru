# AUTH-14 â€” Admin App Scaffold

## What This Does
Creates the standalone Next.js admin dashboard app.
Pure light theme. Deployed to admin.zoomguru.xyz.

## Risk Level
ðŸŸ¢ LOW â€” Brand new app. Nothing existing is touched.

---

## Prompt

```
Read .claude/patches/auth-dashboard/AUTH-DASHBOARD.md first.

Create a new Next.js app for the ZoomGuru admin dashboard.
This is a SEPARATE app from apps/landing.
Path: apps/admin/

Run:
cd apps
npx create-next-app@latest admin --typescript --tailwind \
  --app --no-src-dir --import-alias "@/*"
cd admin
npm install next-auth@beta recharts @heroicons/react

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
Create apps/admin/lib/theme.css (global CSS variables)
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

:root {
  --bg: #ffffff;
  --surface: #f8fafc;
  --surface2: #f1f5f9;
  --border: #e2e8f0;
  --border2: #cbd5e1;
  --text: #0f172a;
  --text2: #475569;
  --muted: #94a3b8;
  --accent: #4f6ef7;
  --accent-light: #eef2ff;
  --green: #10b981;
  --green-light: #d1fae5;
  --red: #ef4444;
  --red-light: #fee2e2;
  --amber: #f59e0b;
  --amber-light: #fef3c7;
  --cyan: #06b6d4;
  --font: 'Inter', sans-serif;
  --mono: 'JetBrains Mono', monospace;
}

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
Create apps/admin/app/layout.tsx
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

Root layout with:
  - Inter font from Google Fonts
  - Import theme.css
  - Light background (#ffffff)
  - HTML lang="en"
  - Metadata: title "ZoomGuru Admin"

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
Create apps/admin/auth.ts
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

NextAuth configured with ONLY credentials provider.
No Google OAuth on admin â€” credentials only.

Credentials authorize:
  1. Accepts email + password
  2. Calls POST ${API_URL}/auth/login
  3. Checks returned user.role === 'admin'
  4. If not admin â†’ return null (access denied)
  5. Returns user with role, accessToken

Pages: signIn: '/login'
Session strategy: 'jwt'

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
Create apps/admin/middleware.ts
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

Protect all routes except /login.
Redirect unauthenticated users to /login.
Redirect authenticated non-admins to /login with error.

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
Create apps/admin/.env.local
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

NEXTAUTH_SECRET=different_secret_from_landing_app
NEXTAUTH_URL=https://admin.zoomguru.xyz
NEXT_PUBLIC_API_URL=https://api.zoomguru.xyz
ADMIN_SECRET_KEY=same_as_backend

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
Create apps/admin/components/AdminLayout.tsx
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

Light theme admin shell:

Left sidebar (240px wide, white, border-right):
  â”œâ”€â”€ ZoomGuru logo + "Admin" badge at top
  â”œâ”€â”€ Admin user avatar + name + email
  â”œâ”€â”€ Navigation:
  â”‚   ðŸ“Š Overview
  â”‚   ðŸ‘¥ Users
  â”‚   ðŸ’° Revenue
  â”‚   ðŸŽ¯ Sessions
  â”‚   ðŸ”— Referrals
  â”‚   ðŸ’¸ Payouts
  â”‚   âš ï¸  Errors
  â”‚   âš™ï¸  Settings
  â””â”€â”€ Sign Out

Top bar:
  Page title (dynamic)
  Last updated: [timestamp]
  Refresh button

Main content: white, padding 32px

Active nav item: accent blue background, white text.
Inactive: gray text, white background, hover: light gray.

Show me all created files.
```

---

# AUTH-15 â€” Admin Login Page

## Prompt

```
Create apps/admin/app/login/page.tsx

PURE LIGHT THEME. Clean, minimal, professional.

Layout:
  Centered card (400px wide) on light gray background (#f8fafc)
  
  Top: ZoomGuru logo + "Admin Dashboard" text below it
  
  Form:
    Email input (clean, border: 1px solid #e2e8f0)
    Password input + show/hide toggle
    [Sign In] button (accent blue, full width)
    
  Below form:
    Error message (red, shown on failed login)
    "Forgot password? Contact admin." (static text)
    
  Footer text: "Authorized personnel only"

No Google OAuth button â€” credentials only.
No register link â€” admins are created manually.

Loading state on button during sign in attempt.
Auto-focus email field on mount.

Use Inter font, pure light colors only.
Show me the created file.
```

---

# AUTH-16 â€” Admin Overview Dashboard

## Prompt

```
Read .claude/patches/auth-dashboard/AUTH-DASHBOARD.md first.

Create apps/admin/app/page.tsx (the overview dashboard).
This is the home page after admin login.
Use AdminLayout wrapper. Pure light theme.

Layout:

ROW 1 â€” KPI Cards (5 cards, horizontal):
  Each card: white background, border, rounded, padding 24px

  Card 1: Total Revenue (this month)
    Value: â‚¦X,XXX,XXX
    Sub: â†‘ X% from last month
    Color accent: green

  Card 2: Active Subscribers
    Value: XXX
    Sub: X monthly Â· X lifetime
    Color accent: blue

  Card 3: New Users (last 7 days)
    Value: XX
    Sub: X% conversion from free
    Color accent: cyan

  Card 4: Churn Rate
    Value: X.X%
    Sub: X users cancelled this month
    Color accent: amber if >5%, red if >10%

  Card 5: Pending Payouts
    Value: â‚¦XX,XXX
    Sub: X requests pending
    Color accent: purple

ROW 2 â€” Two charts side by side:

  Left chart (60% width): Revenue over last 30 days
    Line chart using Recharts
    X axis: dates
    Y axis: â‚¦ amount
    Shows daily revenue as area chart
    Color: accent blue fill

  Right chart (40% width): Plan breakdown
    Pie chart using Recharts
    Segments: NGN Monthly / NGN Lifetime / USD Monthly / USD Lifetime
    Legend below

ROW 3 â€” Two panels side by side:

  Left: Recent Signups (last 10 users)
    Table: Username | Email | Plan | Joined | Country
    "View all users" link

  Right: Recent Errors (last 5 errors)
    Each row: endpoint | error message | time ago
    Color code by severity
    "View all errors" link

ROW 4 â€” System Health row:
  Backend status: â— Online (green dot, last checked Xs ago)
  DB connections: X/100 active
  Active SSE streams: X concurrent
  API uptime: XX% (last 30 days)

Data from:
  GET ${API_URL}/admin/stats (existing endpoint â€” expand it)
  GET ${API_URL}/admin/analytics/revenue?period=30 (new)
  All requests include: Authorization: Bearer {adminAccessToken}

Recharts must be installed: npm install recharts
Use 'use client' directive for chart components.
Server components for data fetching where possible.

Show me all files created.
```

---

# AUTH-17 â€” Admin Users Page + User Detail

## Prompt

```
Create two files:
  apps/admin/app/users/page.tsx
  apps/admin/app/users/[id]/page.tsx

Both use AdminLayout. Pure light theme.

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
USERS LIST PAGE (users/page.tsx)
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

Top bar:
  Page title: "Users"
  Total count badge
  [Export CSV] button (downloads query as CSV)

Filters row:
  Search input (searches username, email, name)
  Filter: All Plans / Free / Monthly / Lifetime
  Filter: All Roles / User / Admin
  Filter: All Status / Active / Expired / Cancelled

Users table:
  Columns:
    Avatar (circle initials or Google avatar)
    Name + username (@username below)
    Email
    Plan badge (Free gray / Monthly blue / Lifetime purple)
    Role badge (User / Admin red)
    Joined date
    Last active
    Actions: [View] button

  Pagination: 50 per page
  Click row â†’ navigate to /users/[id]
  Sticky header

Data from:
  GET ${API_URL}/admin/users?page=1&limit=50&search=&plan=&role=

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
USER DETAIL PAGE (users/[id]/page.tsx)
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

Back button â†’ /users

Header card:
  Large avatar (80px)
  Name, username, email
  Badges: Plan | Role | Status
  Joined date | Last login | Login count

Four info sections:

Section 1 â€” Subscription:
  Plan, currency, amount paid
  Activated date, expires date (or "Lifetime")
  Paystack reference (copyable)
  Device fingerprint (last 12 chars)
  [Revoke License] button (red, confirmation required)
  [Reactivate License] button (green, if revoked)

Section 2 â€” Usage Stats:
  Total sessions | Total responses
  Last session date
  Favorite interview type (from sessions data)
  Sessions list (last 5, compact)

Section 3 â€” Payment History:
  All payments for this user
  Date | Amount | Plan | Reference | Status

Section 4 â€” Referrals:
  Their referral code + link
  People they referred (count)
  Total commission earned
  Pending balance
  [Mark as Paid] button for pending balance

Section 5 â€” Admin Actions:
  [Grant Admin Role] / [Remove Admin Role] button
    â†’ Requires x-admin-key header confirmation modal
  [Delete Account] button (red, triple confirmation)
  [Send Password Reset] button (placeholder)

Data from:
  GET ${API_URL}/admin/users/[id]

Show me both page files.
```

