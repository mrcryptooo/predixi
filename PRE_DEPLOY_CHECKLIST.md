# Pre-Deploy Checklist — PrediXI MVP

## Build Status
✅ `npm run build` — passed (Next.js 16.2.5, no TypeScript errors)

Routes confirmed:
- `○ /` `/leaderboard` `/matches` `/profile` `/world-cup` — static
- `ƒ /api/leaderboard` `/api/predictions` `/api/profiles` `/api/settle-match` — dynamic

---

## Required Vercel Environment Variables

Set these in Vercel Dashboard → Project → Settings → Environment Variables.

| Variable | Scope | Required | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | ✅ Yes | Safe to expose |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | ✅ Yes | Safe to expose (anon) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | ✅ Yes | **Never prefix with NEXT_PUBLIC_** |
| `SETTLEMENT_ADMIN_SECRET` | Server only | ✅ Yes | **Never prefix with NEXT_PUBLIC_** |
| `NEXT_PUBLIC_BASE_BUILDER_CODE` | Client + Server | Optional | Builder Code attribution |

---

## Local-Only Variables — Do NOT Set on Vercel

| Variable | Reason |
|---|---|
| `HTTPS_PROXY` | Windows dev proxy only (nekobox/v2ray). Vercel has direct internet access. Setting this on Vercel will break Supabase calls. |

The proxy code in `server.ts` safely no-ops when `HTTPS_PROXY` is unset — no code changes needed.

---

## Security Verification

- ✅ `SUPABASE_SERVICE_ROLE_KEY` — no `NEXT_PUBLIC_` prefix; used only in `server.ts` and API routes
- ✅ `SETTLEMENT_ADMIN_SECRET` — no `NEXT_PUBLIC_` prefix; used only in `/api/settle-match/route.ts`
- ✅ `HTTPS_PROXY` — server-only, not in client bundle
- ✅ Client code uses only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon key, safe)
- ✅ No secrets found in `src/` client components

---

## Checkpoint Files Present

- ✅ `PHASE_4_CHECKPOINT.md` — proxy + ERC-6492 signature verification
- ✅ `PROFILE_CHECKPOINT.md` — profile page real Supabase data
- ✅ `HOME_CHECKPOINT.md` — home page real wallet stats
- ✅ `BADGES_CHECKPOINT.md` — badge UI redesign + seed SQL
- ✅ `LEADERBOARD_CHECKPOINT.md` — leaderboard real Supabase data
- ✅ `SETTLEMENT_CHECKPOINT.md` — XP settlement API + idempotency test

---

## Post-Deploy Smoke Tests

Run immediately after first deploy:

1. **Home page loads** — no crash, no blank screen
2. **Connect wallet** — Base Account connects on Vercel URL
3. **Profile page** — real XP/stats show after connect
4. **Place prediction** — signature prompt appears, Supabase row inserted
5. **Leaderboard** — real profiles load
6. **Settlement test** (staging only) — `POST /api/settle-match` with correct `x-admin-secret` returns 200
7. **Re-settle same match** — returns 409

---

## Final Recommendation

**✅ Ready for Vercel deploy** — pending confirmation that all 4 required env vars are set in Vercel dashboard.

Do not deploy if:
- `SUPABASE_SERVICE_ROLE_KEY` is missing or wrong → all API routes will fail silently
- `SETTLEMENT_ADMIN_SECRET` is missing → settlement route returns 500
- `HTTPS_PROXY` is accidentally set → Supabase calls will fail on Vercel
