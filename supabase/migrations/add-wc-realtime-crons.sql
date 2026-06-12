-- ─────────────────────────────────────────────────────────────────────────────
-- add-wc-realtime-crons.sql
--
-- Production-ready WC real-time sync using Supabase pg_cron + pg_net.
-- Calls the three WC cron endpoints every 3-5 minutes directly from the
-- database — no Vercel Pro plan required.
--
-- HOW TO APPLY
-- ─────────────────────────────────────────────────────────────────────────────
-- Run in Supabase Dashboard → SQL Editor (or via `supabase db push`):
--
-- Step 1 — Enable the HTTP extension (one-time; idempotent):
--   Run the CREATE EXTENSION line below.
--
-- Step 2 — Store your CRON_SECRET (copy from Vercel Project Settings → Env Vars):
--   INSERT INTO cron_config (key, value)
--   VALUES ('cron_secret', 'paste-your-cron-secret-here')
--   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
--
-- Step 3 — Paste and run the rest of this file.
--
-- Verify jobs were created:
--   SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
--
-- Monitor recent runs:
--   SELECT jobname, status, return_message, start_time
--   FROM cron.job_run_details
--   ORDER BY start_time DESC
--   LIMIT 20;
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Enable pg_net (outbound HTTP from the database) ───────────────────────
-- Supabase projects have pg_net pre-enabled. This is a no-op if already present.
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── 2. Create cron_config table to store the CRON_SECRET securely ────────────
--    pg_cron runs as superuser so it can always read this table.
--    RLS prevents anon/authenticated roles from reading it.
CREATE TABLE IF NOT EXISTS cron_config (
  key   text PRIMARY KEY,
  value text NOT NULL
);

ALTER TABLE cron_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cron_config' AND policyname = 'service_role_only'
  ) THEN
    EXECUTE 'CREATE POLICY service_role_only ON cron_config USING (auth.role() = ''service_role'')';
  END IF;
END $$;

-- ── 3. Remove existing WC sync jobs (idempotent re-run) ──────────────────────
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname IN ('wc-sync-results', 'wc-sync-standings', 'wc-auto-settle');

-- ── 4. Schedule: WC results every 3 minutes ──────────────────────────────────
SELECT cron.schedule(
  'wc-sync-results',
  '*/3 * * * *',
  $job$
    SELECT net.http_get(
      url     := 'https://predixi-base.vercel.app/api/cron/sync-wc-results',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (SELECT value FROM cron_config WHERE key = 'cron_secret')
      )
    );
  $job$
);

-- ── 5. Schedule: WC standings every 5 minutes ────────────────────────────────
SELECT cron.schedule(
  'wc-sync-standings',
  '*/5 * * * *',
  $job$
    SELECT net.http_get(
      url     := 'https://predixi-base.vercel.app/api/cron/sync-wc-standings',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (SELECT value FROM cron_config WHERE key = 'cron_secret')
      )
    );
  $job$
);

-- ── 6. Schedule: auto-settle every 5 minutes ─────────────────────────────────
SELECT cron.schedule(
  'wc-auto-settle',
  '*/5 * * * *',
  $job$
    SELECT net.http_get(
      url     := 'https://predixi-base.vercel.app/api/cron/auto-settle',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (SELECT value FROM cron_config WHERE key = 'cron_secret')
      )
    );
  $job$
);
