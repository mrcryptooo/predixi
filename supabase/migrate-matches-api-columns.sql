-- =============================================================================
-- migrate-matches-api-columns.sql
-- Optional migration — adds API-Football tracking columns to matches table.
-- Run in Supabase SQL Editor BEFORE using sync-fixtures for enriched data.
-- Safe to run multiple times (IF NOT EXISTS / IF NOT EXISTS pattern).
--
-- These columns are NOT required for the basic sync route to work.
-- The sync route uses existing columns as fallback.
-- =============================================================================

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS external_api_id  INTEGER,
  ADD COLUMN IF NOT EXISTS api_provider     TEXT DEFAULT 'api-football',
  ADD COLUMN IF NOT EXISTS api_league_id    INTEGER,
  ADD COLUMN IF NOT EXISTS api_season       INTEGER,
  ADD COLUMN IF NOT EXISTS status_short     TEXT,   -- NS | 1H | HT | 2H | FT | PST | CANC etc
  ADD COLUMN IF NOT EXISTS elapsed          INTEGER; -- live minute, null otherwise

-- Unique index on external_api_id (only non-null rows)
CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_external_api_id
  ON matches (external_api_id)
  WHERE external_api_id IS NOT NULL;

-- =============================================================================
-- END
-- =============================================================================
