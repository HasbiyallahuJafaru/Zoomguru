# Making ZoomGuru Scalable

Work plan. Written 2026-09-01 against commit `6437fff`.

**Status 2026-09-01: Tasks 1 and 2 are done and `.claude/CLAUDE.md` is
corrected. Step 0 (dashboard checks) and Tasks 3-4 are still open.**

Read `.claude/CLAUDE.md` first for system context. This file assumes it.

Every number below was measured from the code, not estimated. File:line
references are given so you do not have to re-derive any of it.

---

## Where the system actually stands

The AI hot path is already well built. Do not "optimise" it.

- Every DB query in `/ai/stream` runs in the check block at
  `apps/backend/src/ai/ai.controller.ts:121` and completes **before**
  `writeHead(200)` at `:161`. A 30-second SSE stream holds **zero** database
  connections.
- Session logging goes to a Redis queue, not Postgres
  (`ai.controller.ts:10`).
- Pool max is 20 (`apps/backend/src/database/db.ts:18`). Nowhere near binding
  for the AI path — those are millisecond queries in the same region.

Rough current ceilings:

| Load type | Ceiling | Set by |
|---|---|---|
| Idle logged-in users | 5,000–10,000 | Nothing much. `/auth/sessions` poll every 60s. |
| Concurrent live interviews | **~30–80** | Gemini quota (unverified) and the log queue below. |
| Screenshots/sec | **~10–20** | Single Node thread parsing 10 MB base64. |
| Replicas | **1. Hard.** | Cron jobs take no distributed lock. |

---

## Step 0 — Verify before building anything

The most likely way to waste this work is to fix a bottleneck that is not the
live one. Three unknowns are not answerable from the repo. Resolve them first;
they change what is worth doing.

**1. Gemini quota tier.** This swings capacity by 10x.

```
railway run node scripts/check-gemini-keys.mjs
```

- Paid tier x 5 keys → ~166 req/s. Not the bottleneck. Ignore it.
- Free tier (15 RPM/key) x 5 keys → **1.25 req/s ≈ 19 concurrent users**, and
  it is the whole ballgame. Nothing else in this file matters until it is fixed,
  and the fix is billing, not code.

A `429 RESOURCE_EXHAUSTED` means out of prepayment credits.

**2. Railway plan: memory and vCPU on `zoomguru-backend`.** Dashboard only —
there is no `railway.json`. This sets the screenshot OOM ceiling. 512 MB vs
8 GB is the difference between ~20 and ~300 concurrent uploads.

**3. Supabase tier.** `.claude/CLAUDE.md` says free, which means shared nano
compute and the ~7-day idle auto-pause that already took production down once
(2026-08-21). If still free, upgrading is a bigger win than any code here.

**Also worth doing before you start:** `GET /admin/stats` reports `online_now`.
Know your real concurrency. If it is 12, most of this file is premature and you
should close it.

---

## Task 1 — Session log queue drains too slowly (silent data cliff)

**Priority: P0. Smallest fix in the file.**

`apps/backend/src/cron/cron.service.ts:169-198`

```ts
@Cron('*/30 * * * * *')
async flushSessionLogQueue(): Promise<void> {
  const BATCH = 100;
  const entries = await redis.lrange('session_log_queue', -BATCH, -1);
  ...
  await redis.ltrim('session_log_queue', 0, -(entries.length + 1));
```

**The problem.** 100 entries per 30s = **3.3 writes/sec**. Auto mode spends two
logged requests per question (transcribe + stream), so at a question every ~30s
that is **~50 concurrent interviewing users** before the queue grows faster than
it drains. Past that it never catches up: `session_log_queue` grows unbounded,
analytics silently fall behind, Redis memory climbs. Users notice nothing until
Redis is under pressure.

**Second, separate bug in the same six lines:** `lrange` then `ltrim` is not
atomic. Two replicas — or one replica with an overlapping tick, which a slow
Postgres insert can cause — will double-insert and then trim entries that were
never written.

**The lazy fix solves both at once.** Redis is 8.2, so `RPOP key count` (6.2+)
exists. Entries are `lpush`ed to the head, so the oldest are at the tail; `RPOP`
with a count pops them atomically. No lock, no race, and it is *fewer* lines
than what is there now:

```ts
const entries = await redis.rpop('session_log_queue', BATCH);
if (!entries || entries.length === 0) return;
// no ltrim — rpop already removed them
```

Then raise throughput. Either bump `BATCH` (1000 is still one small INSERT), or
loop until `rpop` returns fewer than `BATCH`. Prefer the bump; the loop can
starve the event loop if the queue is deeply backlogged.

**Verify:** enqueue 5,000 entries, run one tick, confirm `LLEN` drops by
`BATCH` and `ai_sessions` gains exactly that many rows — no duplicates.

---

## Task 2 — Cron jobs block horizontal scaling

**Priority: P0. This is the actual ceiling.** Everything else is single-process
tuning; this is what lets you add a second replica at all.

Six `@Cron` jobs in `apps/backend/src/cron/cron.service.ts`. Note
`.claude/CLAUDE.md` says five — it is stale, and it omits
`expireLapsedSubscriptions`. Correct the doc while you are in there.

| Job | Schedule | Needs a lock? |
|---|---|---|
| `expireLapsedSubscriptions` | `15 0 * * *` | **No.** Already safe — its `WHERE` excludes rows it has updated (`cron.service.ts:46`). Leave it alone. |
| `sendNoPaymentFollowUps` | `0 11 * * *` | **Yes.** Duplicate email to real customers. |
| `sendExpiryReminders` | `0 9 * * *` | **Yes.** Duplicate email to real customers. |
| `resetWeeklyUsage` | `0 1 * * *` | **Probably not.** It SELECTs elapsed windows then writes a reset (`cron.service.ts:121`), so two replicas write the same values twice. Confirm `quotaService.resetUserUsage` is a straight overwrite, not an increment — if it overwrites, no lock needed. |
| `resetMonthlyUsage` | `0 2 * * *` | **Probably not.** Same shape, same check. |
| `flushSessionLogQueue` | `*/30s` | **No, if Task 1 lands.** `RPOP` is atomic; that is the lock. |

So this is realistically **two jobs that definitely need locking**, plus two to
read. Do not wrap all six reflexively.

**The lazy fix.** Postgres advisory locks. No new dependency, no new table, no
Redlock, no leader election. `pg_try_advisory_lock` returns false immediately if
another replica holds it, which is exactly the desired behaviour: the loser
skips this tick.

```ts
// One helper. Key is any stable int per job.
async function withLock(key: number, fn: () => Promise<void>): Promise<void> {
  const pool = getDB();
  const { rows } = await pool.query('SELECT pg_try_advisory_lock($1) AS ok', [key]);
  if (!rows[0].ok) return;               // another replica has it
  try { await fn(); } finally {
    await pool.query('SELECT pg_advisory_unlock($1)', [key]);
  }
}
```

Session-level locks (not `_xact_`) because these jobs are not in a transaction.
The `finally` matters — a leaked session lock survives until the connection is
returned and reset, which with a pooled connection can be a long time.

**Verify:** two local instances against the same DB, both cron ticks firing.
Assert the job body runs exactly once. `scripts/` already has this pattern —
follow `check-sessions.mjs` in style.

**Only then** raise Railway replicas above 1, and update the warnings in
`.claude/CLAUDE.md` that say it must stay at 1.

---

## Task 3 — Screenshots saturate the event loop

**Priority: P1. Do this only if screenshot traffic is real.** Check
`ai_sessions` for the `screenshot` share before spending time here.

- `bodyLimit: 15_728_640` (15 MB) — `apps/backend/src/main.ts:28`
- Guard allows a 10 MB base64 string — `ai.controller.ts:181`

Fastify buffers the **whole body before the guard runs**, so the 10 MB check
does not protect memory — it only rejects after the cost is paid. Then
`JSON.parse` on a 10 MB string blocks the single Node thread for ~50-100 ms.
About **10-20 screenshots/sec saturates the event loop**, and when it does,
every in-flight SSE stream stalls with it. Streams are I/O-bound and nearly
free; screenshots are not.

Also: `ai.service.ts:369` notes that retries re-upload the entire base64 image
per key, multiplying both memory retention and egress during a Gemini failover.

**Lazy fixes, in order. Stop at the first that holds.**

1. **Drop `bodyLimit` to ~3 MB.** A screenshot of a 1440p screen as JPEG is
   well under that. This is a one-line change and removes most of the risk.
   Check what the Electron app actually sends first —
   `apps/electron/electron/` capture code — so you do not break the client.
2. **Send JPEG, not PNG, from the client**, and downscale to ~1600px before
   upload. The vision models do not need more. Biggest real win, but it is a
   client change, so it needs an app release — and per `.claude/CLAUDE.md`
   there is no auto-updater yet. Weigh that.
3. Only if 1 and 2 are not enough: move decode off the main thread. This is
   real complexity. Almost certainly not needed.

---

## Task 4 — Synchronised re-login waves

**Priority: P2. Watch it; do not pre-emptively fix it.**

`TOKEN_TTL_SEC = 3 * 60 * 60` — `apps/backend/src/auth/sessions.ts:20`. Three
hours, no refresh tokens. Every user re-authenticates every 3h, and everyone
signs out on deploy, so logins arrive in synchronised spikes rather than spread
out.

Login is the one hot path that holds a connection: `pool.connect()` with a
transaction at `apps/backend/src/auth/auth.service.ts:199`, unlike the AI path.
A large enough spike is the realistic way to exhaust those 20 connections.

**Do not add refresh tokens for this reason alone** — that is a real auth
surface and a big change. Cheaper options, in order:

1. Raise the pool `max` (`db.ts:18`). Check the Supabase pooler client limit
   first — free tier is ~200, so there is headroom.
2. Add jitter to token TTL (e.g. 3h ± 15m) so expiry desynchronises. Small
   change, removes the thundering herd, no auth redesign.
3. Refresh tokens only if 1 and 2 fail. It is on the deferred list in
   `.claude/CLAUDE.md` already.

---

## Do NOT build these

Written down because they are the tempting wrong answers here.

- **A queue system (BullMQ, etc.) for session logs.** The list plus `RPOP` is
  already a queue. Task 1 is six lines.
- **Redis Cluster / Redlock.** One Redis, one Postgres. `pg_try_advisory_lock`
  is free and already connected.
- **Read replicas or sharding.** You are not close to a Postgres throughput
  limit. The pool is 20 and the AI path barely touches it.
- **Rewriting SSE as WebSockets.** SSE is not the problem. It holds no DB
  connection and is I/O-bound.
- **Caching AI responses.** Answers are per-user and per-CV. No hit rate.
- **Microservices.** No.

Rate limits are already sensible (40/min active, 15/min trial —
`ai.controller.ts:34`). Leave them.

---

## Suggested order

1. Step 0 verification. Non-negotiable — it may cancel most of this file.
2. Task 1 (`RPOP` + bigger batch). Smallest diff, removes a silent data cliff.
3. Task 2 (advisory locks on two jobs). Unblocks replicas — the real ceiling.
4. Raise replicas, update `.claude/CLAUDE.md`'s 1-replica warnings.
5. Task 3 only if screenshots are a meaningful share of traffic.
6. Task 4 only when login spikes actually show up in logs.

Realistic outcome: Tasks 1 and 2 take **~50 concurrent interviews to a few
hundred**, and remove the single-replica ceiling entirely. If Step 0 shows
Gemini is on the free tier, none of that matters until billing is fixed.

---

## Corrections to make to `.claude/CLAUDE.md` while you are here

Both are stale and will mislead the next session:

1. It lists **five** cron jobs; there are **six**. `expireLapsedSubscriptions`
   (`15 0 * * *`) is missing.
2. It says the JWT is in `localStorage` and lists "JWT in electron-store" as
   deferred. Already done — `grep localStorage apps/electron/src/` returns
   nothing. Tokens go through IPC to electron-store
   (`apps/electron/electron/main.ts:489`).
