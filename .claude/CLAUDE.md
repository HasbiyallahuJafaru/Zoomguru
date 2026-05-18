# ZoomGuru — Master Context

## What Is ZoomGuru

ZoomGuru is an AI-powered interview copilot delivered as a cross-platform desktop app (Windows + macOS). It sits as a transparent, always-on-top overlay that is **completely invisible to screen share software** (Zoom, Google Meet, Teams, Webex). It listens to interview audio, captures screenshots on demand, and streams personalized AI answers in real time — all based on the user's uploaded CV.

**Tagline:** Your invisible edge in every interview.

**Domain:** zoomguru.com (placeholder)

---

## Core Value Proposition

- Invisible to screen share (OS-level window exclusion)
- Personalized answers from uploaded CV — not generic
- Streams answers word by word (<500ms first token)
- Listens via mic, captures screenshots, solves code/math/system design
- Device-locked license — one payment, one machine
- Works on Windows and macOS

---

## Monorepo Structure

```
zoomguru/
├── .claude/                  ← all documentation lives here
│   ├── CLAUDE.md             ← this file (master context)
│   ├── ARCHITECTURE.md       ← system design + data flow
│   ├── BACKEND.md            ← NestJS + Neon + Fastify details
│   ├── ELECTRON.md           ← Electron app, overlay, hotkeys
│   ├── LANDING.md            ← Next.js landing page
│   ├── AI.md                 ← DeepSeek + Qwen VL integration
│   ├── AUTH.md               ← JWT, device fingerprint, license
│   ├── PAYMENTS.md           ← Paystack ₦ + $ integration
│   ├── DATABASE.md           ← Neon raw SQL schema + queries
│   └── COMMANDS.md           ← all dev commands
├── apps/
│   ├── electron/             ← desktop overlay app
│   ├── landing/              ← Next.js landing page
│   └── backend/              ← NestJS API server
└── package.json              ← monorepo root (npm workspaces)
```

---

## Tech Stack — Final Confirmed

### Desktop App
- **Electron** — cross-platform desktop (Windows + macOS)
- **Vite** — fast bundler, minimal build output
- **React** — overlay UI
- **electron-builder** — packaging .exe (Windows) + .dmg (macOS)

### Landing Page
- **Next.js 16** — App Router
- **React 19**
- **Tailwind CSS** — styling
- **Vercel** — hosting + deploy

### Backend
- **NestJS** with **Fastify adapter** — fast, scalable API
- **@neondatabase/serverless** — direct SQL, no ORM
- **Render** — hosting

### Database
- **Neon PostgreSQL** — all data, session state, rate limiting
- **Raw SQL only** — no Prisma, no ORM
- **Tables auto-created on backend boot**

### AI Layer
- **DeepSeek V3** (`deepseek-chat`) — behavioral, conversational, technical definitions
- **DeepSeek R1** (`deepseek-reasoner`) — coding, system design, math, reasoning
- **Qwen VL** — screenshot vision analysis (image understanding)
- **Whisper (local, tiny model)** — speech-to-text transcription via ONNX in Electron
- **Porcupine** — local wake word detection ("Hey ZoomGuru")

### Payments
- **Paystack** — NGN only (₦)
- Inline JS on landing page + hosted page via Electron
- Webhook hits backend, activates license in DB
- No Paystack plan codes — expiry tracked in our DB

### Security
- No external monitoring tools
- Certificate pinning in Electron production build
- API keys server-side only — never in Electron binary
- Device fingerprint SHA256 — hardware-locked license

---

## Pricing Model

| Plan | NGN | Notes |
|------|-----|-------|
| Free | — | 3 sessions, 10 responses each |
| Monthly | ₦15,000 | One-time charge, expires in 30 days |
| Lifetime | ₦100,000 | One-time charge, never expires |

**Free tier limits:**
- 3 interview sessions total
- 10 AI responses per session
- No screenshot mode
- No wake word

**Pro (paid) — unlimited everything:**
- Unlimited sessions
- Unlimited responses
- Screenshot + vision
- Wake word ("Hey ZoomGuru")
- Session transcript export

---

## Standing Rules for Claude Code Sessions

1. Always fetch latest package versions — never assume from training data
2. Run `initDB()` schema check on every backend boot — tables self-create
3. API keys only in `.env` files — never hardcoded
4. All DeepSeek/Qwen calls go through backend proxy — Electron never calls AI directly
5. Device fingerprint sent on every app launch — verified server-side
6. Streaming via SSE — never buffer full response before sending
7. CV profile injected into every AI system prompt — personalization is non-negotiable
8. Direct SQL only — if Prisma appears anywhere, remove it
9. Question type auto-detected — routes to correct model automatically
10. Both Windows and macOS must work — test platform-specific code paths
