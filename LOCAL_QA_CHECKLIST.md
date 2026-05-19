# Local QA Checklist — PrediXI MVP

Run through this before any Vercel deploy.

---

## 1. Wallet Connection
- [ ] Connect Base Account via wallet modal
- [ ] Disconnect wallet — UI reverts to guest/connect state

---

## 2. Prediction Flow
- [ ] Select a match outcome and submit prediction
- [ ] Wallet prompts for signature — accept it
- [ ] Confirm Supabase `predictions` row inserted with correct `match_id`, `outcome`, `profile_id`
- [ ] Reject signature — confirm no lock trap (pick stays selectable, no error stuck)
- [ ] Confirm no Supabase row inserted after rejection

---

## 3. Security
- [ ] `POST /api/predictions` without signature returns 401
- [ ] No `predictions` row in Supabase for unsigned request
- [ ] `POST /api/settle-match` without `x-admin-secret` returns 401

---

## 4. Profile Page
- [ ] Disconnected: "Connect wallet" state shows (no mock user)
- [ ] Connected: real wallet address, XP, streak, accuracy, rank load from Supabase
- [ ] Prediction history shows settled and pending predictions
- [ ] After settlement: XP on profile reflects awarded points

---

## 5. Home Page
- [ ] Connected: real XP, streak, accuracy shown in hero and stat tiles
- [ ] Disconnected: "Connect wallet" prompt shown — mock usr-001 does NOT appear

---

## 6. Leaderboard Page
- [ ] Real Supabase profiles load (not mock data)
- [ ] Connected wallet highlighted with "YOU" badge
- [ ] XP values reflect post-settlement state

---

## 7. Badges
- [ ] Badge cards render with rarity-correct glow and styling
- [ ] `supabase/seed-badges.sql` file exists
- [ ] If `seed-badges.sql` was run in Supabase SQL Editor: badges table has 19 rows

---

## 8. Settlement
- [ ] `SETTLEMENT_ADMIN_SECRET` set in `.env.local`
- [ ] `POST /api/settle-match` with correct secret and valid body returns 200
- [ ] Correct prediction: `is_correct = true`, `points_awarded = 10`, profile `xp += 10`
- [ ] Re-running same match settlement returns 409 `alreadySettled: true`
- [ ] Profile XP does not change on retry

---

## 9. Build
- [ ] `npm run build` passes with no TypeScript errors
- [ ] All routes listed: `/api/leaderboard`, `/api/predictions`, `/api/profiles`, `/api/settle-match`

---

## 10. Vercel Deploy Readiness
- [ ] Do NOT deploy until all env vars are confirmed in Vercel dashboard
- [ ] Required Vercel env vars:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SETTLEMENT_ADMIN_SECRET`
  - `NEXT_PUBLIC_BASE_BUILDER_CODE` *(optional)*
- [ ] `HTTPS_PROXY` — do NOT set on Vercel (proxy is local Windows dev only)
- [ ] Supabase RLS policies allow service role writes
- [ ] `seed-badges.sql` has been run in Supabase SQL Editor
