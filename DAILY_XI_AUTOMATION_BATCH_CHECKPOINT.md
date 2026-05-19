# Daily XI Automation & Batch — Checkpoint

## Status
Daily XI auto-score admin flow, cron foundation, and batch admin control completed.

## Daily XI Auto-Score Admin Flow

### `src/app/admin/settlement/page.tsx`
- Added "Preview + Score Daily XI" button (`Wand2` icon) to `DailyXIScoringForm`
- One-click flow: calls `/api/admin/daily-xi-stats-preview` → populates player rows → immediately calls `/api/admin/score-daily-xi` with returned stats
- Warning: "This will generate mock stats and immediately award Daily XI XP."
- `autoLoading` state disables all three buttons (Preview, Score, Preview+Score) during any operation
- Existing separate Preview and Score buttons unchanged

## Auto Daily XI Scoring Cron

### `src/app/api/cron/score-daily-xi/route.ts` (new)
- `GET /api/cron/score-daily-xi`
- Auth: `Authorization: Bearer CRON_SECRET`; returns 401 if invalid, 500 if env var missing
- Queries `daily_xi_entries` where `status IN ('pending', 'locked')` AND `entry_date <= today` (future dates never scored)
- Ordered by entry_date ascending, limit 25
- Per entry: extracts player IDs from `players` jsonb → fetches mock stats via `fetchStatsForPlayers` → scores with `calculateDailyXIScore` → updates `daily_xi_entries` (status=scored, earned_xp) → inserts `xp_events` (duplicate-safe, 23505 check) → increments `leaderboard_stats` all_time + weekly XP
- Returns: `{ scanned, scoredEntries, totalXPAwarded, skipped, errors }`
- Idempotent: already-scored entries skipped; xp_events unique constraint prevents double XP
- Mock provider only — no paid API

### `vercel.json` (updated)
- Added cron: `{ "path": "/api/cron/score-daily-xi", "schedule": "0 2 * * *" }`
- Fires daily at 02:00 UTC

## Daily XI Batch Score Admin Control

### `src/app/admin/settlement/page.tsx`
- Added `DailyXIBatchForm` card: "Daily XI Auto-Score Batch"
- Password input for cron secret (React state only — never stored anywhere)
- "Run Daily XI Batch Score" button calls `GET /api/cron/score-daily-xi` with `Authorization: Bearer <secret>`
- Result card: scanned / scored entries / total XP / skipped grid + error list + raw JSON toggle
- Warning: "This scores all pending Daily XI entries up to the batch limit."
- No limit input — route hardcodes 25
- Card placed after Daily XI Scoring card in admin page

## Safety
- Cron secret lives in React state only — cleared on unmount / page reload
- No localStorage or sessionStorage writes
- No public UI changes
- No paid API — mock provider only
- xp_events duplicate safety preserved (23505 unique constraint)
- leaderboard_stats XP update preserved (XP only, prediction counts untouched)

## Build
- Build passed clean — TypeScript and all 29 pages compiled successfully
- `/api/cron/score-daily-xi` registered as dynamic route (`ƒ`)
