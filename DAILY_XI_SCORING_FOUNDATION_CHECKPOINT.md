# Daily XI Scoring Foundation — Checkpoint

## Status
Daily XI scoring foundation created.

## New Files

### `src/lib/daily-xi-scoring.ts`
- `calculatePlayerScore(stats)` — scores one player from raw stats
- `calculateDailyXIScore(playersWithStats)` — scores full XI, returns totalXp + playerBreakdown[]
- Scoring rules:
  - goal: +3
  - assist: +2
  - cleanSheet: +2
  - rating >= 8: +2
  - rating >= 7: +1
  - yellowCard: -1
  - redCard: -3
  - played: +1
  - floor per player at 0 XP (no negative per player)

### `src/app/api/admin/score-daily-xi/route.ts`
- `POST /api/admin/score-daily-xi`
- Auth: `x-admin-key` header vs `ADMIN_SETTLEMENT_KEY` env var
- Body: `{ walletAddress, entryDate, playerStats[] }`
- Fetches `daily_xi_entries` by wallet + date
- Calculates score using scoring helper
- Updates entry: `status='scored'`, `earned_xp=totalXp`
- Inserts into `xp_events`: `source_type='daily_xi'`, `reason='daily_xi_scored'`, `metadata` includes player breakdown
- Increments `leaderboard_stats` XP for all_time + weekly (prediction counts untouched)
- Idempotent: re-running on already-scored entry returns existing result, no duplicate writes
- Duplicate-safe: xp_events unique constraint (23505) prevents double XP

## Updated Files

### `src/lib/daily-xi.ts`
- Added `DailyXIEntryMeta` type: `{ status, earnedXp, projectedMaxXp }`
- Added `fetchDailyXIEntryMeta(walletAddress, date?)` — fetches entry metadata without player slots

### `src/components/home/DailyXIPitch.tsx`
- Added optional props: `earnedXp?: number`, `status?: string`
- Scoring panel switches to green "Scored ✓" state when `status === 'scored'`
- Shows real earned XP in green with filled score bar proportional to earnedXp/20
- Pending state unchanged when status is not scored

### `src/components/home/DailyHeroes.tsx`
- Fetches entry meta via `fetchDailyXIEntryMeta` on wallet connect
- Passes `earnedXp` and `status` to `DailyXIPitch`

### `src/components/profile/DailyXIProfileCard.tsx`
- Fetches entry meta via `fetchDailyXIEntryMeta` on wallet connect
- Shows real `earnedXp` XP in green with "Scored" label when status is scored
- Fallback to "Score: 0 XP · Max 20 XP · Scored after matches" when pending

## Safety
- No settlement or match prediction logic touched
- No blockchain calls
- No public UI mutations — display only
- Scoring is admin-triggered only

## Build
- Build passed clean — TypeScript and all 27 pages compiled successfully
- `/api/admin/score-daily-xi` registered as dynamic route (`ƒ`)

## Next Step
- Real player stats ingestion (via football API or manual input)
- Automated Daily XI scoring triggered after match day ends
