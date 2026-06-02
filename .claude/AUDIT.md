# ZoomGuru — Graphify Audit Findings
# Generated: 2026-06-02
# Use this file to guide a debugging/fix session. Work top-down by priority.

---

## How to Use This File

Read CLAUDE.md first (master context), then this file.
Fix issues in the order listed. Each issue has: location, problem, exact fix.
Run `tsc --noEmit` after every file change.

---

## 🔴 CRITICAL — Fix First

### 1. JWT localStorage Fallback Still Active

**File:** `apps/electron/src/App.tsx` lines 17-22

**Problem:**
Even though JWT migration to electron-store is in progress, `App.tsx` still reads
`localStorage.getItem('access_token')` as a fallback. This keeps the security
vulnerability alive. The localStorage path must be fully removed once the IPC
token flow (`getToken` IPC channel) is confirmed working end-to-end.

**Fix:**
- Verify that `window.zoomguru.getToken()` IPC call works in all auth flows
  (Login, Register, Dashboard, Overlay).
- Remove all `localStorage.getItem('access_token')` and
  `localStorage.setItem('access_token', ...)` calls from `App.tsx`,
  `Login.tsx`, `Register.tsx`, `Dashboard.tsx`, and `Overlay.tsx`.
- Replace with IPC calls: `await window.zoomguru.getToken()` /
  `await window.zoomguru.setToken(jwt)` / `await window.zoomguru.clearToken()`.
- Confirm the IPC handlers exist in `electron/main.ts` and are exposed in
  `electron/preload.ts` and typed in `src/global.d.ts`.

**Verify:** Log out, log back in, restart app — token should persist without
localStorage. Open DevTools → Application → Local Storage → confirm empty.

---

### 2. `getDB()` Has No Pooling Guard

**File:** `apps/backend/src/database/db.ts`

**Problem:**
Every backend service (AI, Auth, Admin, Subscription, Cron, Device) calls
`getDB()` directly. On Render's free tier with concurrent requests, this creates
connection spikes. `DATABASE_POOL_URL` env var exists but is optional and
inconsistently applied.

**Fix:**
- In `db.ts`, if `process.env.DATABASE_POOL_URL` is set, use it as the
  connection string instead of `DATABASE_URL`. Pooled URL routes through
  PgBouncer (Neon's connection pooler) and handles concurrent load safely.
- Make the switch automatic — no caller changes needed:
  ```ts
  const connectionString = process.env.DATABASE_POOL_URL ?? process.env.DATABASE_URL;
  ```
- Add `DATABASE_POOL_URL` to Render's environment variables (get it from
  Neon dashboard → Connection → Pooled connection string).

**Verify:** Hit `/ai/stream` and `/subscription/status` simultaneously 10 times.
No connection timeout errors in Render logs.

---

## 🟡 ARCHITECTURE — Fix After Criticals

### 3. Types Duplicated Between Admin Frontend and Backend

**Files:**
- `apps/admin/src/types.ts` — defines `StatsResult`, `DailyCount`,
  `DailyPayments`, `DailyUsage`, `DailyDownloads`, `UserRow`
- `apps/backend/src/admin/admin.service.ts` — re-defines the same types inline

**Problem:**
Manual duplication. If the backend adds a field, the admin frontend silently
gets undefined values. No TypeScript error catches this because they are in
separate packages with no shared dependency.

**Fix Option (minimal — no new packages):**
Copy the types from `admin.service.ts` into a shared location that both can
reference. Since this is a monorepo, create:
`packages/types/admin.ts` (or just `apps/admin/src/types.ts` is the
source of truth — update `admin.service.ts` to import from admin's published
types if you add a shared package, OR keep types in sync manually and add a
comment: `// Keep in sync with apps/admin/src/types.ts`).

**Fix Option (correct — shared package):**
```
packages/shared-types/
  src/admin.ts   ← move types here
  package.json   ← name: "@zoomguru/shared-types"
```
Add `"@zoomguru/shared-types": "*"` to both `apps/admin/package.json` and
`apps/backend/package.json`. Import from `@zoomguru/shared-types/admin`.

**Verify:** Add a dummy field to the type in one place — TypeScript should
error in the other place if sharing is wired correctly.

---

### 4. `TRIAL_DURATION_MS` Duplicated Between Renderer and Backend

**Files:**
- `apps/electron/src/utils.ts` — `export const TRIAL_DURATION_MS = 30 * 60 * 1000`
- `apps/backend/src/subscription/subscription.service.ts` — same constant

**Problem:**
If the trial duration changes in one place, the countdown UI and the backend
enforcement silently diverge. User sees "trial expired" at different times
than the backend enforces.

**Fix:**
The backend is the source of truth. The renderer should not need to know
the raw millisecond value — it should get trial expiry time from the
`/subscription/status` endpoint (which already returns `current_period_end`).

- Remove `TRIAL_DURATION_MS` from `utils.ts`.
- In `Dashboard.tsx` and `Overlay.tsx`, derive the countdown from
  `status.current_period_end` (a timestamp) minus `Date.now()` instead of
  counting down from a hardcoded duration.
- Keep the constant only in `subscription.service.ts`.

**Verify:** Change trial duration in backend only → frontend countdown updates
automatically on next status poll without any frontend code change.

---

### 5. `Overlay.tsx` Is a Monolith (19 graph edges)

**File:** `apps/electron/src/overlay/Overlay.tsx`

**Problem:**
Single component owns: global hotkeys, VAD loop, AI streaming, session cap
enforcement, trial countdown, CV/JD loading, screenshot capture, answer
clearing, hide/show. Any change touches unrelated logic. High regression risk.

**Fix — Extract into custom hooks (one at a time, verify after each):**

```
src/overlay/
  hooks/
    useHotkeys.ts          ← Ctrl+Shift+L/S/H/C/D registration + cleanup
    useVAD.ts              ← VAD loop, auto-mode toggle, speech detection
    useAIStream.ts         ← fetch /ai/stream and /ai/screenshot, SSE parsing
    useSessionCap.ts       ← questionCount, isCapReached, resetCap
    useTrialCountdown.ts   ← countdown timer derived from period_end
    useCVContext.ts        ← loadCV, loadJD, cvText, jdText state
  Overlay.tsx              ← thin: composes hooks, renders AnswerStream
```

**Do one hook at a time. Order:**
1. `useCVContext` (pure data loading, no side effects on UI)
2. `useSessionCap` (pure counter)
3. `useTrialCountdown` (timer only, feeds from subscription status)
4. `useHotkeys` (IPC calls, cleanup on unmount)
5. `useVAD` (most complex — do last)

**Verify after each:** All 5 hotkeys still work. Auto-mode toggles. Answer
streams. Trial expires correctly.

---

### 6. Session Cap Is Renderer-Only (Not DB-Enforced)

**Files:** `apps/electron/src/overlay/Overlay.tsx`, `apps/backend/src/ai/ai.service.ts`

**Problem:**
The 50-question cap for monthly plan is `questionCount` state in `Overlay.tsx`.
Restarting the app resets it to 0. A user can bypass the cap by restarting.

**Fix:**
- In `/ai/stream` and `/ai/screenshot` endpoints, after logging the session to
  `ai_sessions`, count sessions for the current user in the current calendar
  day (or rolling 24h window) and return 429 with `{ error: 'session_cap' }`
  if count >= 50 for monthly plan / unlimited for yearly.
- Query: `SELECT COUNT(*) FROM ai_sessions WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`
- On the renderer side, handle the `session_cap` 429 the same way as `rate_limit`.
- Keep the renderer counter as a UX hint (show remaining count), but the
  backend is now the enforcer.

**Verify:** Make 51 requests in a session. 51st should fail at the server.
Restart app. Still fails on request 52 (cap persists in DB).

---

### 7. Device Lock Cache Window Creates a Bypass Risk

**File:** `apps/backend/src/subscription/subscription.service.ts`

**Problem:**
`checkAccess()` caches device key validation in-memory for 60 seconds.
If a user swaps to a new device during the 60-second window, the old device
can still make AI requests.

**Fix:**
- Reduce cache TTL from 60s to 10s. The performance gain of 60s isn't worth
  the security window.
- Or: cache by `(userId + keyId)` pair and invalidate the cache entry
  immediately when a new key is registered via `POST /device/register`.

**Verify:** Register a new device key. Within the old TTL window, the old
key should now be rejected.

---

## Build Issue (Unrelated to Audit — Pending)

### Electron dist:win Build

**Status:** `npm run dist:win` was run from `apps/electron/`. The Electron
v42.3.0 zip (144 MB) failed to download from GitHub releases due to network
retries. It was manually downloaded and placed in the cache:

```
%LOCALAPPDATA%\electron-builder\cache\electron\electron-v42.3.0-win32-x64\
  electron-v42.3.0-win32-x64.zip
```

**Next step:** Re-run the build:
```powershell
cd "C:\Users\User\Documents\ZoomguruMVP\apps\electron"
npm run dist:win
```

The build should pick up the cached zip and proceed to packaging without
re-downloading.

---

## Confirmed Working (Do Not Break)

- AI key rotation: 5 Gemini keys, round-robin (`nextGeminiKey()`)
- Paystack webhook HMAC-512 verification
- Redis rate limiting: 15 req/60s per user on AI endpoints
- Auth rate limiting: 5/min register, 10/min login, 3/5min forgot-password
- EC P-256 device signing flow (replaces old SHA-256 client hash)
- CV/JD pipeline: CvSetup → electron-store → Overlay → every AI request
- SSE streaming format: `data: {"chunk":"...","done":false}`
- Subscription status gate: `checkAccess()` combines `canUseAI` + `checkDevice`
- Paystack inline.js payment → `/subscription/verify` → device lock bind

---

## File Map (Quick Reference)

```
apps/electron/
  electron/main.ts          IPC handlers (hotkeys, token, CV, capture, device)
  electron/preload.ts       contextBridge — exposes IPC to renderer
  electron/deviceKey.ts     EC P-256 keypair, sign/verify
  electron/capture.ts       desktopCapturer → base64 PNG
  src/global.d.ts           ZoomGuruBridge type declarations
  src/App.tsx               Step router (loading/login/register/dashboard/cv/overlay)
  src/auth/Login.tsx        POST /auth/login → setToken IPC
  src/auth/Register.tsx     POST /auth/register → setToken IPC
  src/dashboard/Dashboard.tsx  Subscription status, Paystack payment
  src/onboarding/CvSetup.tsx   CV parse + JD save → electron-store
  src/overlay/Overlay.tsx   Main overlay (monolith — see Issue #5)
  src/overlay/AnswerStream.tsx  SSE rendering, markdown strip, scroll
  src/utils.ts              TRIAL_DURATION_MS (remove — see Issue #4)

apps/backend/src/
  main.ts                   Fastify adapter, 15MB body limit, CORS
  app.module.ts             Root NestJS module
  database/db.ts            getDB() — Neon connection (see Issue #2)
  database/init.ts          Schema init (run once on cold start)
  ai/ai.service.ts          Gemini/DeepSeek/Groq streaming
  ai/ai.controller.ts       /ai/* endpoints, rate limit, session log
  auth/auth.service.ts      bcrypt, JWT, password reset
  auth/auth.controller.ts   /auth/* endpoints with IP rate limits
  auth/jwt.strategy.ts      Bearer token validation
  subscription/subscription.service.ts  checkAccess, device lock, trial
  subscription/subscription.controller.ts  /subscription/* + webhook
  device/device.service.ts  EC key registration, derivePublicKey
  redis/redis.ts            ioredis client
  email/email.service.ts    Resend transactional email
  cron/cron.service.ts      Daily expiry reminders

apps/admin/src/
  types.ts                  Duplicate types (see Issue #3)
  api.ts                    Admin API client (X-Admin-Key header)
  Dashboard.tsx             Stats, signups, payments, usage, downloads

apps/landing/
  main.js                   Download modal, Paystack analytics tracking
```
