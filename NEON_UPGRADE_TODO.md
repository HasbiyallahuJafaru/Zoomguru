# ZoomGuru — Neon Upgrade & Final Scaling Steps
# Complete this when you have the budget.

---

## What's Already Done

- Redis (Key Value) created on Render — free plan ✅
- `REDIS_URL` added to backend env vars on Render ✅
- Rate limiter is now shared across all instances (Redis INCR) ✅
- `db.ts` already reads `DATABASE_POOL_URL` with fallback to `DATABASE_URL` ✅
- Code is ready — no code changes needed when you upgrade

---

## What's Left

### Step 1 — Upgrade Neon to Launch ($19/mo)

1. Go to console.neon.tech → your project
2. Billing → Upgrade to **Launch** plan
3. This unlocks PgBouncer connection pooling

### Step 2 — Get the pooler connection string

1. Neon console → your project → **Connection Details**
2. Toggle to **Pooled connection** (not Direct)
3. Copy the string — it looks like:
   ```
   postgresql://user:pass@ep-xxx-pooler.us-east-2.aws.neon.tech/dbname?sslmode=require
   ```
   Note the `-pooler` in the hostname — that's the only difference from your current DATABASE_URL

### Step 3 — Add to Render

1. Backend service → **Environment**
2. Add: `DATABASE_POOL_URL` = the pooled connection string
3. Save → Render redeploys
4. Startup warning "DATABASE_POOL_URL not set" will disappear

### Step 4 — Enable Render Auto-Scaling

No code changes needed — `render.yaml` is already configured:
```yaml
scaling:
  minInstances: 1
  maxInstances: 3
  targetMemoryPercent: 80
  targetCPUPercent: 70
```

In Render dashboard:
1. Backend service → **Scaling**
2. Confirm auto-scaling is active, or manually set min=2, max=3

---

## Final Capacity After All Steps

| Layer              | Current (1 instance) | After upgrade (3 instances) |
|--------------------|----------------------|-----------------------------|
| Gemini (5 keys)    | 500–750 concurrent   | 500–750 concurrent          |
| Render instances   | ~350 concurrent SSE  | ~900–1000 concurrent SSE    |
| Rate limiter       | Redis (shared) ✅    | Redis (shared) ✅           |
| Neon connections   | 10 direct            | 3 × 10 → pooler manages     |
| **Target**         | —                    | **500 concurrent ✅**       |

---

## Why This Is Safe To Delay

The app works fine on 1 Render instance without the pooler.
`DATABASE_URL` (direct connection, max 10) is the fallback and handles
normal load. You only need the pooler when you scale to 2–3 instances.
Do not enable Render auto-scaling until `DATABASE_POOL_URL` is set —
otherwise 3 instances × 10 connections may hit Neon's free tier limit.
