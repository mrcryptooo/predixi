# Auto Settlement UI — Checkpoint

## Status
Auto Settlement UI added to /admin/settlement. Manual settlement UI preserved.

## What Changed

### Updated Page
- Updated: `src/app/admin/settlement/page.tsx`
- No backend changes

### New Components
- `AutoSettleForm` — auto settlement controls card
- `AutoResultCard` — result display for both dry run and real run

### Auto Settlement Card
- Placed below manual settlement card inside `SettlementForm`
- Limit number input (default 10, min 1, max 100)
- Dry Run button (primary/blue) — safe, no writes
- Run Auto Settlement button (danger/red) — writes XP and leaderboard stats
- Inline safety note: "Dry Run is safe. Real Auto Settlement writes XP and leaderboard stats."

### Dry Run Result
- Shows candidate finished matches ready to settle
- Per match: homeTeam vs awayTeam, score, inferredResult, unsettledPredictionCount, matchId
- Empty state: "No finished matches with unsettled predictions found."
- Collapsible raw JSON response

### Real Run Result
- Shows settlement summary grid:
  - Matches scanned
  - Matches settled
  - Predictions settled
  - Correct predictions
  - Total XP awarded
- Error list if any settlement errors occurred
- Collapsible raw JSON response

### Security
- Uses verified admin key from existing Admin Gate via prop
- No second key input required
- Admin key not stored in localStorage, sessionStorage, or URL
- Key used only in fetch header, never logged

## Build
- ✅ Passed — 0 errors · 24 routes

## Ready
Ready for production deploy.
