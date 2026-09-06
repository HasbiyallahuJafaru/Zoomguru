# ZoomGuru — Backend Refinement

> **For a fresh Claude session. Self-contained: assume no prior context.**
> Findings verified against the running code, the live schema and the published
> binary on 2026-08-26, on branch `feat/session-cap-and-cost-plan`.
>
> **Read `.claude/CLAUDE.md` first.** It is the master context file.

---

## 0. Hard constraints — read before touching anything

**Do not modify any frontend code.** Users have the app installed and there is **no
auto-updater**. `apps/electron/**` and `apps/admin/**` are off limits for these fixes.
Every item here is backend-only and reaches users the moment the backend deploys.

**Do not delete unused features.** The AI Interviewer, Meeting Copilot and Doc Copilot
endpoints look dead and are *nearly* dead — `onOpenMeeting` and `onOpenInterviewer` are
declared and destructured in `apps/electron/src/dashboard/Dashboard.tsx` but never invoked
in its JSX, so no user can reach them. Removal was explicitly deferred. Leave them.

**Referral is NOT dead.** There is a visible "Refer & Earn" button at
`apps/electron/src/overlay/Overlay.tsx:574`. Its five endpoints must keep working.

**Production deploys on push to `main`.** Railway watches `main` and redeploys
automatically. There is no staging. Treat a push to `main` as a production release.

### Repo state to be aware of

Three commits are **committed locally but not pushed**:

```
83ae449  feat(ai): route all fallbacks through OpenRouter, remove DeepSeek entirely
4559f5c  fix(ai): stop inventing a software-engineer persona when no CV is given
4347c93  fix(db): allow a local Postgres so the stack can be tested off-cloud
```

Two consequences:

- **`OPENROUTER_API_KEY` is not set in Railway.** Once `83ae449` deploys, DeepSeek is gone
  and OpenRouter is the only fallback for every text path. Without that key, Gemini has no
  backup at all. **Set it in Railway before or with that deploy**, and remove the now-unused
  `DEEPSEEK_API_KEY` … `_5`.
- **`apps/admin` must be rebuilt and redeployed alongside the backend.** `83ae449` renames
  the API-usage field `deepseek` → `openrouter`. The admin app is deployed separately; if
  only the backend ships, the provider chart renders an empty series. This is a *rebuild
  and redeploy* of an existing app, not a code change, so it does not violate §0.

---

## 1. Quota is consumed on requests that get refused — **fix this one first**

**`apps/backend/src/ai/ai.controller.ts:137-147`**

`QuotaService.checkQuota()` increments as part of checking — it is an optimistic
`UPDATE usage SET col = col + 1 WHERE col < limit RETURNING col`
(`apps/backend/src/quota/quota.service.ts:107-120`). It runs in a `Promise.all` beside
`peekSessionCap`, and the session-cap result is checked *after* both resolve:

```ts
const [sessionCapResult, quota] = await Promise.all([
  peekSessionCap(...),
  ...checkQuota(...)          // <- already incremented
]);
if (sessionCapResult.capped) { 429 session_cap; return; }   // quota silently spent
```

A weekly subscriber who hits the daily session cap loses a quota unit on **every** refused
request, without being served anything.

The correct pattern is already in the same file: `peekSessionCap` (read-only) and
`consumeSessionCap` (write, called only after the stream is committed) at
`ai.controller.ts:59-79`. Quota should follow it — peek during the gate, consume after
commit. Both `/ai/stream` and `/ai/screenshot` have this shape; fix both.

Watch the fail-open behaviour: a Redis or DB error must not block a paying user
mid-interview. Every other check in this file fails open deliberately.

---

## 2. An uncached DB query per user per minute

**`apps/backend/src/auth/auth.service.ts` — `seatsFor()`, called by `listSessions()`**

The overlay polls `GET /auth/sessions` every 60 seconds
(`apps/electron/src/overlay/Overlay.tsx:74`) purely to render the badge
`"{n} of {max} signed in"`. `seatsFor()` issues an uncached
`SELECT plan, status, current_period_end FROM subscriptions WHERE user_id = $1`
on every one of those polls.

A 30-second cache holding exactly these fields already exists:
`sc:{userId}` in `apps/backend/src/subscription/subscription.service.ts:128-140`
(`getSubCache` / `setSubCache`, `SUB_CACHE_TTL_SEC = 30`). Reuse it.

Do **not** import `SubscriptionService` into `AuthModule` to get at it — check for a
circular module dependency first. Reading the `sc:` key directly from Redis, with the SQL
query as the cache-miss path, is the safer shape and matches how the rest of the codebase
treats that cache.

Cost today is negligible at four users. At 1,000 concurrent overlays it is ~17 queries per
second to power a text label.

---

## 3. Two 2 MB images, one of them a tray icon

**`apps/electron/assets/icon-256.png`** and **`apps/electron/assets/tray-icon.png`**

Both are **1254×1254, 2.02 MB**, despite the filename claiming 256. The tray icon renders
at 16–32 px and is decoded at full size on every launch. Together they are ~4 MB of a
96 MB installer.

> **This is the one item that is not backend-only.** Replacing image assets requires a new
> Windows build and a release upload. It does **not** touch frontend source code, so it is
> compatible with §0, but it is a separate release decision — **confirm with the user
> before doing it**, and do it as its own change, not bundled with backend fixes.

Correctly sized PNGs (256×256 for the app icon, 32×32 for the tray) land at 20–50 KB each.

---

## 4. One genuinely dead dependency

**`apps/backend/package.json`** — `@neondatabase/serverless` is declared and never
imported. The database is Supabase via `pg`; this is a leftover. Safe to remove.

**Do not remove `reflect-metadata` or `rxjs`.** A naive "not referenced in `src/`" scan
flags both. They are declared `peerDependencies` of `@nestjs/core` and are consumed
internally by Nest. Removing them breaks the build. This was verified.

---

## 5. The session-log flush can drop entries

**`apps/backend/src/cron/cron.service.ts:170-198`**

`flushSessionLogQueue` runs every 30s and does `lrange` then `ltrim` as two separate
commands. Anything `lpush`ed between them is trimmed away unread. `logSession`
(`ai.controller.ts:10`) pushes on every AI request, so a request landing in that window
loses its analytics row.

`.claude/CLAUDE.md` documents this as a multi-replica hazard; it is also a single-replica
one. `LMPOP` or a small Lua script makes it atomic. Analytics-only impact — lowest
priority here.

---

## Deliberately leave alone

- **`usage` columns** `interviewer_sessions`, `scorer_reports`, `doc_copilot_requests`,
  and the `ai_sessions.type` check constraint permitting `meeting` / `interviewer` /
  `doc_copilot` / `tts`. Inert, no write path, a few bytes per row. Dropping columns is
  destructive and buys nothing measurable.
- **`idx_device_keys_user_id`.** Now redundant with `device_keys_user_id_key_id_key`,
  which leads with `user_id`. Costs one extra write per key registration — roughly once
  per install. Fold it into the next migration that touches that table; not worth one on
  its own.
- **`users`: `idx_users_referral_code` alongside `users_referral_code_key`.** Same
  reasoning — a redundant partial index, not worth a standalone migration.

---

## Verification — required before any push

There is **no test framework** and none should be added. The convention is a plain Node
script using `node:assert` with an in-memory Redis stub. Two exist and both must stay
green:

```bash
cd apps/backend
npx tsc --noEmit                       # the project's stated gate, must pass
npm run build
node scripts/check-sessions.mjs        # concurrent-session cap
node scripts/check-ai-fallback.mjs     # Gemini -> OpenRouter breaker
```

Also run `npx tsc --noEmit` in `apps/admin`, and in `apps/electron` run **both**
`npx tsc --noEmit` and `npx tsc --noEmit -p electron/tsconfig.json` — the root tsconfig
only includes `src`, so a main-process error is invisible without the second command.

### Add a self-check for finding #1

The quota peek/consume split is money logic and must leave a runnable check behind.
Follow the existing convention exactly — no framework, no fixtures. Assert at minimum:

- a refused request (session cap tripped) does **not** increment `usage`
- a served request **does** increment it, exactly once
- the increment still happens when the `usage` row does not yet exist
- a Redis or DB failure fails **open** rather than blocking the request

### Exercise it against the local stack, not production

A full local stack exists on this machine — Redis 3.0 and PostgreSQL 17 as Windows
services, both `Automatic`. Do not test against production.

```bash
cd apps/backend
npm run build && node --env-file=.env.local dist/main.js
```

`.env.local` is gitignored and uses **fake** Resend, Paystack and AI keys, so a local run
cannot send real email, charge a card, or spend AI credit. `initDB()` builds the whole
schema on first boot. Reset state between runs with
`"C:\Program Files\Redis\redis-cli.exe" FLUSHALL`.

Two traps, both already handled in `.env.local` and documented in `.claude/CLAUDE.md`:

- `db.ts` reads **`DATABASE_POOL_URL` before `DATABASE_URL`**. Override only
  `DATABASE_URL` and your "local" server silently talks to **production**. This has
  already happened once.
- Local Postgres runs `ssl=off`; `db.ts` skips SSL for loopback hosts only.

End-to-end, against the local backend, with a throwaway account you delete afterwards:

- weekly account at its daily session cap → refused request returns `429 session_cap`
  **and** `SELECT copilot_requests FROM usage WHERE user_id = …` is unchanged
- the same account under the cap → served, and the counter goes up by exactly one
- `GET /auth/sessions` still returns `{ max, sessions }` — the installed app reads both
  fields and **must not** see a shape change

### Contract check — the installed app must keep working

Before pushing, confirm no client-facing shape changed. The published binary calls 23
endpoints and reads `max`, `sessions`, `accessToken`, `chunk`, `done`, `contextSummary`.
The SSE frame format is `{chunk, done:false}` then `{done:true, ...extra}`
(`ai.service.ts:141-152`). None of the fixes above should alter any of it — verify rather
than assume.

---

## Suggested order

1. **#1 quota** — the only finding with real user impact; paying users lose quota they
   never spent. Ship with its self-check.
2. **#2 seat cache** — small, contained, removes a per-minute query.
3. **#4 dead dependency** — one line.
4. **#5 log flush** — analytics only.
5. **#3 icons** — separate release, **ask the user first**.

Push to `main` only after every check above passes. Remember: `main` is production, the
deploy signs nobody out this time (tokens already carry `sid`), and `apps/admin` needs its
own redeploy alongside it.
