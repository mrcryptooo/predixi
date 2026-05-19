# Settlement Checkpoint

## What was done

1. **`/api/settle-match` created** — admin-only POST route that settles a match by matchId and actualOutcome.

2. **Auth** — requires `x-admin-secret` header matching `SETTLEMENT_ADMIN_SECRET` env var. Missing env var → 500. Wrong secret → 401.

3. **Correct prediction** — awards 10 XP, sets `is_correct = true`, `points_awarded = 10`.

4. **Wrong prediction** — awards 0 XP, sets `is_correct = false`, `points_awarded = 0`.

5. **Test** — settled `sa-001` with `actualOutcome: "H"`. 1 unsettled prediction existed (outcome: H).

6. **Test result** — `{ settled: 1, correct: 1, xpAwarded: 10 }`.

7. **Profile XP** — updated from 0 → 10. `correct_predictions: 1`, `total_predictions: 1`, `rank: bronze`.

8. **predictions table** — `is_correct = true`, `points_awarded = 10` confirmed via direct Supabase query.

9. **matches table** — `actual_outcome = "H"` confirmed via direct Supabase query.

10. **Idempotency** — re-running same settlement returned `409 alreadySettled: true`. Profile XP stayed at 10. No double award.

11. **Build** — passed (Next.js 16.2.5, `/api/settle-match` listed as dynamic route).

## Files changed

- `src/app/api/settle-match/route.ts` — new settlement route
- `.env.example` — added `SETTLEMENT_ADMIN_SECRET=` placeholder
- `.env.local` — added local test value for `SETTLEMENT_ADMIN_SECRET`

## Next recommended task

Profile, Home, and Leaderboard pages already read live Supabase data — settled XP is reflected automatically on next page load. No immediate UI changes needed. Future tasks: settle remaining test matches (sa-002, l1-001), then consider a simple admin settlement UI or CLI script for ongoing match management.
