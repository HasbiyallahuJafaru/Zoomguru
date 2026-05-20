import { getDB } from './db';

export async function initDB(): Promise<void> {
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
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
          device_fingerprint_trial TEXT,
          referral_code TEXT UNIQUE,
          username TEXT UNIQUE,
          google_id TEXT UNIQUE,
          avatar_url TEXT,
          role TEXT DEFAULT 'user',
          last_login_at TIMESTAMPTZ,
          login_count INTEGER DEFAULT 0,
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
          summary TEXT,
          total_questions INTEGER DEFAULT 0,
          duration_seconds INTEGER,
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

      // Referrals
      await sql`
        CREATE TABLE IF NOT EXISTS referrals (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          referrer_id UUID NOT NULL REFERENCES users(id),
          referred_id UUID UNIQUE NOT NULL REFERENCES users(id),
          payment_id UUID,
          commission_amount NUMERIC DEFAULT 0,
          currency TEXT NOT NULL DEFAULT 'NGN',
          status TEXT DEFAULT 'pending',
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS referral_balances (
          user_id UUID PRIMARY KEY REFERENCES users(id),
          total_earned NUMERIC DEFAULT 0,
          total_paid NUMERIC DEFAULT 0,
          pending_balance NUMERIC DEFAULT 0,
          currency TEXT DEFAULT 'NGN',
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS payout_requests (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id),
          amount NUMERIC NOT NULL,
          currency TEXT NOT NULL,
          bank_name TEXT,
          account_number TEXT,
          account_name TEXT,
          status TEXT DEFAULT 'pending',
          requested_at TIMESTAMPTZ DEFAULT NOW(),
          processed_at TIMESTAMPTZ
        )
      `;

      await sql`CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_referrals_code ON users(referral_code)`;

      // Error logs
      await sql`
        CREATE TABLE IF NOT EXISTS error_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          endpoint TEXT,
          method TEXT,
          error_message TEXT NOT NULL,
          stack_trace TEXT,
          user_id UUID,
          status_code INTEGER,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_error_logs_created
        ON error_logs(created_at DESC)
      `;

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

      await sql`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_nextauth_sessions_token ON nextauth_sessions(session_token)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_nextauth_accounts_user ON nextauth_accounts(user_id)`;

      console.log('ZoomGuru DB initialized');
      return;
    } catch (err) {
      console.error(`DB init attempt ${attempt}/${MAX_RETRIES} failed:`, err);
      if (attempt === MAX_RETRIES) throw err;
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
}
