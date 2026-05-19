# World Cup Settlement & Real Stats Adapter — Checkpoint

## Status
Real Player Stats API Adapter foundation and World Cup Settlement Engine completed.

## Real Player Stats API Adapter

### `src/lib/player-stats-provider.ts` (updated)
- `ApiFootballPlayerStatsProvider` added
  - Calls `GET https://v3.football.api-sports.io/players?id={n}&season={year}` with `x-apisports-key` header
  - Season derived from date: Aug+ → current year, Jan–Jul → previous year
  - Player ID format: `apf-player-{numericId}` → API Football player ID
  - Maps season totals to per-game stats: goals/assists clamped 0–2, yellow >0.12/game → 1, red >0.03/game → 1, clean sheet via conceded <0.3/game, rating from season average or 6.5 default
  - Constructor throws a clear error if `API_FOOTBALL_KEY` is missing
- Mock provider remains default — no behaviour change without env vars
- `getPlayerStatsProvider()` factory updated: `PLAYER_STATS_PROVIDER=api-football` → `ApiFootballPlayerStatsProvider`; anything else → `MockPlayerStatsProvider`
- Safe fallback: unmapped IDs (not `apf-player-{n}` format) or API failures return `{ played:false, goals:0, assists:0, cleanSheet:false, rating:0, yellowCards:0, redCards:0 }` per player
- `fetchStatsForPlayers` and all callers unchanged — no downstream changes needed

### Optional env vars (not set in production yet)
- `PLAYER_STATS_PROVIDER=api-football` — switches provider at runtime
- `API_FOOTBALL_KEY=<key>` — required when api-football mode is active

## World Cup Settlement Engine

### `src/lib/worldcup-settlement.ts` (new)
- `isWCPredictionCorrect(selected, correctValues)` — case-insensitive, trim-normalized; all selected values must be in correctValues set; handles single-pick and multi-pick; empty selection always false
- `settleWCPrediction(supabase, row, correctValues)` — updates `wc_predictions.status` to `won`/`lost`; inserts `xp_events` for winners only (`source_type='wc_prediction'`, `reason='wc_prediction_correct'`); increments `leaderboard_stats` all_time + weekly XP; duplicate-safe via 23505 check
- `WCPredictionRow` and `WCSettleResult` types exported

### `src/app/api/admin/settle-worldcup/route.ts` (new)
- `POST /api/admin/settle-worldcup`
- Auth: `x-admin-key` vs `ADMIN_SETTLEMENT_KEY`
- Body: `{ predictionKey, correctValues[] }`
- Fetches all `status='pending'` rows for predictionKey
- Settles each via `settleWCPrediction`
- Returns: `{ predictionKey, correctValues, totalPredictions, winners, losers, totalXPAwarded, duplicates, errors }`
- Idempotent: only pending rows processed; xp_events unique constraint prevents double XP

## World Cup Settlement Admin UI

### `src/app/admin/settlement/page.tsx` (updated)
- `WCSettlementForm` card added after Daily XI Batch card
- `predictionKey` text input (e.g. `wc-champion`)
- `correctValuesRaw` comma-separated text input (e.g. `Brazil` or `Brazil, Argentina`)
- Parsed correct values displayed as real-time pill tags
- "Settle World Cup Prediction" button calls `POST /api/admin/settle-worldcup` with verified admin key from gate
- Warning: "This awards World Cup XP and updates leaderboard stats."
- `WCSettleResultCard`: total predictions / winners / losers / XP / duplicates grid, error list, raw JSON toggle
- `Globe` icon added to lucide-react imports
- No public UI changes

## Build
- Build passed clean — TypeScript and all 30 pages compiled successfully
- `/api/admin/settle-worldcup` registered as dynamic route (`ƒ`)
