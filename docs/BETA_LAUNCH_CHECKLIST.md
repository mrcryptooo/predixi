# PrediXI Beta Launch Checklist

A step-by-step verification guide to run before and after deploying to Vercel production.

---

## 1. Environment Variables

Verify all required env vars are set in Vercel → Settings → Environment Variables for the **Production** environment.

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Public Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Public (anon) Supabase key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server-only service role key — never expose client-side |
| `ADMIN_API_KEY` | ✅ | Secret for `/api/admin/*` routes — generate with `openssl rand -hex 32` |
| `FOOTBALL_DATA_API_KEY` | ✅ | football-data.org v4 key |
| `API_FOOTBALL_KEY` | ⚠️ | api-football.com key (fallback provider; optional if FD covers all leagues) |
| `CRON_SECRET` | ✅ | Shared secret for Vercel cron route authentication |
| `HTTPS_PROXY` | ❌ | Local dev only (Windows proxy). Must NOT be set on Vercel. |

### Verification
```bash
# In Vercel CLI or dashboard, confirm no HTTPS_PROXY leak
vercel env ls --environment production
```

---

## 2. Database (Supabase)

- [ ] All migrations applied to production project
- [ ] `profiles` table has `wallet_address` unique constraint
- [ ] `predictions` table has `(profile_id, match_id)` unique constraint
- [ ] `xp_events` table has `(wallet_address, source_id)` unique constraint
- [ ] `wc_predictions` table has `(wallet_address, prediction_key)` unique constraint
- [ ] Row Level Security (RLS) enabled on all user-facing tables
- [ ] Service role key can bypass RLS (used by API routes)
- [ ] No public (anon) write access to `xp_events`, `predictions`, or `profiles`

---

## 3. Cron Job Verification

### Schedule (vercel.json)
```json
{
  "crons": [
    { "path": "/api/cron/sync-fixtures", "schedule": "0 */3 * * *" }
  ]
}
```

- [ ] `vercel.json` contains the cron definition
- [ ] `CRON_SECRET` matches the value checked inside `/api/cron/sync-fixtures/route.ts`
- [ ] First cron run logged in Vercel → Logs after deployment

### Manual trigger test
```bash
curl -X POST https://your-domain.vercel.app/api/admin/sync-fixtures \
  -H "x-admin-key: YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json"
```
Expected response: `{ "success": true, "upserted": N, "invalid": 0 }` (or small `invalid` count for stale data).

---

## 4. Fixture Sync Health Check

After first cron run (or manual trigger):

- [ ] `matches` table has rows with `status IN ('upcoming', 'live', 'finished')`
- [ ] All rows have non-null `kickoff` in valid ISO-8601 format
- [ ] `home_team_id` and `away_team_id` are populated
- [ ] No rows with `status = 'invalid'` (validateFixture caught garbage data)

```sql
-- Quick sanity query in Supabase SQL editor
SELECT status, COUNT(*) FROM matches GROUP BY status ORDER BY 1;
SELECT COUNT(*) FROM matches WHERE kickoff IS NULL;
SELECT COUNT(*) FROM matches WHERE home_team_id IS NULL OR away_team_id IS NULL;
```

---

## 5. Wallet Prediction Flow

Test end-to-end with a real wallet (not mock):

- [ ] Connect Base App / Coinbase Smart Wallet on Base mainnet
- [ ] Navigate to `/matches` — fixture list loads
- [ ] Click a match → PredictionModal opens
- [ ] Select an outcome (H / D / A)
- [ ] Wallet prompts for signature — sign it
- [ ] Prediction submitted: commitment hash returned in response
- [ ] Prediction appears in `/profile` → "Match Predictions" section
- [ ] Prediction appears in `/profile` → "Recent Activity" section
- [ ] After kickoff passes: prediction modal shows "Predictions locked"

### Signature replay test
- Submit same prediction twice within 10 minutes using cached signature → second call must return the existing prediction (upsert), not a new row.
- Submit with a signature older than 10 minutes → expect `401 Signature expired`.

---

## 6. Mobile / Base App

Test on a real device or Base App in-app browser:

- [ ] Bottom nav renders and navigates correctly
- [ ] No tap delay on nav items and cards (touch-action: manipulation applied)
- [ ] PredictionModal opens and is scrollable without body scroll leaking
- [ ] Modal close button is large enough to tap (44px hit area)
- [ ] iOS safe-area bottom padding applied (`h-safe-bottom` on BottomNav)
- [ ] Reduced-motion preference respected (test in iOS → Accessibility → Reduce Motion)
- [ ] No horizontal overflow / layout shifts on 375px viewport

---

## 7. Admin Routes

All `/api/admin/*` routes require the `x-admin-key` header.

- [ ] Requests without header return `401`
- [ ] Requests with wrong key return `401`
- [ ] `ADMIN_API_KEY` is not logged anywhere in console output
- [ ] Admin routes are not linked or discoverable from the client UI

```bash
# Should return 401
curl https://your-domain.vercel.app/api/admin/sync-fixtures

# Should return 401
curl -H "x-admin-key: wrong-key" https://your-domain.vercel.app/api/admin/sync-fixtures
```

---

## 8. Leaderboard

- [ ] `/leaderboard` loads with "All-Time" tab active
- [ ] Switching to "This Week" tab shows weekly XP (or empty state if no weekly data)
- [ ] Top 3 podium renders; positions 4+ in full rankings table
- [ ] Connected wallet's "Your Standing" card appears if wallet is ranked
- [ ] Skeleton loading shown on initial load (not blank flash)

---

## 9. World Cup 2026 Predictions

- [ ] `/world-cup` page loads prediction cards
- [ ] Submitting a prediction requires wallet signature (header-based)
- [ ] Duplicate submission returns `{ duplicate: false }` with updated `updatedAt`
- [ ] Commitment hash returned and stored in `wc_predictions.commitment_hash`

---

## 10. Rollback Procedure

If a critical issue is found post-deploy:

1. Vercel dashboard → Deployments → find last known-good deployment → **Promote to Production**
2. If DB migration caused the issue: restore Supabase from point-in-time backup (Settings → Backups)
3. Revert env var changes if any were part of the issue

---

## 11. Monitoring (Post-Launch)

### Error tracking
- Watch Vercel → Functions logs for `[POST /api/predictions]` errors
- Alert if `invalid` count in sync response grows unexpectedly (stale football data)

### Key metrics to watch (first 48 hours)
- Total predictions submitted (`predictions` table row count)
- Signature verification failure rate (`401` responses on POST /api/predictions)
- Cron success rate (check Vercel Cron Executions tab)
- `xp_events` row count growth — any unusual spikes may indicate abuse

---

## 12. Known Limitations (Beta)

- **No rate limiting**: API routes have no per-IP or per-wallet request throttling. A determined actor can hammer endpoints. Mitigation: Vercel's default DDoS protection applies; per-route rate limiting (e.g. Upstash Redis) is a post-beta priority.
- **xp-events POST unauthenticated**: Any caller with a valid wallet address can POST XP events with novel `sourceId` values. The unique constraint prevents duplicate `(wallet, sourceId)` pairs but not entirely novel ones. Full mitigation requires moving XP settlement server-side (triggered by result sync, not client calls).
- **No Base Account identity**: Leaderboard shows truncated wallet addresses. Base Account username resolution is planned for a future phase.
- **Mock data fallback**: If `getMatchById` returns a match, it seeds the DB from local mock data. Production match data relies on fixture sync being current.

---

## 13. Post-Launch Priorities (Phase 2)

1. Per-route rate limiting (Upstash Redis or Vercel KV)
2. Move XP settlement fully server-side (remove unauthenticated xp-events POST or add admin-key guard)
3. Base Account username resolution on leaderboard
4. On-chain batch commitment submission (smart contract deployment)
5. Weekly XP reset cron job
6. Push notifications for settled predictions
