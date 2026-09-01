# ZoomGuru

A desktop overlay app that sits transparently over your screen during job interviews. It listens to questions via microphone, captures screenshots on demand, and streams AI-generated answers in real time. The overlay is invisible to screen share software — the user sees it, the interviewer does not.

---

## How it works

1. Launch the app. A transparent overlay appears above all other windows.
2. Join your interview call. The overlay is hidden from Zoom, Meet, Teams, and Webex via OS content protection.
3. Press `Ctrl+Shift+L`, speak the question you just heard. An answer streams onto the overlay word by word.
4. For coding challenges or visual problems, press `Ctrl+Shift+S` to capture the screen. The vision model reads the problem and streams a full solution.
5. Toggle hands-free mode with `Ctrl+Shift+D` — VAD detects speech automatically, no hotkey needed per question.

Beyond the live copilot, the app also ships an AI Interviewer (mock interview with a scored report), a meeting and document copilot, free trials, and a referral programme with Paystack payouts.

---

## Repository structure

```
zoomguru/
├── apps/
│   ├── electron/       Desktop overlay app (Electron + Vite + React 18)
│   ├── backend/        API server (NestJS + Fastify, deployed on Railway)
│   ├── admin/          Admin dashboard (React + Vite)
│   └── landing/        Marketing and download page
└── .claude/            Project context and specs
```

There is no root `package.json` — this is a folder layout, not an npm workspace. Each app installs and builds independently.

---

## Tech stack

| Layer | Technology |
|---|---|
| Desktop app | Electron, Vite, React 18, TypeScript strict |
| Backend | NestJS, Fastify adapter, TypeScript, deployed on Railway |
| Database | Supabase PostgreSQL 17 via the Supavisor pooler, `pg` and raw SQL |
| Auth | JWT via `@nestjs/jwt`, 3-hour expiry, no refresh tokens |
| Text answers | Gemini 3.1 Flash Lite (primary, with key rotation) → OpenRouter (fallback) |
| Screenshot reading | Gemini → OpenRouter → Groq Llama 4 Scout → OpenAI vision |
| Voice transcription | Groq Whisper |
| Interviewer speech | LemonFox TTS (optional — the interviewer runs silently without it) |
| Payments | Paystack (hosted checkout and inline.js; weekly, monthly, yearly plans) |
| Email | Resend (transactional and broadcasts) |
| Cache, rate limiting, sessions | Redis via ioredis |
| Installer downloads | Firebase Storage (`zoomguru-downloads`), served via `storage.googleapis.com` |

---

## Prerequisites

- Node.js 20+
- A Supabase PostgreSQL database
- A Gemini API key (required) and an OpenRouter key (the only fallback for every text path)
- A Groq API key (transcription and vision fallback)
- A Paystack account
- A Redis instance
- A Resend account (for transactional email)

---

## Setup

### 1. Install dependencies

```bash
cd apps/backend && npm install
cd ../electron && npm install
cd ../admin && npm install
```

### 2. Configure the backend

Create `apps/backend/.env`:

```env
DATABASE_URL=postgresql://...pooler.supabase.com:5432/postgres
DATABASE_POOL_URL=          # required when NODE_ENV=production
JWT_SECRET=any_long_random_string
REDIS_URL=redis://...

GEMINI_API_KEY=...
GEMINI_API_KEY_2=...        # optional, up to _5, for key rotation
OPENROUTER_API_KEY=...      # the only fallback for every text path
GROQ_API_KEY=gsk_...
OPENAI_API_KEY=...          # optional, last vision fallback
LEMONFOX_API_KEY=...        # optional, AI Interviewer TTS

PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_PUBLIC_KEY=pk_test_...
RESEND_API_KEY=re_...
RESEND_WEBHOOK_SECRET=...
FROM_EMAIL=noreply@yourdomain.com
ADMIN_KEY=any_secret_string
ADMIN_EMAIL=you@yourdomain.com
APP_URL=http://localhost:3000     # public backend URL, used in reset links
CHECKOUT_URL=https://zoomguru.xyz
ADMIN_CORS_ORIGIN=http://localhost:5174
ELECTRON_ORIGIN=app://zoomguru

APP_DOWNLOAD_LINK_WINDOWS=       # e.g. https://storage.googleapis.com/<bucket>/ZoomGuru-Setup.exe
APP_DOWNLOAD_LINK_MAC=           # unset in production today, so mac downloads 503
```

The backend hard-exits on boot if `DATABASE_URL`, `JWT_SECRET`, `REDIS_URL`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `PAYSTACK_SECRET_KEY`, `RESEND_API_KEY`, `FROM_EMAIL` or `ADMIN_KEY` is missing.

### 3. Configure the Electron app

Create `apps/electron/.env`:

```env
VITE_API_URL=http://localhost:3000
VITE_PAYSTACK_PUBLIC_KEY=pk_test_...
VITE_PAYSTACK_PLAN_MONTHLY=PLN_...
```

Changing the API host needs **two** edits, not one: `apps/electron/src/utils.ts` for the base URL, and the CSP `connect-src` entry in `apps/electron/electron/main.ts`. The main process cannot import from `src/`, so the CSP entry is a separate literal — miss it and the packaged app blocks every request.

### 4. Database

The backend runs `CREATE TABLE IF NOT EXISTS` on first boot — no migration step needed.

---

## Running

```bash
# Terminal 1 — backend
cd apps/backend
npm run start:dev

# Terminal 2 — Electron app
cd apps/electron
npm run dev

# Terminal 3 — Admin dashboard (optional)
cd apps/admin
npm run dev
```

The backend starts on `http://localhost:3000`. The Electron app connects to it automatically.

Note that `/health` is a liveness check only — it returns `{"status":"ok"}` even when Postgres and Redis are unreachable. To check the data layer, POST bogus credentials to `/auth/login` and confirm a **401**; a 500 means the database is down.

---

## Self-checks

Branching logic ships with a runnable check. None of them need a server, and none spend money:

```bash
cd apps/backend && npm run build
node scripts/check-ai-fallback.mjs   # provider fallback order, key rotation, image format sniffing
node scripts/check-cron.mjs          # session-log drain and cron advisory locks
node scripts/check-sessions.mjs      # concurrent session cap, pruning, revocation
node scripts/check-quota.mjs         # per-plan usage quotas
node scripts/check-gemini-keys.mjs   # calls Google with every configured key, prints status only
```

`node scripts/check-ai-live.mjs` drives the real providers and costs a few hundred tokens per run. Run it after any change to the model constants.

---

## Hotkeys

| Hotkey | Fallback | Action |
|---|---|---|
| `Ctrl+Shift+L` | `Ctrl+Alt+L` | Toggle manual listen mode |
| `Ctrl+Shift+S` | `Ctrl+Alt+S` | Capture screen and answer |
| `Ctrl+Shift+H` | `Ctrl+Alt+H` | Hide / show overlay |
| `Ctrl+Shift+C` | `Ctrl+Alt+C` | Clear current answer |
| `Ctrl+Shift+D` | `Ctrl+Alt+D` | Toggle auto VAD mode |

---

## API endpoints

```
Auth
  POST /auth/register         { email, name, password }
  POST /auth/login            { email, password, revokeSid? }
  POST /auth/logout           { sid? }
  GET  /auth/sessions
  POST /auth/forgot-password  { email }
  POST /auth/reset-password   { token, newPassword }

Device
  POST /device/register       { keyId, publicKey }

AI  (Bearer token + X-Key-ID, X-Timestamp, X-Signature)
  POST /ai/stream             { transcript, cvText?, jdText? }  -> SSE
  POST /ai/screenshot         { image (base64), cvText?, jdText? }  -> SSE
  POST /ai/transcribe         { audio (base64) }  -> { transcript }
  POST /ai/meeting-stream     -> SSE
  POST /ai/doc-copilot        -> SSE
  POST /ai/interviewer-start
  POST /ai/interviewer-question
  POST /ai/score-session
  POST /ai/tts

Subscription  (Bearer token required)
  GET  /subscription/status
  GET  /subscription/usage
  POST /subscription/trial    + X-Key-ID header
  POST /subscription/verify   { reference }
  POST /subscription/webhook  (Paystack, HMAC-verified)

Payments  (hosted checkout)
  POST /payments/create
  POST /payments/session
  POST /payments/confirm

Referral  (Bearer token required)
  GET  /referral/dashboard
  GET  /referral/banks
  POST /referral/bank/save
  POST /referral/bank/verify
  POST /referral/payout/request

Admin  (X-Admin-Key header required)
  GET  /admin/stats           includes online_now
  GET  /admin/users
  GET  /admin/referrals
  GET  /admin/signups?days=30
  GET  /admin/payments?days=30
  GET  /admin/usage?days=30
  GET  /admin/downloads?days=30
  GET/POST/DELETE /admin/broadcast

Analytics  (public)
  GET /analytics/download?platform=windows|mac

Health
  GET /health
```

---

## Building a distributable

```bash
# Windows installer
cd apps/electron
npm run dist:win

# macOS dmg
cd apps/electron
npm run dist:mac
```

Output lands in `apps/electron/release/` as `ZoomGuru.<version>.exe`.

Downloads are served from **Firebase Storage**, bucket `zoomguru-downloads.firebasestorage.app`, where the installer is stored under the fixed, version-less name **`ZoomGuru-Setup.exe`**. Publishing a build means uploading the new `.exe` to that bucket under that name — it overwrites in place, so every existing download link keeps working and `APP_DOWNLOAD_LINK_WINDOWS` does not need to change.

Two traps worth knowing:

- The variables are `APP_DOWNLOAD_LINK_WINDOWS` / `APP_DOWNLOAD_LINK_MAC`. They were once called `R2_DOWNLOAD_URL_*`, which stayed put through two moves of the actual host and misled readers both times; the backend still reads the old names as a fallback until they are removed from Railway.
- `electron-builder.config.js` also configures a GitHub `publish` provider, and `npm run release:win` will push a release asset there. That asset is **not** what the download button serves — `/analytics/download` redirects to the Firebase URL. Uploading to only one of the two leaves them out of sync.

`APP_DOWNLOAD_LINK_MAC` is currently unset, so `/analytics/download?platform=mac` returns 503.

`VITE_*` values are inlined at build time, so changing an environment variable does nothing for binaries that are already packaged. There is no auto-updater yet — a client change means a rebuild and a redistribution, and old versions stay in the wild indefinitely.

---

## Screen share invisibility

The overlay is hidden from screen share software using `win.setContentProtection(true)` — the same OS API used by banking apps to block screen capture. Works on Zoom, Google Meet, Microsoft Teams, and Webex without any configuration.

---

## Request signing and sessions

There is **no device binding** — an account works on any number of machines. Every AI request still has to be signed: the client registers an ECDSA P-256 keypair via `POST /device/register`, then signs `timestamp:userId` and sends `X-Key-ID`, `X-Timestamp` and `X-Signature`. The timestamp must be within 30 seconds, which bounds replay.

Concurrent sessions are capped per plan — monthly and yearly get two machines at once, weekly and trial get one. Slots live in Redis keyed by a `sid` embedded in the JWT, and are pruned on the token clock. Free trials are still device-bound via `users.trial_key_id`, which is anti-abuse rather than licensing.

Redis failures fail **open** throughout: these are abuse controls, not security boundaries.

---

## Rate limiting

AI endpoints are limited per user over a rolling 60-second window: 40 requests for active subscribers, 15 for trial and inactive accounts. Monthly plans also carry a 150-request daily cap. All of it is enforced in Redis. Auth endpoints are not rate limited yet.

---

## Screenshots

Screens are captured at 1280x720 and encoded as JPEG, not lossless PNG. Measured over the UI screenshots in `apps/landing/.shots`, JPEG q80 is about **1.9x** smaller than PNG (1062 KB to 551 KB of base64); busier screens such as an IDE or a video call compress worse as PNG, so the gap is wider in real use. That halves upload size, server memory, JSON parsing on the backend's single thread, and egress to each provider a failover retries. Vision models bill by image dimensions rather than bytes, so the quality setting costs nothing.

Because there is no auto-updater, older clients still send PNG. The backend sniffs the format from the base64 header (`imageMime()` in `ai.service.ts`) and labels each provider request accordingly, so both work.
