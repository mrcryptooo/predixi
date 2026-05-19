-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Daily XI entries table
-- Run this in the Supabase SQL editor or via supabase db push.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists daily_xi_entries (
  id                 uuid        primary key default gen_random_uuid(),
  wallet_address     text        not null,
  entry_date         date        not null,
  players            jsonb       not null,
  status             text        not null default 'pending',
  projected_max_xp   integer     not null default 20,
  earned_xp          integer     not null default 0,
  submitted_onchain  boolean     not null default false,
  tx_hash            text        null,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now(),

  -- one entry per wallet per day
  unique (wallet_address, entry_date),

  constraint daily_xi_status_check
    check (status in ('pending', 'locked', 'scored', 'void'))
);

-- updated_at trigger
create or replace function update_daily_xi_updated_at()
  returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger trg_daily_xi_updated_at
  before update on daily_xi_entries
  for each row execute function update_daily_xi_updated_at();

-- Enable Row Level Security
alter table daily_xi_entries enable row level security;

-- Service role full access (all writes go through the server API route)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'daily_xi_entries' and policyname = 'service_role_all'
  ) then
    create policy "service_role_all" on daily_xi_entries
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end
$$;

-- Index for wallet + date lookups
create index if not exists idx_daily_xi_wallet_date
  on daily_xi_entries (wallet_address, entry_date desc);
