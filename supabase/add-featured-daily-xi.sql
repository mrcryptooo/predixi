-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Add featured_daily_xi flag to players table
-- Run in the Supabase SQL editor (project: ezqydkrhtpobcwtmfgii).
--
-- Purpose:
--   Marks curated "star" players for use in the Daily XI feature.
--   Only players with featured_daily_xi = TRUE are included in the
--   Daily XI player pool (POST /api/players?featured=true).
--
--   Full 26-man squads are kept intact — no rows deleted.
--   The flag gates which players surface in the Daily XI UI.
--
-- After running this migration:
--   node scripts/curate-featured-players.cjs
--   (populates featured_daily_xi = true for ~12 stars per team)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS featured_daily_xi BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN players.featured_daily_xi IS
  'TRUE = curated star player included in Daily XI pool. '
  'Populated by scripts/curate-featured-players.cjs. '
  'All 26-man squads remain intact — this flag gates Daily XI visibility only.';

CREATE INDEX IF NOT EXISTS idx_players_featured_daily_xi
  ON players (featured_daily_xi)
  WHERE featured_daily_xi = TRUE;
