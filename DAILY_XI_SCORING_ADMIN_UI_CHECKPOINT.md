# Daily XI Scoring Admin UI — Checkpoint

## Status
Daily XI Scoring Admin UI added to /admin/settlement.

## Location
- Page: `/admin/settlement`
- Visible after admin key is verified through existing gate
- Position: below Auto Settlement card

## Inputs
- Wallet address — text input for target wallet (0x…)
- Entry date — text input defaulting to today (YYYY-MM-DD)
- Player stats editor — dynamic rows, one per player

## Player Stats Editor
- "Add Player" button appends a new blank row
- Each row contains:
  - playerId (text)
  - goals, assists, yellowCards, redCards (number inputs)
  - rating (decimal number, 0–10)
  - played checkbox (default checked)
  - cleanSheet checkbox
  - Trash icon remove button per row
- Compact dark glass card layout, mobile-friendly grid

## API Call
- Endpoint: `POST /api/admin/score-daily-xi`
- Header: `x-admin-key` set to verified admin key from gate
- Body: `{ walletAddress, entryDate, playerStats[] }`

## Result Summary
- Success: green "Scored — N XP awarded" with per-player XP breakdown list
- Already scored: amber warning with existing XP total, no changes made
- xpDuplicate notice if XP event already existed
- Error state: red with error message
- Raw JSON response collapsible toggle on all result states

## Security
- Uses verified admin key from existing gate — passed as header only
- Admin key not stored in localStorage, sessionStorage, or any persistent state
- Key lives in React state only, cleared on lock or page reload
- Warning text displayed: "This action awards Daily XI XP and updates leaderboard stats"

## Build
- Build passed clean — TypeScript and all 27 pages compiled successfully
- `/admin/settlement` remains static page (client component)
