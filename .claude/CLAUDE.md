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
The five core flows work. There is no device binding — an account works on any number of machines.
Beyond the core flows, the product now also ships: AI Interviewer
(mock interview + scoring), Meeting/Doc Copilot, a referral system
with Paystack payouts, email broadcasts, and free trials.

Next priority: brute-force protection on auth.

---

## Hosting & Infrastructure

```
Backend    → Railway
             Project:  supportive-flow
             Service:  zoomguru-backend  (root dir: apps/backend)
             URL:      https://zoomguru-backend-production.up.railway.app
             Region:   EU West
             Builder:  Railpack (no Dockerfile)
             Replicas: 1  ← raisable now, see "Cron Jobs" below

Redis      → Railway managed Redis 8.2 (same project, EU West)
             REDIS_URL is a Railway *reference*: ${{Redis.REDIS_URL}}
             Resolves to the private .railway.internal domain.
             Never paste a literal Redis URL over this reference.

Database   → Supabase PostgreSQL 17  (NOT Neon — see warning below)
             Project ref: vjrmlvlufesmdyicpnbt  ("zoomguru", eu-west-1)
             Connected via the Supavisor pooler
             (aws-0-eu-west-1.pooler.supabase.com)

Downloads  → Cloudflare R2  (moved off Firebase 2026-09-06)
             Account: jafaruhasbiyallahu@hotmail.com  (NOT the Google
                      account the rest of the stack uses)
             Bucket:  zoomguru-releases  (WEUR, created 2026-05-31)
             Object:  ZoomGuru-Setup.exe  (fixed name, overwritten in place,
                      so the URL never changes between releases)
             Public:  https://dl.zoomguru.xyz  (custom domain, min TLS 1.2,
                      zone 7c465953a791c6c9006a8961f44ecd64)
                      r2.dev URL still exists but is NOT what is served
             Vars: APP_DOWNLOAD_LINK_WINDOWS / APP_DOWNLOAD_LINK_MAC. Renamed
             from R2_DOWNLOAD_URL_* — that name survived two host moves and
             misled a reader each time. Both names are currently set to the
             same R2 URL; the old one is still read as a fallback, drop it
             once Railway no longer sets it.
             APP_DOWNLOAD_LINK_MAC is UNSET, so mac downloads 503.

             Upload with wrangler — and note the trap:
               npx wrangler r2 object put zoomguru-releases/ZoomGuru-Setup.exe \
                 --file=apps/electron/release/ZoomGuru-Setup.exe \
                 --content-type application/octet-stream --remote
             ⚠ WITHOUT --remote, wrangler 4.x writes to a LOCAL simulator and
             still prints "Upload complete". Nothing reaches Cloudflare. The
             tell is that `wrangler r2 bucket info` (which IS remote) does not
             change. bucket subcommands are remote by default; object ones are
             not.

             Custom domain attached 2026-09-06; r2.dev is rate-limited by
             Cloudflare and unfit for production, so do not point anything
             back at it.

             Why not Firebase: the bucket
             zoomguru-downloads.firebasestorage.app still holds the old
             2026-08-28 build, but jhasbiyallahu@gmail.com has NO
             storage.objects.create on it — its apparent read access is a
             public allUsers grant, not a role. Nobody knows which identity
             published that build. The bucket is also publicly LISTABLE.
             Delete it once R2 is proven.

             electron-builder also has a GitHub publish provider; that
             release asset is NOT what the download button serves.
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
    POST /auth/login → JWT → stored in electron-store (via IPC)
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
    ├── ioredis (Redis — rate limiting, session log queue)
    ├── @nestjs/jwt (3-hour JWT, no refresh tokens — users re-login every 3h)
    ├── bcryptjs (password hashing)
    ├── Resend (transactional email + broadcasts)
    └── @nestjs/schedule (cron — see warning below)

AI
    ├── gemini-3.1-flash-lite — PRIMARY for Listen and Screenshot
    │     Key rotation: GEMINI_API_KEY through GEMINI_API_KEY_5
    │     thinkingLevel is 'minimal' — Gemini 3.x replaced the numeric
    │     thinkingBudget with this enum; without it, thinking tokens eat
    │     maxOutputTokens and answers truncate mid-sentence. Sending the
    │     old thinkingBudget key is a 400 on some 3.x models.
    │     GEMINI_MODEL in ai.service.ts is the single source of truth —
    │     it feeds both Gemini URLs and the OpenRouter slug.
    ├── OpenRouter google/gemini-3.1-flash-lite — the ONLY fallback for
    │     every text path. Optional key, but nothing backs Gemini up
    │     without it. Multimodal, so one tier serves text and vision.
    ├── Groq Whisper — audio transcription (/ai/transcribe)
    ├── Groq Llama-4-Scout — vision fallback (/ai/screenshot)
    └── LemonFox — text-to-speech for AI Interviewer (optional;
          without LEMONFOX_API_KEY the interviewer runs silently)

DeepSeek has been removed entirely — no keys, no client, no balance panel.

Fallback order. Listen and Screenshot share one circuit breaker; the other
three paths fall through on a per-request basis:

    Listen       Gemini → OpenRouter
    Screenshot   Gemini → OpenRouter → Groq vision → OpenAI vision
    Interviewer  Gemini → OpenRouter
    Scoring      Gemini → OpenRouter   (JSON, non-streaming)
    Meeting/Doc  Gemini → OpenRouter

A SINGLE Gemini failure sets `ai:gemini:down` in Redis with a 60s TTL, and
every later request on BOTH features skips Gemini until it expires. The TTL
is the reset — there is no timer and nothing to clean up. Keep it SHORT: it
only has to cover a burst of requests hitting the same outage, not the outage
itself. It was 6h, which meant one transient 429 pinned every user to
OpenRouter for the rest of the day. Redis down reads as
untripped, so Gemini is still tried: the breaker is an optimisation, never a
gate. `GEMINI_BREAKER_TTL_SEC` in ai.service.ts is the single source of truth.

Self-check: npm run build && node scripts/check-ai-fallback.mjs
            (branching, all mocked, free)

Key check:  node scripts/check-gemini-keys.mjs
            (or `railway run node scripts/check-gemini-keys.mjs` for prod)
            Calls Google with every configured key and prints status only.
            Tells apart the three states that all LOOK configured:
              401 UNAUTHENTICATED  = key deleted or invalid
              429 RESOURCE_EXHAUSTED = out of prepayment credits (billing)
              404 NOT_FOUND        = that project lost access to the model
              503 UNAVAILABLE      = transient, re-run before concluding

Live check: npm run build && node scripts/check-ai-live.mjs
            Drives the real streamAnswer/streamScreenshot against the real
            Gemini key and asserts GEMINI served both — a wrong model ID or
            thinkingConfig shape 400s, falls through to OpenRouter, and fails
            the check instead of quietly costing money. Spends a few hundred
            tokens per run. Run it after ANY change to the model constants.

Database
    └── Supabase PostgreSQL 17 — direct SQL, via the Supavisor pooler
```

---

## Cron Jobs — safe on multiple replicas

`apps/backend/src/cron/cron.service.ts` defines six `@Cron` jobs:

```
expireLapsedSubscriptions 15 0 * * *   (UTC)   idempotent WHERE
sendNoPaymentFollowUps    0 11 * * *   (UTC)   advisory lock
sendExpiryReminders       0 9  * * *   (UTC)   advisory lock
resetWeeklyUsage          0 1  * * *   (UTC)   idempotent overwrite
resetMonthlyUsage         0 2  * * *   (UTC)   idempotent overwrite
flushSessionLogQueue      */30 * * * * *       atomic RPOP
```

Every job is now safe to fire on every replica. Only the two that email real
customers take a lock — `withLock()` in cron.service.ts, a session-level
`pg_try_advisory_lock`, where the replica that loses the race skips the tick.
The other four are idempotent by construction and deliberately take no lock:
the expiry job's `WHERE` excludes rows it has already updated, the two usage
resets overwrite to the same zeroes, and `flushSessionLogQueue` pops with
`RPOP key count` (Redis 6.2+), which is atomic — that is its lock.

Self-check: `npm run build && node scripts/check-cron.mjs`

Railway is still set to 1 replica; nothing in the code requires it any more.
Raise it in the dashboard when load justifies it.

---

## User Flow (Electron App)

```
App opens
  └─ electron-store has token? → Dashboard
  └─ No token → Login
       └─ Sign up → Register
       └─ Forgot password → email reset flow

Dashboard
    Shows subscription status (inactive / active / past_due / cancelled)
    Free trial available (POST /subscription/trial, device-bound)
    Pay via hosted checkout (POST /payments/session) or Paystack inline
    → POST /subscription/verify → Continue → CvSetup

CvSetup
    Upload CV (PDF/DOCX/TXT/MD) → parsed by electron/documents.ts → electron-store
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
    POST /auth/login             { email, password, revokeSid? }
                                 409 { error:'session_limit', sessions:[...] } when full
    GET  /auth/sessions          (Bearer) → { max, sessions[] }
    POST /auth/logout            (Bearer) { sid? }  omit sid to end your own

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
    POST /subscription/verify    { reference }
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
    GET    /admin/stats          includes online_now — how many people have the
                                 app open, counted from the session cap's
                                 existing `seen` stamp (no separate tracking).
                                 The overlay polls /auth/sessions every 60s, so
                                 an open app refreshes itself; the window is
                                 5 min. Redis down reads as 0, not an error.
                                 Self-check: node scripts/check-sessions.mjs
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

## Email Is Stored And Compared Lowercase

Invariant, added 2026-09-06 after a support report. `auth.service.ts` does
`VALUES (lower($1), ...)` on register and `WHERE email = lower($1)` on both
login and forgot-password. Do not reintroduce an exact match anywhere.

```
register  VALUES (lower($1), ...)
login     WHERE email = lower($1)   -- email branch of the UNION only
forgot    WHERE email = lower($1)
```

Two things this fixes. A user registered as `Ksadiqadam67@gmail.com`, typed it
lowercase on forgot-password, and got "If that email exists, a reset link was
sent" with no email — the lookup found nothing and the handler returned early.
Reproduced on production, same account, minutes apart: the lowercase form
created no token, the stored casing created one. The generic reply is
deliberate (it stops account enumeration) but it also made the failure
invisible, which is why a `console.warn` now marks the no-match path.

Second, `users_email_key` is a CASE-SENSITIVE unique index and register only
detects duplicates by catching its 23505, so `Foo@x.com` and `foo@x.com` could
become two accounts. Storing lowercase makes that index mean what it looks
like it means.

Existing rows were migrated on 2026-09-06:

```sql
UPDATE users SET email = lower(email) WHERE email <> lower(email);
```

Verify collision-free before ever re-running it:
`SELECT lower(email) FROM users GROUP BY 1 HAVING count(*) > 1;`

**Passwords stay case-SENSITIVE.** bcrypt compares the exact string, and that
is correct. Do not "fix" a login failure by normalising password case — it
would slash the keyspace and is never the right answer. Email casing was the
bug; password casing is the design.

---

## Concurrent Session Cap

Seats are per plan. Monthly and yearly run on two computers at once — a third
is refused. Weekly runs on one, and so do trial and lapsed accounts.
`seatsForPlan()` in sessions.ts is the only place this is decided.

```
On login:  a session slot is claimed in Redis hash sess:{userId}
           field = sid (16 random bytes hex), also embedded as the JWT `sid` claim
           at capacity → 409 { error:'session_limit', sessions:[...] }
           login accepts { revokeSid } to sign a listed device out and take its slot

Per request: jwt.strategy.ts calls touchSession() — the sid must still be in the
           hash or the request 401s with 'session_revoked'. This is what makes
           revocation actually bite; the Electron client already routes 401 →
           logout, so a revoked app returns to the login screen on its own.

Freeing a slot:  POST /auth/logout, or the token expiring. Slots are pruned on
           the token clock (3h from login, NOT from last activity), so a slot
           dies exactly when its token does. Pruned on read — no sweeper, no
           per-field TTL. `lastSeen` is display-only, refreshed at most once a
           minute.

Password reset:  a COMPLETED reset (POST /auth/reset-password) calls
           revokeAllSessions(), signing every device out. Deliberately NOT on
           forgot-password request — that endpoint is unauthenticated, so
           logging out on request would let anyone kick any account offline by
           submitting their email.

Redis down → fails OPEN (logins work, cap unenforced), same as every other
           Redis check here. It is an abuse control, not a security boundary.

⚠ Tokens without a `sid` (i.e. issued before this shipped) are REJECTED, so
  deploying this signs every existing user out. That is deliberate. Combined
  with the 3h expiry it means everyone re-authenticates on deploy and then
  every 3 hours after — expect a support bump and a login spike at deploy.
  Every client screen already routes 401 → login, so this degrades cleanly.

Self-check:  npm run build && node scripts/check-sessions.mjs
```

`MAX_SESSIONS` and `TOKEN_TTL_SEC` both live in
`apps/backend/src/auth/sessions.ts`. `TOKEN_TTL_SEC` is the single source of
truth for JWT expiry — auth.module.ts and auth.service.ts both import it, so
changing token lifetime is a one-line edit and slot pruning follows it
automatically. Do not hardcode an expiry anywhere else.

---

## Device Attestation

There is **no device binding**. An account may be used on any number of
machines. The per-subscription device cap was removed; every AI request still
has to be signed by a registered keypair, but the key ID is no longer bound
to the subscription.

```
How it works:
    X-Key-ID: a UUID identifying the device's keypair (registered via POST /device/register)
    X-Timestamp: Unix timestamp of the request
    X-Signature: ECDSA P-256 signature over "timestamp:userId" signed by the device private key

    verifySignature() in device.service.ts, called by every AI endpoint:
        Verifies the signature against the registered public key in device_keys
        Rejects with 403 not_registered / invalid_signature
        Timestamp must be within 30s (replay window)

Free trials ARE still device-bound, via users.trial_key_id, so the same
machine cannot claim repeated trials. That is anti-abuse, not licensing.

The subscriptions.locked_key_id / locked_key_id_2 columns still exist but
are never read or written. Inert.
```

---

## Document Parsing (CV + meeting/doc copilot)

`apps/electron/electron/documents.ts` — one helper behind both `cv:parse` and
`meeting-doc:parse`. They used to hold identical copies and therefore
identical bugs.

```
PDF   pdf-parse          empty extraction is an ERROR, not success
DOCX  adm-zip            word/document.xml, same shape as the pptx path
PPTX  adm-zip            ppt/slides/slideN.xml
TXT   fs.readFileSync
MD    fs.readFileSync
DOC   rejected on purpose - binary OLE, not a zip. Tells the user to save
      as .docx. Without that it fell through to the utf-8 branch and stored
      binary garbage as a CV.
```

Two failures this exists to prevent:

- pdf-parse surfaces pdf.js internals ("bad XRef entry", "Invalid PDF
  structure", "PDFDocument: stream must have data") and they went straight
  into the UI. The wording is not even stable between runs, so matching on
  the message set is a treadmill — anything not a password problem gets one
  honest sentence and the internal goes to console.error.
- A scanned or photographed CV is a VALID PDF with no text layer, so parsing
  "succeeded" with an empty string. The app stored an empty CV, showed the
  filename as if it worked, and every answer afterwards silently lost its CV
  context. Empty extraction is now an error.

Parsing runs on the MAIN process at ~34ms/page (measured), so a large file
freezes the app, overlay included. Hence MAX_DOC_BYTES = 20MB. If decks get
big, move it to a utilityProcess.

Self-check: `cd apps/electron && node scripts/check-documents.mjs`

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
    locked_device_id, locked_device_id_2,   -- dead, never read
    locked_key_id, locked_key_id_2,         -- dead, never read
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
OPENROUTER_API_KEY=    # The only fallback for every text path. NOT in
                       # main.ts REQUIRED — unset just skips that tier
                       # rather than stopping the service booting, but
                       # unset also means Gemini has no backup at all.
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
APP_DOWNLOAD_LINK_WINDOWS=  # Firebase Storage URL (old name R2_DOWNLOAD_URL_* still read)
APP_DOWNLOAD_LINK_MAC=      # unset in production — mac downloads 503
PORT=                  # Defaults to 3000
NODE_ENV=

# Electron (apps/electron/.env)
VITE_API_URL=          # Defaults to https://zoomguru-backend-production.up.railway.app
VITE_PAYSTACK_PUBLIC_KEY=
VITE_PAYSTACK_PLAN_MONTHLY=  # PLN_xxx from Paystack dashboard
```

The backend hard-exits on boot if any of these are missing (`main.ts`):
`DATABASE_URL, JWT_SECRET, REDIS_URL, GEMINI_API_KEY, GROQ_API_KEY,
PAYSTACK_SECRET_KEY, RESEND_API_KEY, FROM_EMAIL, ADMIN_KEY`
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
AI APIs:         Gemini + OpenRouter + Groq (cloud, need internet)

Start backend:   cd apps/backend && npm run start:dev
Start electron:  cd apps/electron && npm run dev
Start admin:     cd apps/admin && npm run dev

Set VITE_API_URL=http://localhost:3000 in apps/electron/.env
to point the Electron app at local backend during development.
```

### Fully local stack (test without touching production)

Redis 3.0 and PostgreSQL 17 are installed as Windows services on the dev
machine (`winget install Redis.Redis` / `PostgreSQL.PostgreSQL.17`). They
listen on the default ports and start with Windows.

```
cd apps/backend
npm run build && node --env-file=.env.local dist/main.js
```

`.env.local` (gitignored) points at `127.0.0.1` and uses **fake** Resend,
Paystack and AI keys, so a local run cannot send real email, charge a card,
or spend AI credit. `initDB()` builds the whole schema on first boot — an
empty database is all that is required.

Two traps, both already handled in `.env.local`:

- `db.ts` reads **`DATABASE_POOL_URL` before `DATABASE_URL`**. Override only
  `DATABASE_URL` and the "local" server silently talks to production.
- Local Postgres runs `ssl=off`. `db.ts` skips SSL for loopback hosts only;
  every hosted URL still gets SSL.

Redis 3.0 is too old for `RPOP key count` (6.2+), which flushSessionLogQueue
uses — on the dev machine that job logs an error every 30s and the queue never
drains. Harmless locally; production Redis is 8.2. Upgrade the local Redis if
you need session logs to land.

Reset local state between runs with
`"C:\Program Files\Redis\redis-cli.exe" FLUSHALL`.

---

## Known Security Issues (Prioritised)

```
OPEN — implement before scaling:
    1. No brute-force protection on /auth/login and /auth/register
       (Redis is available — add rate limit by IP)
    2. Device fingerprint is client-generated and forgeable
       (architectural — needs server-side challenge post-launch)
```

---

## What Is Still Deferred

```
    ├── Google OAuth — email/password only for now
    ├── Wake word (Porcupine) — hotkeys only
    ├── Auto-updater  ← note: this is why host changes are expensive
    ├── Brute-force protection on auth endpoints
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
