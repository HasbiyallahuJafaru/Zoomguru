# ZoomGuru — Auth & Dashboard Surgical Prompts
# One prompt per fix. Copy exactly. Paste into Claude Code.
# Always paste SESSION STARTER first.
# Apply in order. Verify each before moving to next.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SESSION STARTER — Paste this FIRST in every Claude Code session
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Read .claude/CLAUDE.md and
.claude/patches/auth-dashboard/AUTH-DASHBOARD.md
before doing anything.
You are making surgical changes to ZoomGuru.
Rules:
- Smallest possible change only
- Never refactor outside patch scope
- Show exact diff after every change
- Tell me which files you will touch BEFORE touching them
- One fix at a time. Never combine two fixes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTH-01 — Database Schema Additions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: apps/backend/src/database/init.ts
Risk: MEDIUM

Make three changes. Show diff after each:

CHANGE 1 — In CREATE TABLE users, add these columns
AFTER currency TEXT and BEFORE created_at:
  username TEXT UNIQUE,
  google_id TEXT UNIQUE,
  avatar_url TEXT,
  role TEXT DEFAULT 'user',
  last_login_at TIMESTAMPTZ,
  login_count INTEGER DEFAULT 0,

CHANGE 2 — At end of initDB() before console.log, add:
  await sql`CREATE TABLE IF NOT EXISTS nextauth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token TEXT UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires TIMESTAMPTZ NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS nextauth_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, provider TEXT NOT NULL,
    provider_account_id TEXT NOT NULL,
    refresh_token TEXT, access_token TEXT,
    expires_at INTEGER, token_type TEXT,
    scope TEXT, id_token TEXT, session_state TEXT,
    UNIQUE(provider, provider_account_id)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS nextauth_verification_tokens (
    identifier TEXT NOT NULL, token TEXT UNIQUE NOT NULL,
    expires TIMESTAMPTZ NOT NULL,
    PRIMARY KEY(identifier, token)
  )`;

CHANGE 3 — Add indexes:
  await sql`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_nextauth_sessions_token ON nextauth_sessions(session_token)`;

Do not touch any other table. Show all 3 diffs separately.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTH-02A — Login Accepts Username OR Email
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: apps/backend/src/auth/auth.service.ts
Risk: HIGH — test login after

In login(), change the user lookup query from email-only to:
  const identifier = email.toLowerCase().trim();
  const [user] = await sql`
    SELECT id, email, name, username, password_hash,
           is_pro, role, avatar_url
    FROM users
    WHERE email = ${identifier} OR username = ${identifier}
    LIMIT 1
  `;

After successful bcrypt compare, before generateTokens, add:
  await sql`UPDATE users SET last_login_at = NOW(),
    login_count = login_count + 1 WHERE id = ${user.id}`;

In generateTokens(), update JWT payload to include role and username.
Update return user object to include username, role, avatarUrl.

Do not change any other method. Show me the diff.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTH-02B — Register Requires Username
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: apps/backend/src/auth/auth.service.ts
Risk: MEDIUM

Add username as 6th parameter to register().
Add validation BEFORE email check:
  if (!username || username.trim().length < 3)
    throw new BadRequestException('Username must be 3+ characters');
  const cleanUsername = username.trim().toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
  const [uExists] = await sql`SELECT id FROM users
    WHERE username = ${cleanUsername} LIMIT 1`;
  if (uExists) throw new ConflictException('Username already taken');

Add username to INSERT INTO users.
Update auth controller to pass username from request body.
Add GET /auth/check-username?username=X endpoint:
  Returns { available: boolean }

Show me the diff of service + controller.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTH-02C — Admin Guard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: apps/backend/src/guards/admin.guard.ts
Risk: LOW

Create this file exactly:
  Injectable CanActivate that:
  1. Gets userId from request.user (set by JwtAuthGuard)
  2. Queries: SELECT role FROM users WHERE id = userId
  3. If role !== 'admin' → throw ForbiddenException
  4. If role === 'admin' → return true

Then add AdminGuard to the existing /admin/stats endpoint
in admin.controller.ts alongside JwtAuthGuard.

Do not modify any other endpoint. Show me both files.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTH-02D — Admin User Management Endpoints
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Files: admin.controller.ts + admin.service.ts
Risk: LOW — purely additive

Add these endpoints to admin.controller.ts
(all protected by JwtAuthGuard + AdminGuard):

GET  /admin/users          → paginated users list with search/filter
GET  /admin/users/:id      → full user detail
PATCH /admin/users/:id/role → update role (also requires x-admin-key)
PATCH /admin/users/:id/license → toggle license active/revoked
GET  /admin/payouts        → payout requests by status
PATCH /admin/payouts/:id   → approve or reject payout
GET  /admin/analytics/revenue?period=30  → revenue data
GET  /admin/analytics/users?period=30    → user growth data
GET  /admin/analytics/sessions?period=30 → session analytics
GET  /admin/analytics/referrals          → referral funnel data
GET  /admin/errors         → error log with pagination + search

Add all corresponding methods to admin.service.ts.
Each method queries Neon directly with getDB().

Show me controller first. Confirm. Then service methods one at a time.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTH-03 — Google Cloud Setup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MANUAL SETUP — No code changes.
Follow the step-by-step guide in:
.claude/patches/auth-dashboard/AUTH-03-google-cloud-setup.md

After completing, you will have:
  GOOGLE_CLIENT_ID=...
  GOOGLE_CLIENT_SECRET=...

Add to: apps/backend/.env
        apps/landing/.env.local
        apps/admin/.env.local
        Render environment variables

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTH-04 — Cloudflare Setup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MANUAL SETUP — No code changes.
Follow the step-by-step guide in:
.claude/patches/auth-dashboard/AUTH-04-cloudflare-setup.md

After completing:
  zoomguru.com → Cloudflare proxied to Netlify
  admin.zoomguru.com → Cloudflare proxied to Netlify
  api.zoomguru.com → Cloudflare proxied to Render
  WAF rate limiting active on /api/auth/*
  DDoS protection: always on

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTH-05 — NextAuth in Landing App
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run first:
  cd apps/landing
  npm install next-auth@beta @auth/core

Create 3 files:

FILE 1: apps/landing/auth.ts
NextAuth with two providers:
  1. Google provider (clientId, clientSecret from env)
  2. Credentials provider that calls POST /auth/login on backend
     and checks user.role

Callbacks:
  jwt: copies id, username, isPro, role, accessToken to token
  session: exposes those fields on session.user

Pages: signIn: '/login'
Session: jwt strategy

FILE 2: apps/landing/app/api/auth/[...nextauth]/route.ts
  import { handlers } from '../../../../auth';
  export const { GET, POST } = handlers;

FILE 3: apps/landing/middleware.ts
  Protect /dashboard/* → redirect to /login if no session
  Redirect /login and /register → /dashboard if already logged in

Add to apps/landing/.env.local:
  NEXTAUTH_SECRET= (generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
  NEXTAUTH_URL=https://zoomguru.com
  GOOGLE_CLIENT_ID=from_google_cloud
  GOOGLE_CLIENT_SECRET=from_google_cloud

Do not modify any existing landing page files.
Show me all 3 created files.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTH-06 — Login + Register Pages
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create 3 files. Dark theme matching landing page.

FILE 1: apps/landing/app/login/page.tsx
  'use client'. Uses signIn from next-auth/react.
  Fields: Email or Username | Password
  Buttons: Continue with Google (top) | Sign In (form)
  Divider "or" between Google and form
  Error display on failed login
  Loading state on buttons
  Link to /register

FILE 2: apps/landing/app/register/page.tsx
  'use client'. POST to /api/register then signIn automatically.
  Fields: Full Name | Username (with availability check onBlur)
          Email | Password (strength indicator) | Confirm Password
  Google button at top
  Error display
  Link to /login

FILE 3: apps/landing/app/api/register/route.ts
  POST handler:
  Body: name, username, email, password, refCode
  Calls: POST ${NEXT_PUBLIC_API_URL}/auth/register
  Returns: success or error message

Same dark CSS variables as landing page.
No new npm packages needed.
Show me all 3 files.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTH-07 — Dashboard Layout + Home Page
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create 2 files. Dark theme.

FILE 1: apps/landing/app/dashboard/layout.tsx
  Left sidebar with: logo, username, nav links
  (Overview, Subscription, Payments, Sessions, Referrals, Settings)
  Sign Out at bottom
  Active route highlighted

FILE 2: apps/landing/app/dashboard/page.tsx
  4 stat cards: Plan status | Sessions | Questions | Referral earnings
  Last 5 sessions list (type, date, duration, questions, summary)
  Quick actions: Download / Upgrade / Copy referral link

Add to backend:
  GET /user/dashboard-summary (JwtAuthGuard)
  Returns: plan, isPro, usageStats, last5Sessions, referralBalance

Show me files + backend endpoint.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTH-08 — Subscription Page
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: apps/landing/app/dashboard/subscription/page.tsx
Dark theme.

Shows: Current plan card (plan name, status, expiry, device fingerprint)
Upgrade section: two plan cards with NGN/USD toggle + Paystack payment
Feature comparison table

Add backend: GET /user/subscription (JwtAuthGuard)
Returns: plan, status, expiresAt, deviceFingerprintLast8, usageStats

Show me file + endpoint.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTH-09 — Payments History Page
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: apps/landing/app/dashboard/payments/page.tsx
Dark theme.

Shows: Payment history table with filters (currency, plan type)
Columns: Date | Plan badge | Amount | Currency | Reference | Status
Pagination 20/page

Add backend: GET /user/payments?page=1&limit=20 (JwtAuthGuard)
Queries payments WHERE user_id = userId ORDER BY created_at DESC

Show me file + endpoint.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTH-10 — Sessions History Page
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: apps/landing/app/dashboard/sessions/page.tsx
Dark theme.

Shows: Session cards with type badge, date, duration, questions, summary
Filter by type, sort options
Expandable summary on each card

Add backend: GET /user/sessions?page=1&limit=20&type=all (JwtAuthGuard)
Queries interview_sessions WHERE user_id ORDER BY started_at DESC

Show me file + endpoint.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTH-11 — Referrals Page
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: apps/landing/app/dashboard/referrals/page.tsx
Dark theme.

Shows: 4 KPI cards | Referral link with copy + share buttons
Earnings breakdown table | Payout request form (if balance >= ₦5,000)
Payout history table

Uses existing endpoints:
  GET /referral/me
  POST /referral/payout

No new backend endpoints needed.
Show me the page file.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTH-12 — Settings Page
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: apps/landing/app/dashboard/settings/page.tsx
Dark theme. 4 sections: Profile | Security | Device | Danger Zone

Add backend endpoints:
  PATCH /user/profile → UPDATE users SET name, username
  PATCH /user/password → verify current, hash new, UPDATE
  DELETE /user/account → soft delete
  GET /user/device → license device fingerprint info

Show me file + all 4 endpoints.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTH-13A — Electron Deep Link Handler
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: apps/electron/electron/main.ts
Risk: MEDIUM

Add before app creation:
  app.setAsDefaultProtocolClient('zoomguru')

Add handleDeepLink() function that:
  Parses zoomguru://auth?token=xxx URL
  Sends token to renderer via IPC: auth:google-callback

Add app.on('open-url') handler for macOS.
Add argv deep link check for Windows.

In preload.ts, add to contextBridge:
  onGoogleAuth: listener for auth:google-callback IPC
  openGoogleAuth: opens system browser to /auth/google/electron

Show me both file diffs.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTH-13B — Electron Login + Register Updates
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Files: Login.tsx + Register.tsx
Risk: LOW

In Login.tsx:
  Change email input label to "Email or Username"
  Add Google button above the form with SVG logo
  Add divider "or" between Google and form
  Add useEffect to listen for onGoogleAuth callback
  On callback: exchange token at /auth/google/electron/exchange

In Register.tsx:
  Add username field after name field
  Username validates: 3+ chars, alphanumeric + underscore only
  Availability check on blur via GET /auth/check-username
  Include username in register POST body

Add to backend: GET /auth/check-username?username=X
  Returns { available: boolean }

Add to backend: POST /auth/google/electron/exchange
  Verifies short-lived electronToken
  Returns full accessToken + refreshToken

Show me all diffs separately.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTH-14 — Admin App Scaffold
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run first:
  cd apps
  npx create-next-app@latest admin --typescript --tailwind --app --no-src-dir
  cd admin && npm install next-auth@beta recharts @heroicons/react

Create:
  apps/admin/lib/theme.css — light theme CSS variables
  apps/admin/app/layout.tsx — root layout, Inter font, white bg
  apps/admin/auth.ts — NextAuth credentials only (no Google)
    Authorize: call /auth/login, check role === 'admin'
  apps/admin/middleware.ts — protect all routes except /login
  apps/admin/components/AdminLayout.tsx — white sidebar shell
    Nav: Overview, Users, Revenue, Sessions, Referrals, Payouts, Errors, Settings

All pure white/light gray theme. No dark colors.
Show me all created files.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTH-15 — Admin Login Page
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: apps/admin/app/login/page.tsx
Pure light theme. Centered card on #f8fafc background.
Email + password form. No Google button. No register link.
Loading state. Error message. "Authorized personnel only" footer.
Show me the file.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTH-16 — Admin Overview Dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: apps/admin/app/page.tsx
AdminLayout wrapper. Light theme. Uses Recharts.

5 KPI cards: Revenue this month | Active subscribers |
             New users (7d) | Churn rate | Pending payouts

Revenue area chart (30 days, Recharts)
Plan breakdown pie chart (Recharts)
Recent signups table (last 10)
Recent errors table (last 5)
System health row (backend status, DB connections)

Data from existing /admin/stats + /admin/analytics/revenue.
Show me the file.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTH-17 — Admin Users Pages
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create 2 files. Light theme. AdminLayout.

FILE 1: apps/admin/app/users/page.tsx
  Search + filters (plan, role)
  Users table: avatar, name/username, email, plan badge,
    role badge, joined, last active, View button
  Pagination 50/page

FILE 2: apps/admin/app/users/[id]/page.tsx
  Header: avatar, name, badges
  5 sections: Subscription | Usage | Payments | Referrals | Admin Actions
  Actions: Revoke/Reactivate license | Grant/Remove admin | Delete account

Show me both files.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTH-18 — Admin Revenue Analytics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: apps/admin/app/revenue/page.tsx
AdminLayout. Light theme. Recharts heavy.

6 KPI cards: MRR | ARR | Total Revenue | Net Revenue | ARPU | LTV
Revenue area chart (daily, 30/90/365 day toggle)
Stacked bar chart (plan breakdown over time)
NGN vs USD donut chart
Cohort retention color table
Churn rate line chart

Expand /admin/analytics/revenue endpoint to return all these fields.
Show me page + updated service method.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTH-19 — Admin Sessions Analytics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: apps/admin/app/sessions/page.tsx
AdminLayout. Light theme. Recharts.

KPI cards: total sessions, daily avg, avg duration, avg questions
Daily sessions stacked bar (by interview type)
Interview type pie chart
Peak hours bar chart (hour 0-23)
Mac vs Windows donut
Recent sessions table with expandable summaries

Expand /admin/analytics/sessions endpoint.
Show me page + service method.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTH-20A — Admin Referrals Page
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: apps/admin/app/referrals/page.tsx
AdminLayout. Light theme.

KPI cards: total links | signups | converted | commissions earned/paid
Funnel visualization (links → signups → paid → retained)
Top referrers table (rank, username, referred, earned, pending)
All referrals table

Uses existing /admin/analytics/referrals endpoint.
Show me the file.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTH-20B — Admin Payouts Page
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: apps/admin/app/payouts/page.tsx
AdminLayout. Light theme.

Summary cards: pending total | pending count | all-time paid | avg amount
Pending payout cards with Mark as Paid / Reject buttons
Payout history table

Uses existing /admin/payouts endpoints.
Show me the file.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTH-21 — Admin Error Log Viewer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: apps/admin/app/errors/page.tsx
AdminLayout. Light theme.

Error count summary cards (24h / 7d / 30d)
Filters: search text, endpoint, status code
Error table: severity icon, endpoint, message, user, code, time
Expandable stack trace (monospace, copy button)
Auto-refresh every 30 seconds

Add backend: GET /admin/errors?page&limit&search&endpoint
  Queries error_logs table with pagination

Show me file + endpoint.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTH-22 — Admin Settings Page
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: apps/admin/app/settings/page.tsx
AdminLayout. Light theme.

4 sections:
  Your Account: name (editable), email (read-only), change password form
  Admin Management: list all admins, add new admin, remove admin
  System Config: read-only display of all services + URLs
  Pricing Config: read-only display of current prices

Uses /admin/users?role=admin and /admin/users/:id/role endpoints.
Show me the file.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL STEP — Make Yourself Admin
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After deploying everything, run this in Neon SQL Editor:

UPDATE users
SET role = 'admin'
WHERE email = 'your@email.com';

Then log into admin.zoomguru.com with your credentials.
You now have full admin access.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
END OF AUTH + DASHBOARD PROMPTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
