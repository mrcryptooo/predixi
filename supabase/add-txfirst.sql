-- Migration: transaction-first architecture
--
-- Adds client_nonce to predictions (required for hash recomputation).
-- Adds onchain_verified_at + legacy_submission to all three submission tables.
-- Backfills existing rows as legacy so they remain queryable.
--
-- Run once on Supabase before deploying the transaction-first API code.

-- ── predictions ──────────────────────────────────────────────────────────────
ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS client_nonce       TEXT,
  ADD COLUMN IF NOT EXISTS onchain_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS legacy_submission   BOOLEAN NOT NULL DEFAULT false;

-- Mark all pre-migration rows as legacy (no tx_hash means no on-chain proof)
UPDATE predictions
SET legacy_submission = true
WHERE tx_hash IS NULL AND legacy_submission = false;

-- ── daily_xi_entries ─────────────────────────────────────────────────────────
ALTER TABLE daily_xi_entries
  ADD COLUMN IF NOT EXISTS onchain_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS legacy_submission   BOOLEAN NOT NULL DEFAULT false;

UPDATE daily_xi_entries
SET legacy_submission = true
WHERE tx_hash IS NULL AND legacy_submission = false;

-- ── wc_predictions ───────────────────────────────────────────────────────────
ALTER TABLE wc_predictions
  ADD COLUMN IF NOT EXISTS onchain_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS legacy_submission   BOOLEAN NOT NULL DEFAULT false;

UPDATE wc_predictions
SET legacy_submission = true
WHERE tx_hash IS NULL AND legacy_submission = false;
