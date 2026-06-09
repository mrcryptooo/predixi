-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: add composite (status, entry_date) index to daily_xi_entries
--
-- Context:
--   The Vercel cron at /api/cron/score-daily-xi queries:
--     .in('status', ['pending', 'locked'])
--     .lte('entry_date', today)
--     .limit(25)
--   Without an index on status + entry_date, this is a full table scan.
--   The existing index idx_daily_xi_wallet_date (wallet_address, entry_date DESC)
--   is useless for this query because it does not lead with status.
--
-- Note on commitment_hash:
--   The commitment_hash column is NOT added here. It is already tracked in
--   supabase/add-onchain-metadata.sql (line 30) with ADD COLUMN IF NOT EXISTS.
--   Running that migration on a fresh database correctly creates the column.
--   This file adds only the missing index.
--
-- Idempotent: CREATE INDEX IF NOT EXISTS is safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────────────

create index if not exists idx_daily_xi_status_date
  on daily_xi_entries (status, entry_date);
