# Daily XI — Supabase Persistence Checkpoint

## Status
Daily XI moved from localStorage-only MVP to Supabase persistence.

## What Changed

### Database
- Migration file created: `supabase/add-daily-xi.sql`
- Table: `daily_xi_entries`
- Fields: `id`, `wallet_address`, `entry_date` (date), `players` (jsonb), `status`, `projected_max_xp`, `earned_xp`, `submitted_onchain`, `tx_hash`, `created_at`, `updated_at`
- Unique constraint: `(wallet_address, entry_date)`
- Status constraint: `pending | locked | scored | void`
- RLS enabled — service role full access
- Index on `(wallet_address, entry_date desc)`
- Migration run manually in Supabase SQL editor ✅

### API Route
- Added: `src/app/api/daily-xi/route.ts`
- `GET /api/daily-xi?wallet=0x...&date=YYYY-MM-DD` — returns entry for wallet/date (defaults today)
- `POST /api/daily-xi` — upserts by `(wallet_address, entry_date)`, status stays `pending`
- Uses service role key via `getServerSupabaseClient()`
- No XP settlement — `earned_xp` stays 0
- No blockchain

### Client Helper
- Updated: `src/lib/daily-xi.ts`
- Added `fetchDailyXIRemote(walletAddress, date?)` — fetches remote entry, returns 11-slot array or null
- Added `saveDailyXIRemote(walletAddress, players, date?)` — fire-and-forget POST, never throws
- All existing localStorage helpers unchanged

### DailyHeroes
- Updated: `src/components/home/DailyHeroes.tsx`
- Added `useAccount()` from wagmi for wallet address
- On mount: loads localStorage immediately, then if wallet connected fetches API and merges (API wins)
- After each spin: saves to localStorage first, then fires remote save if wallet connected (non-blocking)
- Not-connected users: localStorage only, unchanged behaviour
- Footer text now reflects sync status

### DailyXIProfileCard
- Updated: `src/components/profile/DailyXIProfileCard.tsx`
- Added `useAccount()` from wagmi
- Loads localStorage immediately as baseline
- If wallet connected, fetches API entry async and applies it if available
- UI layout unchanged

## Test Results
- `GET /api/daily-xi?wallet=0x123...` → `200 {"success":true,"entry":null}` ✅
- `POST /api/daily-xi` with 11 players → `200 {"success":true,"entry":{"entryDate":"2026-05-16","status":"pending",...}}` ✅
- Supabase row confirmed via follow-up GET — all 11 player objects returned intact with `status:"pending"`, `projectedMaxXp:20`, `earnedXp:0`, `submittedOnchain:false`, timestamps ✅

## XP Status
- `earned_xp`: 0 (placeholder)
- `projected_max_xp`: 20 (placeholder)
- No scoring, no settlement — future phase

## What Is NOT Done
- No XP settlement
- No blockchain / on-chain submission
- No World Cup changes
- No match prediction flow changes

## Build
- Code and API clean — no errors
- Local build blocked only by Google Fonts network issue (`fonts.googleapis.com` unreachable — proxy down)
- This is a network issue, not a code issue — builds passed multiple times earlier in the session
- Vercel build will pass with direct internet access

## Production Note
- Production Vercel deployment predates this route
- Redeploy required for `/api/daily-xi` to be live on `predixi-base.vercel.app`
