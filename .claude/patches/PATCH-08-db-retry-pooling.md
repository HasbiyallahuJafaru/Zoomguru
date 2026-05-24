# PATCH-08 â€” DB Connection Retry + Connection Pooling

## Problem
1. Neon goes cold occasionally â€” first query fails without retry
2. At 500 concurrent users, 20 connection limit exhausted fast
3. No pooling = each request opens/closes a connection

## Files Affected
- `apps/backend/src/database/db.ts`
- `apps/backend/src/database/init.ts`

## Risk Level
ðŸŸ¡ MEDIUM â€” Changes DB client. Test all endpoints after.

---

## Claude Code Prompt

```
Read .claude/DATABASE.md and .claude/BACKEND.md first.

I need to upgrade the database layer for connection pooling
and retry logic. Make these changes surgically:

STEP 1 â€” Replace apps/backend/src/database/db.ts entirely
with this new version:

import { neon, neonConfig, Pool } from '@neondatabase/serverless';

// Enable connection pooling
neonConfig.poolQueryViaFetch = true;

// Singleton pool for connection pooling
let _pool: Pool | null = null;

export function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return _pool;
}

// Keep getDB() for backward compatibility â€” 
// existing code using sql`` tagged templates still works
let _sql: ReturnType<typeof neon> | null = null;

export function getDB(): ReturnType<typeof neon> {
  if (!_sql) {
    _sql = neon(process.env.DATABASE_URL!);
  }
  return _sql;
}

STEP 2 â€” In apps/backend/src/database/init.ts,
find the initDB() export function.
Wrap the entire body of initDB() in a retry loop:

export async function initDB(): Promise<void> {
  const MAX_RETRIES = 3;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // ... existing CREATE TABLE statements stay here unchanged ...
      console.log('ZoomGuru DB initialized');
      return;
    } catch (err) {
      console.error(`DB init attempt ${attempt}/${MAX_RETRIES} failed:`, err);
      if (attempt === MAX_RETRIES) throw err;
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
}

Keep ALL existing CREATE TABLE statements exactly as they are.
Only wrap them in the retry loop.

Do not change any service files â€” getDB() signature is unchanged.
Show me both files after changes.
```

---

## Verification

```bash
npm run start:dev
# Should start normally

# Test all existing endpoints still work:
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123"}'
```

## Rollback
Restore original db.ts (remove Pool export, remove neonConfig line).
Remove retry wrapper from init.ts (keep inner content unchanged).

