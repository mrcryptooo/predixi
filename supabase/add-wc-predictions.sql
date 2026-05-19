-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: World Cup Predictions table
-- Run this in the Supabase SQL editor or via supabase db push.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists wc_predictions (
  id               uuid        primary key default gen_random_uuid(),
  wallet_address   text        not null,
  prediction_key   text        not null,
  prediction_type  text        not null,
  selected_value   jsonb       not null,
  xp_reward        integer     not null default 0,
  status           text        not null default 'pending',
  deadline         timestamptz null,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),

  -- one prediction per wallet per card
  unique (wallet_address, prediction_key),

  -- only these status values are valid
  constraint wc_predictions_status_check
    check (status in ('pending', 'locked', 'won', 'lost', 'void'))
);

-- updated_at trigger (reuse pattern from existing tables)
create or replace function update_wc_predictions_updated_at()
  returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger trg_wc_predictions_updated_at
  before update on wc_predictions
  for each row execute function update_wc_predictions_updated_at();

-- Enable Row Level Security
alter table wc_predictions enable row level security;

-- Service role has full access (all writes go through the server API route
-- which uses the service role key — no anon policies needed for Phase 1).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'wc_predictions' and policyname = 'service_role_all'
  ) then
    create policy "service_role_all" on wc_predictions
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end
$$;

-- Index for wallet lookups
create index if not exists idx_wc_predictions_wallet
  on wc_predictions (wallet_address);
