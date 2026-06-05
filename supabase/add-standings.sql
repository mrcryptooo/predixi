-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: League standings table
-- Safe additive migration — uses CREATE TABLE IF NOT EXISTS throughout.
-- Run in the Supabase SQL editor (project: ezqydkrhtpobcwtmfgii).
--
-- ── Purpose ──────────────────────────────────────────────────────────────────
--
--   Caches league standings from API-Football so the UI can serve them from
--   Supabase instead of calling APF directly per page view.
--
--   Populated by POST /api/admin/sync-standings (run daily after fixture sync).
--   Read by GET /api/standings?leagueId=PL (future Phase D UI endpoint).
--
-- ── ID conventions ───────────────────────────────────────────────────────────
--
--   league_id  — internal competition code (e.g. 'PL', 'PD', 'BL1').
--                Matches matches.league_id format so standings can be JOINed
--                with matches on (league_id, season).
--
--   team_id    — 'apf-team-{id}' format (e.g. 'apf-team-50' for Arsenal).
--                Matches matches.home_team_id / away_team_id format so
--                standings can be JOINed with matches on team_id.
--
--   season     — integer year the season starts (e.g. 2025 = 2025/26).
--                Matches APF_CURRENT_SEASON convention.
--
-- ── Media URL storage policy ─────────────────────────────────────────────────
--
--   league_logo, country_flag, team_logo are stored as returned from APF.
--   These CDN URLs (media.api-sports.io) are served from Supabase — never
--   called from the frontend per page view. Future improvement: mirror to
--   PrediXI own storage/CDN.
--
-- ── Upsert key ───────────────────────────────────────────────────────────────
--
--   UNIQUE (league_id, season, team_id) — one row per team per season per
--   competition. Re-running sync-standings updates existing rows in place.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS standings (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Competition identifier (matches matches.league_id)
  league_id      text        NOT NULL,
  league_name    text        NOT NULL,
  league_logo    text        NULL,   -- APF league.logo CDN URL
  country        text        NULL,   -- e.g. 'England', 'Spain', 'International'
  country_flag   text        NULL,   -- APF country.flag CDN URL

  -- Season year (e.g. 2025 for the 2025/26 season)
  season         integer     NOT NULL,

  -- Team (ID matches matches.home_team_id / away_team_id format)
  team_id        text        NOT NULL,   -- 'apf-team-{apf_id}'
  team_name      text        NOT NULL,
  team_logo      text        NULL,       -- APF team.logo CDN URL

  -- Standing position and stats
  position       integer     NOT NULL,
  points         integer     NOT NULL DEFAULT 0,
  played         integer     NOT NULL DEFAULT 0,
  won            integer     NOT NULL DEFAULT 0,
  drawn          integer     NOT NULL DEFAULT 0,
  lost           integer     NOT NULL DEFAULT 0,
  goals_for      integer     NOT NULL DEFAULT 0,
  goals_against  integer     NOT NULL DEFAULT 0,
  goal_diff      integer     NOT NULL DEFAULT 0,

  -- Optional enrichment fields
  form           text        NULL,         -- e.g. 'WWDLW' (last 5 results)
  description    text        NULL,         -- e.g. 'Champions League', 'Relegation'

  -- Sync timestamp
  updated_at     timestamptz NOT NULL DEFAULT now(),

  -- One row per team per competition per season
  CONSTRAINT uq_standings_key UNIQUE (league_id, season, team_id)
);

COMMENT ON TABLE standings IS
  'Cached league standings from API-Football. '
  'Populated by POST /api/admin/sync-standings. '
  'league_id and team_id match the format used in the matches table.';

COMMENT ON COLUMN standings.league_id IS
  'Internal competition code — same as matches.league_id (e.g. ''PL'', ''PD'').';

COMMENT ON COLUMN standings.team_id IS
  'APF team ID in apf-team-{id} format — same as matches.home/away_team_id.';

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Primary lookup: get all standings for a competition + season
CREATE INDEX IF NOT EXISTS idx_standings_league_season
  ON standings (league_id, season);

-- Position-ordered lookup: render the sorted table for a given league + season
CREATE INDEX IF NOT EXISTS idx_standings_position
  ON standings (league_id, season, position);
