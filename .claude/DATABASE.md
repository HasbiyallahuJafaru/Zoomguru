# ZoomGuru — Database

## Provider

**Supabase PostgreSQL 17** — direct SQL, no ORM, no Prisma.

```
Project ref : vjrmlvlufesmdyicpnbt   ("zoomguru")
Region      : eu-west-1
Pooler host : aws-0-eu-west-1.pooler.supabase.com
Console     : https://supabase.com/dashboard/project/vjrmlvlufesmdyicpnbt
```

> Earlier revisions of this file said **Neon**. That was wrong.
> The database is Supabase. `@neondatabase/serverless` is still listed in
> `apps/backend/package.json` but is **never imported** — it is a dead
> dependency. The real driver is `pg`.

> **Free-tier projects auto-pause after ~7 days idle.** A paused project
> makes Supavisor return `tenant/user postgres.<ref> not found`, which
> surfaces as blanket 500s while `/health` still returns 200.

---

## Driver

`pg` (node-postgres) connection pool — `apps/backend/src/database/db.ts`.

```typescript
import { Pool } from 'pg';

let _pool: Pool | null = null;

export function getDB(): Pool {
  if (!_pool) {
    const raw = process.env.DATABASE_POOL_URL ?? process.env.DATABASE_URL;
    if (!raw) throw new Error('DATABASE_URL not set');

    // sslmode is stripped from the URL on purpose — see note below.
    const connectionString = raw.replace(/[?&]sslmode=[^&]*/gi, '');
    _pool = new Pool({
      connectionString,
      max: process.env.DATABASE_POOL_URL ? 20 : 12,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: { rejectUnauthorized: false },
    });

    _pool.on('error', (err: Error) => {
      console.error('[DB pool] idle client error:', err.message);
    });
  }
  return _pool;
}
```

Two behaviours worth knowing before you touch this file:

**`sslmode` is stripped deliberately.** `pg` lets the connection string's
`sslmode` override the `ssl` option. `sslmode=require` forces certificate
verification, which fails against Supabase's pooler with *"self-signed
certificate in certificate chain"*. Stripping it lets the explicit
`ssl: { rejectUnauthorized: false }` win. Do not "fix" this by re-adding
`sslmode=require`.

**The idle `error` handler is load-bearing.** The pool drops connections
after inactivity; without the handler Node throws an uncaught error and the
process exits. `[DB pool] idle client error: terminating connection due to
administrator command` is normal during a Supabase restore or maintenance.

---

## Connection String Format

```
postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Get it from: Supabase dashboard → Project Settings → Database →
Connection string → **Connection pooling**.

The username must be `postgres.<project-ref>`, not bare `postgres` — the
pooler uses it to resolve the tenant. A malformed username produces
`tenant/user postgres.<ref> not found`, the same error a paused project gives.

`DATABASE_POOL_URL` is **required** whenever `NODE_ENV=production`; the app
exits on boot without it (`main.ts`). It also raises the pool size from 12
to 20.

---

## Schema

12 tables in `public`, all created by `initDB()` on boot
(`apps/backend/src/database/init.ts`) with `CREATE TABLE IF NOT EXISTS`.
`initDB()` is fire-and-forget and never throws — it retries in the
background every 30s, so the server answers `/health` even when the schema
is unverified.

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

users (
    id UUID PK DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    username TEXT UNIQUE,
    is_pro BOOLEAN,
    created_at TIMESTAMPTZ,
    referral_code TEXT,
    referred_by_user_id UUID,
    trial_started_at TIMESTAMPTZ,
    trial_key_id TEXT            -- device-bound trial, prevents re-claiming
)

subscriptions (
    id UUID PK, user_id UUID FK → users,
    status TEXT ('inactive'|'active'|'past_due'|'cancelled'),
    plan TEXT ('weekly'|'monthly'|'yearly'),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    paystack_customer_code TEXT,
    paystack_subscription_code TEXT,
    paystack_reference TEXT,     -- webhook idempotency key
    locked_device_id TEXT, locked_device_id_2 TEXT,   -- legacy
    locked_key_id TEXT, locked_key_id_2 TEXT,         -- current
    created_at, updated_at
)

device_keys (
    id UUID PK, user_id UUID FK → users,
    key_id TEXT, public_key TEXT, created_at
)

usage (
    user_id UUID, plan_type TEXT, period_start TIMESTAMPTZ,
    copilot_requests INT, interviewer_sessions INT,
    scorer_reports INT, doc_copilot_requests INT, updated_at
)

password_reset_tokens (
    id UUID PK, user_id UUID FK → users,
    token_hash TEXT, expires_at TIMESTAMPTZ (1 hour TTL), created_at
)

referral_commissions (
    id UUID PK, referrer_user_id UUID, referred_user_id UUID,
    amount_kobo INT, payment_reference TEXT,
    status TEXT, created_at, paid_at
)

referral_bank_accounts (
    id UUID PK, user_id UUID,
    account_number TEXT, bank_code TEXT, bank_name TEXT,
    account_name TEXT, recipient_code TEXT, created_at, updated_at
)

broadcasts (
    id UUID PK, subject TEXT, body TEXT, target_filter JSONB,
    status TEXT, scheduled_at, sent_at,
    recipient_count INT, open_count INT, created_at
)

broadcast_batches (
    id UUID PK, broadcast_id UUID FK → broadcasts,
    batch_index INT, status TEXT, recipients TEXT[],
    scheduled_at, sent_at, error TEXT, retry_count INT, created_at
)

ai_sessions (
    id UUID PK, user_id UUID FK → users (nullable),
    type TEXT ('stream'|'screenshot'|'transcribe'), created_at
)

downloads (
    id UUID PK, platform TEXT, version TEXT, ip TEXT, created_at
)

schema_version (version INT)
```

---

## Common Queries

The pool takes positional parameters (`$1`, `$2`), not tagged templates.

```typescript
const pool = getDB();

// Find user by email
const { rows } = await pool.query<{ id: string; email: string }>(
  `SELECT id, email, name, username, password_hash, is_pro
     FROM users
    WHERE email = $1
    LIMIT 1`,
  [email],
);
const user = rows[0];

// Create user
const { rows: created } = await pool.query(
  `INSERT INTO users (email, password_hash, name, username)
   VALUES ($1, $2, $3, $4)
   RETURNING id, email, name, username`,
  [email, hash, name, username],
);
```

---

## Verifying the Database Is Actually Up

`/health` does **not** touch the database — it returns 200 regardless.
To check the data layer, POST bogus credentials to `/auth/login`:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://zoomguru-backend-production.up.railway.app/auth/login \
  -H 'Content-Type: application/json' -H 'X-Device-ID: probe' \
  -d '{"email":"nobody@example.invalid","password":"x"}'
```

```
401 → database reachable (queried users, no match)
500 → database down (paused project, bad credentials, or pooler failure)
```

---

## Creating an Admin User

Run in the Supabase SQL Editor
(dashboard → SQL Editor), not the Neon console:

```sql
INSERT INTO users (email, password_hash, name, username, is_pro)
VALUES (
  'your@email.com',
  crypt('yourpassword', gen_salt('bf')),
  'Your Name',
  'yourusername',
  true
);
```

Prefer `/auth/register` where possible — it applies the same bcrypt cost
factor the login path expects.
