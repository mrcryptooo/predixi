-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: API request usage log
-- Safe additive migration — uses CREATE TABLE IF NOT EXISTS throughout.
-- Run in the Supabase SQL editor (project: ezqydkrhtpobcwtmfgii).
--
-- Purpose:
--   Track per-day, per-endpoint API call counts for external providers.
--   Used by src/lib/football/apiFootball.ts to enforce daily budget caps
--   and by GET /api/admin/health to report usage vs quota.
--
-- Initial provider: 'apf' (API-Football / api-sports.io)
--   Plan: Pro, 7,500 requests/day
--   Hard cap enforced at 6,000 to preserve safety buffer
--   Warning threshold at 3,000
--
-- Design:
--   One row per (date, provider, endpoint) combination.
--   calls_this_day is incremented by the application layer on each call.
--   The UNIQUE constraint + application-level upsert pattern handles
--   concurrent increments safely for our low-volume usage.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_request_log (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Calendar date (UTC) the calls were made — one row per day per endpoint.
  date             date        NOT NULL,

  -- Provider identifier. 'apf' = API-Football (api-sports.io).
  -- Future providers: 'fd' = football-data.org, etc.
  provider         text        NOT NULL,

  -- Logical endpoint name (short, human-readable). Examples:
  --   'fixtures', 'standings', 'fixtures/events', 'fixtures/lineups', 'teams'
  endpoint         text        NOT NULL,

  -- Running call count for this (date, provider, endpoint).
  -- Incremented by one each time the application makes a live API call.
  calls_this_day   integer     NOT NULL DEFAULT 1,

  -- When the most recent call was made for this (date, provider, endpoint).
  last_called_at   timestamptz NOT NULL DEFAULT now(),

  -- Row creation timestamp (always the first call of the day for this endpoint).
  created_at       timestamptz NOT NULL DEFAULT now(),

  -- Uniqueness: one row per calendar day per provider per endpoint.
  CONSTRAINT uq_api_request_log_key UNIQUE (date, provider, endpoint)
);

COMMENT ON TABLE api_request_log IS
  'Per-day external API call counts. Used to enforce daily budget caps '
  'and monitor usage vs quota for each provider and endpoint.';

COMMENT ON COLUMN api_request_log.provider IS
  '''apf'' = API-Football (api-sports.io). Future: ''fd'' = football-data.org.';

COMMENT ON COLUMN api_request_log.calls_this_day IS
  'Incremented by the application layer on each live API call. '
  'Never decremented — reset implicitly when a new date row is created.';

-- ── Primary lookup index ─────────────────────────────────────────────────────
-- Used by budget check: WHERE date = today AND provider = 'apf'
CREATE INDEX IF NOT EXISTS idx_api_request_log_date_provider
  ON api_request_log (date, provider);

-- ── Health dashboard index ────────────────────────────────────────────────────
-- Used by /api/admin/health to aggregate calls per day per provider.
CREATE INDEX IF NOT EXISTS idx_api_request_log_provider_date
  ON api_request_log (provider, date DESC);
