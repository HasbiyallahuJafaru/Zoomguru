# ZoomGuru — Full Codebase Security & Quality Audit
**Date:** 2026-05-22  
**Method:** 6 parallel specialist agents + graphify knowledge graph (604 nodes, 628 edges)  
**Scope:** Backend (NestJS), Payments (Paystack), AI Layer (DeepSeek), Electron app, Database (Neon), Landing page (Next.js)

---

## CRITICAL — Fix Before Any Public Release

These issues can result in account takeover, license fraud, or credential compromise with little or no attacker skill required.

---

### CRIT-1 — Google OAuth Accepts Client-Supplied Identity (Account Takeover)
**File:** `apps/backend/src/auth/auth.controller.ts:127`, `auth.service.ts:551`

`POST /auth/google/web` accepts `{ googleId, email, name, avatar }` raw from the request body and writes it directly to the database. Any attacker can supply any `email` (including an admin's) and receive a valid JWT. This is a zero-friction account takeover.

**Fix:** Accept a Google `id_token` only. Verify it server-side with Google's tokeninfo API. Extract claims from the verified token — never from the request body.

---

### CRIT-2 — Hardcoded GlitchTip DSN Credential in Source
**File:** `apps/backend/src/main.ts:4`

```typescript
dsn: process.env.GLITCHTIP_DSN || 'https://41222b9dc9e94a93b69db9367b692e76@app.glitchtip.com/23688'
```

The fallback encodes a live credential granting write access to your error project. Anyone who reads this source can flood it with fake errors or read captured error payloads (which may contain user data).

**Fix:** Remove the hardcoded default. Add `GLITCHTIP_DSN` to `REQUIRED_ENV`. Fail fast on startup if absent.

---

### CRIT-3 — ELECTRON_OAUTH_SECRET Not Validated at Startup
**File:** `apps/backend/src/main.ts:17-32`, `auth.service.ts:518`

`ELECTRON_OAUTH_SECRET` is missing from `REQUIRED_ENV`. If unset, `jwtService.sign(..., { secret: undefined })` may fall back to signing with an empty string — a trivially guessable key. The server starts successfully and the failure only surfaces during a Google OAuth flow.

**Fix:** Add `ELECTRON_OAUTH_SECRET` to `REQUIRED_ENV`.

---

### CRIT-4 — Webhook HMAC Uses API Key Instead of Webhook Secret
**File:** `apps/backend/src/paystack/paystack.service.ts:100`

```typescript
.createHmac('sha512', this.secretKey)  // should be this.webhookSecret
```

`PAYSTACK_WEBHOOK_SECRET` is defined and required at startup but never used. The HMAC uses `secretKey` (the API key). If these are ever set to different values, webhook verification silently breaks — letting any forged webhook activate licenses.

**Fix:** Change to `this.webhookSecret`. Ensure `PAYSTACK_WEBHOOK_SECRET` is correctly set in the environment.

---

### CRIT-5 — Paid Amount Never Validated Against Plan Price
**File:** `apps/backend/src/paystack/paystack.service.ts:139-184`

`activateLicense()` reads the plan from attacker-controllable `metadata.plan` and never checks that the paid `amount` matches the expected price. An attacker can pay ₦100 with `plan: 'lifetime'` in the metadata and receive a lifetime license.

**Fix:** Derive plan from the verified amount:
```typescript
const plan = data.amount >= 10_000_000 ? 'lifetime' : 'monthly';
```
Also verify against expected kobo amounts before calling `activateLicense`.

---

### CRIT-6 — Non-Atomic License Activation (Race Condition — Double Activation)
**File:** `apps/backend/src/paystack/paystack.service.ts:109-137`

The idempotency check is a non-atomic read-then-act. Two simultaneous Paystack webhook retries both pass the `status = 'pending'` check concurrently, resulting in double license activation, double referral commission, and a split-brain DB state.

**Fix:** Use a single atomic UPDATE as the mutex:
```sql
UPDATE payments SET status = 'success' WHERE paystack_reference = $1 AND status = 'pending' RETURNING id
```
Only proceed if a row is returned.

---

### CRIT-7 — License Activation Has No Transaction (3 Separate Writes)
**File:** `apps/backend/src/paystack/paystack.service.ts:152-180`

`UPDATE users`, `INSERT INTO licenses`, and `UPDATE payments SET status='success'` run as three separate statements. A crash between any two leaves the database inconsistent — user has `is_pro = true` but no license row, or license row exists but payment is still `pending` (causing re-activation on next webhook retry).

**Fix:** Wrap all three statements (including `processReferralCommission`) in a single Postgres transaction using `getPool()`.

---

### CRIT-8 — SQL Injection via Period Parameter in Admin Analytics
**File:** `apps/backend/src/admin/admin.service.ts:300, 432, 443, 465, 527`

```typescript
AND created_at >= NOW() - (${period} || ' days')::INTERVAL
```

`period` comes from a query parameter, is never validated as a positive integer, and is interpolated directly into SQL string concatenation. An unsanitised value can cause PostgreSQL errors or, with crafted input, unintended query behaviour.

**Fix:** Validate `period` as a positive integer (1–365) in the controller DTO. Use parameterised interval arithmetic:
```sql
NOW() - ($1 * INTERVAL '1 day')
```

---

### CRIT-9 — JWT Access Token Exposed in Client-Side Session Object
**File:** `apps/landing/auth.ts:108`, all dashboard pages

```typescript
(session.user as any).accessToken = token.accessToken;
```

The raw backend JWT is embedded in the NextAuth session and returned by `useSession()` to every client component — visible in `__NEXT_DATA__`, readable by any injected script or third-party analytics.

**Fix:** Never put the backend access token in the session object. Keep it in the server-side JWT callback only. All authenticated backend calls must be proxied through Next.js API routes that read `token.accessToken` server-side.

---

### CRIT-10 — `ALTER TABLE payout_requests` Runs Before `CREATE TABLE`
**File:** `apps/backend/src/database/init.ts:156`

On a cold boot, `ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS bank_code TEXT` executes before the `CREATE TABLE IF NOT EXISTS payout_requests` block. This throws `relation "payout_requests" does not exist` and crashes `initDB()`, preventing the server from starting.

**Fix:** Move all `ALTER TABLE payout_requests` lines to after the table's `CREATE TABLE` block.

---

## HIGH — Fix This Sprint

---

### HIGH-1 — Auth Tokens Stored in Plaintext localStorage (Electron)
**File:** `apps/electron/src/store/auth.store.ts:39`, `Login.tsx:79`

Access and refresh tokens are written to `localStorage` and Zustand persist middleware — both readable by any process running as the same OS user, visible in Chromium's LevelDB profile directory.

**Fix:** Remove tokens from `localStorage`. Store only in `electron-store` (encrypted) or OS keychain via `keytar`. Read tokens back via the preload bridge on app load.

---

### HIGH-2 — No Rate Limiting on Auth Endpoints (Brute Force)
**File:** `apps/backend/src/auth/auth.controller.ts` — login, register, refresh

No throttling, rate limiting, or lockout on any auth endpoint. Unlimited brute force and credential stuffing attacks are possible.

**Fix:** Install `@nestjs/throttler`. Apply `ThrottlerGuard` with ≥5 req/15min per IP on login, and ≥10 req/hour on register.

---

### HIGH-3 — CORS Allows Null Origin and All `*.vercel.app` Subdomains
**File:** `apps/backend/src/main.ts:70-79`

Two issues: (1) `if (!origin) return callback(null, true)` — any `null`-origin request (sandboxed iframe, file://, data URI redirect) bypasses the CORS allowlist. (2) `/\.vercel\.app$/` allows any Vercel deployment including attacker-owned projects.

**Fix:** Remove the null origin bypass. Replace the Vercel regex with an allowlist of your specific deployment URLs.

---

### HIGH-4 — SSE Endpoints Override CORS with Wildcard
**File:** `apps/backend/src/ai/ai.controller.ts:24, 60`

```typescript
'Access-Control-Allow-Origin': '*'
```
Set directly on the raw response, bypassing NestJS CORS middleware. Any origin can read the SSE stream containing CV-derived AI responses.

**Fix:** Remove the hardcoded header. Let NestJS CORS middleware set the correct origin header. Reflect the validated request `Origin` header if manual control is needed.

---

### HIGH-5 — Device Fingerprint Comparison is Not Timing-Safe
**File:** `apps/backend/src/guards/device.guard.ts:28`, `license.service.ts:47`

```typescript
if (license.device_fingerprint !== deviceId)
```
JavaScript string inequality short-circuits — a timing oracle that lets an attacker enumerate valid fingerprints byte by byte.

**Fix:**
```typescript
crypto.timingSafeEqual(Buffer.from(stored), Buffer.from(supplied))
```

---

### HIGH-6 — `verifyAndActivate` Endpoint Has No Rate Limit; Credits Wrong User
**File:** `apps/backend/src/paystack/paystack.controller.ts:22-29`

Any authenticated user can call this with any reference. The service overwrites `metadata.user_id` with `req.user.userId` — so if Alice pays and Bob opens the success URL while logged in as Bob, Bob gets the license. Also completely unrate-limited.

**Fix:** Verify that the Paystack transaction's `metadata.user_id` **matches** the requesting user (do not override it). Add rate limiting.

---

### HIGH-7 — `admin/toggleLicense` Missing `x-admin-key` Second Factor
**File:** `apps/backend/src/admin/admin.controller.ts:57-64`

Other admin mutation endpoints check `x-admin-key`. `toggleLicense` (which grants Pro access without payment) does not. A compromised admin JWT is sufficient to grant any user lifetime Pro.

**Fix:** Add the same `x-admin-key` check used by `updateUserRole` and `getStats`.

---

### HIGH-8 — Referral Payout Has TOCTOU Race (Negative Balance)
**File:** `apps/backend/src/referral/referral.service.ts:88-111`

Balance check and deduction are two separate queries with no lock. Two concurrent requests both pass the balance check and both deduct, producing a negative balance.

**Fix:** Atomic conditional update:
```sql
UPDATE referral_balances SET pending_balance = pending_balance - $1
WHERE user_id = $2 AND pending_balance >= $1
RETURNING pending_balance
```
Only proceed if a row is returned.

---

### HIGH-9 — IPC Handlers Do Not Validate Sender Frame (Electron)
**File:** `apps/electron/electron/main.ts:368-393`

All `ipcMain.handle` registrations accept messages from any frame (including future `BrowserWindow` or `webview` additions). The `capture:screen` handler can be triggered by any IPC sender, capturing a full screenshot.

**Fix:**
```typescript
ipcMain.handle('store:get', (event, key) => {
    if (!['file://', 'http://localhost:5173'].some(o => event.senderFrame?.url.startsWith(o))) return;
    return store.get(key);
});
```

---

### HIGH-10 — `shell.openExternal` Has No URL Validation (Electron)
**File:** `apps/electron/electron/preload.ts:41`, `main.ts:381`

The `openExternal` IPC handler passes any URL to `shell.openExternal()` without validation. An attacker who can inject into the renderer can open `file://`, `javascript:`, or OS-protocol URLs (`ms-word:`, etc.) to execute arbitrary processes.

**Fix:** Whitelist `https:` and `http:` protocols only in the IPC handler before calling `shell.openExternal`.

---

### HIGH-11 — Certificate Pinning Not Implemented Despite Being in Architecture Docs
**File:** `apps/electron/electron/main.ts` (absent)

The app has no `certificate-error` handler. A MITM on the same network can intercept all API traffic including auth tokens and AI responses.

**Fix:** Add a `certificate-error` handler in `main.ts` that verifies the expected SHA256 fingerprint for `api.zoomguru.xyz` and rejects all others.

---

### HIGH-12 — Session Messages Written by Client, Not Server (AI)
**File:** `apps/backend/src/session/session.controller.ts:11-25`, `session.service.ts:98`

`POST /session/end` accepts `messages` from the Electron client and writes them verbatim to the database. The server never validates these against what it actually generated. A client can fabricate any session history.

**Fix:** Accumulate messages server-side during `streamAnswer`/`streamScreenshot` (append to `interview_sessions.messages`). Ignore or remove the `messages` field from the `endSession` request.

---

### HIGH-13 — Screenshot Endpoint Has No Size or MIME Validation (AI)
**File:** `apps/backend/src/ai/ai.controller.ts:46`, `ai.service.ts:207`

The `image` field is accepted as an unbounded base64 string. No maximum length, no MIME sniffing. An attacker can send 100MB payloads or non-image data forwarded to the vision model.

**Fix:** Cap base64 string at ~3.6MB (≈2.7MB decoded). Sniff the first bytes for PNG/JPEG magic numbers. Enforce via DTO `@MaxLength()`.

---

### HIGH-14 — Usage Limit Check Has TOCTOU Race (AI)
**File:** `apps/backend/src/ai/ai.service.ts:329-354`

`checkUsageLimit()` reads `responses_used`, then `incrementUsage()` writes 1–30 seconds later after streaming completes. Two concurrent requests both read `responses_used = 9`, both pass the check, and both consume a response — exceeding the free tier limit without restriction.

**Fix:** Single atomic statement:
```sql
UPDATE user_usage SET responses_used = responses_used + 1
WHERE user_id = $1 AND responses_used < 10
RETURNING responses_used
```
Reject if zero rows returned. Remove separate `incrementUsage()` call.

---

### HIGH-15 — Windows Builds Unsigned, Public GitHub Repo
**File:** `apps/electron/electron-builder.config.js:33`

`forceCodeSigning: false` means `electron-updater` checksums verify file integrity but not publisher identity. A GitHub account compromise or CDN MITM could serve a malicious update the app would accept.

**Fix:** Sign Windows builds with an EV code signing certificate. Set `forceCodeSigning: true`.

---

### HIGH-16 — No Content Security Policy (Electron + Landing)
**Files:** `apps/electron/electron/main.ts` (absent), `apps/landing/vercel.json` (no headers block)

Neither the Electron BrowserWindow nor the landing page set a CSP. Without it, any XSS payload (e.g., injected through AI response rendering) executes with full origin access.

**Fix — Electron:**
```typescript
session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self'; script-src 'self'; connect-src 'self' https://api.zoomguru.xyz; style-src 'self' 'unsafe-inline'; img-src 'self' data:"]
    }});
});
```
**Fix — Landing:** Add a `headers` block in `vercel.json` with `default-src 'self'`, `script-src 'self' https://js.paystack.co`, `frame-ancestors 'none'`.

---

### HIGH-17 — Open Redirect After Login and Payment
**Files:** `apps/landing/app/login/page.tsx:21`, `components/Pricing.tsx:73`

`callbackUrl` from the query string is passed to `router.push()` without validation. An attacker can craft `/login?callbackUrl=https://evil.example.com` and redirect users after login.

**Fix:** Validate that `callbackUrl` starts with `/` and does not start with `//` before calling `router.push`.

---

### HIGH-18 — Prompt Injection via CV Content (AI)
**File:** `apps/backend/src/cv/cv.service.ts:165`, `prompts.ts:70`

`sanitizeCVText()` strips a small set of exact phrases but misses unicode lookalikes, paraphrasing, and roleplay framing. After AI parsing, the returned `CVProfile` fields are inserted verbatim into every system prompt via `buildCVContext()` with no further sanitisation — indirect injection through the AI parser itself is unguarded.

**Fix:** (1) Enforce strict field-length caps in `validateAndFillDefaults()`. (2) Strip embedded newlines and role-label prefixes from every returned string field. (3) Wrap CV content in delimiter tags inside the system prompt and instruct the model to treat it as untrusted data.

---

## MEDIUM — Fix Before Next Major Feature

| ID | File | Issue |
|----|------|-------|
| M-1 | `backend/src/main.ts:71` | Null Origin CORS bypass |
| M-2 | `ai.service.ts:142,322` | `fullAnswer` in SSE done-frame doubles data, leakage risk |
| M-3 | `ai.controller.ts:24,55` | SSE CORS wildcard (see HIGH-4) |
| M-4 | `cv.controller.ts:30` | No file size cap on CV upload before buffer concat |
| M-5 | `auth.service.ts:295` | `changePassword` accepts empty passwords |
| M-6 | `auth.service.ts:60` | `register` has no password minimum length |
| M-7 | `admin.service.ts:266` | `processPayout` not wrapped in transaction |
| M-8 | `database/init.ts` | Missing index on `refresh_tokens(token_hash)` |
| M-9 | `database/init.ts` | No expired refresh token purge — unbounded table growth |
| M-10 | `admin.service.ts:628` | Raw `stack_trace` returned in API response |
| M-11 | `auth.service.ts:300` | CV `raw_text` (PII) not deleted on account soft-delete |
| M-12 | `paystack.service.ts:144` | `plan` read from untrusted `metadata.plan` (see CRIT-5) |
| M-13 | `paystack.service.ts:109` | Idempotency keyed on reference+status, not Paystack event ID |
| M-14 | `auth.service.ts:589` | Stale `isPro` JWT claim — revoked licenses valid for 15 min |
| M-15 | `landing/auth.ts` | `NEXT_PUBLIC_API_URL` used for server-side calls |
| M-16 | `landing/ReferralCapture.tsx` | Referral code stored in localStorage / non-HttpOnly cookie without validation |
| M-17 | `landing/payment/success/page.tsx` | `useEffect` can double-fire verify on session refresh |
| M-18 | `electron/fingerprint.ts` | Fingerprint uses spoofable MAC + hostname; no persistence |
| M-19 | `electron/main.ts:50` | electron-store encryption key is predictable |
| M-20 | `electron/main.ts:197` | 200ms race window: screen exclusion re-applied after window.show() |
| M-21 | `electron/preload.ts:16` | `onEvent` allows renderer to attach listener to any IPC channel |
| M-22 | `ai.controller.ts:37` | Raw `err.message` (including DB errors) sent to client in SSE stream |
| M-23 | `admin.service.ts:300` | `period` pagination: no upper bound, no integer validation |
| M-24 | `main.ts` (backend) | No global `ValidationPipe` — DTOs are undecorated interfaces |
| M-25 | `landing/package.json` | `next-auth` v5 beta in production |

---

## LOW — Address When Convenient

| ID | File | Issue |
|----|------|-------|
| L-1 | `backend/main.ts:17` | Google OAuth env vars not in `REQUIRED_ENV` |
| L-2 | `paystack.service.ts:133` | Payment reference logged to stdout |
| L-3 | `auth.controller.ts:146` | OAuth `state` param not validated (CSRF for OAuth) |
| L-4 | `referral.service.ts:22` | Referred users' full emails exposed to referrer |
| L-5 | `database/init.ts:210` | `error_logs` no retention policy — stores PII indefinitely |
| L-6 | `database/init.ts:239` | OAuth tokens in `nextauth_accounts` stored in plaintext |
| L-7 | `database/init.ts:24,139` | Redundant username uniqueness constraint (full + partial) |
| L-8 | `db.ts:4` | `poolQueryViaFetch = true` has no effect on Pool connections |
| L-9 | `db.ts` | `getPool()` exported but never used (transactions unavailable) |
| L-10 | `auth.service.ts:306` | Empty string used as deleted-account password hash (fingerprintable) |
| L-11 | `electron/main.ts:430` | Deep link token forwarded to renderer without format check |
| L-12 | `electron/main.ts:339` | Debug pixel data included in production IPC payload |
| L-13 | `landing/Pricing.tsx:71` | Payment reference generated with `Math.random()` (not cryptographic) |
| L-14 | `landing/ReferralCapture.tsx:15` | `zg_ref` cookie missing `Secure` flag |
| L-15 | `landing/settings/page.tsx:150` | Debounce timer stored on `window._uTimer` (namespace pollution) |
| L-16 | `landing/register/page.tsx:54` | Username availability endpoint is an unauthenticated oracle |
| L-17 | `ai.service.ts:200` | No per-user daily token budget; Pro users can trigger unlimited AI calls |
| L-18 | `ai.controller.ts:83` | `interviewType`/`answerLength` not validated against allowlist |
| L-19 | `DATABASE.md` | Schema documentation is out of date |

---

## Recommended Fix Order

### Immediate (block release)
1. CRIT-1 — Google OAuth account takeover
2. CRIT-2 — Hardcoded credential
3. CRIT-5 — Amount not validated (pay ₦1 for lifetime)
4. CRIT-9 — JWT in client session
5. CRIT-10 — Server crashes on cold boot

### This week
6. CRIT-4, CRIT-6, CRIT-7 — Webhook HMAC, race condition, missing transaction
7. HIGH-1 — Tokens in localStorage
8. HIGH-2 — Rate limiting on auth
9. HIGH-3, HIGH-4 — CORS
10. HIGH-7 — toggleLicense missing second factor

### This sprint
11. HIGH-5, HIGH-9, HIGH-10, HIGH-11, HIGH-12, HIGH-13, HIGH-14, HIGH-15, HIGH-16, HIGH-17, HIGH-18
12. All MEDIUM items

---

*Generated by 6 parallel audit agents using graphify knowledge graph context.*
