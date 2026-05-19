# XP Ledger — Foundation Checkpoint

## Status
XP Ledger foundation completed. Unified source of truth for all XP across PrediXI.

## What Changed

### Database
- Migration file created: `supabase/add-xp-events.sql`
- Table: `xp_events`
- Fields: `id`, `wallet_address`, `source_type`, `source_id`, `xp_amount` (positive/zero/negative), `reason`, `metadata` (jsonb), `created_at`
- Unique constraint: `(wallet_address, source_type, source_id, reason)` — prevents duplicate awards
- Source type constraint: `match_prediction | wc_prediction | daily_xi | badge | mission | admin_adjustment`
- RLS enabled — service role full access
- Indexes on `wallet_address`, `source_type`, `created_at`
- Migration run manually in Supabase SQL editor ✅

### API Route
- Added: `src/app/api/xp-events/route.ts`
- `GET /api/xp-events?wallet=0x...` — returns all events, `totalXp`, `eventCount`, `bySourceType` summary
- `POST /api/xp-events` — inserts XP event, duplicate-safe (unique constraint 23505 → `200 {duplicate:true}`, no 500)
- Uses service role key via `getServerSupabaseClient()`
- No leaderboard_stats update
- No prediction settlement
- No real XP awarding

### Helper Library
- Created: `src/lib/xp-ledger.ts`
- `XP_SOURCE_TYPES` const and `XPSourceType` type
- `XPEvent` and `XPLedgerSummary` types
- `fetchXPEvents(walletAddress)` — GET wrapper, returns null on failure
- `createXPEvent(input)` — POST wrapper, returns `{success, duplicate}`, never throws
- `calculateTotalXP(events)` — pure sum helper
- `groupXPBySource(events)` — pure grouping helper
- `XP_SOURCE_LABELS` — display label map for UI

### Profile Integration
- Updated: `src/app/profile/page.tsx`
- Added `XPLedgerPreview` component — reads from `/api/xp-events` if wallet connected
- Shows: total ledger XP, event count, per-source breakdown
- Shows "No XP events yet" when empty
- Inserted as "XP Ledger" section after World Cup Picks
- Read-only — does not modify existing XP display logic

## Test Results
- `GET /api/xp-events?wallet=0x123...` → `200 {"success":true,"totalXp":0,"eventCount":0,...}` ✅
- `POST /api/xp-events` with `wc_prediction / wc-champion / 200 XP / test_award` → `200 {"success":true,"duplicate":false,...}` ✅
- Duplicate POST → `200 {"success":true,"duplicate":true,"message":"XP event already recorded for this source"}` ✅
- GET after POST → `totalXp:200`, `eventCount:1`, `bySourceType:{"wc_prediction":{"totalXp":200,"count":1}}`, `metadata:{"prediction":"Brazil"}` all confirmed ✅

## What Is NOT Done
- No XP settlement logic
- No leaderboard_stats updates
- No real XP awarding to users
- No blockchain
- No Daily XI scoring
- No World Cup settlement

## Build
- ✅ Passed — 0 errors · 21 routes
- `/api/xp-events` registered as dynamic route

## Production Note
- Production Vercel deployment predates this route
- Redeploy required for `/api/xp-events` to be live on `predixi-base.vercel.app`
