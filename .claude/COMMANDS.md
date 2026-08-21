# ZoomGuru MVP — Commands

## Start Everything Locally

```bash
# Terminal 1 — Backend
cd apps/backend
npm install
npm run start:dev
# Should print: ZoomGuru backend running on http://localhost:3000

# Terminal 2 — Electron
cd apps/electron
npm install
npm run dev
# Should open the Electron overlay window
```

Both must be running simultaneously.

---

## Verify Backend Is Running

```bash
curl http://localhost:3000/health
# Expected: {"status":"ok"}
```

If /health doesn't exist yet, just check:
```bash
curl http://localhost:3000
# Any response = backend is running
```

---

## TypeScript Verification (Run After Every File Change)

```bash
# Electron
cd apps/electron
npx tsc --noEmit

# Backend
cd apps/backend
npx tsc --noEmit

# Zero output = zero errors = ready
```

---

## Create Your First User in Supabase

```sql
-- Run in Supabase SQL Editor (supabase.com/dashboard)
INSERT INTO users (email, password_hash, name, username, is_pro)
VALUES (
  'test@zoomguru.com',
  crypt('password123', gen_salt('bf')),
  'Test User',
  'testuser',
  true
);
```

Then log in with:
- Email: test@zoomguru.com or username: testuser
- Password: password123

---

## Environment Files

```bash
# apps/electron/.env (create this if missing)
VITE_API_URL=http://localhost:3000
VITE_APP_ENV=development

# apps/backend/.env (create this if missing)
DATABASE_URL=postgresql://postgres.<ref>:<pw>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
DATABASE_POOL_URL=          # required when NODE_ENV=production
JWT_SECRET=zoomguru_local_dev_secret_change_this
REDIS_URL=redis://localhost:6379
GEMINI_API_KEY=AIza...      # primary AI
DEEPSEEK_API_KEY=sk-...     # fallback AI
GROQ_API_KEY=gsk_...        # transcription + vision
PAYSTACK_SECRET_KEY=sk_...
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@zoomguru.xyz
ADMIN_KEY=...
PORT=3000
NODE_ENV=development
```

---

## Test Each Flow Manually

```
FLOW 1 — Window:
  1. npm run dev in electron
  2. Window appears
  3. Open Zoom → share screen
  4. Confirm overlay not visible in Zoom preview
  ✅ Pass: hidden from screen share

FLOW 2 — Login:
  1. Type email/username + password
  2. Click Sign In
  3. Check network tab: POST http://localhost:3000/auth/login
  4. Confirm 200 response with accessToken
  5. Overlay appears
  ✅ Pass: logged in successfully

FLOW 3 — Listen:
  1. Press Cmd/Ctrl+Shift+A
  2. "● Listening..." appears in header
  3. Speak: "What is a closure in JavaScript?"
  4. Check network tab: POST http://localhost:3000/ai/stream
  5. Answer streams word by word in overlay
  ✅ Pass: text flow works end to end

FLOW 4 — Screenshot:
  1. Open a coding problem in browser
  2. Press Cmd/Ctrl+Shift+S
  3. Check network tab: POST http://localhost:3000/ai/screenshot
  4. Answer streams in overlay
  ✅ Pass: image flow works end to end
```

---

## Common Issues and Fixes

```
Issue: Backend not starting
Fix: Check .env exists with all required vars
     Check Supabase project is not PAUSED (free tier pauses after ~7 days idle)
     Run: cd apps/backend && npm install

Issue: Electron window not appearing
Fix: Check VITE_API_URL=http://localhost:3000 in .env
     Check vite dev server is on port 5173
     Run: cd apps/electron && npm install

Issue: Login fails with network error
Fix: Confirm backend is running on port 3000
     Confirm CORS allows localhost:5173
     Check browser DevTools network tab for error

Issue: SSE streaming not working
Fix: Confirm endpoint accepts POST not GET
     Confirm Authorization header is sent
     Check backend logs for JWT errors

Issue: Overlay visible in screen share
Fix: Confirm setContentProtection(true) called before show()
     On Windows: confirm re-applied after first show
     Test: open Zoom, share entire screen, check preview
```

---

## Graphify (Codebase Map)

```bash
# Already installed. Run in Claude Code sessions:
graphify claude install  # done once

# The graph rebuilds automatically after code changes
# via the PreToolUse hook installed in .claude/settings.json
```

---

## Build for Distribution (Post-MVP)

```bash
# Not needed for local MVP
# When ready:
cd apps/electron
npm run dist:win   # Windows .exe
npm run dist:mac   # macOS .dmg
```
