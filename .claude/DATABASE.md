# ZoomGuru â€” Database

## Driver
```
@neondatabase/serverless â€” direct SQL, no ORM, no Prisma
```

No migration files. No schema.prisma. Tables auto-created on backend boot via `initDB()`.

---

## db.ts â€” Singleton Client

```typescript
import { neon, NeonQueryFunction } from '@neondatabase/serverless';

let _sql: NeonQueryFunction<false, false> | null = null;

export function getDB(): NeonQueryFunction<false, false> {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable not set');
    }
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}
```

---

## init.ts â€” Auto Schema Creation

```typescript
import { getDB } from './db';

export async function initDB(): Promise<void> {
  const sql = getDB();

  // Enable UUID extension
  await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`;

  // Users
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      is_pro BOOLEAN DEFAULT false,
      plan TEXT DEFAULT 'free',
      currency TEXT DEFAULT 'NGN',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Refresh tokens
  await sql`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      device_id TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Licenses
  await sql`
    CREATE TABLE IF NOT EXISTS licenses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_fingerprint TEXT NOT NULL,
      plan TEXT NOT NULL,
      currency TEXT NOT NULL,
      amount NUMERIC NOT NULL,
      paystack_reference TEXT UNIQUE,
      status TEXT DEFAULT 'active',
      activated_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ
    )
  `;

  // Usage tracking (free tier enforcement)
  await sql`
    CREATE TABLE IF NOT EXISTS user_usage (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      sessions_used INTEGER DEFAULT 0,
      responses_used INTEGER DEFAULT 0,
      last_session_at TIMESTAMPTZ,
      reset_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
    )
  `;

  // CV profiles (parsed, stored as JSONB)
  await sql`
    CREATE TABLE IF NOT EXISTS cv_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      raw_text TEXT,
      parsed_profile JSONB NOT NULL,
      filename TEXT,
      uploaded_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Interview sessions
  await sql`
    CREATE TABLE IF NOT EXISTS interview_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      cv_profile JSONB,
      job_description TEXT,
      interview_type TEXT DEFAULT 'general',
      answer_length TEXT DEFAULT 'standard',
      messages JSONB DEFAULT '[]'::jsonb,
      total_questions INTEGER DEFAULT 0,
      started_at TIMESTAMPTZ DEFAULT NOW(),
      ended_at TIMESTAMPTZ
    )
  `;

  // Payment records
  await sql`
    CREATE TABLE IF NOT EXISTS payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      paystack_reference TEXT UNIQUE NOT NULL,
      paystack_event TEXT,
      amount NUMERIC NOT NULL,
      currency TEXT NOT NULL,
      plan TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Indexes for performance
  await sql`CREATE INDEX IF NOT EXISTS idx_licenses_user ON licenses(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_licenses_fingerprint ON licenses(device_fingerprint)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_user ON interview_sessions(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(paystack_reference)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)`;

  console.log('ZoomGuru DB initialized');
}
```

---

## Common Query Patterns

### Get user with usage
```typescript
const [user] = await sql`
  SELECT 
    u.id, u.email, u.name, u.is_pro, u.plan, u.currency,
    uu.sessions_used, uu.responses_used, uu.reset_at
  FROM users u
  LEFT JOIN user_usage uu ON uu.user_id = u.id
  WHERE u.id = ${userId}
`;
```

### Check + bind device license
```typescript
// Check
const [license] = await sql`
  SELECT device_fingerprint, plan, expires_at, status
  FROM licenses
  WHERE user_id = ${userId}
  AND status = 'active'
  LIMIT 1
`;

// Bind (first login after payment)
await sql`
  UPDATE licenses
  SET device_fingerprint = ${deviceId}
  WHERE user_id = ${userId}
  AND device_fingerprint IS NULL
  AND status = 'active'
`;
```

### Start interview session
```typescript
const [session] = await sql`
  INSERT INTO interview_sessions (user_id, cv_profile, job_description, interview_type, answer_length)
  VALUES (
    ${userId},
    ${JSON.stringify(cvProfile)},
    ${jobDescription || null},
    ${interviewType},
    ${answerLength}
  )
  RETURNING id, started_at
`;

// Create usage row if not exists
await sql`
  INSERT INTO user_usage (user_id)
  VALUES (${userId})
  ON CONFLICT (user_id) DO UPDATE
  SET sessions_used = user_usage.sessions_used + 1,
      last_session_at = NOW()
`;
```

### Append message to session
```typescript
await sql`
  UPDATE interview_sessions
  SET 
    messages = messages || ${JSON.stringify([
      { role: 'user', content: question, timestamp: new Date().toISOString() },
      { role: 'assistant', content: answer, timestamp: new Date().toISOString() }
    ])}::jsonb,
    total_questions = total_questions + 1
  WHERE id = ${sessionId} AND user_id = ${userId}
`;
```

### End session
```typescript
await sql`
  UPDATE interview_sessions
  SET ended_at = NOW()
  WHERE id = ${sessionId} AND user_id = ${userId}
`;
```

### Activate license after payment
```typescript
await sql`
  UPDATE users
  SET is_pro = true, plan = ${plan}, updated_at = NOW()
  WHERE id = ${userId}
`;

await sql`
  INSERT INTO licenses (
    user_id, plan, currency, amount, paystack_reference,
    status, expires_at
  )
  VALUES (
    ${userId}, ${plan}, ${currency}, ${amount}, ${paystackRef},
    'active',
    ${plan === 'monthly'
      ? sql`NOW() + INTERVAL '30 days'`
      : null  /* lifetime â€” no expiry */
    }
  )
  ON CONFLICT (paystack_reference) DO NOTHING
`;
```

### Monthly usage reset (run as cron on Render)
```typescript
await sql`
  UPDATE user_usage
  SET responses_used = 0, sessions_used = 0, reset_at = NOW() + INTERVAL '30 days'
  WHERE reset_at < NOW()
`;
```

### Get session history
```typescript
const sessions = await sql`
  SELECT 
    id, interview_type, total_questions,
    started_at, ended_at,
    jsonb_array_length(messages) as message_count
  FROM interview_sessions
  WHERE user_id = ${userId}
  ORDER BY started_at DESC
  LIMIT 20
`;
```

---

## CVProfile Type

```typescript
export interface CVProfile {
  name: string;
  currentRole: string;
  yearsExperience: number;
  skills: string[];
  companies: Array<{
    name: string;
    role: string;
    duration: string;
    achievements: string[];
  }>;
  projects: Array<{
    name: string;
    description: string;
    stack: string[];
    impact: string;
  }>;
  education: Array<{
    institution: string;
    degree: string;
    year: string;
  }>;
  certifications: string[];
  summary?: string;
}
```

---

## Neon Environment

```env
DATABASE_URL=postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/zoomguru?sslmode=require
```

Get from: console.neon.tech â†’ your project â†’ Connection Details

