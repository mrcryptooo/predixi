# Sync Results Admin UI — Checkpoint

## Status
Sync Results UI added to /admin/settlement.

## Preserved
- Admin Gate preserved — key verification unchanged
- Manual Settlement UI preserved — settle-match form unchanged
- Auto Settlement UI preserved — dry run and real run unchanged

## New: Sync Results Card
- Added above Auto Settlement card
- Single "Sync Results" button
- Calls `POST /api/admin/sync-results` with `x-admin-key` header (verified key from gate)
- Loading state during request
- Error state on network failure

## Result Summary Displayed
- scanned — matches queried from DB
- apiCallsUsed — external API calls consumed
- updated — matches with changed status/score written to DB
- skipped — matches with no change or unknown prefix
- errors — count + individual error messages
- updatedMatches — list of changed matches with homeTeam, awayTeam, score, status, outcome
- Raw JSON response — collapsed by default, expandable via toggle

## Safety Note
"Sync Results only updates match scores and status. It does not award XP. Run Auto Settlement after syncing."

## Security
- Admin key passed as `x-admin-key` header on every request
- Key stored only in React state — never in localStorage, sessionStorage, or cookies
- Cleared on lock or page reload

## Build
- Build passed clean — TypeScript and all 26 pages compiled successfully
- `/admin/settlement` registered as static page (client component, no server data)
