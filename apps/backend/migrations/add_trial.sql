-- Migration: per-user + per-device free trial
-- Run this against Neon before deploying the updated backend.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS trial_key_id      TEXT;

-- Fast lookup: "has this device already been used for a trial?"
CREATE INDEX IF NOT EXISTS users_trial_key_id_idx
  ON users(trial_key_id)
  WHERE trial_key_id IS NOT NULL;
