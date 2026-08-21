# ZoomGuru — Live MVP
# Master Context File
# Read this before every session. No exceptions.

---

## What ZoomGuru Is

A desktop Electron app that sits as a transparent overlay
on the user's screen during job interviews. It listens to
questions via microphone, captures screenshots on demand,
and streams AI-generated answers in real time.

The overlay is invisible to screen share software.
The user sees it. The interviewer does not.

---

## Current Phase

LIVE MVP — backend deployed on **Railway**, payments live via Paystack,
landing page live, admin dashboard running.
The five core flows work. Device locking is enforced.
Beyond the core flows, the product now also ships: AI Interviewer
(mock interview + scoring), Meeting/Doc Copilot, a referral system
with Paystack payouts, email broadcasts, and free trials.

Next priorities: brute-force protection on auth, JWT migration
from localStorage to electron-store.

---

## Hosting & Infrastructure

```
Backend    → Railway
             Project:  supportive-flow
             Service:  zoomguru-backend  (root dir: apps/backend)
             URL:      https://zoomguru-backend-production.up.railway.app
             Region:   EU West
             Builder:  Railpack (no Dockerfile)
             Replicas: 1  ← MUST STAY 1, see "Cron Jobs" below

Redis      → Railway managed Redis 8.2 (same project, EU West)
             REDIS_URL is a Railway *reference*: ${{Redis.REDIS_URL}}
             Resolves to the private .railway.internal domain.
             Never paste a literal Redis URL over this reference.

Database   → Supabase PostgreSQL 17  (NOT Neon — see warning below)
             Project ref: vjrmlvlufesmdyicpnbt  ("zoomguru", eu-west-1)
             Connected via the Supavisor pooler
             (aws-0-eu-west-1.pooler.supabase.com)

Downloads  → Cloudflare R2
```

> **The database is Supabase, not Neon.** Earlier revisions of these docs
> said Neon throughout. That was wrong and caused a near-miss where the
> backend was almost pointed at the wrong database. If you see a Neon
> reference anywhere in `.claude/`, it is stale — treat Supabase as truth.

> **Supabase free-tier projects auto-pause after ~7 days idle.** When
> paused, Supavisor returns `tenant/user postgres.<ref> not found` and the
> whole backend 500s while still reporting `/health` 200. This has already
> taken production down once (2026-08-21).

---

## The Five Core Flows

```
FLOW 1: Window
    App launches → splash screen → transparent overlay appears
    Open Zoom → overlay is invisible to screen share
    ✅ Gate: hidden from screen share confirmed

FLOW 2: Auth
    Register (email + name + password) or login
    POST /auth/login → JWT → stored in localStorage
    Dashboard shows subscription status
    ✅ Gate: can register, log in, and see dashboard

FLOW 3: Listen (manual)
    Press Ctrl+Shift+L
    Speak a question (VAD detects speech end automatically)
    POST /ai/transcribe → POST /ai/stream
    Answer streams word by word in overlay
    ✅ Gate: text flows end to end

FLOW 4: Auto mode
    Press Ctrl+Shift+D to toggle
    VAD continuously listens, auto-transcribes, auto-answers
    No hotkey needed per question
    ✅ Gate: hands-free mode works

FLOW 5: Screenshot
    Press Ctrl+Shift+S
    Screen captured → POST /ai/screenshot
    Answer streams in overlay
    ✅ Gate: image flows end to end
```

---

## Monorepo Structure

```
zoomguru/
├── .claude/
│   ├── CLAUDE.md          ← this file (master context)
│   ├── BIBLE.md           ← code generation law
│   ├── ELECTRON.md        ← electron app spec
│   ├── BACKEND.md         ← backend spec
│   ├── DATABASE.md        ← database schema
│   ├── DASHBOARD.md       ← admin dashboard spec
│   ├── AUDIT.md           ← audit notes
│   ├── COMMANDS.md        ← command reference
│   ├── OPTIMIZATION.md    ← performance notes
│   ├── SECURITY-FIXES.md  ← security remediation log
│   ├── SESSION-PROMPTS.md ← session prompt history
│   └── gemini.md          ← gemini-specific notes
├── apps/
│   ├── electron/          ← desktop overlay app
│   ├── backend/           ← nestjs server (Railway)
│   ├── admin/             ← admin dashboard (React + Vite)
│   └── landing/           ← marketing + download page
└── render.yaml            ← LEGACY, Render is decommissioned
```

Note: there is **no root `package.json`**. This is a folder layout, not an
npm-workspaces monorepo. Each app installs and builds independently — which
is why Railway needs `rootDirectory: apps/backend`.

---

## Tech Stack

```
Electron App
    ├── Electron (latest)
    ├── Vite + React 18
    ├── TypeScript strict
    └── No external UI library — plain inline styles

Backend (NestJS on Railway — port 3000 locally)
    ├── NestJS + Fastify adapter (trustProxy: true)
    ├── pg (node-postgres Pool) — the ONLY database driver in use
    │     @neondatabase/serverless is in package.json but never
    │     imported. Dead dependency, safe to remove.
    ├── ioredis (Redis — rate limiting, session log queue)
    ├── @nestjs/jwt (30-day JWT, no refresh tokens)
    ├── bcryptjs (password hashing)
    ├── Resend (transactional email + broadcasts)
    └── @nestjs/schedule (cron — see warning below)

AI
    ├── Gemini 2.0 Flash — PRIMARY for all text answers
    │     Key rotation: GEMINI_API_KEY through GEMINI_API_KEY_5
    ├── DeepSeek (deepseek-chat) — FALLBACK for text answers
    │     Key rotation: DEEPSEEK_API_KEY through DEEPSEEK_API_KEY_5
    ├── Groq Whisper — audio transcription (/ai/transcribe)
    ├── Groq Llama-4-Scout — vision/screenshot (/ai/screenshot)
    └── LemonFox — text-to-speech for AI Interviewer (optional;
          without LEMONFOX_API_KEY the interviewer runs silently)

Database
    └── Supabase PostgreSQL 17 — direct SQL, via the Supavisor pooler
```

---

## Cron Jobs — DO NOT SCALE PAST 1 REPLICA

`apps/backend/src/cron/cron.service.ts` defines five `@Cron` jobs:

```
sendNoPaymentFollowUps   0 11 * * *   (UTC)
sendExpiryReminders      0 9  * * *   (UTC)
resetWeeklyUsage         0 1  * * *   (UTC)
resetMonthlyUsage        0 2  * * *   (UTC)
flushSessionLogQueue     */30 * * * * *  (every 30s)
```

**None of them take a distributed lock or do leader election.** If the
service runs more than one replica, every replica fires every job:
duplicate expiry and follow-up emails to real customers, plus an
`lrange`/`ltrim` race in `flushSessionLogQueue`.

Keep Railway at 1 replica. To scale horizontally, add a Postgres advisory
lock around each job first.

---

## User Flow (Electron App)

```
App opens
  └─ localStorage has token? → Dashboard
  └─ No token → Login
       └─ Sign up → Register
       └─ Forgot password → email reset flow

Dashboard
    Shows subscription status (inactive / active / past_due / cancelled)
    Free trial available (POST /subscription/trial, device-bound)
    Pay via hosted checkout (POST /payments/session) or Paystack inline
    → POST /subscription/verify → Continue → CvSetup

CvSetup
    Upload CV (PDF/TXT/MD) → parsed via pdf-parse → stored in electron-store
    Paste job description text → stored in electron-store
    → Done → Overlay

Overlay
    Global hotkeys active (see below)
    Session cap enforced per plan
    CV text + JD text attached to every AI request
```

---

## Global Hotkeys

```
Ctrl+Shift+L  (fallback: Ctrl+Alt+L)  → Toggle manual listen mode
Ctrl+Shift+S  (fallback: Ctrl+Alt+S)  → Take screenshot + answer
Ctrl+Shift+H  (fallback: Ctrl+Alt+H)  → Hide / show overlay
Ctrl+Shift+C  (fallback: Ctrl+Alt+C)  → Clear current answer
Ctrl+Shift+D  (fallback: Ctrl+Alt+D)  → Toggle auto VAD mode
```

---

## Backend Endpoints

```
Auth
    POST /auth/register          { email, name, password }
    POST /auth/login             { email, password } + X-Device-ID header
    POST /auth/forgot-password   { email }
    GET  /auth/reset-password-page?token=...
    POST /auth/reset-password    { token, newPassword }

Device
    POST /device/register        { keyId, publicKey }  (Bearer token)

AI  (all require Authorization: Bearer <token> + device signature headers)
    POST /ai/stream                { transcript, cvText?, jdText? }  → SSE
    POST /ai/screenshot            { image (base64), cvText?, jdText? } → SSE
    POST /ai/transcribe            { audio (base64) }  → { transcript }
    POST /ai/meeting-stream        → SSE   (meeting copilot)
    POST /ai/doc-copilot           → SSE   (document copilot)
    POST /ai/interviewer-start     (AI Interviewer session)
    POST /ai/interviewer-question  (next question)
    POST /ai/score-session         (interview scoring report)
    POST /ai/tts                   (LemonFox text-to-speech)

Subscription  (requires Authorization: Bearer <token>)
    GET  /subscription/status
    GET  /subscription/usage
    POST /subscription/trial     + X-Key-ID header (device-bound trial)
    POST /subscription/verify    { reference } + X-Key-ID header
    POST /subscription/webhook   (Paystack HMAC-verified, raw body)

Payments  (hosted checkout)
    POST /payments/create
    POST /payments/session
    POST /payments/confirm

Referral
    GET  /referral/dashboard
    GET  /referral/banks
    POST /referral/bank/save
    POST /referral/bank/verify
    POST /referral/payout/request

Admin  (requires X-Admin-Key header)
    GET    /admin/stats
    GET    /admin/signups?days=30
    GET    /admin/payments?days=30
    GET    /admin/usage?days=30
    GET    /admin/downloads?days=30
    GET    /admin/users
    GET    /admin/referrals
    GET    /admin/email-test
    GET    /admin/broadcast
    POST   /admin/broadcast
    POST   /admin/broadcast/preview
    POST   /admin/broadcast/recipients
    POST   /admin/broadcast/:id/retry
    DELETE /admin/broadcast/:id

Webhooks
    POST /broadcast/webhook      (Resend delivery/open events)

Analytics  (public)
    GET /analytics/download?platform=windows|mac

Health
    GET /health
```

> `/health` is a **liveness** check only — it returns `{"status":"ok"}` even
> when Postgres and Redis are unreachable, because `initDB()` is
> fire-and-forget (`main.ts`). A green health check does not mean the app
> works. To verify the data layer, make an authenticated call, or POST bogus
> credentials to `/auth/login` and confirm a **401** (a 500 means the DB is
> down).

---

## Paystack Integration

```
Plans are weekly / monthly / yearly, driven by Paystack plan codes.
The backend maps Paystack's plan.interval → our plan column:
    weekly → weekly, monthly → monthly, annually|yearly → yearly

Two payment paths:
    1. Hosted checkout  → POST /payments/session → /payments/confirm
       (used by the landing page at zoomguru.xyz)
    2. Paystack inline.js in the Electron dashboard
       → POST /subscription/verify { reference }

Webhook: POST /subscription/webhook
    HMAC-SHA512 over the raw body using PAYSTACK_SECRET_KEY.
    No IP allowlist — purely signature based.
    Idempotent on paystack_reference (a replayed event is a no-op).

    ⚠ The webhook URL is configured in the Paystack dashboard and must
      point at the Railway host. If it still points at the old Render URL,
      payments will not confirm.

Prices live in the Paystack dashboard, not in this repo — check there
rather than trusting any figure written here.
```

---

## Device Locking

Device locking is enforced at AI endpoint time, not at login time.

```
How it works:
    X-Key-ID: a UUID identifying the device's keypair (registered via POST /device/register)
    X-Timestamp: Unix timestamp of the request
    X-Signature: ECDSA P-256 signature over "timestamp:userId" signed by the device private key

    checkAccess() in subscription.service.ts:
        Reads X-Key-ID, X-Timestamp, X-Signature from request headers
        Verifies signature against the registered public key in device_keys table
        On first active subscription use: binds the key ID to the subscription (locked_key_id)
        Subsequent requests: key ID must match locked_key_id or locked_key_id_2

Free trials are also device-bound, via users.trial_key_id, so the same
machine cannot claim repeated trials.
```

---

## Rate Limiting (AI Endpoints Only)

```
15 requests per 60 seconds per user
Enforced via Redis INCR + EXPIRE
Returns 429 { error: 'rate_limit', retryAfter: N } when exceeded
Auth endpoints are NOT rate limited yet — post-launch priority
```

---

## SSE Streaming Format

```
Content-Type: text/event-stream

data: {"chunk":"word ","done":false}\n\n
data: {"chunk":"by ","done":false}\n\n
data: {"done":true}\n\n
```

---

## Database Schema

Live schema, verified against Supabase. 12 tables in `public`.

```sql
users (
    id UUID PK, email, password_hash, name, username,
    is_pro BOOLEAN, created_at,
    referral_code TEXT, referred_by_user_id UUID,
    trial_started_at TIMESTAMPTZ, trial_key_id TEXT
)

subscriptions (
    id UUID PK, user_id UUID FK → users,
    status ('inactive'|'active'|'past_due'|'cancelled'),
    plan TEXT, current_period_start, current_period_end,
    paystack_customer_code, paystack_subscription_code,
    paystack_reference TEXT,
    locked_device_id, locked_device_id_2,   -- legacy device locking
    locked_key_id, locked_key_id_2,         -- current keypair locking
    created_at, updated_at
)

device_keys (
    id UUID PK, user_id UUID FK → users,
    key_id TEXT, public_key TEXT, created_at
)

usage (
    user_id UUID, plan_type TEXT, period_start TIMESTAMPTZ,
    copilot_requests INT, interviewer_sessions INT,
    scorer_reports INT, doc_copilot_requests INT, updated_at
)

password_reset_tokens (
    id UUID PK, user_id FK → users,
    token_hash TEXT, expires_at (1 hour TTL), created_at
)

referral_commissions (
    id UUID PK, referrer_user_id UUID, referred_user_id UUID,
    amount_kobo INT, payment_reference TEXT,
    status TEXT, created_at, paid_at
)

referral_bank_accounts (
    id UUID PK, user_id UUID,
    account_number, bank_code, bank_name, account_name,
    recipient_code TEXT, created_at, updated_at
)

broadcasts (
    id UUID PK, subject, body, target_filter JSONB,
    status TEXT, scheduled_at, sent_at,
    recipient_count INT, open_count INT, created_at
)

broadcast_batches (
    id UUID PK, broadcast_id UUID FK → broadcasts,
    batch_index INT, status TEXT, recipients TEXT[],
    scheduled_at, sent_at, error TEXT, retry_count INT, created_at
)

ai_sessions (
    id UUID PK, user_id FK → users (nullable),
    type ('stream'|'screenshot'|'transcribe'), created_at
)

downloads (id UUID PK, platform, version, ip, created_at)

schema_version (version INT)
```

---

## Environment Variables

```env
# Backend (apps/backend/.env) — set in the Railway dashboard in production
DATABASE_URL=          # Supabase pooler connection string
DATABASE_POOL_URL=     # REQUIRED when NODE_ENV=production — app exits without it
JWT_SECRET=            # Any long random string
REDIS_URL=             # Railway reference: ${{Redis.REDIS_URL}}
GEMINI_API_KEY=        # Required
GEMINI_API_KEY_2..5=   # Optional key rotation
DEEPSEEK_API_KEY=      # Required (fallback)
DEEPSEEK_API_KEY_2..5= # Optional key rotation
GROQ_API_KEY=          # Transcription + vision
OPENAI_API_KEY=        # Optional
LEMONFOX_API_KEY=      # AI Interviewer TTS (optional — silent without it)
PAYSTACK_SECRET_KEY=   # Paystack secret
PAYSTACK_PUBLIC_KEY=   # Paystack public
RESEND_API_KEY=        # Transactional email
RESEND_WEBHOOK_SECRET= # Verifies /broadcast/webhook events
FROM_EMAIL=            # Verified sender address
ADMIN_KEY=             # For /admin/* endpoints
ADMIN_EMAIL=           # Admin notification recipient
APP_URL=               # PUBLIC BACKEND URL — used in password reset links.
                       # Must be the Railway URL, or reset emails 404.
CHECKOUT_URL=          # Hosted checkout origin (defaults to https://zoomguru.xyz)
ADMIN_CORS_ORIGIN=     # Admin dashboard origin
ELECTRON_ORIGIN=       # app://zoomguru in production
R2_DOWNLOAD_URL_WINDOWS=
R2_DOWNLOAD_URL_MAC=
PORT=                  # Defaults to 3000
NODE_ENV=

# Electron (apps/electron/.env)
VITE_API_URL=          # Defaults to https://zoomguru-backend-production.up.railway.app
VITE_PAYSTACK_PUBLIC_KEY=
VITE_PAYSTACK_PLAN_MONTHLY=  # PLN_xxx from Paystack dashboard
```

The backend hard-exits on boot if any of these are missing (`main.ts`):
`DATABASE_URL, JWT_SECRET, REDIS_URL, GEMINI_API_KEY, DEEPSEEK_API_KEY,
GROQ_API_KEY, PAYSTACK_SECRET_KEY, RESEND_API_KEY, FROM_EMAIL, ADMIN_KEY`
— plus `DATABASE_POOL_URL` whenever `NODE_ENV=production`.

---

## Client API URL

The Electron renderer reads the API base from **one** place:

```
apps/electron/src/utils.ts  →  export const API_URL
```

All renderer files import it from there. Do not re-declare it per file.

Changing hosts requires **two** edits, not one:
1. `apps/electron/src/utils.ts` — the API base
2. `apps/electron/electron/main.ts` — the CSP `connect-src` entry

The main process cannot import from `src/`, so the CSP entry is a separate
literal. If it is not updated, the packaged app blocks every API request at
the CSP layer no matter what `API_URL` says.

`VITE_*` values are inlined at build time — changing an env var does nothing
for already-packaged binaries. The app must be rebuilt and redistributed.

---

## Local Development

```
Backend URL:     http://localhost:3000
Electron dev:    http://localhost:5173 (Vite)
Database:        Supabase (cloud, always accessible unless paused)
AI APIs:         Gemini + DeepSeek + Groq (cloud, need internet)

Start backend:   cd apps/backend && npm run start:dev
Start electron:  cd apps/electron && npm run dev
Start admin:     cd apps/admin && npm run dev

Set VITE_API_URL=http://localhost:3000 in apps/electron/.env
to point the Electron app at local backend during development.
```

---

## Known Security Issues (Prioritised)

```
OPEN — implement before scaling:
    1. No brute-force protection on /auth/login and /auth/register
       (Redis is available — add rate limit by IP)
    2. JWT stored in localStorage (renderer)
       (should move to electron-store via IPC)
    3. Device fingerprint is client-generated and forgeable
       (architectural — needs server-side challenge post-launch)
    4. Cron jobs have no distributed lock (see "Cron Jobs" above)
```

---

## What Is Still Deferred

```
    ├── Google OAuth — email/password only for now
    ├── Wake word (Porcupine) — hotkeys only
    ├── Auto-updater  ← note: this is why host changes are expensive
    ├── Brute-force protection on auth endpoints
    ├── JWT in electron-store (currently localStorage)
    ├── Server-side device fingerprint verification
    ├── Cloudflare protection
    └── DB-enforced usage caps (the `usage` table tracks, but the
        per-session cap is still enforced client-side)
```

Shipped since earlier revisions of this file: referral system, AI
Interviewer, meeting/doc copilot, email broadcasts, free trials.

---

## Universal Rules (Active Every Session)

1. Run graphify claude install once per machine (done)
2. Always read BIBLE.md before generating any code
3. Complete files only — never patches or partial output
4. tsc --noEmit must pass before any file is considered done
5. One file at a time — verify before moving to next
6. IPC channels must exist in all four places:
   main.ts + preload.ts + type definition + renderer call
7. API calls must match endpoint method + path + headers + body
8. No TODO comments in generated code
9. No placeholder functions
10. No assumed APIs — only use what exists in this codebase

---

## Andrej Karpathy Coding Guidelines

### 1. Think Before Coding
Don't assume. Don't hide confusion. Surface tradeoffs.
Before implementing: state assumptions, present multiple
interpretations if they exist, push back when a simpler
approach exists, stop and ask if something is unclear.

### 2. Simplicity First
Minimum code that solves the problem. Nothing speculative.
No features beyond what was asked. No abstractions for
single-use code. No "flexibility" that wasn't requested.
No error handling for impossible scenarios.
If 200 lines could be 50, rewrite it.

### 3. Surgical Changes
Touch only what you must. Clean up only your own mess.
Don't "improve" adjacent code, comments, or formatting.
Don't refactor things that aren't broken. Match existing style.
Remove imports/variables/functions that YOUR changes made
unused — don't touch pre-existing dead code unless asked.

### 4. Goal-Driven Execution
Define success criteria. Loop until verified.
Transform tasks into verifiable goals. For multi-step tasks,
state a brief plan with verify steps before starting.
