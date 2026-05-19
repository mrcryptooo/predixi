# Profile Page Checkpoint

## What was done

1. **Profile page uses connected wallet data** — real XP, rank, streak, accuracy, and prediction counts fetched from Supabase via `/api/profiles`.
2. **Disconnected wallet state** — `NotConnected` component renders when no wallet is connected.
3. **Prediction history loads from Supabase** — `/api/predictions` returns rows; `toHistoryEntry()` enriches them with match/league data from mock data files.
4. **Root cause of empty history bug** — `Promise.all` with a single `.catch(() => {})` silently swallowed any fetch or parse error, preventing both `setProfile` and `setPredictions` from being called. Fixed by splitting into two independent fetch chains, each with its own `.catch` and a shared counter-based `finish()` for loading state.
5. **Build** — passed (Next.js 16.2.5, no TypeScript errors, 10 static pages + 2 dynamic API routes).
6. **Manual test** — passed. Connected wallet shows real stats and prediction history. Disconnected wallet shows connect prompt.

## Files changed

- `src/app/profile/page.tsx` — full rewrite; real API fetches, synthetic user, independent fetch pattern
- `src/app/api/profiles/route.ts` — new; GET profile by wallet address
- `src/components/profile/ProfileHeader.tsx` — added `address` prop, real wallet display
- `src/components/profile/StatsBar.tsx` — `globalRank > 0` guard to prevent showing `#0`

## Next recommended task

Connect Home page stats to real profile data — show connected wallet's XP, rank, and streak in the home hero/stats section instead of hardcoded mock values.
