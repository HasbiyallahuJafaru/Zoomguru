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

LIVE MVP — backend deployed on Render, payments live via Paystack,
landing page live, admin dashboard running.
Four core flows are working. Device locking is enforced.
Next priorities: brute-force protection on auth, JWT migration
from localStorage to electron-store.

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
│   ├── CLAUDE.md          ← this file
│   ├── BIBLE.md           ← code generation law
│   ├── ELECTRON.md        ← electron app spec
│   ├── BACKEND.md         ← backend spec
│   └── DATABASE.md        ← neon schema
├── apps/
│   ├── electron/          ← desktop overlay app
│   ├── backend/           ← nestjs server (Render)
│   ├── admin/             ← admin dashboard (React + Vite)
│   └── landing/           ← marketing + download page
└── package.json
```

---

## Tech Stack

```
Electron App
    ├── Electron (latest)
    ├── Vite + React 18
    ├── TypeScript strict
    └── No external UI library — plain inline styles

Backend (NestJS on Render — port 3000 locally)
    ├── NestJS + Fastify adapter
    ├── @neondatabase/serverless (Neon PostgreSQL)
    ├── ioredis (Redis — rate limiting)
    ├── @nestjs/jwt (30-day JWT, no refresh tokens)
    ├── bcryptjs (password hashing)
    ├── Resend (transactional email)
    └── @nestjs/schedule (cron — expiry reminders)

AI
    ├── Gemini 2.0 Flash — PRIMARY for all text answers
    │     Key rotation: GEMINI_API_KEY through GEMINI_API_KEY_5
    ├── DeepSeek (deepseek-chat) — FALLBACK for text answers
    │     Key rotation: DEEPSEEK_API_KEY through DEEPSEEK_API_KEY_5
    ├── Groq Whisper — audio transcription (/ai/transcribe)
    └── Groq Llama-4-Scout — vision/screenshot (/ai/screenshot)

Database
    └── Neon PostgreSQL — direct SQL, @neondatabase/serverless
```

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
    Pay via Paystack inline.js → POST /subscription/verify
    → Continue → CvSetup

CvSetup
    Upload CV (PDF/TXT/MD) → parsed via pdf-parse → stored in electron-store
    Paste job description text → stored in electron-store
    → Done → Overlay

Overlay
    Global hotkeys active (see below)
    Session cap: 50 questions per session for monthly plan
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

AI  (all require Authorization: Bearer <token> + X-Device-ID header)
    POST /ai/stream        { transcript, cvText?, jdText? }  → SSE
    POST /ai/screenshot    { image (base64), cvText?, jdText? }  → SSE
    POST /ai/transcribe    { audio (base64) }  → { transcript }

Subscription  (requires Authorization: Bearer <token>)
    GET  /subscription/status
    POST /subscription/verify    { reference }  + X-Device-ID header
    POST /subscription/webhook   (Paystack HMAC-verified)

Admin  (requires X-Admin-Key header)
    GET /admin/stats
    GET /admin/signups?days=30
    GET /admin/payments?days=30
    GET /admin/usage?days=30
    GET /admin/downloads?days=30
    GET /admin/users

Analytics  (public)
    GET /analytics/download?platform=windows|mac

Health
    GET /health
```

---

## Paystack Integration (Inline.js)

```
Monthly plan  → pop.setup({ plan: VITE_PAYSTACK_PLAN_MONTHLY })
                Recurring ₦50,000/month
                Plan code (PLN_xxx) must exist in Paystack dashboard

Lifetime plan → pop.setup({ amount: 100_000_000 })
                One-time ₦1,000,000 (amount in kobo)

After payment → POST /subscription/verify { reference }
                Backend calls Paystack API to confirm
                Monthly: provisional 30-day period_end (webhook corrects it)
                Lifetime: current_period_end = 2099-12-31
                Device is locked on first AI use after subscription is active
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

```sql
users (
    id UUID PK, email UNIQUE, password_hash,
    name, username UNIQUE, is_pro BOOLEAN, created_at
)

subscriptions (
    id UUID PK, user_id UUID UNIQUE FK → users,
    status CHECK IN ('inactive','active','past_due','cancelled'),
    plan TEXT, current_period_start, current_period_end,
    paystack_customer_code, paystack_subscription_code,
    locked_device_id TEXT, created_at, updated_at
)

password_reset_tokens (
    id UUID PK, user_id FK → users,
    token_hash TEXT, expires_at (1 hour TTL), created_at
)

downloads (id UUID PK, platform, version, ip, created_at)

ai_sessions (
    id UUID PK, user_id FK → users (nullable),
    type CHECK IN ('stream','screenshot','transcribe'), created_at
)
```

---

## Environment Variables

```env
# Backend (apps/backend/.env)
DATABASE_URL=          # Neon PostgreSQL connection string
DATABASE_POOL_URL=     # Optional — pooled URL for multi-instance
JWT_SECRET=            # Any long random string
REDIS_URL=             # Redis connection string
GEMINI_API_KEY=        # Required
GEMINI_API_KEY_2=      # Optional key rotation
GEMINI_API_KEY_3=      # Optional
GEMINI_API_KEY_4=      # Optional
GEMINI_API_KEY_5=      # Optional
DEEPSEEK_API_KEY=      # Required (fallback)
DEEPSEEK_API_KEY_2=    # Optional
GROQ_API_KEY=          # For transcription + vision
PAYSTACK_SECRET_KEY=   # Paystack secret
RESEND_API_KEY=        # For transactional email
FROM_EMAIL=            # Sender address
ADMIN_KEY=             # For /admin/* endpoints
APP_URL=               # Base URL for password reset links
ADMIN_CORS_ORIGIN=     # Admin dashboard origin
R2_DOWNLOAD_URL_WINDOWS= # Cloudflare R2 download URL
R2_DOWNLOAD_URL_MAC=      # Cloudflare R2 download URL

# Electron (apps/electron/.env)
VITE_API_URL=          # Defaults to https://zoomguru.onrender.com
VITE_PAYSTACK_PUBLIC_KEY=
VITE_PAYSTACK_PLAN_MONTHLY=  # PLN_xxx from Paystack dashboard
```

---

## Local Development

```
Backend URL:     http://localhost:3000
Electron dev:    http://localhost:5173 (Vite)
Database:        Neon PostgreSQL (cloud, always accessible)
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
```

---

## What Is Still Deferred

```
    ├── Google OAuth — email/password only for now
    ├── Wake word (Porcupine) — hotkeys only
    ├── Auto-updater
    ├── Brute-force protection on auth endpoints
    ├── JWT in electron-store (currently localStorage)
    ├── Server-side device fingerprint verification
    ├── Referral system
    ├── Cloudflare protection
    └── Free tier / usage limits (monthly cap is session-only, not DB-enforced)
```

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
