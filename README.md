# ZoomGuru

A desktop overlay app that sits transparently over your screen during job interviews. It listens to questions via microphone, captures screenshots on demand, and streams AI-generated answers in real time. The overlay is invisible to screen share software — the user sees it, the interviewer does not.

---

## How it works

1. Launch the app. A transparent overlay appears above all other windows.
2. Join your interview call. The overlay is hidden from Zoom, Meet, Teams, and Webex via OS content protection.
3. Press `Ctrl+Shift+L`, speak the question you just heard. An answer streams onto the overlay word by word.
4. For coding challenges or visual problems, press `Ctrl+Shift+S` to capture the screen. The vision model reads the problem and streams a full solution.
5. Toggle hands-free mode with `Ctrl+Shift+D` — VAD detects speech automatically, no hotkey needed per question.

---

## Repository structure

```
zoomguru/
├── apps/
│   ├── electron/       Desktop overlay app (Electron + Vite + React 18)
│   ├── backend/        API server (NestJS + Fastify, deployed on Render)
│   ├── admin/          Admin dashboard (React + Vite)
│   └── landing/        Marketing and download page
└── .claude/            Project context and specs
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Desktop app | Electron, Vite, React 18, TypeScript strict |
| Backend | NestJS, Fastify adapter, TypeScript, deployed on Render |
| Database | Neon PostgreSQL, `@neondatabase/serverless`, raw SQL |
| Auth | JWT via `@nestjs/jwt`, 30-day expiry |
| Text answers | Gemini 2.0 Flash (primary), DeepSeek V3 (fallback), with key rotation |
| Screenshot reading | Groq vision (`llama-4-scout`) |
| Voice transcription | Groq Whisper (`whisper-large-v3-turbo`) |
| Payments | Paystack (inline.js, monthly recurring + lifetime one-time) |
| Email | Resend |
| Cache / rate limiting | Redis via ioredis |

---

## Prerequisites

- Node.js 20+
- A Neon PostgreSQL database
- A Gemini API key (required) and DeepSeek API key (fallback)
- A Groq API key
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
DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/dbname?sslmode=require
JWT_SECRET=any_long_random_string
REDIS_URL=redis://...

GEMINI_API_KEY=...
GEMINI_API_KEY_2=...        # optional key rotation
DEEPSEEK_API_KEY=sk-...
GROQ_API_KEY=gsk_...

PAYSTACK_SECRET_KEY=sk_test_...
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@yourdomain.com
ADMIN_KEY=any_secret_string
APP_URL=http://localhost:3000
ADMIN_CORS_ORIGIN=http://localhost:5174

R2_DOWNLOAD_URL_WINDOWS=    # GitHub release asset URL for Windows installer
R2_DOWNLOAD_URL_MAC=        # GitHub release asset URL for Mac dmg
```

### 3. Configure the Electron app

Create `apps/electron/.env`:

```env
VITE_API_URL=http://localhost:3000
VITE_PAYSTACK_PUBLIC_KEY=pk_test_...
VITE_PAYSTACK_PLAN_MONTHLY=PLN_...
```

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
  POST /auth/login            { email, password } + X-Device-ID header
  POST /auth/forgot-password  { email }
  POST /auth/reset-password   { token, newPassword }

AI  (Bearer token + X-Device-ID required)
  POST /ai/stream             { transcript, cvText?, jdText? }  → SSE
  POST /ai/screenshot         { image (base64), cvText?, jdText? }  → SSE
  POST /ai/transcribe         { audio (base64) }  → { transcript }

Subscription  (Bearer token required)
  GET  /subscription/status
  POST /subscription/verify   { reference } + X-Device-ID header

Admin  (X-Admin-Key header required)
  GET /admin/stats
  GET /admin/users
  GET /admin/signups?days=30
  GET /admin/payments?days=30
  GET /admin/usage?days=30

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

Output lands in `apps/electron/dist-release/`. Upload the output file to a GitHub Release, then update `R2_DOWNLOAD_URL_WINDOWS` / `R2_DOWNLOAD_URL_MAC` on Render with the new asset URL.

---

## Screen share invisibility

The overlay is hidden from screen share software using `win.setContentProtection(true)` — the same OS API used by banking apps to block screen capture. Works on Zoom, Google Meet, Microsoft Teams, and Webex without any configuration.

---

## Device locking

Each active subscription is locked to one device. The device fingerprint is derived from CPU model, platform, architecture, hostname, total memory, and MAC address, then SHA-256 hashed. The hash is sent as the `X-Device-ID` header on every AI request. The first AI call after activation binds the subscription to that device.

---

## Rate limiting

AI endpoints are limited to 15 requests per 60 seconds per user, enforced via Redis.
