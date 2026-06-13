-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Atomic profiles.xp increment RPC
-- Run in the Supabase SQL editor (project: ezqydkrhtpobcwtmfgii).
--
-- Problem solved:
--   All XP-awarding code paths previously used a read-then-write pattern:
--     1. SELECT xp FROM profiles WHERE id = p_id
--     2. UPDATE profiles SET xp = (read_value + delta) WHERE id = p_id
--   When two paths ran concurrently (e.g. badge award racing with daily_xi
--   scoring), the second writer would overwrite the first with a stale base
--   value, silently losing XP.  leaderboard_stats was unaffected because it
--   used pure increments, so it drifted ahead of profiles.xp over time.
--
-- Fix:
--   Single atomic SQL UPDATE: xp = xp + p_delta.
--   No read, no race window.  Called via supabase.rpc('increment_profile_xp').
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_profile_xp(p_id uuid, p_delta int)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE profiles
  SET    xp         = xp + p_delta,
         updated_at = now()
  WHERE  id = p_id;
$$;

COMMENT ON FUNCTION increment_profile_xp(uuid, int) IS
  'Atomically increment profiles.xp by p_delta. '
  'Eliminates the read-then-write race condition across concurrent XP-awarding paths. '
  'Called from: settlement, score-daily-xi, checkAndAward, daily-streak, '
  'awardReferralBonus, registerReferral, worldcup-settlement.';
