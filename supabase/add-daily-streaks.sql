-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Daily Streaks
-- Tracks each wallet's daily check-in streak and last claim date.
-- Run in Supabase SQL Editor or via supabase db push.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. daily_streaks table
create table if not exists daily_streaks (
  id               uuid        primary key default gen_random_uuid(),
  profile_id       uuid        references profiles(id) on delete set null,
  wallet_address   text        not null,
  current_streak   integer     not null default 0,
  longest_streak   integer     not null default 0,
  last_claim_date  date        null,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),

  unique (wallet_address)
);

-- updated_at trigger
create or replace function update_daily_streaks_updated_at()
  returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger trg_daily_streaks_updated_at
  before update on daily_streaks
  for each row execute function update_daily_streaks_updated_at();

-- Enable Row Level Security
alter table daily_streaks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'daily_streaks' and policyname = 'service_role_all'
  ) then
    create policy "service_role_all" on daily_streaks
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end
$$;

-- Indexes
create index if not exists idx_daily_streaks_wallet
  on daily_streaks (wallet_address);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Add 'daily_streak' to xp_events.source_type CHECK constraint
--    PostgreSQL requires DROP + ADD to modify a named check constraint.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  -- Drop old constraint (if it exists with the old name)
  if exists (
    select 1 from information_schema.table_constraints
    where table_name = 'xp_events'
      and constraint_name = 'xp_events_source_type_check'
  ) then
    alter table xp_events drop constraint xp_events_source_type_check;
  end if;

  -- Add updated constraint that includes 'daily_streak'
  alter table xp_events
    add constraint xp_events_source_type_check check (
      source_type in (
        'match_prediction',
        'wc_prediction',
        'daily_xi',
        'daily_streak',
        'badge',
        'mission',
        'admin_adjustment'
      )
    );
end
$$;
