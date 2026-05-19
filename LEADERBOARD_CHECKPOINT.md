# Leaderboard Checkpoint

## What was done

1. **Leaderboard uses `/api/leaderboard`** — static mock `leaderboard` array removed from page; data now fetched client-side via `useEffect` on mount.

2. **`/api/leaderboard` reads real Supabase profiles** — new server route at `src/app/api/leaderboard/route.ts` queries the `profiles` table using the service role client. Wallet address mapped to display name, avatar (⚡), flag (🌐), and initials. `weeklyXp` and `badgeIds` default to `0`/`[]` until those systems are built.

3. **Sorting** — `xp DESC`, `correct_predictions DESC`, `total_predictions DESC`. Limit 50 (configurable via `?limit=`).

4. **Connected wallet highlighted** — `myEntry` matched case-insensitively against `useAccount()` address. "YOU" badge, podium outline, and "Your Standing" card all work with real wallet data.

5. **Build** — passed (Next.js 16.2.5, `/api/leaderboard` listed as dynamic route).

6. **Manual test** — http://localhost:3000/leaderboard. Shows real profiles from Supabase. Loading state while fetching. Clean empty state if no profiles exist. Footer shows "Live Data" or "No Data Yet".

## Files changed

- `src/app/api/leaderboard/route.ts` — new API route
- `src/app/leaderboard/page.tsx` — full rewrite to real API data
- `src/components/leaderboard/LeaderboardTable.tsx` — case-insensitive userId match

## Next recommended task

Build match settlement and XP awarding system — when a match result is known, update `predictions.is_correct` and `points_awarded`, then update `profiles.xp`, `correct_predictions`, `total_predictions`, and `streak` accordingly.
