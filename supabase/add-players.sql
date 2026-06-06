-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Players table (WC 2026 squads + future use)
-- Safe additive migration — uses CREATE TABLE IF NOT EXISTS throughout.
-- Run in the Supabase SQL editor (project: ezqydkrhtpobcwtmfgii).
--
-- ── Purpose ──────────────────────────────────────────────────────────────────
--
--   Caches player squad data from API-Football /players/squads endpoint.
--   Primary use: World Cup 2026 player photos for Daily XI and WC pages.
--
--   Populated by POST /api/admin/sync-player-squads.
--   Future: Daily XI player pool reads from this table instead of hardcoded arrays.
--
-- ── ID conventions ───────────────────────────────────────────────────────────
--
--   apf_player_id  integer  — APF numeric player ID
--   player_id      text     — 'apf-player-{id}' format (unique per player)
--   apf_team_id    integer  — APF numeric team ID (references national_teams.apf_team_id)
--   team_id        text     — 'apf-team-{id}' (matches matches.home/away_team_id)
--
-- ── Media URL storage policy ─────────────────────────────────────────────────
--
--   photo_url and team_logo_url are stored as APF CDN URLs (media.api-sports.io).
--   Served from Supabase — never fetched per page view from APF.
--   Future: mirror to PrediXI own storage/CDN for independence.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS players (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- APF player identity
  apf_player_id   integer     NOT NULL,
  player_id       text        NOT NULL,     -- 'apf-player-{apf_player_id}'

  -- Player metadata
  name            text        NOT NULL,
  age             integer     NULL,
  number          integer     NULL,         -- squad shirt number
  position        text        NULL,         -- 'Goalkeeper' | 'Defender' | 'Midfielder' | 'Attacker'
  nationality     text        NULL,         -- country name from APF

  -- Photo — APF CDN URL, stored not hotlinked
  photo_url       text        NULL,         -- APF player.photo CDN URL

  -- Team reference
  apf_team_id     integer     NOT NULL,
  team_id         text        NOT NULL,     -- 'apf-team-{apf_team_id}'
  team_name       text        NOT NULL,
  team_logo_url   text        NULL,         -- from national_teams.logo_url

  -- Tournament context
  world_cup_year  integer     NOT NULL DEFAULT 2026,
  source          text        NOT NULL DEFAULT 'apf',

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- One row per player per tournament year
  CONSTRAINT uq_players_apf_id_year UNIQUE (apf_player_id, world_cup_year),
  -- player_id globally unique
  CONSTRAINT uq_players_player_id   UNIQUE (player_id)
);

COMMENT ON TABLE players IS
  'Player squad data from API-Football. '
  'Provides WC 2026 player photos and squad composition for Daily XI.';

COMMENT ON COLUMN players.player_id IS
  '''apf-player-{apf_player_id}'' — stable APF-based ID.';

COMMENT ON COLUMN players.photo_url IS
  'APF player.photo CDN URL (media.api-sports.io). '
  'Store here, serve via Supabase — never hotlink from frontend per request.';

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_players_world_cup_year
  ON players (world_cup_year);

CREATE INDEX IF NOT EXISTS idx_players_team_id
  ON players (team_id);

CREATE INDEX IF NOT EXISTS idx_players_apf_team_id
  ON players (apf_team_id);

CREATE INDEX IF NOT EXISTS idx_players_position
  ON players (position)
  WHERE position IS NOT NULL;
