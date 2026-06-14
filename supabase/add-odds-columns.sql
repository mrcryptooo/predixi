-- Migration: add odds columns to matches table
-- Run once in Supabase SQL editor (Dashboard → SQL Editor → Run)
-- Safe to re-run — uses ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS odds_home       NUMERIC(6,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS odds_draw       NUMERIC(6,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS odds_away       NUMERIC(6,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS odds_bookmaker  SMALLINT     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS odds_fetched_at TIMESTAMPTZ  DEFAULT NULL;

-- Partial index: only APF matches that haven't had odds fetched yet
-- Used by the daily sync-odds cron to quickly find matches needing a sync
CREATE INDEX IF NOT EXISTS idx_matches_odds_sync
  ON matches (kickoff, status)
  WHERE api_source = 'apf' AND odds_fetched_at IS NULL;
