# SECURITY_ONCHAIN_SEASON_BATCH_CHECKPOINT

## Batch Summary
Security, Onchain, and Season/Rank foundation batch. No app logic broken. Build passed clean.

---

## Changes Included

### Wallet Signature Verification Foundation
- Added `src/lib/auth/wallet-signature.ts`
- Exports: `normalizeWalletAddress`, `isValidWalletAddress`, `buildPredixiAuthMessage`, `generateNonce`, `verifyWalletSignature`, `verifyOptionalWalletAuth`
- `verifyWalletSignature` uses viem `verifyMessage` (EOA support, never throws)
- `verifyOptionalWalletAuth` reads `x-wallet-signature` + `x-wallet-message` headers; returns `{ checked: false }` if absent, logs warning if checked and failed

### Nonce API Added
- Route: `GET /api/auth/nonce?wallet=0x...&action=<action>`
- Returns: `{ success, nonce, message, wallet, action, expiresInMs: 600000 }`
- Stateless — no DB writes

### Optional Wallet Auth Wired to WC / Daily XI Writes
- `POST /api/wc-predictions` — calls `verifyOptionalWalletAuth` with action `'wc-prediction'`; returns `walletAuth` in response
- `POST /api/daily-xi` — calls `verifyOptionalWalletAuth` with action `'daily-xi'`; returns `walletAuth` in response
- Auth is optional (not enforced); Phase 2 TODO comments in place for future rejection

### Match Predictions Return walletAuth Verified Metadata
- `POST /api/predictions` already enforces mandatory signature verification (Phase 4D)
- Response now includes `walletAuth: { checked: true, verified: true }` for consistency

### Onchain Commitment Foundation Added
- Added `src/lib/onchain/commitment.ts`
- Exports: `hashCommitment`, `createPredictionCommitment`, `createDailyXICommitment`, `createWCCommitment`
- Type: `CommitmentResult: { payload: Record<string, unknown>, commitmentHash: string }`

### Deterministic Commitment Hashing Added
- `hashCommitment` uses viem `keccak256(toBytes(deterministicStringify(payload)))`
- `deterministicStringify` recursively sorts object keys — insertion order never affects hash

### commitmentHash Returned for All Three Write Routes
- `POST /api/predictions` — includes `commitmentHash` from `createPredictionCommitment`
- `POST /api/wc-predictions` — includes `commitmentHash` from `createWCCommitment`
- `POST /api/daily-xi` — includes `commitmentHash` from `createDailyXICommitment`
- Phase 1: computed server-side and returned in response only (no DB write yet)

### Onchain Client Placeholder Added
- Added `src/lib/onchain/client.ts`
- Exports: `submitCommitmentToBase`, `getCommitmentStatus`
- Both return `{ status: 'not-implemented', ... }` — Phase 3 stubs
- Phase 3 TODO comments reference contract address env vars

### Additive Onchain Metadata Migration Created
- File: `supabase/add-onchain-metadata.sql`
- Adds `commitment_hash text null` to: `predictions`, `wc_predictions`, `daily_xi_entries`
- Adds `submitted_onchain boolean default false`, `tx_hash text null` to: `predictions`, `wc_predictions`
- All via `ADD COLUMN IF NOT EXISTS` — safe to re-run
- Partial indexes on `commitment_hash WHERE NOT NULL` for all three tables

### Season Helper Added
- Added `src/lib/seasons.ts`
- Exports: `buildSeasonId(date)` → `"YYYY-S1"` / `"YYYY-S2"` (S1=Jan–Jun, S2=Jul–Dec)
- Exports: `buildWeeklyPeriod(date)` → `"YYYY-WNN"` (ISO 8601 week, zero-padded)
- Exports: `getCurrentSeason()` → current season ID
- Exports: `getCurrentWeekWindow()` → `{ weekId, start (Mon 00:00 UTC), end (Sun 23:59 UTC) }`
- Exports: `shouldResetWeeklyStats(lastUpdated)` → `true` if different ISO week than now
- ISO week year-aware (handles Jan 1 / Dec 31 edge cases correctly)

### Rank Helper Centralized
- Added `src/lib/ranks.ts` — single source of truth for rank tier definitions
- Exports: `RANK_TIERS`, `RankId`, `RankTier`, `RankProgress`
- Exports: `getRankFromXP(xp)`, `getNextRank(xp)`, `getRankProgress(xp)`, `computeRank(xp)`
- Thresholds: Bronze 0, Silver 100, Gold 300, Platinum 600, Diamond 1000, Legend 2000

### Settlement Rank Calculation Refactored to Shared Helper
- `src/lib/settlement.ts` — local inline `computeRank` body replaced with delegate to `computeRankFromXP` from `src/lib/ranks.ts`
- Public API unchanged — all existing callers unaffected

### Leaderboard API Includes Current Season/Week Metadata
- `GET /api/leaderboard` — all response paths now include `meta`:
  ```json
  { "currentSeason": "2026-S1", "currentWeek": "2026-W21", "weekStart": "...", "weekEnd": "..." }
  ```

### Profiles API Includes rankMetadata
- `GET /api/profiles` — both exists and not-exists responses include `rankMetadata`:
  ```json
  { "tier": "silver", "tierLabel": "Silver", "tierColor": "#c0c0c0", "tierEmoji": "🥈",
    "nextTier": "gold", "nextTierLabel": "Gold", "xpInTier": 45, "xpForTier": 200, "progressPct": 22 }
  ```

---

## Build Status
- `npm run build` passed clean
- TypeScript: no errors
- Pages: 31/31 generated
- All routes compiled successfully
