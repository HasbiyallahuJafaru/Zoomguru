# Multi-User Seats — Implementation Brief

> **For a fresh Claude session.** Self-contained: assume no prior context.
> Everything here was verified against the code and the live database on
> 2026-08-25. File:line references are accurate as of commit `7c3c124` on
> branch `feat/session-cap-and-cost-plan`.

---

## 1. What to build

Two problems, one deliverable. Both must ship together or the issue reopens.

**Problem A — seats are not plan-aware.** `MAX_SESSIONS = 2` is a flat
constant (`apps/backend/src/auth/sessions.ts:6`). Every plan gets 2 seats.

**Problem B — two different accounts cannot share one computer.**
`device_keys.key_id` is globally `UNIQUE`. The first account to register a
machine owns that key forever. A second account's registration silently
writes nothing *and still returns `{ success: true }`*, so every later AI call
from that account returns `not_registered` → the user sees **"Access denied"**
with no way out. This is the bug that has generated repeated support reports.

### The product rules (already decided — do not relitigate)

| Plan | Simultaneous users | Behaviour at the limit |
|---|---|---|
| **weekly** | **1** | **Auto sign out the older session.** Newest login always wins. |
| **monthly** | **2** | Refuse with `409 session_limit`; user picks who to sign out. |
| **yearly** | **2** | Same as monthly. |
| trial / no active plan | **1** | Same as weekly (auto-evict). |

**The split in behaviour is deliberate — do not "fix" it into consistency.**
At 1 seat the session being displaced is almost always the same person's older
one, so refusing is pure friction. At 2 seats two people legitimately share
the account; auto-evicting would make them silently kick each other in a loop,
so refusing and showing them who is signed in lets them coordinate.

Encode the rule as `const evictOldest = seats === 1;` so it stays in one place.

---

## 2. Repo state — read before touching anything

- Branch: **`feat/session-cap-and-cost-plan`**, 8 commits, **not pushed**.
  `main` is behind.
- **Production is running old code.** The concurrent-session cap, the 3-hour
  token, and the device-binding removal are all committed locally but **not
  deployed**. Do not assume production behaves like the code you are reading.
- Deploying this branch signs every existing user out once (tokens without a
  `sid` claim are rejected). That is intended and already agreed.
- There is **no test framework**. The convention is a plain node script with
  `node:assert` and an in-memory Redis stub — see
  `apps/backend/scripts/check-sessions.mjs`. Follow it; do not add a framework.
- Project rules in `.claude/CLAUDE.md`: `tsc --noEmit` must pass, complete
  files only, no TODOs, surgical changes, match existing style.

### Things in the docs that are WRONG (verified)

- `.claude/CLAUDE.md` says the AI model is Gemini 2.0 Flash. The code calls
  **`gemini-2.5-flash`** (`apps/backend/src/ai/ai.service.ts:155`).
- `.claude/CLAUDE.md` lists `VITE_PAYSTACK_*` as required for the Electron
  build. Nothing references them; the build works without a `.env`.
- `apps/backend/migrations/add_device_keys.sql` says "Run this against Neon".
  The database is **Supabase**. That file is stale — do not use it as truth.
- `R2_DOWNLOAD_URL_WINDOWS` sounds like Cloudflare but actually holds a GitHub
  release URL. Irrelevant here, but it has misled people twice.

---

## 3. Part A — plan-tiered seats

### A1. `apps/backend/src/auth/sessions.ts`

Replace the flat `MAX_SESSIONS` (line 6) with a plan → seats map. Keep
everything else in this file as-is — the token-clock pruning and the
same-device takeover are load-bearing (see §5).

```ts
// Simultaneous users per plan. Weekly is a single-seat plan; monthly and
// yearly are shared. Trial and lapsed accounts get one seat.
const SEATS: Record<string, number> = { weekly: 1, monthly: 2, yearly: 2 };
export const DEFAULT_SEATS = 1;

export function seatsForPlan(plan: string | null | undefined): number {
  return (plan && SEATS[plan]) ?? DEFAULT_SEATS;
}
```

Change the signature at line 98 to take the seat count:

```ts
export async function addSession(
  userId: string, ip: string, ua: string | undefined, seats: number,
): Promise<string | null>
```

Inside, replace the two `MAX_SESSIONS` uses (lines 120 and 130) with `seats`,
and add eviction **after** the existing same-device takeover block, before the
capacity check:

```ts
// A single-seat plan yields to the newest login rather than refusing: the
// session being displaced is almost always this same person's older one.
// At 2+ seats we refuse instead, so two legitimate users can see each other
// and coordinate instead of silently kicking each other in a loop.
if (seats === 1 && live.size >= seats) {
  const oldest = [...live.entries()].sort((a, b) => a[1].at - b[1].at)[0];
  if (oldest) { live.delete(oldest[0]); await redis.hdel(key(userId), oldest[0]); }
}
if (live.size >= seats) return null;
```

Keep the post-insert race guard, comparing against `seats` rather than the
old constant.

**Keep `MAX_SESSIONS` exported** as an alias for the monthly/yearly value, or
update its two remaining importers (§A3, §A4). Do not leave a dangling import.

### A2. `login()` must learn the plan — `apps/backend/src/auth/auth.service.ts`

`login()` (line 119) currently queries **only** the `users` table (line 131)
and never looks at `subscriptions`. This is the main structural change.

Fold the subscription into the existing UNION query so there is **no extra
round trip**:

```sql
(SELECT u.id, u.email, u.name, u.username, u.password_hash,
        s.plan, s.status, s.current_period_end
   FROM users u LEFT JOIN subscriptions s ON s.user_id = u.id
  WHERE u.email = $1 LIMIT 1)
UNION ALL
(SELECT u.id, u.email, u.name, u.username, u.password_hash,
        s.plan, s.status, s.current_period_end
   FROM users u LEFT JOIN subscriptions s ON s.user_id = u.id
  WHERE u.username = $1 LIMIT 1)
LIMIT 1
```

Then resolve the effective plan. **A row can sit at `status = 'active'` with an
elapsed `current_period_end`** — nothing expires subscriptions on a timer, so
you must check the date, not just the status. That logic already exists as
`isSubActive(status, periodEnd)` in
`apps/backend/src/subscription/subscription.service.ts` (module-level, currently
not exported). **Export it and import it** rather than writing a second copy —
duplicated expiry logic is exactly how this drifts. It is a pure function with
no Nest decorators, so there is no DI or circular-module risk.

```ts
const plan = isSubActive(row.status, row.current_period_end) ? row.plan : null;
const seats = seatsForPlan(plan);
const sid = await addSession(user.id, ip ?? '', userAgent, seats);
```

Update the 409 message at line 160 to use `seats`, not `MAX_SESSIONS`. Weekly
users will never reach it now, but monthly/yearly still will.

`register()` (line 105) also calls `addSession`. A brand-new account has no
subscription, so pass `DEFAULT_SEATS` — do not add a query there.

### A3. `GET /auth/sessions` — `apps/backend/src/auth/auth.controller.ts:133-136`

Returns `{ max: MAX_SESSIONS, sessions }`. `max` must become the user's actual
seat count, or a weekly user sees "1 of 2 signed in" in the overlay.

This endpoint is polled every 60s by the overlay, so do not add an unbounded
query. Either resolve seats through the same helper used by login, or reuse the
30-second `sc:{userId}` subscription cache that
`subscription.service.ts` already maintains. **Do not** wire `SubscriptionModule`
into `AuthModule` for this — check for a circular module dependency first; a
small direct SQL lookup is safer than a `forwardRef`.

### A4. Client — no changes needed

The shipped Electron build already handles all of this:

- `409 { error: 'session_limit', sessions: [...] }` renders a device list with
  a "Sign out" button and retries with `revokeSid`
  (`apps/electron/src/auth/Login.tsx`).
- The overlay renders `"{count} of {max} signed in"` from `GET /auth/sessions`
  (`apps/electron/src/overlay/Overlay.tsx`), so `max: 1` displays correctly
  with no change.

**Do not rebuild or modify the Electron app for Part A.**

---

## 4. Part B — let two accounts share one computer

### B1. The migration

Verified against the live Supabase database on 2026-08-25:

```
device_keys_key_id_key  | UNIQUE (key_id)          <- the blocker
device_keys_pkey        | PRIMARY KEY (id)
device_keys_user_id_fkey| FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
idx_device_keys_user_id | INDEX (user_id)
```

**7 rows, 7 distinct `key_id`, 4 distinct `user_id`** — no duplicates, so the
new constraint cannot fail on existing data. Re-verify before running; do not
take this on faith.

```sql
ALTER TABLE device_keys DROP CONSTRAINT IF EXISTS device_keys_key_id_key;
ALTER TABLE device_keys
  ADD CONSTRAINT device_keys_user_id_key_id_key UNIQUE (user_id, key_id);
```

Add this to `apps/backend/src/database/init.ts` as a **new versioned block**.
The file already has a `schema_version` table and versions 1 and 2 (lines
270-302) — follow that pattern exactly and insert version 3. Also fix the
inline `CREATE TABLE` at line ~215 (`key_id TEXT UNIQUE NOT NULL`) so fresh
databases get the right shape.

Note `init.ts` is fire-and-forget at boot (`main.ts`), so a migration failure
will not stop the app — check the logs after deploying.

### B2. `registerKey` — `apps/backend/src/device/device.service.ts:23-29`

The conflict target must move to the composite key. The
`WHERE device_keys.user_id = EXCLUDED.user_id` guard becomes redundant once
`user_id` is in the conflict target — remove it, or the update silently
no-ops again.

```sql
INSERT INTO device_keys (user_id, key_id, public_key)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, key_id) DO UPDATE SET public_key = EXCLUDED.public_key
```

`verifySignature` already selects by `WHERE user_id = $1 AND key_id = $2`
(same file, ~line 85) and needs **no change** — it was always account-scoped.
The bug was only ever in the write path.

---

## 5. Do NOT touch these — each one caused a regression already

- **`TOKEN_TTL_SEC = 3 * 60 * 60`** and token-clock pruning
  (`sessions.ts:12`, `loadLive`). Sessions are pruned on **login time**, not
  idle time, deliberately. An idle window longer than the token leaves a slot
  that outlives the token that owns it — unreclaimable, and two cycles of that
  lock the account out. This was already gotten wrong once.
- **The same-device takeover** in `addSession` (~lines 105-118). It matches on
  `ip + device` so one machine reclaims its own slot. Older clients have no
  `/auth/logout` call and never release a slot; without this, one machine locks
  itself out by signing in and out twice. Keep it, and keep it **before** the
  eviction logic.
- **`isRegistered` early-return** in `device.controller.ts`. Re-registering a
  known key must stay free — the client re-POSTs `/device/register` on every
  Dashboard mount, and charging for it locked users out with "Too many device
  registrations".
- **`DEV_REG_MAX = 5`** is now correct *because* re-registrations are free.
  Do not raise it; that was tried and treats the symptom.
- **Device binding is gone and stays gone.** `subscriptions.locked_key_id` /
  `locked_key_id_2` are dead columns, never read or written. Do not revive
  them — seat limits belong in the session layer, not the subscription row.
- **Fail-open on Redis.** Every Redis check here fails open on purpose: the
  product is used live during interviews and a Redis blip must not lock
  paying users out mid-call. Keep that.

---

## 6. Verification

Extend `apps/backend/scripts/check-sessions.mjs` — it already has the
in-memory Redis stub and covers takeover, expiry pruning, and revocation. Add:

- weekly (`seats = 1`): a second login **succeeds** and the first session's
  `sid` is gone — assert `touchSession(uid, firstSid) === false`
- monthly (`seats = 2`): two logins succeed, a **third distinct device** is
  refused (`null`)
- same-device takeover still works at both seat counts and does not consume
  an extra slot
- eviction picks the **oldest** by `at`, not an arbitrary one

Then:

```bash
cd apps/backend
npx tsc --noEmit          # project's stated gate
npm run build && node scripts/check-sessions.mjs
```

End-to-end, against a deployed backend:

- weekly account, sign in on two machines → both work, first is signed out
  and lands on the login screen on its next request
- monthly account, sign in on three machines → third gets the device picker,
  can sign one out and proceed
- **the Part B check:** two different accounts sign in on the *same* computer
  → both work. Confirm with
  `SELECT user_id, key_id FROM device_keys WHERE key_id = '<that machine>'`
  returning **two rows**. Before the migration this is impossible.

---

## 7. Deploy order

1. Run the migration (§B1) — additive and safe on the verified data.
2. Deploy the backend. Everyone is signed out once; expected.
3. No Electron rebuild or release upload is required for either part.

---

## 8. Why this kept going in circles

Recorded so it does not happen again:

- The symptom is always **"Access denied"** or **"Too many device
  registrations"**, but there are *four* distinct causes: a rate-limit window
  that reset itself, a client that re-registers on every mount, a globally
  unique `key_id`, and a flat seat cap. Fixing one leaves the others.
- Repeated attempts to fix it by **raising a limit** rather than removing the
  reason the limit was hit.
- Assuming the device keypair rotates on logout. **It does not** — verified:
  `%APPDATA%\zoomguru\device-key.json` survived every login, logout, restart
  and rebuild; `clearToken` is a single-key delete on a *different* store file.
- Trusting `.claude/CLAUDE.md` and variable names over the actual code and
  database. Check both.
