# ZoomGuru â€” Master Context

## What Is ZoomGuru

ZoomGuru is an AI-powered interview copilot delivered as a cross-platform desktop app (Windows + macOS). It sits as a transparent, always-on-top overlay that is **completely invisible to screen share software** (Zoom, Google Meet, Teams, Webex). It listens to interview audio, captures screenshots on demand, and streams personalized AI answers in real time â€” all based on the user's uploaded CV.

**Tagline:** Your invisible edge in every interview.

**Domain:** zoomguru.xyz (placeholder)

---

## Core Value Proposition

- Invisible to screen share (OS-level window exclusion)
- Personalized answers from uploaded CV â€” not generic
- Streams answers word by word (<500ms first token)
- Listens via mic, captures screenshots, solves code/math/system design
- Device-locked license â€” one payment, one machine
- Works on Windows and macOS

---

## Monorepo Structure

```
zoomguru/
â”œâ”€â”€ .claude/                  â† all documentation lives here
â”‚   â”œâ”€â”€ CLAUDE.md             â† this file (master context)
â”‚   â”œâ”€â”€ ARCHITECTURE.md       â† system design + data flow
â”‚   â”œâ”€â”€ BACKEND.md            â† NestJS + Neon + Fastify details
â”‚   â”œâ”€â”€ ELECTRON.md           â† Electron app, overlay, hotkeys
â”‚   â”œâ”€â”€ LANDING.md            â† Next.js landing page
â”‚   â”œâ”€â”€ AI.md                 â† DeepSeek + Qwen VL integration
â”‚   â”œâ”€â”€ AUTH.md               â† JWT, device fingerprint, license
â”‚   â”œâ”€â”€ PAYMENTS.md           â† Paystack â‚¦ + $ integration
â”‚   â”œâ”€â”€ DATABASE.md           â† Neon raw SQL schema + queries
â”‚   â””â”€â”€ COMMANDS.md           â† all dev commands
â”œâ”€â”€ apps/
â”‚   â”œâ”€â”€ electron/             â† desktop overlay app
â”‚   â”œâ”€â”€ landing/              â† Next.js landing page
â”‚   â””â”€â”€ backend/              â† NestJS API server
â””â”€â”€ package.json              â† monorepo root (npm workspaces)
```

---

## Tech Stack â€” Final Confirmed

### Desktop App
- **Electron** â€” cross-platform desktop (Windows + macOS)
- **Vite** â€” fast bundler, minimal build output
- **React** â€” overlay UI
- **electron-builder** â€” packaging .exe (Windows) + .dmg (macOS)

### Landing Page
- **Next.js 16** â€” App Router
- **React 19**
- **Tailwind CSS** â€” styling
- **Vercel** â€” hosting + deploy

### Backend
- **NestJS** with **Fastify adapter** â€” fast, scalable API
- **@neondatabase/serverless** â€” direct SQL, no ORM
- **Render** â€” hosting

### Database
- **Neon PostgreSQL** â€” all data, session state, rate limiting
- **Raw SQL only** â€” no Prisma, no ORM
- **Tables auto-created on backend boot**

### AI Layer
- **DeepSeek V3** (`deepseek-chat`) â€” behavioral, conversational, technical definitions, screenshot vision
- **DeepSeek R1** (`deepseek-reasoner`) â€” coding, system design, math, reasoning
- **Whisper (local, tiny model)** â€” speech-to-text transcription via ONNX in Electron
- **Porcupine** â€” local wake word detection ("Hey ZoomGuru")

### Payments
- **Paystack** â€” NGN only (â‚¦)
- Inline JS on landing page + hosted page via Electron
- Webhook hits backend, activates license in DB
- No Paystack plan codes â€” expiry tracked in our DB

### Security
- No external monitoring tools
- Certificate pinning in Electron production build
- API keys server-side only â€” never in Electron binary
- Device fingerprint SHA256 â€” hardware-locked license

---

## Pricing Model

| Plan | NGN | Notes |
|------|-----|-------|
| Free | â€” | 3 sessions, 10 responses each |
| Monthly | â‚¦15,000 | One-time charge, expires in 30 days |
| Lifetime | â‚¦100,000 | One-time charge, never expires |

**Free tier limits:**
- 3 interview sessions total
- 10 AI responses per session
- No screenshot mode
- No wake word

**Pro (paid) â€” unlimited everything:**
- Unlimited sessions
- Unlimited responses
- Screenshot + vision
- Wake word ("Hey ZoomGuru")
- Session transcript export

---

## Standing Rules for Claude Code Sessions

1. Always fetch latest package versions â€” never assume from training data
2. Run `initDB()` schema check on every backend boot â€” tables self-create
3. API keys only in `.env` files â€” never hardcoded
4. All DeepSeek/Qwen calls go through backend proxy â€” Electron never calls AI directly
5. Device fingerprint sent on every app launch â€” verified server-side
6. Streaming via SSE â€” never buffer full response before sending
7. CV profile injected into every AI system prompt â€” personalization is non-negotiable
8. Direct SQL only â€” if Prisma appears anywhere, remove it
9. Question type auto-detected â€” routes to correct model automatically
10. Both Windows and macOS must work â€” test platform-specific code paths

