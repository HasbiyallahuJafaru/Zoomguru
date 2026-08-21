# ZoomGuru — Backend

## Purpose
NestJS + Fastify server handling auth, subscriptions, payments,
referrals, admin, email broadcasts, and AI proxying/streaming.

```
Production : https://zoomguru-backend-production.up.railway.app  (Railway)
Local dev  : http://localhost:3000
```

---

## File Structure

```
apps/backend/
├── src/
│   ├── main.ts                    ← bootstrap, env validation, CORS
│   ├── app.module.ts              ← root module
│   ├── health.controller.ts       ← GET /health (liveness only)
│   ├── database/
│   │   ├── db.ts                  ← pg Pool singleton (Supabase)
│   │   └── init.ts                ← CREATE TABLE IF NOT EXISTS (12 tables)
│   ├── redis/redis.ts             ← ioredis singleton
│   ├── auth/                      ← register, login, password reset
│   ├── device/                    ← POST /device/register (keypairs)
│   ├── ai/                        ← stream, screenshot, transcribe, tts,
│   │                                 interviewer, scoring, copilots
│   ├── subscription/              ← status, usage, trial, verify, webhook
│   ├── payments/                  ← hosted checkout (create/session/confirm)
│   ├── referral/                  ← dashboard, banks, payouts
│   ├── admin/                     ← stats, users, broadcasts
│   ├── analytics/                 ← GET /analytics/download
│   └── cron/cron.service.ts       ← 5 scheduled jobs (see CLAUDE.md warning)
├── migrations/
├── .env                           ← secrets (never commit)
├── tsconfig.json
├── nest-cli.json
└── package.json
```

---

## Endpoints

44 routes across auth, device, ai, subscription, payments, referral,
admin, broadcast webhook, analytics, and health.

**The full endpoint list lives in `.claude/CLAUDE.md`** — single source of
truth, do not duplicate it here. Regenerate it from the controllers rather
than trusting any hand-written list:

```bash
grep -rn "@Controller\|@Get(\|@Post(" apps/backend/src --include=*.ts
```

Auth model:
- `JwtAuthGuard` (Bearer token) on user endpoints
- `X-Admin-Key` header on `/admin/*`
- HMAC signature on `/subscription/webhook` and `/broadcast/webhook`
- Device signature headers (`X-Key-ID`, `X-Timestamp`, `X-Signature`) on
  AI endpoints — see Device Locking in CLAUDE.md

---

## Database (Supabase — direct SQL)

Driver: `pg` (node-postgres) connection pool.
No ORM. No Prisma. Raw SQL with positional parameters only.

`@neondatabase/serverless` appears in package.json but is never imported —
dead dependency. The database is **Supabase**, not Neon.

```typescript
// database/db.ts
import { Pool } from 'pg';
let _pool: Pool | null = null;
export function getDB(): Pool {
  if (!_pool) {
    const raw = process.env.DATABASE_POOL_URL ?? process.env.DATABASE_URL;
    if (!raw) throw new Error('DATABASE_URL not set');
    // sslmode stripped on purpose — it overrides the ssl option below and
    // breaks against Supabase's pooler. See .claude/DATABASE.md.
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

The live schema is **12 tables**, all created by `initDB()` on boot:
`users, subscriptions, device_keys, usage, password_reset_tokens,
referral_commissions, referral_bank_accounts, broadcasts,
broadcast_batches, ai_sessions, downloads, schema_version`.

Full column-level schema lives in **`.claude/DATABASE.md`** — that is the
single source of truth. Do not duplicate it here.

---

## Auth (JWT — simple, long expiry for local)

```typescript
// JWT config for local development
{
  secret: process.env.JWT_SECRET,
  expiresIn: '30d',  // long expiry, no refresh token needed locally
}

// Token payload
{
  sub: userId,
  email: userEmail,
}
```

No refresh tokens.

**Device binding IS enforced** — but at AI endpoint time, not at login.
A valid JWT alone is not enough to reach `/ai/*`: the request must also
carry `X-Key-ID` / `X-Timestamp` / `X-Signature`, verified against the
public key registered in `device_keys`. See Device Locking in CLAUDE.md.

---

## AI Service — Model Routing

```
Text answers:
    Gemini 2.0 Flash  → PRIMARY for all text answers
                        Key rotation: GEMINI_API_KEY .. GEMINI_API_KEY_5
    DeepSeek (deepseek-chat)
                      → FALLBACK when Gemini is unavailable
                        Key rotation: DEEPSEEK_API_KEY .. DEEPSEEK_API_KEY_5

Transcription:
    Groq Whisper      → /ai/transcribe

Vision / screenshot:
    Groq Llama-4-Scout → /ai/screenshot

Text-to-speech:
    LemonFox          → /ai/tts (AI Interviewer)
                        Optional — interviewer runs silently without it
```

Qwen is **not** used anywhere. Any `QWEN_API_KEY` reference is stale.

---

## System Prompt (Generic — no CV for MVP)

```
You are ZoomGuru, an AI interview assistant.
Answer the following interview question clearly and confidently,
as if the user is speaking directly to the interviewer.
Be concise, specific, and professional.
For coding questions: show your approach first, then the code.
For behavioral questions: use the STAR format naturally.
For system design: structure your answer with components.
Keep answers focused — 3 to 6 sentences for most questions.
```

---

## SSE Streaming Format

Every streaming endpoint writes this exact format:

```
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
Access-Control-Allow-Origin: *

data: {"chunk":"First ","done":false}\n\n
data: {"chunk":"word ","done":false}\n\n
data: {"chunk":"arrives.","done":false}\n\n
data: {"done":true,"fullAnswer":"First word arrives."}\n\n
```

The renderer splits on `\n`, looks for lines starting with
`data: `, parses the JSON, appends chunk to answer state.

---

## CORS Configuration

Origin-callback based, driven by env vars (`main.ts`):

```typescript
app.enableCors({
  origin: (origin, callback) => {
    const allowed = [
      'http://localhost:5173',
      'http://localhost:5174',
      'app://.',
      process.env.APP_URL,
      process.env.ADMIN_CORS_ORIGIN,
      process.env.CHECKOUT_URL ?? 'https://zoomguru.xyz',
      'https://zoomguru.xyz',
      'https://www.zoomguru.xyz',
    ].filter(Boolean);
    // Requests with no Origin (Electron main process) are allowed.
    callback(null, !origin || allowed.includes(origin) || origin === 'app://zoomguru');
  },
  credentials: true,
});
```

Note the Railway `*.up.railway.app` domain is **not** in this list. Anything
browser-based calling the API from that origin needs `APP_URL` or
`ADMIN_CORS_ORIGIN` set accordingly.

---

## Environment Variables

The full annotated list lives in `.claude/CLAUDE.md` and
`apps/backend/.env.example`. Startup validation (`main.ts`):

```typescript
const REQUIRED = [
  'DATABASE_URL', 'JWT_SECRET', 'REDIS_URL', 'GEMINI_API_KEY',
  'DEEPSEEK_API_KEY', 'GROQ_API_KEY', 'PAYSTACK_SECRET_KEY',
  'RESEND_API_KEY', 'FROM_EMAIL', 'ADMIN_KEY',
];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error('❌ Missing env vars:', missing.join(', '));
  process.exit(1);
}

// DATABASE_POOL_URL is additionally required in production
if (!process.env['DATABASE_POOL_URL'] && process.env['NODE_ENV'] === 'production') {
  console.error('❌ DATABASE_POOL_URL is required in production');
  process.exit(1);
}
```

`QWEN_API_KEY` is stale — it does not exist.

---

## main.ts

```typescript
const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter({
    logger: false,
    trustProxy: true,        // req.ip behind Railway's proxy (rate limiting)
    bodyLimit: 15_728_640,   // 15 MB — screenshots are base64
  }),
  { rawBody: true },         // REQUIRED: Paystack HMAC is over the raw body
);

app.enableCors({ /* see CORS Configuration above */ });

// Fire-and-forget on purpose: the server must listen and answer /health
// even if the database is briefly unreachable. initDB() never throws —
// it retries schema setup in the background every 30s.
void initDB();

await app.listen(process.env['PORT'] ?? 3000, '0.0.0.0');
```

Three things here are load-bearing — do not "simplify" them away:

1. **`{ rawBody: true }`** — without it `req.rawBody` is undefined and every
   Paystack webhook fails signature verification. Payments stop confirming.
2. **`trustProxy: true`** — without it `req.ip` is the proxy's address, so
   IP-based rate limiting collapses to a single bucket.
3. **`void initDB()`** — deliberately *not* awaited. Awaiting it means a
   database blip prevents the process from ever listening.

---

## Compiler Verification

After every generated file:
```bash
cd apps/backend
npx tsc --noEmit
```

Zero errors = ready.
