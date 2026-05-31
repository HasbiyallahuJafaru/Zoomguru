-- Migration: server-side device attestation
-- Run this against Neon before deploying the updated backend.

CREATE TABLE IF NOT EXISTS device_keys (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_id     UUID NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS device_keys_user_idx  ON device_keys(user_id);
CREATE INDEX IF NOT EXISTS device_keys_key_id_idx ON device_keys(key_id);

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS locked_key_id   TEXT,
  ADD COLUMN IF NOT EXISTS locked_key_id_2 TEXT;
