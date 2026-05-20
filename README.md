# ZoomGuru

**Your invisible edge in every interview.**

ZoomGuru is an AI-powered interview copilot delivered as a cross-platform desktop app (Windows + macOS). It sits as a transparent, always-on-top overlay that is **completely invisible to screen share software** — Zoom, Google Meet, Teams, Webex, and browser-based tab sharing via Chrome. It listens to interview audio, captures screenshots on demand, and streams personalized AI answers in real time, all based on your uploaded CV.

---

## What it does

- **Listens** — local Whisper STT transcribes the interviewer's question on-device
- **Reads your screen** — press a hotkey to capture a screenshot; vision AI reads code challenges, diagrams, and whiteboard problems
- **Answers in real time** — first word in under 500ms, streamed word by word
- **Personalized to your CV** — every answer pulls from your real experience, projects, and skills
- **Invisible** — OS-level window exclusion; no screen capture software can see the overlay

---

## Monorepo structure

```
zoomguru/
├── apps/
│   ├── backend/      NestJS + Fastify API server (Render)
│   ├── electron/     Desktop overlay app — Electron + Vite + React
│   ├── landing/      Marketing + user dashboard — Next.js 16 + Tailwind (Netlify)
│   └── admin/        Internal admin dashboard — Next.js 16 + Recharts (Netlify)
├── .claude/          Full architecture, patch notes, and documentation
└── package.json      npm workspaces root
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Desktop app | Electron, Vite, React 19, TypeScript |
| Landing + dashboard | Next.js 16 (App Router), Tailwind CSS, Netlify |
| Admin dashboard | Next.js 16, Recharts, NextAuth, Netlify |
| Backend API | NestJS, Fastify adapter, Render |
| Database | Neon PostgreSQL — raw SQL, no ORM |
| AI — text | DeepSeek V3 (`deepseek-chat`) + R1 (`deepseek-reasoner`) |
| AI — vision | DeepSeek V3 multimodal for screenshot understanding |
| AI — speech | Whisper tiny (local ONNX, on-device) |
| Wake word | Porcupine (local, on-device) |
| Payments | Paystack (NGN + USD) |
| Auth | JWT (15m access / 30d refresh rotation) + Google OAuth + device fingerprint |

---

## Apps

### `apps/backend` — NestJS API
Full REST API with Fastify. Modules: auth, cv, session, license, paystack, referral, admin.  
Self-healing: all DB tables auto-create on first boot — no migrations needed.

### `apps/electron` — Desktop overlay
Transparent always-on-top Electron window. Screen share invisible via OS-level exclusion.  
Connects to backend via HTTPS. Audio captured locally, STT via Whisper ONNX, wake word via Porcupine.

### `apps/landing` — Marketing + user dashboard
Public marketing pages, pricing, and a full authenticated user dashboard:
- Session history, subscription management, referral tracking, settings, payment history.

### `apps/admin` — Internal admin dashboard
Protected admin-only Next.js app. Full observability and management:
- **Overview** — live KPI cards, revenue + session sparklines, recent signups
- **Users** — searchable/filterable table, per-user detail with license + payment history
- **Revenue** — MRR/ARR/LTV, daily area chart (NGN/USD toggle), cohort retention, churn analysis
- **Sessions** — stacked bar by interview type, peak-hours heatmap, recent session table with AI summaries
- **Referrals** — conversion funnel, top referrers leaderboard, all referral rows
- **Payouts** — pending payout cards with pay/reject modals, payout history
- **Errors** — auto-refreshing error log, severity icons, inline stack trace expansion, filters
- **Settings** — account management, admin user CRUD, system config reference, pricing display

---

## Screen share invisibility

### Windows
```javascript
const { setWindowDisplayAffinity } = require('electron-wda');
setWindowDisplayAffinity(win, 'WDA_EXCLUDEFROMCAPTURE');
```
Uses `SetWindowDisplayAffinity` Win32 API (`0x00000011`). Excludes from all capture including Zoom, Teams, Chrome `getDisplayMedia()`, and OBS.

### macOS
```javascript
win.setContentProtection(true);
```
Electron built-in. Renders on user display, appears black/absent in any screen capture.

---

## Pricing

| Plan | NGN | USD |
|---|---|---|
| Free | 3 sessions · 10 responses each | — |
| Monthly | ₦15,000 / month | $12 / month |
| Lifetime | ₦100,000 one-time | $79 one-time |

---

## Hotkeys

| Hotkey | Action |
|---|---|
| `Ctrl+Shift+A` | Start listening (mic → STT → AI) |
| `Ctrl+Shift+S` | Capture screenshot → vision AI |
| `Ctrl+Shift+H` | Hide / show overlay |
| `Ctrl+Shift+R` | Regenerate last answer |
| `Ctrl+Shift+C` | Clear overlay |
| `"Hey ZoomGuru"` | Wake word → listen mode |

---

## Getting started

### Prerequisites
- Node.js 20+
- A [Neon](https://neon.tech) PostgreSQL database
- [DeepSeek](https://platform.deepseek.com) API key
- [Paystack](https://paystack.com) account
- Google OAuth credentials (for Google sign-in)

### 1. Clone and install

```bash
git clone https://github.com/HasbiyallahuJafaru/Zoomguru.git
cd Zoomguru
npm install
```

### 2. Backend

```bash
cd apps/backend
cp .env.example .env
# Fill in: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, ELECTRON_OAUTH_SECRET,
#          DEEPSEEK_API_KEY, PAYSTACK_SECRET_KEY, PAYSTACK_WEBHOOK_SECRET,
#          GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ADMIN_SECRET_KEY
npm run start:dev
```

Tables auto-create on first boot — no migrations needed.

### 3. Electron app

```bash
cd apps/electron
cp .env .env.local      # adjust VITE_API_URL if needed
npm install
npm run dev
```

### 4. Landing page

```bash
cd apps/landing
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY
npm install
npm run dev
```

### 5. Admin dashboard

```bash
cd apps/admin
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_URL, NEXTAUTH_SECRET, NEXTAUTH_URL
npm install
npm run dev
```

---

## Build & release

```bash
# Backend → Render
cd apps/backend && npm run build

# Landing → Netlify (auto-deploys on push if connected)
cd apps/landing && npm run build

# Admin → Netlify
cd apps/admin && npm run build

# Electron — package installers
cd apps/electron
npm run dist:win    # → release/ZoomGuru-Setup-1.0.0.exe
npm run dist:mac    # → release/ZoomGuru-1.0.0-arm64.dmg
```

---

## Tests

```bash
cd apps/backend
npm test              # run all tests
npm run test:coverage # with coverage report
```

**297 tests · 13 suites · 0 failures**

| Suite | What it tests |
|---|---|
| `ai/prompts.spec.ts` | System prompt building and CV context injection |
| `ai/question-router.spec.ts` | Model routing — coding/system-design → R1, behavioral → V3 |
| `ai/sse-manager.spec.ts` | SSE client lifecycle, stream writing, cleanup |
| `cv/cv-sanitize.spec.ts` | CV text sanitisation and injection-attack stripping |
| `cv/cv-profile-validation.spec.ts` | Profile defaults, fallback builder, file type gating |
| `license/license-expiry.spec.ts` | Expiry dates, plan types, payout floor validation |
| `license/license-logic.spec.ts` | Full license resolution — expiry + device lock + status |
| `auth/auth-logic.spec.ts` | JWT signing/verification, bcrypt, username rules, referral codes |
| `session/session-logic.spec.ts` | Transcript export, duration formatting, ownership checks |
| `referral/referral-logic.spec.ts` | Commission calc, payout validation, revenue KPIs, funnel rates |
| `admin/admin-analytics.spec.ts` | KPI builders, retention colours, peak hours, churn stats, masking |
| `guards/guards.spec.ts` | AdminGuard, DeviceGuard, multi-account detection, secret key check |
| `paystack/paystack-webhook.spec.ts` | HMAC-SHA512 webhook signature verification |

---

## Environment variables

All required variables are documented in `apps/backend/.env.example` and `apps/landing/.env.local.example`.  
Never commit real `.env` files — they are `.gitignore`d.

---

## Documentation

Full architecture, data flows, and implementation details live in [`.claude/`](.claude/):

- [`CLAUDE.md`](.claude/CLAUDE.md) — master context and standing rules for AI sessions
- [`ARCHITECTURE.md`](.claude/ARCHITECTURE.md) — system overview and all data flows
- [`BACKEND.md`](.claude/BACKEND.md) — NestJS module structure and API endpoints
- [`ELECTRON.md`](.claude/ELECTRON.md) — overlay, hotkeys, screen exclusion, IPC
- [`AI.md`](.claude/AI.md) — DeepSeek V3/R1 + Whisper integration
- [`DATABASE.md`](.claude/DATABASE.md) — schema and raw SQL query patterns
- [`AUTH.md`](.claude/AUTH.md) — JWT flow, Google OAuth, device fingerprinting
- [`PAYMENTS.md`](.claude/PAYMENTS.md) — Paystack webhook and license activation
- [`LANDING.md`](.claude/LANDING.md) — Next.js landing page and user dashboard
- [`patches/auth-dashboard/`](.claude/patches/auth-dashboard/) — step-by-step auth + admin build log

---

## License

Proprietary. All rights reserved © 2026 ZoomGuru.
