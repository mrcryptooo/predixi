# Auto Settlement Foundation — Checkpoint

## Status
Auto Settlement foundation created. Backend route ready to scan and settle finished matches automatically.

## What Changed

### New Route
- Created: `src/app/api/admin/auto-settle/route.ts`
- Route: `POST /api/admin/auto-settle`
- Reuses existing `ADMIN_SETTLEMENT_KEY` env var + `x-admin-key` header — no new env vars needed

### Request Body
- `dryRun: boolean` (required)
- `limit?: number` (optional, default 10, max 100)

### Match Scanning
- Queries `matches` where `status = 'finished'`
- Skips matches where `actual_outcome IS NOT NULL` (already settled)
- Skips matches where `home_score` or `away_score` is null (no final score)
- Skips matches with zero unsettled predictions (`is_correct IS NULL` count = 0)

### Result Inference
- `home_score > away_score` → Home win (`H`)
- `away_score > home_score` → Away win (`A`)
- `home_score = away_score` → Draw (`D`)

### Dry Run (dryRun=true)
- Nothing written to DB
- Returns `candidates[]` per match: `matchId`, `homeTeam`, `awayTeam`, `score`, `inferredResult`, `unsettledPredictionCount`
- Safe to call repeatedly

### Real Run (dryRun=false)
- Calls `settlePrediction()` from `src/lib/settlement.ts` for every unsettled prediction
- Awards XP through `xp_events` ledger
- Updates `leaderboard_stats` (all_time + weekly) through settlement logic
- Marks `matches.actual_outcome` after predictions are settled
- Returns: `scanned`, `settledMatches`, `totalPredictions`, `totalCorrect`, `totalXPAwarded`, `errors[]`

### Safety
- Idempotent — already-settled matches excluded by query filter
- Duplicate-safe — `xp_events` unique constraint blocks double XP award
- Never settles without final score
- Never settles matches with no unsettled predictions

## What Is NOT Done
- No cron scheduling
- No public UI changes
- No automatic trigger on match finish
- No blockchain

## Build
- ✅ Passed — 0 errors · 24 routes
- `/api/admin/auto-settle` registered as dynamic route
