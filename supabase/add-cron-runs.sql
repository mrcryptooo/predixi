-- =============================================================================
-- Migration: add-cron-runs.sql
-- Creates cron_runs table for health-logging automatic cron executions.
-- Safe to run multiple times (CREATE TABLE IF NOT EXISTS / IF NOT EXISTS).
--
-- Run in Supabase SQL Editor before deploying cron health-log changes.
-- =============================================================================

CREATE TABLE IF NOT EXISTS cron_runs (
  id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  route    TEXT        NOT NULL,                          -- e.g. /api/cron/sync-fixtures
  status   TEXT        NOT NULL,                          -- success | error | unauthorized | skipped
  summary  JSONB       NOT NULL DEFAULT '{}'::jsonb,      -- apiCallsUsed, inserted, updated, etc.
  error    TEXT        NULL,                              -- error message if status=error
  ran_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  cron_runs IS 'Health log for Vercel Cron invocations. One row per execution.';
COMMENT ON COLUMN cron_runs.route   IS 'API route path that was invoked, e.g. /api/cron/sync-fixtures.';
COMMENT ON COLUMN cron_runs.status  IS 'success | error | unauthorized | skipped';
COMMENT ON COLUMN cron_runs.summary IS 'Structured run summary: apiCallsUsed, inserted, updated, skipped, errorCount, etc.';
COMMENT ON COLUMN cron_runs.error   IS 'Top-level error message for status=error rows. Never contains secrets.';

-- ── Indexes ────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_cron_runs_route
  ON cron_runs (route);

CREATE INDEX IF NOT EXISTS idx_cron_runs_ran_at
  ON cron_runs (ran_at DESC);

-- ── Row Level Security ─────────────────────────────────────────────────────────
-- Service role key (used by all server routes) bypasses RLS automatically.
-- No public read access needed.

ALTER TABLE cron_runs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- END
-- =============================================================================
