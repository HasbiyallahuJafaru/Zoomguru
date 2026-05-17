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
