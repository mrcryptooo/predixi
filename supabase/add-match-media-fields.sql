-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Match media fields + API source traceability
-- Safe additive migration — uses ADD COLUMN IF NOT EXISTS throughout.
-- Run in the Supabase SQL editor (project: ezqydkrhtpobcwtmfgii).
--
-- NOTE: home_team_crest and away_team_crest were already added by
-- supabase/add-team-crests.sql. This migration does NOT re-add them.
-- This migration adds the three remaining columns:
--   league_logo, country_flag, api_source
--
-- ── What this migration does ─────────────────────────────────────────────────
--
--   1. Adds league_logo and country_flag for UI enrichment:
--        API-Football returns league.logo and country.flag as CDN URLs.
--        Store them here — never fetch from APF per page view from frontend.
--        These may later be mirrored to PrediXI own storage/CDN.
--
--   2. Adds api_source for provider traceability:
--        Which API populated this row? 'fd' | 'apf' | 'mock'
--        Useful for debugging sync conflicts and auditing data quality.
--
-- ── Media URL storage policy ─────────────────────────────────────────────────
--
--   All APF media URLs (team logos, league logos, country flags,
--   player/coach photos) are stored as-is from the API response.
--   They are served from APF's CDN (media.api-sports.io) for now.
--   Future improvement: mirror to PrediXI storage/CDN for independence.
--   DO NOT hotlink these URLs by calling APF directly from the frontend.
--
-- ── Column summary ────────────────────────────────────────────────────────────
--
--   home_team_crest  text NULL  — team badge URL (added by add-team-crests.sql)
--   away_team_crest  text NULL  — team badge URL (added by add-team-crests.sql)
--   league_logo      text NULL  — APF league.logo CDN URL (added here)
--   country_flag     text NULL  — APF country.flag CDN URL (added here)
--   api_source       text NULL  — 'fd' | 'apf' | 'mock' (added here)
-- ─────────────────────────────────────────────────────────────────────────────


-- =============================================================================
-- 1. Add league and country media URL columns
-- =============================================================================

ALTER TABLE matches
  -- URL of the league logo from API-Football (league.logo).
  -- Example: https://media.api-sports.io/football/leagues/39.png
  -- Store here; never re-fetch per request from APF.
  ADD COLUMN IF NOT EXISTS league_logo   text NULL,

  -- URL of the country flag from API-Football (country.flag).
  -- Example: https://media.api-sports.io/flags/gb-eng.svg
  -- NULL for international competitions (Champions League, World Cup).
  ADD COLUMN IF NOT EXISTS country_flag  text NULL;


-- =============================================================================
-- 2. Add API source traceability column
-- =============================================================================

ALTER TABLE matches
  -- Which external API populated this fixture row.
  -- 'fd'   = football-data.org (IDs prefixed fd-)
  -- 'apf'  = API-Football / api-sports.io (IDs prefixed apf-)
  -- 'mock' = seeded from local mock data (IDs from src/data/matches.ts)
  -- NULL   = unknown / not yet set (all existing rows keep NULL)
  ADD COLUMN IF NOT EXISTS api_source    text NULL;

-- ── api_source check constraint (idempotent DO block) ─────────────────────────
-- Allows NULL (existing rows, unknown source) or one of the known provider codes.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'matches'
      AND constraint_name = 'chk_matches_api_source'
  ) THEN
    ALTER TABLE matches
      ADD CONSTRAINT chk_matches_api_source
      CHECK (api_source IS NULL OR api_source IN ('fd', 'apf', 'mock'));
  END IF;
END
$$;


-- =============================================================================
-- 3. Indexes
-- =============================================================================

-- Useful for admin queries like "show all matches from APF" or
-- "find matches without a known source for backfill auditing".
CREATE INDEX IF NOT EXISTS idx_matches_api_source
  ON matches (api_source)
  WHERE api_source IS NOT NULL;
