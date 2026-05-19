-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Add onchain metadata columns
-- Safe additive migration — uses ADD COLUMN IF NOT EXISTS throughout.
-- Run in the Supabase SQL editor or via supabase db push.
--
-- Adds to predictions, wc_predictions, daily_xi_entries:
--   commitment_hash  text null    — keccak256 hash of the canonical payload
--
-- Adds to predictions, wc_predictions (daily_xi_entries already has these):
--   submitted_onchain  boolean default false
--   tx_hash            text null
-- ─────────────────────────────────────────────────────────────────────────────

-- ── predictions ───────────────────────────────────────────────────────────────
alter table predictions
  add column if not exists commitment_hash   text    null,
  add column if not exists submitted_onchain boolean not null default false,
  add column if not exists tx_hash           text    null;

-- ── wc_predictions ────────────────────────────────────────────────────────────
alter table wc_predictions
  add column if not exists commitment_hash   text    null,
  add column if not exists submitted_onchain boolean not null default false,
  add column if not exists tx_hash           text    null;

-- ── daily_xi_entries ─────────────────────────────────────────────────────────
-- submitted_onchain and tx_hash already exist from add-daily-xi.sql
-- Only commitment_hash is new here.
alter table daily_xi_entries
  add column if not exists commitment_hash text null;

-- ── Indexes for future lookups by commitment hash ─────────────────────────────
create index if not exists idx_predictions_commitment_hash
  on predictions (commitment_hash) where commitment_hash is not null;

create index if not exists idx_wc_predictions_commitment_hash
  on wc_predictions (commitment_hash) where commitment_hash is not null;

create index if not exists idx_daily_xi_commitment_hash
  on daily_xi_entries (commitment_hash) where commitment_hash is not null;
