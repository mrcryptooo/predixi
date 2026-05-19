# Real Leaderboard + Profile XP — Checkpoint

## Status
Leaderboard and Profile XP connected to real Supabase backend data.

## Leaderboard API
- `/api/leaderboard` now supports `?period=all_time|weekly`
- Primary source: `leaderboard_stats` table (queried by period, ordered by xp desc)
- Fetches wallet_address, rank, streak from `profiles` by profile_id join
- Fallback for all_time: queries `profiles` directly if leaderboard_stats is empty
- Weekly tab returns empty array if no weekly stats exist yet
- Real `weeklyXp` now returned from `leaderboard_stats.weekly_xp`

## Leaderboard Page
- Period tab change triggers re-fetch from API with correct `period=` param
- Removed client-side sort by hardcoded `weeklyXp: 0`
- All-Time tab and Weekly tab each fetch real server data independently
- Empty state: "No ranked predictors yet" for all-time
- Empty state: "No weekly rankings yet" for weekly with contextual note

## Profile XP
- Total XP from `profiles.xp` via `/api/profiles` (updated by settlement)
- Accuracy, correct predictions, total predictions from real profile stats
- XP Ledger preview fetches from `/api/xp-events` via `fetchXPEvents`

## XP Ledger Preview
- Shows latest 5 XP events ordered by most recent
- Each event displays: reason, formatted date, source label, XP amount
- Positive XP highlighted in primary color
- Overflow count shown if more than 5 events exist
- Empty state: "No settled XP yet"
- Removed stale "Foundation phase · XP settlement coming" placeholder

## Safety
- All changes are read-only
- No settlement, admin, or XP mutation calls added
- No mock data added or promoted to production

## Build
- Build passed clean — TypeScript and all 26 pages compiled successfully
