-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: spin_analytics_events
--
-- Lightweight event log for SPIN feature analytics.
-- Stores spin_prepare, spin_claim, spin_reward, and block events.
--
-- Run in Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists spin_analytics_events (
  id           uuid        primary key default gen_random_uuid(),
  event_name   text        not null,
  wallet       text,
  properties   jsonb       not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

-- Query patterns: events by name over time, events by wallet, recent events
create index if not exists idx_spin_analytics_event_time
  on spin_analytics_events (event_name, created_at desc);

create index if not exists idx_spin_analytics_wallet_time
  on spin_analytics_events (wallet, created_at desc)
  where wallet is not null;

-- RLS: only service_role can write/read analytics
alter table spin_analytics_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'spin_analytics_events' and policyname = 'service_role_all'
  ) then
    create policy "service_role_all" on spin_analytics_events
      for all to service_role
      using (true) with check (true);
  end if;
end
$$;
