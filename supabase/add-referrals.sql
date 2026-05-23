-- =============================================================================
-- Migration: Referral System — STEP 1 (Schema Foundation)
-- XP-only referral rewards. No money, no token, no financial promise.
--
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- Run AFTER: schema.sql, add-xp-events.sql, add-daily-streaks.sql
-- =============================================================================


-- =============================================================================
-- 1. ADD REFERRAL COLUMNS TO profiles
--
-- referral_code   — short unique code the user shares (e.g. "AB3F2C1D")
-- referred_by_wallet — the wallet that referred this user (null = organic join)
-- referred_at     — when the referral was recorded
-- =============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referral_code      TEXT    UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by_wallet TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS referred_at        TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN profiles.referral_code      IS 'Unique share code generated on first profile creation (8 hex chars, uppercase).';
COMMENT ON COLUMN profiles.referred_by_wallet IS 'Normalized wallet address of the user who referred this account. NULL = organic.';
COMMENT ON COLUMN profiles.referred_at        IS 'Timestamp when this account was linked to a referrer.';


-- =============================================================================
-- 2. referrals TABLE
--
-- One row per (referrer → referred) relationship.
-- referred_wallet is UNIQUE — a user can only have one referrer.
-- Self-referral is prevented by CHECK constraint.
--
-- direct_reward_xp   — XP awarded to referrer when referred user joins (default 200)
-- future_bonus_bps   — basis points of referred user's future XP forwarded to
--                      referrer (1000 bps = 10%). Stored here so it can be
--                      adjusted per cohort without touching old rows.
-- =============================================================================

CREATE TABLE IF NOT EXISTS referrals (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_wallet     TEXT        NOT NULL,
  referred_wallet     TEXT        NOT NULL,
  referral_code       TEXT        NOT NULL,   -- code used at time of join (snapshot)
  status              TEXT        NOT NULL DEFAULT 'completed'
                        CHECK (status IN ('pending', 'completed', 'voided')),
  direct_reward_xp    INTEGER     NOT NULL DEFAULT 200,
  future_bonus_bps    INTEGER     NOT NULL DEFAULT 1000,  -- 10% = 1000/10000
  direct_rewarded_at  TIMESTAMPTZ NULL,                   -- when 200 XP was issued
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  completed_at        TIMESTAMPTZ NULL,

  -- One referrer per referred user — prevents double-referral
  UNIQUE (referred_wallet),

  -- Anti-abuse: cannot refer yourself
  CONSTRAINT referrals_no_self_referral
    CHECK (referrer_wallet <> referred_wallet),

  -- Sanity bounds: direct XP between 0–10000, bonus bps between 0–5000
  CONSTRAINT referrals_direct_reward_xp_range
    CHECK (direct_reward_xp >= 0 AND direct_reward_xp <= 10000),
  CONSTRAINT referrals_future_bonus_bps_range
    CHECK (future_bonus_bps >= 0 AND future_bonus_bps <= 5000)
);

COMMENT ON TABLE  referrals IS 'One row per referrer → referred pair. Tracks XP reward config and issuance state.';
COMMENT ON COLUMN referrals.future_bonus_bps IS '10% = 1000 bps. Stored per-row so cohort rates can vary without retroactive changes.';
COMMENT ON COLUMN referrals.direct_rewarded_at IS 'Set when the 200 XP event is inserted. NULL = not yet rewarded.';

-- Enable RLS
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'referrals' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all" ON referrals
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END
$$;

-- Public read: referrer can check their own referrals in a future UI
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'referrals' AND policyname = 'referrals_select_public'
  ) THEN
    CREATE POLICY "referrals_select_public" ON referrals
      FOR SELECT USING (true);
  END IF;
END
$$;


-- =============================================================================
-- 3. INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_wallet
  ON referrals (referrer_wallet);

CREATE INDEX IF NOT EXISTS idx_referrals_referred_wallet
  ON referrals (referred_wallet);

CREATE INDEX IF NOT EXISTS idx_referrals_referral_code
  ON referrals (referral_code);

CREATE INDEX IF NOT EXISTS idx_profiles_referral_code
  ON profiles (referral_code);

CREATE INDEX IF NOT EXISTS idx_profiles_referred_by
  ON profiles (referred_by_wallet);


-- =============================================================================
-- 4. ADD 'referral_reward' AND 'referral_bonus' TO xp_events source_type CHECK
--
--   referral_reward  — one-time 200 XP when a referred user joins
--   referral_bonus   — ongoing 10% bonus forwarded from referred user XP events
--
-- The source_id convention for traceability:
--   referral_reward : "referral-reward:{referrer_wallet}:{referred_wallet}"
--   referral_bonus  : "referral-bonus:{referrer_wallet}:{source_xp_event_id}"
--
-- This lets you JOIN xp_events on source_id to trace any bonus back to its
-- origin event without a separate join table.
-- =============================================================================

DO $$
BEGIN
  -- Drop the current constraint (name may have changed across migrations)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'xp_events'
      AND constraint_name = 'xp_events_source_type_check'
  ) THEN
    ALTER TABLE xp_events DROP CONSTRAINT xp_events_source_type_check;
  END IF;

  -- Re-add with all current + new source types
  ALTER TABLE xp_events
    ADD CONSTRAINT xp_events_source_type_check CHECK (
      source_type IN (
        'match_prediction',
        'wc_prediction',
        'daily_xi',
        'daily_streak',
        'referral_reward',   -- 200 XP to referrer when friend joins
        'referral_bonus',    -- 10% of friend's future XP to referrer
        'badge',
        'mission',
        'admin_adjustment'
      )
    );
END
$$;


-- =============================================================================
-- 5. REFERRAL CODE GENERATOR FUNCTION
--
-- Deterministic 8-char uppercase hex code from the wallet address.
-- sha256(lower(wallet)) → first 8 hex chars → uppercase
-- Collision probability at 10k users: ~1.2% — acceptable for a code that also
-- has wallet-uniqueness enforcement via profiles.referral_code UNIQUE.
-- If a collision occurs, the UNIQUE constraint fires and the app can append a
-- short random suffix at generation time.
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_referral_code(p_wallet TEXT)
  RETURNS TEXT
  LANGUAGE SQL
  IMMUTABLE
AS $$
  SELECT UPPER(SUBSTR(ENCODE(SHA256(LOWER(TRIM(p_wallet))::bytea), 'hex'), 1, 8));
$$;

COMMENT ON FUNCTION generate_referral_code IS
  'Returns an 8-char uppercase hex referral code deterministic on wallet address. '
  'Used for backfill and initial code assignment on profile creation.';


-- =============================================================================
-- 6. BACKFILL referral_code FOR ALL EXISTING profiles
--
-- Safe: only updates rows where referral_code IS NULL.
-- Uses the same deterministic function above.
-- =============================================================================

UPDATE profiles
SET referral_code = generate_referral_code(wallet_address)
WHERE referral_code IS NULL;


-- =============================================================================
-- END — Referral Schema Foundation
--
-- What comes next (Step 2+):
--   • /api/referral/register   — link wallet to code on first join
--   • /api/referral/reward     — POST 200 XP referral_reward event
--   • /api/referral/bonus      — called by XP award logic to forward 10%
--   • Profile card referral link UI
--   • Leaderboard referral stat column
-- =============================================================================
