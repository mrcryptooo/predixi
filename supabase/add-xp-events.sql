-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: XP Events ledger table
-- Source of truth for all XP across: match predictions, WC predictions,
-- Daily XI, badges, missions, and admin adjustments.
-- Run this in the Supabase SQL editor or via supabase db push.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists xp_events (
  id             uuid        primary key default gen_random_uuid(),
  wallet_address text        not null,
  source_type    text        not null,
  source_id      text        not null,
  xp_amount      integer     not null,           -- positive, zero, or negative
  reason         text        not null,
  metadata       jsonb       not null default '{}'::jsonb,
  created_at     timestamptz default now(),

  -- one event per wallet × source_type × source_id × reason
  unique (wallet_address, source_type, source_id, reason),

  constraint xp_events_source_type_check check (
    source_type in (
      'match_prediction',
      'wc_prediction',
      'daily_xi',
      'badge',
      'mission',
      'admin_adjustment'
    )
  )
);

-- Enable Row Level Security
alter table xp_events enable row level security;

-- Service role full access (all writes go through the server API route)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'xp_events' and policyname = 'service_role_all'
  ) then
    create policy "service_role_all" on xp_events
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end
$$;

-- Indexes
create index if not exists idx_xp_events_wallet
  on xp_events (wallet_address);

create index if not exists idx_xp_events_source_type
  on xp_events (source_type);

create index if not exists idx_xp_events_created_at
  on xp_events (created_at desc);
