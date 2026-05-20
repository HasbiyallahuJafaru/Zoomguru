# ZoomGuru — Auth & Dashboard Context

## What This Module Covers

Full authentication system (username/password + Google OAuth)
across three surfaces:

1. Landing + User Dashboard (zoomguru.com) — Next.js, Netlify
2. Admin Dashboard (admin.zoomguru.com) — separate Next.js, Netlify
3. Electron App — username login + device fingerprint display

---

## Auth Architecture

```
Web Auth (NextAuth.js v5)
    ├── Credentials provider — username OR email + password
    ├── Google OAuth provider — Google Cloud OAuth 2.0
    ├── Sessions stored in Neon (database sessions strategy)
    ├── JWT for API calls to backend
    └── Shared auth logic between landing app and admin app

Electron Auth (existing JWT system — extended)
    ├── Login accepts username OR email
    ├── Device fingerprint sent on every request
    ├── Token stored in electron-store (encrypted)
    └── Deep link callback for Google OAuth in Electron
```

---

## User Dashboard Routes (zoomguru.com)

```
/login                    Email or username + password, Google button
/register                 Username + email + password + Google
/dashboard                Home — subscription status, quick stats
/dashboard/subscription   Plan details, upgrade, cancel
/dashboard/payments       Full transaction history
/dashboard/sessions       Interview session summaries
/dashboard/referrals      Referral link, earnings, payout request
/dashboard/settings       Profile, username, password change, avatar
```

---

## Admin Dashboard Routes (admin.zoomguru.com)

```
/login                    Admin credentials only — no Google
/                         Overview — revenue, users, health, errors
/users                    All users table — search, filter, sort
/users/[id]               Single user — full profile, actions
/revenue                  MRR, ARR, churn, LTV, cohort charts
/sessions                 Interview analytics, usage patterns
/referrals                Referral funnel, top referrers
/payouts                  Pending payout requests — approve/reject
/errors                   Error log viewer, filtered by severity
/settings                 Admin account management
```

---

## DB Schema Additions

```sql
-- users table — new columns
username              TEXT UNIQUE NOT NULL
google_id             TEXT UNIQUE
avatar_url            TEXT
role                  TEXT DEFAULT 'user'   -- 'user' | 'admin'
last_login_at         TIMESTAMPTZ
login_count           INTEGER DEFAULT 0

-- nextauth sessions (web sessions)
CREATE TABLE nextauth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires TIMESTAMPTZ NOT NULL
);

CREATE TABLE nextauth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  UNIQUE(provider, provider_account_id)
);

CREATE TABLE nextauth_verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  PRIMARY KEY(identifier, token)
);
```

---

## Google OAuth Flow

```
Web:
  User clicks "Continue with Google"
  → Redirect to Google consent screen
  → Google redirects to zoomguru.com/api/auth/callback/google
  → NextAuth creates/updates user in Neon
  → Redirect to /dashboard

Electron:
  User clicks "Continue with Google" in app
  → Opens system browser to zoomguru.com/auth/google/electron
  → After Google consent, backend generates short-lived token
  → Redirects to deep link: zoomguru://auth?token=xxx
  → Electron intercepts deep link, exchanges token for JWT
  → User logged in
```

---

## Admin Role System

```
users.role column:
  'user'   — default, accesses user dashboard only
  'admin'  — accesses admin dashboard + all admin endpoints

Granting admin:
  Via backend endpoint: PATCH /admin/users/:id/role
  Protected by: existing admin + ADMIN_SECRET_KEY header
  First admin: set manually via Neon SQL console

Admin middleware checks:
  1. Valid JWT
  2. users.role = 'admin'
  3. Request comes from admin.zoomguru.com origin
```

---

## Cloudflare Setup

```
Free tier protection on all domains:
  zoomguru.com          → proxied to Netlify
  admin.zoomguru.com    → proxied to Netlify (admin app)
  api.zoomguru.com      → proxied to Render backend

WAF rules (free):
  Block requests from known bad IPs
  Rate limit: /api/auth/* → 10 requests per minute per IP
  Rate limit: /api/paystack/webhook → 100/min (Paystack IPs only)
  Bot fight mode: ON

SSL: Full (strict) — Cloudflare handles certs
```

---

## Analytics Stack

```
Admin dashboard charts: Recharts (React charting library)
Data source: Direct queries to Neon via backend /admin/* endpoints
No external analytics service needed
All data already in your DB

Chart types used:
  Line chart   — revenue over time, signups over time
  Bar chart    — sessions per day, questions per type
  Area chart   — MRR growth
  Pie chart    — plan breakdown, currency split
  Table        — users, payouts, errors
  Stat cards   — KPI numbers at top of each page
```

---

## Styling

```
User Dashboard:
  Same dark theme as landing page
  Consistent with ZoomGuru brand
  Font: Syne (already used on landing)
  Colors: Same CSS variables as landing

Admin Dashboard:
  Pure light theme — white backgrounds
  Clean, data-focused, readable
  Font: Inter (clarity for data tables)
  Colors:
    Background: #ffffff / #f8fafc
    Surface: #f1f5f9
    Border: #e2e8f0
    Text: #0f172a
    Accent: #4f6ef7 (same brand blue)
    Success: #10b981
    Danger: #ef4444
    Warning: #f59e0b
```

---

## Environment Variables — New Additions

```env
# Both apps
NEXTAUTH_SECRET=random_64_char_string
NEXTAUTH_URL=https://zoomguru.com          # landing app
NEXTAUTH_URL=https://admin.zoomguru.com   # admin app

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Backend
GOOGLE_CLIENT_ID=same_as_above
GOOGLE_CLIENT_SECRET=same_as_above
ELECTRON_OAUTH_SECRET=random_32_char_string  # for deep link token

# Admin app
NEXT_PUBLIC_API_URL=https://api.zoomguru.com
ADMIN_APP_SECRET=random_32_char_string       # extra admin app auth
```

---

## Patch Order for This Module

```
AUTH-01   DB schema additions (users table + nextauth tables)
AUTH-02   Backend auth extensions (username login, Google, admin role)
AUTH-03   Google Cloud project setup (guided prompt)
AUTH-04   Cloudflare setup (guided prompt)
AUTH-05   NextAuth setup in landing app
AUTH-06   Login + Register pages (web)
AUTH-07   User dashboard layout + home page
AUTH-08   Subscription page
AUTH-09   Payments history page
AUTH-10   Sessions page
AUTH-11   Referrals page
AUTH-12   Settings page
AUTH-13   Electron auth extensions (username login, Google deep link)
AUTH-14   Admin app scaffold
AUTH-15   Admin login page
AUTH-16   Admin overview dashboard
AUTH-17   Admin users page + user detail
AUTH-18   Admin revenue analytics
AUTH-19   Admin sessions analytics
AUTH-20   Admin referrals + payouts
AUTH-21   Admin error log viewer
AUTH-22   Admin settings
```
