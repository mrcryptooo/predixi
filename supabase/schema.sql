-- =============================================================================
-- PrediXI — Supabase Database Schema
-- Phase 4A: Foundation preparation. No data migration yet.
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- =============================================================================

-- Enable UUID generation (required for gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- TABLE: profiles
-- One row per connected wallet. Created on first wallet connection.
-- wallet_address is the primary identity (lowercase Ethereum address).
-- =============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address      TEXT        UNIQUE NOT NULL,          -- 0x... lowercase
  username            TEXT,
  display_name        TEXT,
  avatar              TEXT,                                 -- emoji or image URL
  xp                  INTEGER     NOT NULL DEFAULT 0,
  rank                TEXT        NOT NULL DEFAULT 'bronze'
                        CHECK (rank IN ('bronze','silver','gold','platinum','diamond','legend')),
  streak              INTEGER     NOT NULL DEFAULT 0,
  total_predictions   INTEGER     NOT NULL DEFAULT 0,
  correct_predictions INTEGER     NOT NULL DEFAULT 0,
  country             TEXT,
  country_flag        TEXT,                                 -- emoji
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  profiles IS 'One row per wallet. Identity is wallet_address.';
COMMENT ON COLUMN profiles.wallet_address IS 'Ethereum address, always lowercase.';
COMMENT ON COLUMN profiles.rank           IS 'Gamification rank derived from XP.';

-- =============================================================================
-- TABLE: matches
-- Mirrors the app Match type. Text PK so mock IDs can coexist during migration.
-- actual_outcome is set by admin/backend when match is settled.
-- =============================================================================

CREATE TABLE IF NOT EXISTS matches (
  id                  TEXT        PRIMARY KEY,              -- e.g. "match-001"
  league_id           TEXT        NOT NULL,
  home_team_id        TEXT        NOT NULL,
  home_team_name      TEXT        NOT NULL,
  home_team_short     TEXT        NOT NULL,                 -- 3-letter code
  away_team_id        TEXT        NOT NULL,
  away_team_name      TEXT        NOT NULL,
  away_team_short     TEXT        NOT NULL,
  kickoff             TIMESTAMPTZ NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'upcoming'
                        CHECK (status IN ('upcoming','live','finished','postponed')),
  home_score          INTEGER,
  away_score          INTEGER,
  matchday            INTEGER,
  venue               TEXT,
  actual_outcome      TEXT        CHECK (actual_outcome IN ('H','D','A')),  -- null until settled
  community_home      NUMERIC(5,2) NOT NULL DEFAULT 33.33, -- percentage
  community_draw      NUMERIC(5,2) NOT NULL DEFAULT 33.33,
  community_away      NUMERIC(5,2) NOT NULL DEFAULT 33.34,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  matches IS 'Football fixtures. actual_outcome set on settlement.';
COMMENT ON COLUMN matches.actual_outcome IS 'H=home win, D=draw, A=away win. NULL until finished.';
COMMENT ON COLUMN matches.community_home IS 'Live community prediction % for home win.';

-- =============================================================================
-- TABLE: predictions
-- One row per (profile, match) pair. Outcome stored as H/D/A.
-- points_awarded and is_correct are set after match settles.
-- =============================================================================

CREATE TABLE IF NOT EXISTS predictions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  match_id        TEXT        NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  outcome         TEXT        NOT NULL CHECK (outcome IN ('H','D','A')),
  points_awarded  INTEGER,                                  -- null until settled
  is_correct      BOOLEAN,                                  -- null until settled
  placed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One prediction per user per match (update by replacing, not inserting)
  UNIQUE (profile_id, match_id)
);

COMMENT ON TABLE  predictions IS 'User match predictions. One per (profile, match).';
COMMENT ON COLUMN predictions.outcome        IS 'H=home, D=draw, A=away.';
COMMENT ON COLUMN predictions.points_awarded IS 'XP awarded. NULL until match settles.';
COMMENT ON COLUMN predictions.is_correct     IS 'Whether prediction matched actual_outcome.';

-- =============================================================================
-- TABLE: leaderboard_stats
-- Computed leaderboard snapshot per profile per period.
-- Regenerated by backend on match settlement — not user-writable.
-- =============================================================================

CREATE TABLE IF NOT EXISTS leaderboard_stats (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id          UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period              TEXT        NOT NULL DEFAULT 'all_time'
                        CHECK (period IN ('all_time','weekly','monthly')),
  xp                  INTEGER     NOT NULL DEFAULT 0,
  position            INTEGER,                              -- rank position, computed
  accuracy            NUMERIC(5,2) NOT NULL DEFAULT 0,     -- 0.00–100.00
  total_predictions   INTEGER     NOT NULL DEFAULT 0,
  correct_predictions INTEGER     NOT NULL DEFAULT 0,
  weekly_xp           INTEGER     NOT NULL DEFAULT 0,
  computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (profile_id, period)
);

COMMENT ON TABLE  leaderboard_stats IS 'Computed leaderboard snapshot. Backend-managed.';
COMMENT ON COLUMN leaderboard_stats.period IS 'all_time | weekly | monthly.';

-- =============================================================================
-- TABLE: badges
-- Static badge definitions. Matches existing mock badge data.
-- Populated once by admin seed; not user-writable.
-- =============================================================================

CREATE TABLE IF NOT EXISTS badges (
  id          TEXT        PRIMARY KEY,                      -- matches mock badge IDs
  name        TEXT        NOT NULL,
  description TEXT,
  icon        TEXT,                                         -- emoji
  rarity      TEXT        NOT NULL DEFAULT 'common'
                CHECK (rarity IN ('common','rare','epic','legendary')),
  category    TEXT        NOT NULL
                CHECK (category IN ('streak','accuracy','volume','special','league','worldcup')),
  xp_reward   INTEGER     NOT NULL DEFAULT 0,
  criteria    TEXT,                                         -- human-readable unlock condition
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE badges IS 'Achievement badge definitions. Seeded by admin, read-only to users.';

-- =============================================================================
-- TABLE: user_badges
-- Junction: which profiles have earned which badges.
-- One row per (profile, badge) pair.
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_badges (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id    TEXT        NOT NULL REFERENCES badges(id)   ON DELETE CASCADE,
  awarded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (profile_id, badge_id)
);

COMMENT ON TABLE user_badges IS 'Which badges each profile has earned.';

-- =============================================================================
-- UPDATED_AT trigger
-- Automatically updates `updated_at` on any row modification.
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_matches_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_predictions_updated_at
  BEFORE UPDATE ON predictions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY
-- All tables have RLS enabled. Policies are conservative:
--   - Anyone can read profiles, matches, leaderboard_stats, badges, user_badges
--   - No anonymous write access to any table
--   - Authenticated writes handled via service role key (backend only)
--   - Phase 4B will add wallet-scoped write policies once auth flow is wired
-- =============================================================================

ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches            ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_stats  ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges             ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges        ENABLE ROW LEVEL SECURITY;

-- ── profiles: public read, no public write ───────────────────────────────────
CREATE POLICY "profiles_select_public"
  ON profiles FOR SELECT
  USING (true);

-- ── matches: public read, no public write ────────────────────────────────────
CREATE POLICY "matches_select_public"
  ON matches FOR SELECT
  USING (true);

-- ── predictions: public read, no public write ────────────────────────────────
-- Phase 4B will add INSERT/UPDATE policy scoped to authenticated wallet owner
CREATE POLICY "predictions_select_public"
  ON predictions FOR SELECT
  USING (true);

-- ── leaderboard_stats: public read only ──────────────────────────────────────
CREATE POLICY "leaderboard_stats_select_public"
  ON leaderboard_stats FOR SELECT
  USING (true);

-- ── badges: public read only (admin-seeded) ──────────────────────────────────
CREATE POLICY "badges_select_public"
  ON badges FOR SELECT
  USING (true);

-- ── user_badges: public read only ────────────────────────────────────────────
CREATE POLICY "user_badges_select_public"
  ON user_badges FOR SELECT
  USING (true);

-- =============================================================================
-- INDEXES
-- Indexes for the most common query patterns.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_predictions_profile_id  ON predictions(profile_id);
CREATE INDEX IF NOT EXISTS idx_predictions_match_id    ON predictions(match_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_period      ON leaderboard_stats(period, xp DESC);
CREATE INDEX IF NOT EXISTS idx_matches_kickoff         ON matches(kickoff);
CREATE INDEX IF NOT EXISTS idx_matches_status          ON matches(status);
CREATE INDEX IF NOT EXISTS idx_user_badges_profile_id  ON user_badges(profile_id);
CREATE INDEX IF NOT EXISTS idx_profiles_wallet         ON profiles(wallet_address);

-- =============================================================================
-- END OF SCHEMA
-- Next step: run seed.sql to populate badges and demo matches (Phase 4B)
-- =============================================================================
