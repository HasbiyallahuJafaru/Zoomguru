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
│   └── landing/      Marketing site — Next.js 14 + Tailwind (Netlify)
├── .claude/          Full architecture + documentation
└── package.json      npm workspaces root
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Desktop app | Electron, Vite, React 18, TypeScript |
| Landing page | Next.js 14 (App Router), Tailwind CSS, Netlify |
| Backend API | NestJS, Fastify adapter, Render |
| Database | Neon PostgreSQL — raw SQL, no ORM |
| AI — text | DeepSeek V3 (`deepseek-chat`) + R1 (`deepseek-reasoner`) |
| AI — vision | Qwen VL (`qwen-vl-max`) for screenshot understanding |
| AI — speech | Whisper tiny (local ONNX, on-device) |
| Wake word | Porcupine (local, on-device) |
| Payments | Paystack (NGN + USD) |
| Auth | JWT (15m access / 30d refresh rotation) + device fingerprint |

---

## Screen share invisibility

### Windows
```javascript
// electron-wda native addon
const { setWindowDisplayAffinity } = require('electron-wda');
setWindowDisplayAffinity(win, 'WDA_EXCLUDEFROMCAPTURE');
```
Uses `SetWindowDisplayAffinity` Win32 API (value `0x00000011`). Excludes the window from **all** screen capture — including Zoom, Teams, Chrome `getDisplayMedia()`, and OBS.

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
- [Qwen/DashScope](https://dashscope.aliyuncs.com) API key
- [Paystack](https://paystack.com) account

### 1. Clone and install

```bash
git clone https://github.com/HasbiyallahuJafaru/Zoomguru.git
cd Zoomguru
```

### 2. Backend

```bash
cd apps/backend
cp .env.example .env
# Fill in DATABASE_URL, JWT_SECRET, DEEPSEEK_API_KEY, QWEN_API_KEY, PAYSTACK_* keys
npm install
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
# Set NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY
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

# Electron — package installers
cd apps/electron
npm run dist:win    # → release/ZoomGuru-Setup-1.0.0.exe
npm run dist:mac    # → release/ZoomGuru-1.0.0-arm64.dmg
```

---

## Environment variables

All required variables are documented in `apps/backend/.env.example` and `apps/landing/.env.local.example`.  
Never commit real `.env` files — they are `.gitignore`d.

---

## Documentation

Full architecture, data flows, and implementation details live in [`.claude/`](.claude/):

- [`ARCHITECTURE.md`](.claude/ARCHITECTURE.md) — system overview and all data flows
- [`BACKEND.md`](.claude/BACKEND.md) — NestJS module structure and API endpoints
- [`ELECTRON.md`](.claude/ELECTRON.md) — overlay, hotkeys, screen exclusion, IPC
- [`AI.md`](.claude/AI.md) — DeepSeek + Qwen VL + Whisper integration
- [`DATABASE.md`](.claude/DATABASE.md) — schema and raw SQL query patterns
- [`AUTH.md`](.claude/AUTH.md) — JWT flow and device fingerprinting
- [`PAYMENTS.md`](.claude/PAYMENTS.md) — Paystack webhook and license activation
- [`LANDING.md`](.claude/LANDING.md) — Next.js landing page components

---

## License

Proprietary. All rights reserved © 2025 ZoomGuru.
