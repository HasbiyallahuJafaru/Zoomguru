import { getDB } from './db';

export async function initDB(): Promise<void> {
  const MAX_ATTEMPTS = 3;
  const BACKOFF_MS = 2000;

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const pool = getDB();

      await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email         TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name          TEXT,
          username      TEXT UNIQUE,
          is_pro        BOOLEAN DEFAULT true,
          created_at    TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS subscriptions (
          id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id                     UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          status                      TEXT NOT NULL DEFAULT 'inactive'
                                        CHECK (status IN ('inactive', 'active', 'past_due', 'cancelled')),
          plan                        TEXT,
          current_period_start        TIMESTAMPTZ,
          current_period_end          TIMESTAMPTZ,
          paystack_customer_code      TEXT UNIQUE,
          paystack_subscription_code  TEXT UNIQUE,
          locked_device_id            TEXT,
          created_at                  TIMESTAMPTZ DEFAULT NOW(),
          updated_at                  TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      await pool.query(`
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS locked_device_id_2 TEXT
      `);

      await pool.query(`
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paystack_reference TEXT
      `);

      // Drop the UNIQUE constraint on paystack_customer_code if it still exists
      // from a previous schema version. The column only needs a plain index for
      // webhook lookups; enforcing uniqueness here causes the upsert in verify()
      // to crash with a unique_violation when two ZoomGuru accounts share one
      // Paystack customer (e.g. same email used for both).
      await pool.query(`
        ALTER TABLE subscriptions
          DROP CONSTRAINT IF EXISTS subscriptions_paystack_customer_code_key
      `);

      await Promise.all([
        pool.query(`
          CREATE INDEX IF NOT EXISTS idx_subscriptions_status
            ON subscriptions(status)
        `),
        pool.query(`
          CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end
            ON subscriptions(current_period_end)
            WHERE current_period_end IS NOT NULL
        `),
        pool.query(`
          CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_code
            ON subscriptions(paystack_customer_code)
            WHERE paystack_customer_code IS NOT NULL
        `),
      ]);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash  TEXT NOT NULL,
          expires_at  TIMESTAMPTZ NOT NULL,
          created_at  TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      await Promise.all([
        pool.query(`
          CREATE INDEX IF NOT EXISTS idx_prt_user_id
            ON password_reset_tokens(user_id)
        `),
        pool.query(`
          CREATE INDEX IF NOT EXISTS idx_prt_expires
            ON password_reset_tokens(expires_at)
        `),
      ]);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS downloads (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          platform    TEXT NOT NULL,
          version     TEXT,
          ip          TEXT,
          created_at  TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS ai_sessions (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
          type        TEXT NOT NULL CHECK (type IN ('stream', 'screenshot', 'transcribe')),
          created_at  TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      await Promise.all([
        pool.query(`
          CREATE INDEX IF NOT EXISTS idx_downloads_created_at
            ON downloads(created_at)
        `),
        pool.query(`
          CREATE INDEX IF NOT EXISTS idx_ai_sessions_user_id
            ON ai_sessions(user_id)
            WHERE user_id IS NOT NULL
        `),
        pool.query(`
          CREATE INDEX IF NOT EXISTS idx_ai_sessions_created_at
            ON ai_sessions(created_at)
        `),
      ]);

      // ── Referral system (additive — all nullable, safe for existing data) ──

      await pool.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE
      `);

      await pool.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES users(id)
      `);

      await pool.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ
      `);

      await pool.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_key_id TEXT
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS referral_commissions (
          id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          referrer_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          referred_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          amount_kobo       INTEGER NOT NULL,
          payment_reference TEXT NOT NULL,
          status            TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'requested', 'paid')),
          created_at        TIMESTAMPTZ DEFAULT NOW(),
          paid_at           TIMESTAMPTZ
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS referral_bank_accounts (
          id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id        UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          account_number TEXT NOT NULL,
          bank_code      TEXT NOT NULL,
          bank_name      TEXT NOT NULL,
          account_name   TEXT NOT NULL,
          recipient_code TEXT,
          created_at     TIMESTAMPTZ DEFAULT NOW(),
          updated_at     TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      await Promise.all([
        pool.query(`
          CREATE INDEX IF NOT EXISTS idx_referral_commissions_referrer
            ON referral_commissions(referrer_user_id)
        `),
        pool.query(`
          CREATE INDEX IF NOT EXISTS idx_referral_commissions_referred
            ON referral_commissions(referred_user_id)
        `),
        pool.query(`
          CREATE INDEX IF NOT EXISTS idx_users_referral_code
            ON users(referral_code)
            WHERE referral_code IS NOT NULL
        `),
      ]);

      // Backfill referral codes for existing users who have none
      await pool.query(`
        UPDATE users
        SET referral_code = upper(substring(encode(gen_random_bytes(6), 'hex') FROM 1 FOR 8))
        WHERE referral_code IS NULL
      `);

      // ── Usage & quota tracking ──

      await pool.query(`
        CREATE TABLE IF NOT EXISTS usage (
          id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id              UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          plan_type            TEXT NOT NULL DEFAULT 'monthly',
          copilot_requests     INTEGER NOT NULL DEFAULT 0,
          interviewer_sessions INTEGER NOT NULL DEFAULT 0,
          scorer_reports       INTEGER NOT NULL DEFAULT 0,
          doc_copilot_requests INTEGER NOT NULL DEFAULT 0,
          period_start         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_usage_user_id ON usage(user_id)
      `);

      console.log('✅ ZoomGuru DB ready');
      return;
    } catch (err) {
      lastError = err;
      console.error(`[DB init] attempt ${attempt}/${MAX_ATTEMPTS} failed:`, (err as Error).message);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS));
      }
    }
  }

  throw lastError;
}
