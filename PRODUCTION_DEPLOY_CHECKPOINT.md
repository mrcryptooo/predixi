# Production Deploy Checkpoint

## Deploy

- **Status:** success
- **Production URL:** https://predixi-base.vercel.app
- **Platform:** Vercel (project: mrcrypto/predixi)
- **Deploy ID:** dpl_HPu62YDY2fQDNygaQnkYo2wtvmCp

---

## Production Tests Passed

- ✅ Home page loads — real wallet stats when connected, guest state when not
- ✅ Wallet connect — Base Account connects on production URL
- ✅ Accept signature prediction — signature prompt works, Supabase row inserted
- ✅ Reject signature flow — no lock trap, no Supabase row, prediction retryable
- ✅ Profile page — real XP, streak, accuracy, rank, prediction history from Supabase
- ✅ Leaderboard — real Supabase profiles, connected wallet highlighted
- ✅ No double-award on re-settlement (409 idempotency confirmed locally)

---

## Vercel Environment Variables Configured

- `NEXT_PUBLIC_SUPABASE_URL` — public
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public (anon)
- `SUPABASE_SERVICE_ROLE_KEY` — server only
- `SETTLEMENT_ADMIN_SECRET` — server only

Note: `HTTPS_PROXY` intentionally NOT set on Vercel (local Windows dev proxy only).

---

## Blocking Errors

None.

---

## Current MVP Status

PrediXI is live on Base Mainnet (Vercel production). Core prediction loop is complete:

- Wallet connect → sign prediction → Supabase write → XP settlement → leaderboard
- Profile, Home, and Leaderboard all show real Supabase data
- Manual settlement via `POST /api/settle-match` with admin secret
- Badge UI designed; seed SQL ready; badges not yet auto-awarded
- No blockchain transactions in this phase (on-chain is a future phase)

---

## Next Recommended Tasks

1. **Admin settlement UI** — simple internal page or script to settle matches without manual API calls
2. **Real football API integration** — auto-fetch match results (e.g. football-data.org) to trigger settlement
3. **Badge awarding logic** — auto-award badges on settlement based on streak/accuracy/volume thresholds
4. **Better XP/streak settlement** — implement streak tracking, underdog bonus, match multipliers (see XP_ECONOMY.md)
5. **On-chain prediction phase** — future phase; predictions recorded on Base as verifiable on-chain proof
