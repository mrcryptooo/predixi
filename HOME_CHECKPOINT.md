# Home Page Checkpoint

## What was done

1. **Mock usr-001 removed** — Home page no longer pulls `currentUser` from mock leaderboard data or displays it as the connected user's stats.
2. **Real profile stats** — When wallet is connected, `useAccount()` provides the address; `GET /api/profiles?walletAddress=` fetches live XP, streak, accuracy, rank, and prediction count from Supabase.
3. **Disconnected state** — Hero shows "Connect wallet to view your stats and predictions" with a shield icon. Stat tiles show `—` for accuracy, streak, and global rank.
4. **Build** — passed (Next.js 16.2.5, no TypeScript errors).
5. **Manual test** — passed. Connected wallet shows real stats. Disconnected shows guest prompt.

## Files changed

- `src/app/page.tsx` — removed `leaderboard` import and `currentUser`; added `useAccount`, `useEffect`, `ApiProfile` type, profile fetch; hero user row and stat tiles now use real data; footer shows connection state.

## Next recommended task

Connect leaderboard to real Supabase data — replace mock `leaderboard` array with live `/api/leaderboard` endpoint reading from the `profiles` table ordered by XP descending.
