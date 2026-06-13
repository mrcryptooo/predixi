-- Backfill leaderboard_stats.xp (all_time) from xp_events totals.
--
-- Fixes wallets where leaderboard_stats.xp fell behind profiles.xp because
-- Supabase SDK update() errors were silently discarded (no { error } check).
-- Root cause: try/catch only catches JS exceptions, not SDK error returns.
--
-- Only rows where xp currently differs are touched.
-- Safe to re-run — idempotent.

UPDATE leaderboard_stats ls
SET    xp          = ev.total_xp,
       computed_at = now()
FROM (
  SELECT p.id                                AS profile_id,
         COALESCE(SUM(e.xp_amount), 0)::int  AS total_xp
  FROM   profiles  p
  JOIN   xp_events e ON e.wallet_address = p.wallet_address
  GROUP  BY p.id
) ev
WHERE  ls.profile_id = ev.profile_id
  AND  ls.period     = 'all_time'
  AND  ls.xp        <> ev.total_xp;
