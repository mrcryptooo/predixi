# WC Predictions — Supabase Persistence Checkpoint

## Status
World Cup predictions moved from localStorage-only MVP to Supabase persistence.

## What Changed

### Database
- Migration file created: `supabase/add-wc-predictions.sql`
- Table: `wc_predictions`
- Fields: `id`, `wallet_address`, `prediction_key`, `prediction_type`, `selected_value` (jsonb), `xp_reward`, `status`, `deadline`, `created_at`, `updated_at`
- Unique constraint: `(wallet_address, prediction_key)`
- Status constraint: `pending | locked | won | lost | void`
- RLS enabled — service role full access
- Index on `wallet_address`
- Migration run manually in Supabase SQL editor ✅

### API Route
- Added: `src/app/api/wc-predictions/route.ts`
- `GET /api/wc-predictions?wallet=0x...` — returns all WC predictions for wallet
- `POST /api/wc-predictions` — upserts by `(wallet_address, prediction_key)`, status stays `pending`
- Uses service role key via `getServerSupabaseClient()`
- No wallet signature required (low-stakes MVP persistence)
- XP settlement not done here

### Client Helper
- Updated: `src/lib/worldcup-predictions.ts`
- Added `fetchWCPredictions(walletAddress)` — fetches remote store, maps to `WCPredictionsStore`
- Added `saveWCPredictionRemote(...)` — fire-and-forget POST, never throws
- All existing localStorage helpers unchanged

### WorldCupPredictionCard
- Updated: `src/components/world-cup/WorldCupPredictionCard.tsx`
- Added `useAccount()` from wagmi
- On mount: loads localStorage immediately, then if wallet connected fetches API and merges (API wins)
- On confirm: always saves to localStorage first, then fires remote save if wallet connected
- Not-connected users: localStorage only, unchanged behaviour

### Profile WC Picks Summary
- Updated: `src/app/profile/page.tsx`
- `WCPicksSummary` now accepts `walletAddress` prop
- Loads localStorage count immediately as baseline
- If wallet connected, fetches API count async and uses the higher of the two
- UI unchanged

## Test Results
- `GET /api/wc-predictions?wallet=0x123...` → `200 {"success":true,"predictions":[]}` ✅
- `POST /api/wc-predictions` with `wc-champion / Brazil / 200 XP` → `200 {"success":true,...}` ✅
- Supabase row confirmed via follow-up GET — all fields present including `predictionType`, `selectedValue`, `deadline`, timestamps ✅

## What Is NOT Done
- No XP settlement
- No blockchain
- No Daily XI changes
- No match prediction flow changes

## Build
- Passed clean — 0 errors, 19 routes
- `/api/wc-predictions` registered as dynamic route

## Production Note
- Production Vercel deployment predates this route
- Redeploy required for `/api/wc-predictions` to be live on `predixi-base.vercel.app`
