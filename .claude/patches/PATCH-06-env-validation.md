# PATCH-06 â€” Environment Variable Validation on Startup

## Problem
Backend starts with missing env vars and crashes on first
DB or API call with a confusing error. Hard to debug on Render.

## Files Affected
- `apps/backend/src/main.ts`

## Risk Level
ðŸŸ¢ LOW â€” Additive only. Added before app.listen().

---

## Claude Code Prompt

```
Read .claude/BACKEND.md first.

In apps/backend/src/main.ts, find the bootstrap() function.

Add this validation block as the VERY FIRST thing inside
bootstrap(), before any NestFactory.create() call:

  // Validate required environment variables on startup
  const REQUIRED_ENV = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'DEEPSEEK_API_KEY',
    'QWEN_API_KEY',
    'PAYSTACK_SECRET_KEY',
    'PAYSTACK_WEBHOOK_SECRET',
  ];

  const missing = REQUIRED_ENV.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error('âŒ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    process.exit(1);
  }

  console.log('âœ… All environment variables present');

Place this BEFORE the NestFactory.create() line.
Do not touch anything else in bootstrap().
Show me the exact diff.
```

---

## Verification

```bash
# Temporarily unset DATABASE_URL
# unset DATABASE_URL && npm run start:dev
# Should see: âŒ Missing required environment variables: DATABASE_URL
# Process should exit immediately with code 1
# Restore DATABASE_URL â€” server should start normally
```

## Rollback
Remove the REQUIRED_ENV validation block.

