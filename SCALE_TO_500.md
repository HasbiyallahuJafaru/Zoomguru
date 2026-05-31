# ZoomGuru — Scale to 500 Concurrent Users
# Session Guide for New Claude Session
# Read every word before writing a single line of code.

---

## What Was Already Done (Previous Session)

These changes are COMPLETE and already in the codebase. Do not redo them.

```
✅ Finding 1 — Device check DB cache added
   File: apps/backend/src/subscription/subscription.service.ts
   What: checkDevice() now caches userId:deviceId → allowed in a
         module-level Map with 60s TTL. DB is no longer hit on every
         AI request. invalidateDeviceCache(userId) called after verify().

✅ Finding 4 — Rate limit raised
   File: apps/backend/src/ai/ai.controller.ts
   What: RATE_LIMIT changed from 3 to 15 (per 60 seconds per user).

✅ Finding 6 — Destroyed socket guard added
   File: apps/backend/src/ai/ai.service.ts
   What: sseWrite() and sseEnd() helpers guard every reply.write()
         with if (!reply.destroyed). While loops check reply.destroyed
         at top of each iteration and break early.

✅ Gemini 2.0 Flash added as primary AI provider
   File: apps/backend/src/ai/ai.service.ts
   What: streamToGemini() tries Gemini first for both text and vision.
         Returns false if Gemini fails before sending bytes → falls
         back to DeepSeek (text) or Groq Vision (screenshots).
         Groq Whisper unchanged for transcription.

✅ Gemini key rotation added (5 keys)
   File: apps/backend/src/ai/ai.service.ts
   What: geminiKeys[] array reads GEMINI_API_KEY through
         GEMINI_API_KEY_5. nextGeminiKey() round-robins.
         On 429 rotates to next key and retries once before
         returning false (triggering DeepSeek fallback).

✅ GEMINI_API_KEY added to required env vars
   File: apps/backend/src/main.ts
   What: GEMINI_API_KEY added to REQUIRED array. Backend will not
         start without it.
```

---

## Current Concurrent Capacity

```
Gemini (5 keys):          500-750 concurrent streams    ✅ not the bottleneck
Render (1 instance 2GB):  300-350 concurrent SSE        ← BOTTLENECK
Rate limiter (in-process Map): breaks with >1 instance  ← MUST FIX before scaling
Neon DB (pool max 20):    fine on 1 instance            ← MUST FIX before scaling
```

To reach 500 concurrent, two things must be fixed before Render can scale
to multiple instances. These are the two remaining tasks.

---

## Remaining Findings (What This Session Must Fix)

```
Finding 3 — Rate limiter is instance-local (in-process Map)
Finding 5 — DB pool × multiple instances exhausts Neon connections
```

After both are fixed, Render auto-scaling to 3 instances is safe.

---

## Current File State (Read Before Touching Anything)

### apps/backend/src/ai/ai.controller.ts

Key facts:
- Line 19: `const RATE_LIMIT = 15;`
- Line 20: `const WINDOW_MS = 60_000;`
- Lines 22-25: `interface RateWindow { count: number; windowStart: number; }`
- Line 31: `const rateLimits = new Map<string, RateWindow>();`
- Lines 33-40: setInterval cleanup every 5 minutes
- Lines 42-58: `function checkRateLimit(userId: string)` — pure in-process logic

This entire in-process rate limiter (lines 22-58) must be replaced with Redis.

### apps/backend/src/database/db.ts

Current content:
```typescript
import { Pool } from '@neondatabase/serverless';

let _pool: Pool | null = null;

export function getDB(): Pool {
  if (!_pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not set');
    }
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
    });
  }
  return _pool;
}
```

Problem: max 20 connections per instance. 3 instances = 60 connections.
Neon free tier = ~20 total. This will cause connection errors at scale.

### apps/backend/package.json

Current dependencies include:
- `@neondatabase/serverless` — DB driver
- `@nestjs/common`, `@nestjs/core`, `@nestjs/jwt`, `@nestjs/passport`
- `@nestjs/platform-fastify`
- `@nestjs/schedule`
- `bcryptjs`, `dotenv`, `passport`, `passport-jwt`
- `resend`, `rxjs`

Does NOT yet have: `ioredis` — you must install it.

---

## STAGE 1 — Redis Rate Limiter

### Context

The `rateLimits` Map in `ai.controller.ts` is module-level in-process state.
When Render runs 3 instances behind a load balancer, each instance has its
own Map. A user hitting instance A uses 5 of their 15 allowed requests,
then hits instance B and gets a fresh 15. Rate limit is completely bypassed.

Fix: replace the in-process Map with Redis using a sliding window counter.
Each userId gets a Redis key that expires after 60 seconds. All instances
share the same Redis, so the count is accurate across the fleet.

### What Redis to Use

Render has a built-in Redis addon. In Render dashboard:
- Go to your service → Add-ons → Redis
- Or create a standalone Redis instance in Render
- Copy the `REDIS_URL` (format: `redis://:password@host:port`)
- Add it to Render environment variables as `REDIS_URL`

### Package to Install

```
ioredis
```

Run from apps/backend:
```bash
npm install ioredis
npm install --save-dev @types/ioredis  (if types not bundled)
```

Check that ioredis appears in `dependencies` in package.json after install.

### New File to Create

Create `apps/backend/src/redis/redis.ts`:

```
Purpose: singleton Redis client, same pattern as db.ts
Exports: getRedis() → IORedis instance
Reads:   process.env.REDIS_URL
```

### File to Modify: ai.controller.ts

Remove entirely:
- The `RateWindow` interface
- The `rateLimits` Map
- The `setInterval` cleanup
- The `checkRateLimit` function

Replace with:
- Import `getRedis` from the new redis.ts
- New async `checkRateLimit(userId: string)` that uses Redis INCR + EXPIRE
  sliding window (or SET NX with TTL)
- Update both call sites in `stream()` and `screenshot()` and `transcribe()`
  to `await` the new async version

### Redis Rate Limit Algorithm

Use Redis atomic INCR + EXPIRE pattern:
```
key = `rl:${userId}`
count = INCR key
if count === 1: EXPIRE key 60   (first request sets the window)
if count > 15: reject with 429
else: allow
```

This is atomic (no race conditions) and works identically across all instances.

### Files to Touch in Stage 1

```
apps/backend/src/redis/redis.ts          ← CREATE
apps/backend/src/ai/ai.controller.ts     ← MODIFY
apps/backend/package.json                ← updated by npm install
```

### Success Criteria for Stage 1

```
[ ] ioredis in package.json dependencies
[ ] redis/redis.ts exists and exports getRedis()
[ ] ai.controller.ts has NO Map, NO RateWindow interface, NO setInterval
[ ] checkRateLimit is async and uses Redis INCR
[ ] npx tsc --noEmit passes with zero errors
[ ] REDIS_URL added to main.ts REQUIRED array
```

---

## STAGE 2 — Fix DB Connection Pooling

### Context

`@neondatabase/serverless` Pool with `max: 20` per instance means 3 Render
instances attempt up to 60 persistent connections to Neon. Neon free tier
allows ~20 total. Neon's paid tiers (Launch $19/mo, Scale $69/mo) include
a built-in PgBouncer connection pooler accessible via a separate pooler URL.

The pooler URL looks like:
```
postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require
```
Note `-pooler` in the hostname — that's the only difference from the direct URL.

### What to Do in Neon

1. Upgrade Neon project to Launch tier ($19/mo) at console.neon.tech
2. In Connection Details, copy the **Pooled connection** string (not direct)
3. Add it as a new env var `DATABASE_POOL_URL` in Render
   (keep `DATABASE_URL` for migrations/admin, use `DATABASE_POOL_URL` for runtime)

### File to Modify: database/db.ts

Change Pool config:
- Use `DATABASE_POOL_URL` if present, fall back to `DATABASE_URL`
- Reduce `max` from 20 to 10 (PgBouncer manages the actual connections)
- Add `idleTimeoutMillis: 10000` and `connectionTimeoutMillis: 5000`

### Files to Touch in Stage 2

```
apps/backend/src/database/db.ts     ← MODIFY
apps/backend/src/main.ts            ← add DATABASE_POOL_URL to optional check (warn, not crash)
```

### Success Criteria for Stage 2

```
[ ] db.ts reads DATABASE_POOL_URL with fallback to DATABASE_URL
[ ] Pool max reduced to 10
[ ] Idle and connection timeouts set
[ ] npx tsc --noEmit passes with zero errors
[ ] DATABASE_POOL_URL set in Render env vars
```

---

## STAGE 3 — Enable Render Auto-Scaling

### Context

`render.yaml` is already configured for scaling:
```yaml
scaling:
  minInstances: 1
  maxInstances: 3
  targetMemoryPercent: 80
  targetCPUPercent: 70
```

This is only safe AFTER Stage 1 (Redis rate limiter) and Stage 2
(DB pooling) are complete. Do NOT enable scaling before both stages pass
their success criteria.

### What to Do

No code changes needed. In Render dashboard:
- Go to your service → Scaling
- Confirm auto-scaling is active with the settings from render.yaml
- Or manually set min=2, max=3 in the dashboard

### Capacity After Stage 3

```
Gemini (5 keys):              500-750 concurrent   ✅
Render (3 instances × 350):   ~900-1000 concurrent ✅
Redis rate limiter:            shared across fleet  ✅
Neon + PgBouncer:             3 × 10 = 30 client
                               connections →
                               pooler manages real  ✅
```

Target of 500 concurrent users: achieved with headroom.

---

## Universal Rules (Follow These Every Step)

1. Read BIBLE.md before generating any code
2. Complete files only — no patches, no partial output
3. Run `npx tsc --noEmit` after every file. Zero errors before moving on.
4. One file at a time — verify compiler before next file
5. Do not touch files outside the stage you are working on
6. Do not install packages not listed in this document

---

## Session Start Checklist

Before writing any code in the new session:

```
[ ] Run /graphify . from apps/backend
[ ] Confirm ai.controller.ts still has const RATE_LIMIT = 15 (not 3)
[ ] Confirm ai.service.ts has streamToGemini() method
[ ] Confirm subscription.service.ts has deviceCache Map
[ ] Confirm main.ts REQUIRED array includes GEMINI_API_KEY
[ ] Read this entire file top to bottom
[ ] Start with Stage 1 only — do not skip ahead
```
