-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: National teams table (WC 2026 + future tournaments)
-- Safe additive migration — uses CREATE TABLE IF NOT EXISTS throughout.
-- Run in the Supabase SQL editor (project: ezqydkrhtpobcwtmfgii).
--
-- ── Purpose ──────────────────────────────────────────────────────────────────
--
--   Caches national team metadata from API-Football for World Cup and
--   other international tournaments. Provides the canonical mapping from
--   APF numeric team ID → team name, logo, group, short code.
--
--   Used by:
--     - WC-D player squad sync (references team by apf_team_id)
--     - Future Daily XI team display (team logo, short code)
--     - WC standings / fixtures UI (team logo CDN URL)
--
-- ── ID conventions ───────────────────────────────────────────────────────────
--
--   apf_team_id  integer  — APF numeric ID (e.g. 6 for Brazil)
--   team_id      text     — 'apf-team-{id}' format (matches matches.home/away_team_id)
--
-- ── Media URL storage policy ─────────────────────────────────────────────────
--
--   logo_url and flag_url are stored as APF CDN URLs (media.api-sports.io).
--   Served from Supabase — never fetched per page view from APF.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS national_teams (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- APF numeric team ID (unique per team in APF system)
  apf_team_id     integer     NOT NULL,

  -- PrediXI team_id format — matches matches.home_team_id / away_team_id
  team_id         text        NOT NULL,

  -- Team metadata
  name            text        NOT NULL,       -- e.g. 'Brazil'
  short_code      text        NULL,           -- 3-letter FIFA code, e.g. 'BRA'
  country         text        NULL,           -- country name from APF

  -- Tournament context
  group_code      text        NULL,           -- 'A' through 'L' for WC 2026; null if unknown
  world_cup_year  integer     NOT NULL DEFAULT 2026,
  source          text        NOT NULL DEFAULT 'apf',

  -- Media URLs — stored as CDN URLs, never hotlinked from frontend
  logo_url        text        NULL,           -- APF team.logo CDN URL
  flag_url        text        NULL,           -- APF country flag CDN URL (if available)

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- One row per APF team per tournament year
  CONSTRAINT uq_national_teams_apf_id_year UNIQUE (apf_team_id, world_cup_year),
  -- team_id is also globally unique (apf-team-{id} is unique per APF team)
  CONSTRAINT uq_national_teams_team_id UNIQUE (team_id)
);

COMMENT ON TABLE national_teams IS
  'National team metadata from API-Football. '
  'Provides APF ID → logo, group, short code mapping for WC and international tournaments.';

COMMENT ON COLUMN national_teams.team_id IS
  '''apf-team-{apf_team_id}'' — same format as matches.home_team_id / away_team_id.';

COMMENT ON COLUMN national_teams.group_code IS
  'World Cup group letter (A–L for WC 2026). May be null if APF /teams does not return '
  'group — inferred from worldcup.ts static data or standings.description at sync time.';

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Primary lookup: "get all WC 2026 teams"
CREATE INDEX IF NOT EXISTS idx_national_teams_world_cup_year
  ON national_teams (world_cup_year);

-- Group-based lookup: "get all teams in Group A"
CREATE INDEX IF NOT EXISTS idx_national_teams_group_code
  ON national_teams (group_code)
  WHERE group_code IS NOT NULL;

-- team_id lookup: join with matches table
CREATE INDEX IF NOT EXISTS idx_national_teams_team_id
  ON national_teams (team_id);
