# Player Stats Provider Foundation — Checkpoint

## Status
Player Stats Provider foundation created.

## New Files

### `src/lib/player-stats-provider.ts`
- `PlayerStatsProvider` interface: `name` + `fetchStats(playerIds, date)`
- `MockPlayerStatsProvider` — deterministic stats per `playerId::date` seed
- Mock stats use djb2 hash (no Math.random) — same playerId + date always produces same output
- Weighted distributions: goals 65/28/7%, assists 60/32/8%, rating 5.5–8.5 bell-curved via double-hash, played 90%, cleanSheet 28%, yellowCards 14%, redCards 3%
- `getPlayerStatsProvider()` factory — returns mock now, ready for env var switch to real API
- `fetchStatsForPlayers(playerIds, date, provider?)` convenience wrapper

### `src/app/api/admin/daily-xi-stats-preview/route.ts`
- `POST /api/admin/daily-xi-stats-preview`
- Auth: `x-admin-key` header vs `ADMIN_SETTLEMENT_KEY` env var
- Body: `{ walletAddress, entryDate }`
- Fetches `daily_xi_entries` by wallet + date
- Extracts player IDs from `entry.players` jsonb array
- Fetches mock stats via provider
- Calculates projected score using existing `calculateDailyXIScore` helper
- Returns: `{ stats, totalXp, playerBreakdown, providerName, entryId, entryStatus }`
- Does NOT write to DB
- Does NOT create `xp_events`
- Preview only

## Updated Files

### `src/app/admin/settlement/page.tsx`
- Added `Eye` icon import
- Added `StatsPreviewResponse` type
- `DailyXIScoringForm` updated:
  - `previewLoading` + `previewXp` state added
  - `canPreview` guard: requires wallet + date, disabled during any loading
  - `handlePreview` calls preview API and populates player rows with returned stats
  - "Preview Mock Stats" button added to player stats header row
  - Sky-blue preview XP badge shown below player list after preview
  - Manual editing of rows still works after preview
  - Score Daily XI button still uses current rows (no change to scoring flow)

## Build
- Build passed clean — TypeScript and all 28 pages compiled successfully
- `/api/admin/daily-xi-stats-preview` registered as dynamic route (`ƒ`)
