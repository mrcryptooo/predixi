# DAILY_FIXTURES_SYNC_CHECKPOINT

## Batch Summary
Daily Fixtures Sync foundation added. Upcoming fixtures upserted from football APIs into matches table. Build passed clean.

---

## Changes Included

### Daily Fixtures Sync Foundation Added
- Automated fetch and upsert of upcoming football fixtures for today + next 7 days
- Designed for daily use within free-tier API quotas
- No settlement logic touched, no old matches deleted, no scoring changes

### New Admin Route
- File: `src/app/api/admin/sync-fixtures/route.ts`
- Method: POST
- Auth: `x-admin-key` header vs `ADMIN_SETTLEMENT_KEY` env var
- Tries `FOOTBALL_DATA_TOKEN` first, then `API_FOOTBALL_KEY` as supplement/fallback
- Returns: `{ apiCallsUsed, inserted, updated, skipped, errors, sources, dateFrom, dateTo }`

### New Cron Route
- File: `src/app/api/cron/sync-fixtures/route.ts`
- Method: GET
- Auth: `Authorization: Bearer CRON_SECRET`
- Identical sync logic to admin route
- Gracefully no-ops if no API key is configured (logs warning, returns success — never crashes cron)

### Fetches Today + Next 7 Days
- Date window: today (UTC) through today + 7 days
- Competitions synced: PL, PD, BL1, SA, FL1, CL
- football-data.org: one request per competition code
- api-football: one request per league ID (39, 140, 78, 135, 61, 2) with season 2025

### Supports FOOTBALL_DATA_TOKEN and API_FOOTBALL_KEY
- `FOOTBALL_DATA_TOKEN` → football-data.org `/v4/competitions/{code}/matches`
- `API_FOOTBALL_KEY` → api-football `/fixtures?league={id}&season={year}&from=...&to=...`
- Both can run in the same request (sources reported separately)
- Rate limit (429) handled per-competition — one failure does not abort others

### Upserts by External ID fd- or apf-
- football-data.org matches: `fd-{match.id}`
- api-football fixtures: `apf-{fixture.id}`
- Upsert on conflict `id` — no duplicate rows
- Existing row fetched before upsert to check settled outcome

### Preserves Settled actual_outcome
- Before each upsert, existing row is fetched from Supabase
- If `actual_outcome` is already set on the existing row, it is carried forward into the upsert
- Incoming API data never overwrites a settled outcome

### Does Not Delete Old Matches
- No DELETE or truncate operations anywhere in sync logic
- Only INSERT (new) or UPDATE (existing) via upsert

### Does Not Run Settlement
- No XP awarded, no predictions updated, no profiles modified
- Sync is data-fetch only — settlement remains a separate admin/cron action

### Vercel Cron Added at 00:30 UTC Daily
- File updated: `vercel.json`
- Schedule: `"30 0 * * *"` — 00:30 UTC every day
- Total crons now: 3
  - `/api/cron/auto-settle`   — every 15 minutes
  - `/api/cron/score-daily-xi` — 02:00 UTC daily
  - `/api/cron/sync-fixtures`  — 00:30 UTC daily

---

## Build Status
- `npm run build` passed clean
- TypeScript: no errors
- Pages: 33/33 generated (2 new routes added)
- All routes compiled successfully
