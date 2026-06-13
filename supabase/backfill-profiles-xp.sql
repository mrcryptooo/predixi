-- ─────────────────────────────────────────────────────────────────────────────
-- One-time backfill: sync profiles.xp from xp_events totals
-- Run AFTER deploying add-increment-profile-xp-rpc.sql.
-- Run in the Supabase SQL editor (project: ezqydkrhtpobcwtmfgii).
--
-- Why:
--   The read-then-write race condition in XP-awarding code caused profiles.xp
--   to fall behind xp_events totals for some users.  leaderboard_stats.xp
--   (the leaderboard source of truth) already matches xp_events.
--   This query syncs profiles.xp to match.
--
-- Safety:
--   Only updates rows where xp differs — no-op if already in sync.
--   Returns the number of rows updated.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE profiles p
SET    xp         = ev.total_xp,
       updated_at = now()
FROM (
  SELECT wallet_address,
         COALESCE(SUM(xp_amount), 0)::int AS total_xp
  FROM   xp_events
  GROUP  BY wallet_address
) ev
WHERE  p.wallet_address = ev.wallet_address
  AND  p.xp             <> ev.total_xp;

-- Verify: should return 0 rows after the update
SELECT p.wallet_address,
       p.xp                    AS profiles_xp,
       ev.total_xp             AS xp_events_sum,
       ls.xp                   AS leaderboard_xp,
       p.xp - ev.total_xp      AS drift
FROM   profiles p
JOIN (
  SELECT wallet_address, COALESCE(SUM(xp_amount), 0)::int AS total_xp
  FROM   xp_events GROUP BY wallet_address
) ev ON ev.wallet_address = p.wallet_address
LEFT JOIN leaderboard_stats ls
       ON ls.profile_id = p.id AND ls.period = 'all_time'
WHERE  p.xp <> ev.total_xp
ORDER  BY ABS(p.xp - ev.total_xp) DESC;
