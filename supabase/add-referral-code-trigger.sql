-- =============================================================================
-- Migration: Referral Code Auto-Generation Trigger
--
-- Problem: No INSERT trigger existed on profiles. The add-referrals.sql
-- migration created generate_referral_code() and ran a one-time backfill,
-- but new profiles created after that migration received NULL referral_code.
-- Result: 65/73 profiles (89%) missing referral codes at time of fix.
--
-- Fix:
--   1. BEFORE INSERT trigger — auto-generates referral_code for every new profile
--   2. Backfill UPDATE — fixes all existing NULL referral_code rows
--
-- Safe to re-run: trigger uses CREATE OR REPLACE; UPDATE is WHERE IS NULL.
-- Run AFTER: schema.sql, add-referrals.sql
-- =============================================================================


-- =============================================================================
-- 1. TRIGGER FUNCTION
--    Sets referral_code on INSERT if not already provided.
--    The NULL check means it never overwrites a code supplied by the caller
--    (e.g. registerReferral explicitly sets the code for referred users).
-- =============================================================================

CREATE OR REPLACE FUNCTION set_profile_referral_code()
  RETURNS TRIGGER
  LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code(NEW.wallet_address);
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION set_profile_referral_code IS
  'BEFORE INSERT trigger on profiles — assigns referral_code via '
  'generate_referral_code() when none is supplied by the caller.';


-- =============================================================================
-- 2. TRIGGER
--    Fires BEFORE INSERT, once per row.
--    DROP + CREATE ensures idempotency when re-running the migration.
-- =============================================================================

DROP TRIGGER IF EXISTS profiles_set_referral_code ON profiles;

CREATE TRIGGER profiles_set_referral_code
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_profile_referral_code();

COMMENT ON TRIGGER profiles_set_referral_code ON profiles IS
  'Auto-generates an 8-char uppercase hex referral_code for every new profile row.';


-- =============================================================================
-- 3. BACKFILL — fix all existing NULL referral_code rows
--    Safe: only updates rows where referral_code IS NULL.
--    generate_referral_code is deterministic — same code every time for a
--    given wallet, so this is safe to re-run.
-- =============================================================================

UPDATE profiles
SET    referral_code = generate_referral_code(wallet_address)
WHERE  referral_code IS NULL;


-- =============================================================================
-- 4. VERIFY — confirm no NULLs remain
--    Expected: 0 rows
-- =============================================================================

SELECT
  COUNT(*)                                       AS total_profiles,
  COUNT(referral_code)                           AS profiles_with_code,
  COUNT(*) - COUNT(referral_code)                AS profiles_missing_code,
  COUNT(*) - COUNT(DISTINCT referral_code)       AS duplicate_codes
FROM profiles;
