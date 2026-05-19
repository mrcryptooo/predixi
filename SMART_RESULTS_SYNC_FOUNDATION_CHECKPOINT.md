# Smart Football Results Sync Foundation — Checkpoint

## Status
Smart Football Results Sync foundation created.

## New Admin Route
- **Path:** `/api/admin/sync-results`
- **Method:** POST
- **File:** `src/app/api/admin/sync-results/route.ts`

## Security
- Reuses `ADMIN_SETTLEMENT_KEY` via `x-admin-key` header
- No new environment variables required

## API Support
- `FOOTBALL_DATA_TOKEN` — used for matches with `fd-` ID prefix (football-data.org `GET /v4/matches/{id}`)
- `API_FOOTBALL_KEY` — used for matches with `apf-` ID prefix (api-football `GET /fixtures?id={id}`)
- Matches with unknown prefix are skipped with reason reported

## Candidate Selection
- Queries matches where status is not finished OR home_score/away_score is null
- Kickoff window: yesterday to tomorrow (UTC)
- Hard limit: 20 candidates per call

## API Behavior
- One targeted API call per candidate match (single-match endpoints, not competition-wide)
- Skips remaining matches if rate limit (429) is returned mid-run
- Skips unchanged rows (no DB write if status and scores already match)

## DB Updates
- Updates: `status`, `home_score`, `away_score`, `updated_at`
- Sets `actual_outcome` (`H`/`D`/`A`) only when status is finished and both scores are present
- No settlement logic inside this route

## Response Summary
Returns: `scanned`, `apiCallsUsed`, `updated`, `skipped`, `errors[]`, `updatedMatches[]`

## Integration
- Designed to feed the existing `/api/admin/auto-settle` and `/api/cron/auto-settle` routes
- Run sync first → then auto-settle picks up newly finished matches from DB

## Quota Safety
- Tight kickoff window protects against scanning stale or future matches
- Single-match API endpoints consume one quota unit per match, not per competition
- Rate-limit detection stops further API calls immediately
- Hard 20-match ceiling per invocation

## Build
- Build passed clean — TypeScript and all 26 pages compiled successfully
- `/api/admin/sync-results` registered as dynamic route (`ƒ`)

## Next Step
- Add admin UI controls for Sync Results on `/admin/settlement`
- Optionally cron sync-results to run before auto-settle (e.g. every 15 min, offset by a few minutes)
