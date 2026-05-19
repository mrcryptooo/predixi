# Settlement Engine v1 — Checkpoint

## Status
Settlement Engine v1 foundation completed. Unified settlement flow integrating xp_events ledger and leaderboard_stats.

## What Changed

### Settlement Utility
- Created: `src/lib/settlement.ts`
- `calculatePredictionXP(isCorrect)` — 25 XP correct, 0 XP wrong
- `computeRank(xp)` — bronze / silver / gold / platinum / diamond / legend thresholds
- `awardXPEvent(...)` — inserts into `xp_events` table; duplicate-safe (Postgres 23505 → `{duplicate:true}`, no re-insert)
- `updateLeaderboardStats(...)` — upserts `all_time` + `weekly` rows per profile; increments xp, weekly_xp, total_predictions, correct_predictions, accuracy
- `settlePrediction(...)` — orchestrates all 4 steps for one prediction: mark row → update profile → xp_events → leaderboard_stats
- `OUTCOME_TO_DB` map — `home/draw/away → H/D/A`
- `PredictionRecord`, `SettlePredictionResult`, `AwardXPEventInput`, `UpdateLeaderboardInput` types

### Admin Route
- Added: `src/app/api/admin/settle-match/route.ts`
- `POST /api/admin/settle-match`
- Auth: `x-admin-key` header vs `ADMIN_SETTLEMENT_KEY` env var
- Body: `{ matchId: string, actualResult: "home" | "draw" | "away" }`
- XP: 25 for correct predictions · 0 for incorrect
- Idempotent: 409 if match already settled; skips predictions where `is_correct IS NULL`
- Integrates: `xp_events` + `leaderboard_stats` + `predictions` + `profiles`
- Response includes: `settled`, `correct`, `xpAwarded`, `duplicates` (if any), `errors`
- Separate from legacy `/api/settle-match` (10 XP, profiles-only, no ledger)

## Build
- ✅ Passed — 0 errors · 22 routes
- `/api/admin/settle-match` registered as dynamic route

## Environment
- `ADMIN_SETTLEMENT_KEY` env var added to Vercel
- Production redeployed

## Test Results
- Missing key → `401 Unauthorized` ✅
- Wrong key → `401 Unauthorized` ✅
- Invalid `actualResult` (e.g. `"H"`) → `400` with clear message ✅
- Missing `matchId` → `400 matchId is required` ✅
- Invalid JSON body → `400 Invalid JSON body` ✅
- Valid key + valid body → Supabase query executed, `200 {"success":true,"settled":0,...,"message":"No unsettled predictions found"}` ✅

## What Is NOT Done
- Full end-to-end XP award not yet tested — no prediction rows exist in DB
- No cron jobs
- No blockchain
- No automatic settlement triggers
- No World Cup settlement
- No Daily XI scoring integration

## Pending
- Seed at least one prediction row in the `predictions` table
- Run full settlement: predictions marked → xp_events inserted → leaderboard_stats upserted
- Verify duplicate rerun does not double-award XP

## Design Notes
- Double-award structurally impossible: `awardXPEvent` catches 23505; re-run excludes already-settled predictions via `is_correct IS NULL` filter
- `leaderboard_stats` upsert handles first-time insert (no existing row) and increment on existing row
- `all_time` and `weekly` periods updated on every settlement
