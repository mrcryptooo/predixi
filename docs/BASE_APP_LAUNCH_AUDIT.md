# PrediXI — Base App Launch Audit

Audit date: 2026-05-20. Production deployment: https://predixi-base.vercel.app

---

## 1. Production-Ready Systems

The following systems are fully built, tested, and deployed. They do not block launch.

| System | Detail |
|---|---|
| **Kickoff locking** | Server-side only — no client trust. Predictions rejected at or after kickoff UTC. |
| **Wallet signature enforcement** | EIP-191 signatures verified on Base mainnet via `publicClient.verifyMessage`. Supports EOA, ERC-1271, ERC-6492 (Base Account / Coinbase Smart Wallet). |
| **Commitment hash pipeline** | Deterministic SHA-256 hashes stored atomically with every prediction. Tamper-evident audit trail without a live contract. |
| **Fixture sync** | Dual-provider (football-data.org + api-football). `validateFixture()` gates all upserts. Cron runs every 3 hours. `invalid` counter in sync response. |
| **Result settlement** | Match outcomes settled via admin trigger. XP awarded via `xp_events` insert. `is_correct` flag written atomically. Settled outcomes never overwritten. |
| **WC settlement pipeline** | World Cup prediction settlement idempotent. XP awarded per correct call. Status resolved to `correct`/`incorrect`. |
| **Leaderboard** | All-time and weekly XP rankings. Podium, full table, connected-wallet "Your Standing" card. Real-time data from Supabase. |
| **Activity feed** | Unified reverse-chronological timeline. Deduplicates match XP from raw events. Includes ProofBadge per prediction. |
| **Admin pipeline** | Health dashboard, cron monitor, manual sync/settle triggers — all protected by `x-admin-key`. |
| **Mobile UX** | Tap highlight removed, touch-action, overscroll-contain, 44px hit areas, safe-area insets, select-none, skeleton loading, stagger caps. |
| **Base App webview** | Visibility-change reconnect, explicit wagmi reconnect on mount, `viewport-fit=cover`, `apple-mobile-web-app-capable`. |
| **Reduced-motion** | `MotionConfig reducedMotion="user"` globally + CSS `prefers-reduced-motion` media query. |
| **Web manifest** | `src/app/manifest.ts` auto-generates `/site.webmanifest`. PWA-installable. |
| **OG / social metadata** | Open Graph and Twitter card tags in layout. Apple mobile web app meta tags. |
| **Security hardening** | Input length limits on all POST routes. `xpAmount` range guard. `selectedValue` type/length guards. `matchId` length guard. |

---

## 2. Beta-Grade Systems

These work but have known limitations acceptable for beta launch.

| System | Limitation | Risk |
|---|---|---|
| **xp-events POST auth** | No wallet signature required. Any caller with a known wallet address can POST XP events with novel `sourceId` values. Unique constraint prevents exact replay but not new fabricated events. | Medium — inflated XP possible but exploiter needs target wallet address |
| **Rate limiting** | No per-IP or per-wallet throttle. Vercel edge DDoS protection only. | Medium at scale — low risk for beta user volumes |
| **Commitment hashes** | SHA-256 only, stored offchain. No live contract. `submitted_onchain: false` for all rows. | Low for beta — provability exists via DB audit; onchain not promised yet |
| **Leaderboard identity** | Truncated wallet addresses only. No Base Account username resolution. | Low — cosmetic; users can identify themselves by address |
| **Match data freshness** | Relies on football-data.org API (free tier). Fixture sync may lag during high-traffic periods. | Low-Medium — cron runs every 3 hours; manual admin trigger available |
| **pointsAwarded from client** | Predictions POST accepts `pointsAwarded` from request body (clamped to ≥0). Not used for XP calculation but stored in DB. | Low — field is cosmetic in current flow |
| **No privacy/support pages** | `/privacy` and `/support` routes return 404. Required for Base App submission. | High for submission — not a runtime issue |

---

## 3. Blocks Official Base App Launch

The following must be resolved before submitting to the Base App store:

| Blocker | Action Required |
|---|---|
| **No privacy policy page** | Create `/app/privacy/page.tsx` with real policy text covering: data collected (wallet address, predictions), no PII beyond wallet, no data selling, GDPR/CCPA basics |
| **No support page** | Create `/app/support/page.tsx` with contact email and FAQ |
| **Missing OG image** | Create `/public/brand/og-image.png` at 1200×630 px — required for social sharing and store listing |
| **Missing favicon** | Create `/public/favicon.ico` at 32×32 px |
| **Missing apple-touch-icon** | Create `/public/apple-touch-icon.png` at 180×180 px |
| **App icon verification** | Verify `/public/brand/predixi-logo.png` is ≥512×512 px; resize if needed |
| **"No gambling" copy** | Add explicit "XP only, no real money" copy on landing page and in store description |
| **Store listing text** | Write final short + long descriptions (see `BASE_APP_SUBMISSION_CHECKLIST.md`) |

---

## 4. Post-Launch Monitoring

Monitor these signals in the first 48–72 hours after launch:

| Signal | Where | Threshold |
|---|---|---|
| Prediction submission errors | Vercel → Functions logs for `POST /api/predictions` | Any `401` spike > 5% of requests |
| Signature verification failures | Same logs, look for `verifyMessage error` | Any repeated pattern suggests client-side issue |
| Fixture sync health | `/api/admin/health` → `fixtureSync.lastRunAgo` | Alert if > 6 hours since last successful sync |
| `invalid` count in sync response | Cron logs in Supabase `cron_logs` | Alert if `invalid > 10` per run (stale data from provider) |
| xp_events row growth | Supabase `xp_events` table count | Unusual spikes may indicate abuse of unauthenticated POST |
| Leaderboard correctness | `/leaderboard` — verify top entries reflect real predictions | Manual spot-check after first settlement run |
| WC predictions settlement | Admin dashboard after WC match results | Verify XP awarded matches correct predictions |

---

## 5. Known Limitations

- **No onchain contract deployed.** All commitments are offchain SHA-256 hashes. The "onchain proof" feature is architectural groundwork — no transactions are broadcast.
- **No rate limiting.** A single IP can submit many requests. Vercel edge DDoS protection provides a floor, but dedicated rate limiting (Upstash Redis) is not implemented.
- **No push notifications.** Settlement events do not notify users. Users must check the app.
- **No username resolution.** Leaderboard shows truncated `0x...` addresses, not Base Account usernames.
- **Weekly leaderboard resets manually.** No automated weekly XP reset cron. Must be triggered by admin.
- **Football data is pull-only.** No webhook from football providers. Data is only as fresh as the last sync run.

---

## 6. Future Roadmap After Base Launch

### Phase 2 — Anti-abuse + scale
- Move XP settlement fully server-side (cron/sync writes `xp_events` directly; remove unauthenticated POST or gate with admin key)
- Per-route rate limiting via Upstash Redis
- Remove `pointsAwarded` from predictions POST body
- Weekly XP reset cron job

### Phase 3 — Identity + social
- Base Account username resolution on leaderboard and profile
- Farcaster share actions (share prediction, celebrate win)
- Friend challenges / prediction duels

### Phase 4 — Onchain
- Smart contract deployment on Base
- Batch commitment hash submission with merkle root
- On-chain settlement verification
- Random salt added to commitment inputs before contract write

### Phase 5 — Advanced
- Push notifications for prediction settlement
- Multiple sport categories beyond football
- Staking/skin-in-the-game layer on top of XP
- DAO governance for league selection and scoring rules
