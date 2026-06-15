-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: SPIN feature
--
-- 1. spin_entries — tracks every spin session (prepare → claim lifecycle)
-- 2. xp_events    — adds 'spin' to the allowed source_type values
--
-- Run in Supabase SQL editor or via supabase db push.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. spin_entries ───────────────────────────────────────────────────────────

create table if not exists spin_entries (
  id              uuid        primary key default gen_random_uuid(),
  wallet_address  text        not null,
  profile_id      uuid        not null references profiles(id) on delete cascade,

  -- Pre-determined outcome (set at prepare time, never changes)
  xp_amount       int         not null
                              check (xp_amount in (5, 10, 15, 25, 50, 100, 250)),
  segment_index   int         not null
                              check (segment_index between 0 and 6),

  -- Lifecycle
  status          text        not null default 'pending'
                              check (status in ('pending', 'claimed', 'expired')),
  tx_hash         text,
  prepared_at     timestamptz not null default now(),
  claimed_at      timestamptz,
  expires_at      timestamptz not null default (now() + interval '15 minutes'),
  created_at      timestamptz not null default now()
);

-- tx_hash uniqueness prevents replay attacks
alter table spin_entries
  add constraint spin_entries_tx_hash_unique unique (tx_hash);

-- Fast cooldown and daily-limit lookups
create index if not exists idx_spin_entries_wallet_claimed
  on spin_entries (wallet_address, claimed_at desc)
  where status = 'claimed';

create index if not exists idx_spin_entries_pending_expiry
  on spin_entries (expires_at)
  where status = 'pending';

-- Enable RLS — all writes go through the service-role API
alter table spin_entries enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'spin_entries' and policyname = 'service_role_all'
  ) then
    create policy "service_role_all" on spin_entries
      for all to service_role
      using (true) with check (true);
  end if;
end
$$;

-- ── 2. xp_events — add 'spin' to source_type allowlist ───────────────────────

alter table xp_events
  drop constraint if exists xp_events_source_type_check;

alter table xp_events
  add constraint xp_events_source_type_check check (
    source_type in (
      'match_prediction',
      'wc_prediction',
      'daily_xi',
      'badge',
      'mission',
      'admin_adjustment',
      'spin'
    )
  );
