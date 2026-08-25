# Cost-Abuse Hardening — Implementation Plan

> Status: **planned, not implemented.** Written 2026-08-25.
> The two items under "Open decisions" must be settled before starting P0.

## Context

How do we stop users abusing the AI endpoints and running up the bill?

The audit found that the limits we already built are **switched off**, and one
retry bug bills **5 upstream calls to serve 1 request**. Today a single paid
account can sustain 40 req/min × 60 × 24 = **57,600 AI requests/day** with
nothing to stop it, nothing to reveal it, and no way to shut it off.

An earlier draft sized ceilings at "2–3× heaviest legitimate use" and landed at
~$20/month of AI against $33.58 of revenue — **60% COGS**. That was the wrong
anchor. This version sizes every ceiling backwards from **90% gross margin**,
then checks whether that still covers a real user.

### Decisions taken

1. **Preventive** — no cost pain yet; order by risk, not by fire.
2. **Hard block** at the limit.
3. **Ceilings are anti-abuse, not product limits** — marketing says "unlimited".
4. **Target 90% gross margin** — AI cost ≤ 10% of revenue at the ceiling.
5. **Keep `gemini-2.5-flash`** — quality is the product. This is the expensive
   choice, and the ceilings below are ~5× stricter because of it.

### Correction to our own docs

`.claude/CLAUDE.md` says the primary model is **Gemini 2.0 Flash**. The code
actually calls **`gemini-2.5-flash`** (`apps/backend/src/ai/ai.service.ts:155`)
— roughly $0.30/1M in and **$2.50/1M out**, about 6× the output price the docs
imply. The model was changed without the cost following the decision.
**Fix the doc as part of P0.**

> Verify current Gemini pricing before committing these numbers. Every ceiling
> scales linearly with it, so the structure holds even if the rate has moved.

---

## The economics

Revenue at ₦1,340/USD, and the 10% AI budget it allows:

| Plan | Price | USD | AI budget @ 90% margin |
|---|---|---|---|
| Weekly (7d) | ₦15,000 | $11.19 | **$1.12 / 7d** |
| Monthly | ₦45,000 | $33.58 | **$3.36 / 30d** |
| Yearly | ₦450,000 | $335.82 | **$33.58 / yr** ($2.76 / 30d) |

**Unit cost.** 1 unit = one `/ai/stream` answer. Output dominates — 82% of the
bill — because every call sets `maxOutputTokens: 800`:

```
input   1,500 tok × $0.30/1M  = $0.00045
output    800 tok × $2.50/1M  = $0.00200   <- 82%
                                 ---------
                                 $0.00245  per unit today
```

Trimming the output cap 800 → 500 takes this to **$0.0017/unit (−31%)**. That
single change is what makes 90% margin and full coverage of a heavy user
compatible. Without it the ceiling must drop to ~1,370 units and starts blocking
genuine p95 users. **It is load-bearing — see Open decisions.**

**Weighted units** (relative real cost, used by the ceiling counter):

```
stream 1 · transcribe 1 · tts 1 · interviewer 1
screenshot 2 · meeting 2 · scorer 4 · doc_copilot 8
```

**What real usage costs, in units:**

- Real interview (~30 questions): 30 transcribe + 30 stream + 5 screenshot@2 = **70**
- Mock interview (25 q): 25 question + 25 tts + 25 transcribe + 1 scorer@4 = **79**
- Doc-copilot question: **8**

| | per month | at $0.0017/unit | margin on monthly |
|---|---|---|---|
| Median (4 interviews, 3 mocks, 20 doc) | 677 units | $1.15 | 96.6% |
| p95 heavy (10, 6, 50) | 1,574 units | $2.68 | 92.0% |
| **Ceiling** | **1,900 units** | **$3.23** | **90.4%** |

### The ceilings

| Control | Value | Worst case | Margin at ceiling |
|---|---|---|---|
| Daily, paid | **500 units/day** | $0.85/day | (burst guard) |
| Period, monthly + yearly | **1,900 units/30d** | $3.23 | 90.4% / 88.3% |
| Period, weekly | **650 units/7d** | $1.11 | 90.1% |
| Daily, trial | **60 units** | $0.10/trial | marketing spend |

- Daily 500 covers a heavy day (3 interviews + 1 mock = 289 units) at 1.7×, and
  stops one account burning the whole month in four days.
- Monthly 1,900 covers the p95 heavy user at 1.2× and the median at 2.8×.
- **Yearly deliberately gets the monthly allowance** (1,900/30d) rather than its
  strict $2.76 budget, so 88.3% not 90%. Yearly subscribers pay the most
  upfront; giving them a *smaller* monthly ceiling than monthly subscribers is
  indefensible to a customer. The 1.7pp is worth it.
- Weekly is the thinnest-margin plan. If real weekly users cluster near 650,
  reprice it.

**These numbers assume the fan-out is fixed.** Until P0 item 1 lands, actual
spend can be 5× the ceiling — the counter measures requests, not upstream calls.

---

## P0 — one deploy (~2.5h). Everything here is cost-per-request.

### 1. Kill the retry fan-out + add key cooldown

**File:** `apps/backend/src/ai/ai.service.ts`

`:347-360` does `Array.from({ length: keyCount - 1 }, () => this.fetchGemini(...))`,
which invokes every fetch **eagerly**. `Promise.any` takes the first winner and
never cancels the losers — they complete, get billed, and leak unread bodies.
Same pattern at `:499` (`streamToDeepSeek`) and `:909` (`streamToDeepSeekQuestion`).

Replace all three with one sequential helper that tries the next key only after
the previous returns 429, and cancels each loser:

```ts
private async tryKeys(
  keys: string[],
  take: () => string,
  doFetch: (key: string) => Promise<Response>,
): Promise<Response> {
  let key = take();
  let response = await doFetch(key);
  for (let i = 1; i < keys.length && response.status === 429; i++) {
    this.cool(key);
    void response.body?.cancel();
    key = take();
    response = await doFetch(key);
  }
  if (response.status === 429) this.cool(key);
  return response;
}
```

Add a shared `keyCooldown = new Map<string, number>()` (60s) that
`nextGeminiKey` / `nextDeepSeekKey` (`:297-307`) skip over, so a key that just
429'd is not immediately reused. An in-process `Map` is *exact* here, not
approximate — `.claude/CLAUDE.md` mandates 1 Railway replica for the same reason
the cron jobs require it. No Redis needed.

`generateInterviewerQuestion` (`:986`), `callGemini25ForJson` (`:1078`),
`getOrCreateDocCache` (`:1222`) and `streamGeminiCached` (`:1255`) call
`nextGeminiKey()` directly and get the cooldown for free.

**Net negative diff.** Write this first: pure bug, no product tradeoff, divides
worst case by 5.

### 2. Trim `maxOutputTokens` 800 → 500

**File:** `apps/backend/src/ai/ai.service.ts:321` (and `:481` for DeepSeek)

−31% on every text answer — the biggest per-request saving available without
changing model. 500 tokens is ~375 words, ~2–3 spoken minutes, already longer
than anything usable as a live interview prompt.

**Leave the scorer at 2,000** (`:1085`) — it is a written report and the one
place reasoning quality is visible.

### 3. Weighted ceiling on all 9 endpoints

**New file:** `apps/backend/src/ai/limits.ts`

Move `checkRateLimit` / `sessionCapKey` / `peekSessionCap` / `consumeSessionCap`
out of `ai.controller.ts` into one module shaped exactly like
`apps/backend/src/auth/sessions.ts` (plain module-level functions over
`getRedis()`), and replace them with a single `checkLimits()` that does rate
limit + daily counter + period counter in **one Redis pipeline / one round trip**.

This fixes three existing defects at once:

- the current cap early-returns for any plan that is not `monthly` (`:64`, `:74`),
  so weekly and yearly subscribers have **no daily cap at all**
- it is wired into only 2 of 9 endpoints
- it is a non-atomic peek-then-consume race (peek `:140`, consume `:159`)

```ts
export const UNITS: Record<Endpoint, number> = {
  stream: 1, transcribe: 1, tts: 1, interviewer: 1,
  screenshot: 2, meeting: 2, scorer: 4, doc_copilot: 8,
};

export async function checkLimits(userId, endpoint, subActive, periodStart) {
  // INCR rl + EXPIRE + TTL, INCRBY cap:{u}:{day} + EXPIRE,
  // INCRBY cap30:{u}:{periodIndex} + EXPIRE  -- one pipeline
}
```

Returns `{ rateLimited, retryAfter, dayOver, periodOver, resetAt }`. Each of the
9 endpoints swaps `checkRateLimit(...)` for `checkLimits(...)` and gains two
`if` lines.

**Wire compatibility:** reuse the existing `session_cap` error code.
`apps/electron/src/overlay/Overlay.tsx:115` and `:187` already handle it, so
`/ai/stream` and `/ai/screenshot` need **zero client changes**. Add `resetAt` to
the payload and update the two client strings to use it.

### 4. Input bounds

**doc-copilot** — `ai.service.ts:1388`. `streamDocCopilot` joins documents with
**no truncation**: 3 docs × 200,000 chars = 600,000 chars (~150k tokens,
~$0.047, **20× a copilot answer**). This is the most expensive single request in
the product. Truncate the joined `docContent` at **120,000 chars**, split evenly
across `documents.length` so one huge file cannot crowd out the others.
`streamMeetingAnswer:1317` already has exactly this guard at 6,000 chars —
doc-copilot is simply missing it. Cuts worst case ~5×.

Also make the cache **server-keyed**: replace the client-supplied
`body.cacheKey` with `createHash('sha256').update(docContent).digest('hex').slice(0,32)`.
Today caching only happens if the client bothers to send a key, so the cost
benefit is client-controlled. Gemini cached input is ~4× cheaper.

> Known tradeoff: truncating at 120,000 chars silently drops later pages of a
> very long document, and the model will answer "that information is not in your
> loaded documents". 120k is ~30–40 pages, which covers the overwhelming
> majority. The real fix for "load your 100-page deck" is chunking + retrieval —
> a feature, not hardening. Truncate now, put retrieval on the roadmap.

**Interviewer prompt** — `ai.controller.ts:295`. `priorQuestions` re-sends
30 × 500 chars (~3,750 tokens) on **every** question, growing quadratically
across a session. Change to `.slice(-25)` × 160 chars. One line, ~$0.02/session,
invisible to the user.

**Screenshot** — `ai.controller.ts:180`. Cap 10,000,000 → 3,000,000 base64
chars, and validate PNG dimensions by decoding the first 48 bytes (no dependency):

```ts
// PNG IHDR: 8-byte signature, 4-byte length, 'IHDR', then width/height BE uint32.
const head = Buffer.from(body.image.slice(0, 64), 'base64');
if (head.readUInt32BE(0) !== 0x89504e47) throw new BadRequestException('Invalid image');
if (head.readUInt32BE(16) > 1920 || head.readUInt32BE(20) > 1920) {
  throw new BadRequestException('Image too large');
}
```

A byte cap alone does not close this: Gemini bills **tiles derived from
resolution**, so a 6000×6000 flat-colour PNG is tiny in bytes but bills dozens
of tiles. The Electron client only ever captures 1280×720
(`apps/electron/electron/capture.ts:7`), so the current headroom serves
attackers exclusively.

**`sanitize()`** — `ai.controller.ts:18`. Add a `max = 20_000`
slice-before-replace default, so every call site is bounded. Today a global
regex can run over up to 15MB (the Fastify `bodyLimit` in `main.ts:28`) on the
event loop, blocking every other user. **Delete `sanitize(body.audio)` at `:533`
entirely** — base64 contains no control characters by definition, and
`Buffer.from(x, 'base64')` already ignores invalid ones.

**Audio** — `ai.controller.ts:518`. 5,000,000 base64 chars is ~3.75MB, roughly
20 minutes of Opus; a question is under 60s. Drop to **1,000,000** (~4 min,
still 5× headroom).

**Timeouts** — the only two outbound calls with none:
add `AbortSignal.timeout(30_000)` to `transcribe` (`ai.service.ts:1181`) and
`AbortSignal.timeout(20_000)` to `getOrCreateDocCache` (`:1224`). Whisper is
billed per audio-second, so an indefinitely hanging request is unbounded cost.

---

## P1 — next deploy (~2h). Closing the bypasses.

### 5. Server-side interviewer session

Today the server holds **no session state** and accepts `questionNumber` up to
100 (`ai.controller.ts:291`), while the 25-question limit is client-side only
(`apps/electron/src/interviewer/InterviewerSession.tsx:32`). A client can skip
`interviewer-start` entirely and loop `interviewer-question`.

`interviewer-start` (`:237`) mints a session id:

```ts
const sid = randomBytes(12).toString('hex');
await redis.set(`iv:${userId}:${sid}`, '0', 'EX', 7200);
return { sessionId: sid, ... };
```

`interviewer-question` requires `body.sessionId` and consumes a slot. The trap is
that `INCR` **creates** a missing key, so a forged id would work. Solve it
without Lua by reading the TTL in the same pipeline:

```ts
const [[, n], [, ttl]] = await redis.pipeline().incr(key).ttl(key).exec() as ...;
if (ttl < 0) { await redis.del(key); return 403 'invalid_session'; }  // forged
if (n > MAX_QUESTIONS) return 429 'session_complete';
```

`MAX_QUESTIONS = 30` server-side (client uses 25 — the headroom means a network
retry does not strand someone mid-interview). Also tighten `questionNumber` from
`> 100` to `> 30`.

**Only meter `interviewer-question` against the session.** `/ai/tts` and
`/ai/transcribe` are shared with the copilot flow and are the two cheapest
calls; the weighted daily ceiling already bounds them. Do not gate
`score-session` on a session id either.

**Client:** `InterviewerSetup.tsx:67` already calls `interviewer-start` and
discards the body — capture `sessionId`, pass through `onStart`, include it in
`InterviewerSession.tsx:146`. ~35 lines backend, ~10 lines Electron.

### 6. Per-user kill switch

Two layers, because it must bite immediately *and* survive a Redis flush:

- **Redis, for immediacy.** `SET ban:{userId} 1` (no TTL), checked in
  `apps/backend/src/auth/jwt.strategy.ts` inside the existing `Promise.all`
  alongside `touchSession` — one extra command, zero added latency. Banned →
  `401 account_suspended`, which every client screen already routes to logout.
- **Postgres, for durability.**
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled BOOLEAN NOT NULL DEFAULT false`
  in the schema_version block of `database/init.ts`. Add `u.disabled` to the
  `checkAccess` JOIN (`subscription.service.ts:439`) and to `SubCacheEntry`;
  `canUse = false` when disabled.

The 30s `sc:` sub cache does not delay this, because the ban never goes through
`checkAccess` on the hot path: the admin endpoint does `SET ban:` +
`revokeAllSessions(userId)` + `DEL sc:{userId}` in one call, so the abuser's very
next request 401s at `jwt.strategy` in under a second. `revokeAllSessions`
(`auth/sessions.ts:158`) finally gets a caller.

**Endpoints:** `POST /admin/users/:id/ban` and `/unban` on the existing
`AdminKeyGuard`.

### 7. Per-user cost attribution — the data is already there

`logSession` (`ai.controller.ts:10`) already writes `{userId, type}` into
`ai_sessions`, indexed on both columns. Nobody ever wrote the `GROUP BY`. The
minimum change that answers "who cost us the most yesterday":

```sql
SELECT u.email, s.type, COUNT(*)::int AS n
FROM ai_sessions s JOIN users u ON u.id = s.user_id
WHERE s.created_at >= NOW() - INTERVAL '1 day' * $1
GROUP BY u.email, s.type ORDER BY n DESC LIMIT 50
```

Grouping by `type` as well as user matters: raw request counts mislead when
doc_copilot costs 20× a tts call. With `type` you can apply the same `UNITS`
weights and rank by cost rather than volume. Expose as `GET /admin/top-users?days=`.

Two gaps to close alongside it:

- `score-session` calls **no** `logSession` at all (`ai.controller.ts:328-372`)
  — add it, plus `'scorer'` to the `type` union and the CHECK constraint.
- `flushSessionLogQueue` drains `BATCH = 100` every 30s = 200 rows/min
  (`cron/cron.service.ts`). One abuser at 40 req/min is fine; three are not, and
  the queue grows unboundedly. Raise to 500.

**Do not thread `userId` through `trackedFetch` yet.** If per-upstream-call
attribution is ever needed, use `AsyncLocalStorage` (`node:async_hooks`, no
dependency, ~10 lines) rather than editing ~30 call sites. Request counts find
the abuser first — they will be 100× the median, not 1.3×.

---

## P2 — after the bounds exist

### 8. Admin alerting

An alert without a bound is just a pager, so this comes last. There is currently
**no admin notification of any kind**: `email/email.service.ts` has 5 send
functions, all user-facing, and none of the 6 cron jobs check a threshold.

Add `notifyAdmin(subject, body)` following the existing senders, and one hourly
`@Cron` that fires when either:

- any provider's `apifail:{today}:{provider}` exceeds ~50 (a key is dead, or
  someone is hammering), or
- the top user exceeds 250 units in a day (50% of the daily ceiling — a real
  user never gets there).

The second is the one that will actually catch something.

---

## Explicitly not doing

- **Re-enabling the Postgres quota** (`CAPPED_PLANS`, `quota/quota.service.ts:38`).
  It puts an `UPDATE usage` on the hot path of every AI request for a bound the
  Redis counter gives free, needs both cron reset jobs to stay correct, and
  meters only 4 of 9 endpoints. Leaving `/subscription/usage` reporting zeros is
  *consistent* with "unlimited". Do not delete the machinery either —
  `getPlanLimits` is still read by `getUsage`.
- **Downgrading OpenAI vision to `detail: 'low'`** (`ai.service.ts:720`). It is
  the *third* fallback, only reached when Gemini and Groq have both failed.
  512px cannot read code off a screenshot, so we would be paying for a fallback
  that returns garbage during a live interview.
- **Server-side image downscaling (`sharp`).** New native dependency and build
  risk for a client that already captures 720p. The 8-line IHDR check is the
  whole win.
- **A lifetime cap on device keys per user.** Every limit is keyed on `userId`;
  extra keypairs multiply nothing.
- **An IP dimension on the rate limit.** Behind Railway's proxy and Nigerian ISP
  CGNAT this false-positives on real users for very little gain.

---

## Open decisions

1. **Output cap 800 → 500 is load-bearing.** Keeping `gemini-2.5-flash` on
   quality grounds leaves this as the only remaining lever on the core unit
   cost. Without it the monthly ceiling must drop to ~1,370 units, which starts
   blocking genuine p95 users. If answer length must not change, the honest
   options are a lower ceiling (and more support requests to lift it) or
   accepting ~86% margin instead of 90%.
2. **No "upgrade" CTA on the block message.** There is nothing above yearly to
   upgrade to, so telling a yearly subscriber to upgrade at a fair-use ceiling is
   confusing. Proposed instead:
   `429 { error: 'session_cap', resetAt, message: "Unusually high activity — resets at <time>. Contact support if you need it lifted." }`
3. **Pricing copy contradicts itself** (marketing task, outside this plan).
   `apps/landing/index.html:603` lists "120 AI coaching sessions" while
   `apps/landing/faq.html:373` says "unlimited coaching sessions" — the same site
   promises both. Given decision 3 above the cards should say unlimited. The
   ceilings here are deliberately invisible, so **no number in this document ever
   needs to appear on the pricing page.**

---

## Verification

There is no test framework in this repo. Follow the `check-sessions.mjs`
precedent exactly: plain `node:assert/strict` with an in-memory Redis stub, no
framework, no new dependency.

- **`apps/backend/scripts/check-limits.mjs`** (~90 lines): unit weights
  accumulate correctly; the daily counter blocks at exactly the ceiling and not
  before; the period counter is independent of the daily one; a forged `iv:`
  session id is rejected via the TTL check; question 31 is refused.
  (This is the reason the limit logic belongs in `src/ai/limits.ts` rather than
  staying inside the Nest controller — the same rationale that made
  `src/auth/sessions.ts` its own file.)
- `npx tsc --noEmit` in `apps/backend` and `apps/electron` after each file — the
  project's stated gate.
- `npm run build && node scripts/check-sessions.mjs` must still pass; the
  concurrent-session cap must not regress.
- **Margin check on real data:** after 7 days, run `/admin/top-users` and
  multiply the top 10 users' weighted units by $0.0017. If anyone exceeds 10% of
  what they pay, the ceiling is still too loose. That is the number that decides
  whether this worked — not the request count.
- **Fan-out proof:** record `GET /admin/api-health` `callsToday` per provider
  before the deploy and 24h after. Provider calls should fall with no drop in
  `ai_sessions` rows; that divergence is the fix working.
- **Manual:** drive one full 25-question mock interview end to end and confirm
  it completes without tripping the ceiling.

## Files touched

| File | Items |
|---|---|
| `apps/backend/src/ai/ai.service.ts` | 1, 2, 4 |
| `apps/backend/src/ai/ai.controller.ts` | 3, 4, 5, 7 |
| `apps/backend/src/ai/limits.ts` *(new)* | 3 |
| `apps/backend/src/auth/jwt.strategy.ts` | 6 |
| `apps/backend/src/subscription/subscription.service.ts` | 6 |
| `apps/backend/src/admin/admin.controller.ts` + `admin.service.ts` | 6, 7 |
| `apps/backend/src/database/init.ts` | 6, 7 |
| `apps/backend/src/cron/cron.service.ts` | 7, 8 |
| `apps/backend/src/email/email.service.ts` | 8 |
| `apps/backend/scripts/check-limits.mjs` *(new)* | verification |
| `apps/electron/src/interviewer/InterviewerSetup.tsx` + `InterviewerSession.tsx` | 5 |
| `apps/electron/src/overlay/Overlay.tsx` | 3 (resetAt copy) |
| `.claude/CLAUDE.md` | model correction |
