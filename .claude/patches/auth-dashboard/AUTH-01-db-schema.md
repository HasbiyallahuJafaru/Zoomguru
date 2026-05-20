# AUTH-01 — Database Schema Additions

## What This Does
Adds username, Google OAuth fields, admin role, and NextAuth
session tables to the existing Neon database.

## Files Affected
- `apps/backend/src/database/init.ts`

## Risk Level
🟡 MEDIUM — Modifies existing users table CREATE statement.
Test all existing auth endpoints after.

---

## Prompt

```
Read .claude/CLAUDE.md, .claude/DATABASE.md and
.claude/patches/auth-dashboard/AUTH-DASHBOARD.md first.

Tell me which files you will touch before writing any code.

In apps/backend/src/database/init.ts, make these changes
surgically. Do not touch any other table definitions.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 1 — Extend users CREATE TABLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find the CREATE TABLE IF NOT EXISTS users statement.
Add these columns AFTER the existing currency TEXT column
and BEFORE created_at:

  username TEXT UNIQUE,
  google_id TEXT UNIQUE,
  avatar_url TEXT,
  role TEXT DEFAULT 'user',
  last_login_at TIMESTAMPTZ,
  login_count INTEGER DEFAULT 0,

Note: username is nullable for now because existing users
won't have one. We enforce it at registration level in code.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 2 — Add NextAuth tables
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add these three CREATE TABLE statements at the end of
initDB(), BEFORE the console.log line:

  await sql`
    CREATE TABLE IF NOT EXISTS nextauth_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_token TEXT UNIQUE NOT NULL,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires TIMESTAMPTZ NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS nextauth_accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      refresh_token TEXT,
      access_token TEXT,
      expires_at INTEGER,
      token_type TEXT,
      scope TEXT,
      id_token TEXT,
      session_state TEXT,
      UNIQUE(provider, provider_account_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS nextauth_verification_tokens (
      identifier TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires TIMESTAMPTZ NOT NULL,
      PRIMARY KEY(identifier, token)
    )
  `;

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 3 — Add indexes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add these after the new CREATE TABLEs:

  await sql`CREATE INDEX IF NOT EXISTS idx_users_username
    ON users(username)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_google_id
    ON users(google_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_role
    ON users(role)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_nextauth_sessions_token
    ON nextauth_sessions(session_token)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_nextauth_accounts_user
    ON nextauth_accounts(user_id)`;

Do not change any existing CREATE TABLE statements.
Do not change any existing indexes.
Show me the exact diff of what you added.
```

---

## Verification

```bash
npm run start:dev

# Check Neon console — users table should have new columns
# Check: nextauth_sessions, nextauth_accounts,
#        nextauth_verification_tokens tables exist

# Test existing login still works:
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123","deviceId":"abc"}'
# Should still return tokens normally
```

## Rollback
Remove the 6 new column definitions from users CREATE TABLE.
Remove the 3 new CREATE TABLE statements.
Remove the 5 new indexes.
