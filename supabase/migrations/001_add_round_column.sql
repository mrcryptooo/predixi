-- =============================================================================
-- Migration 001 — Add `round` column to matches table
--
-- Stores the raw API-Football round string (e.g. "Round of 32", "Semi-finals").
-- Required for knockout bracket categorisation.
-- Non-breaking: nullable, existing rows get NULL.
-- Safe to re-run: ALTER TABLE ... ADD COLUMN IF NOT EXISTS
-- =============================================================================

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS round TEXT;

COMMENT ON COLUMN matches.round IS
  'Raw API-Football round string, e.g. "Group Stage - 1", "Round of 32", "Final". NULL for legacy rows.';

-- Index for fast WC knockout queries
CREATE INDEX IF NOT EXISTS idx_matches_league_round
  ON matches (league_id, round)
  WHERE round IS NOT NULL;
