# PrediXI — Real Base Transaction Flow (Migration Architecture)

**Status:** Step 2A.5 complete · Hash uniqueness hardened · Target network: Base Mainnet  
**Applies to:** `src/lib/onchain/client.ts`, `src/lib/onchain/contracts.ts`, all ProofBadge surfaces  
**Do not deploy until:** contract address is set in `NEXT_PUBLIC_PREDIXI_COMMITMENT_CONTRACT`

---

## 1. Why Migrate from signMessage

The current Phase 2 system uses `signMessage` (EIP-191) exclusively as an **authentication gate** — the signature proves wallet ownership so the backend trusts the write. The commitment hash is stored in Supabase but never anchored onchain. ProofBadge shows "proof ready" (blue) rather than "onchain" (emerald).

The Phase 3 migration adds an **optional, user-triggered** step that anchors the commitment hash to Base mainnet. The signed prediction data is never posted onchain — only the opaque `bytes32` hash is submitted. This gives users a verifiable, chain-permanent receipt that predates any match result.

**Why optional, not mandatory:**  
Mandatory onchain writes block the UX on gas estimation, mobile wallet interruptions, and network latency. Making it optional preserves the fast submit path for users who don't care about chain receipts while giving power users proof of prediction provenance.

---

## 2. Architecture Overview

```
User submits prediction (current Phase 2 — unchanged)
  │
  ├─► signMessageAsync()        ← EIP-191 wallet auth, no gas
  ├─► POST /api/predictions     ← backend verifies signature, writes to Supabase
  └─► response: { commitmentHash, id }   ← hash stored in DB, returned to client

                    ▼  (new Phase 3 optional path)

User taps "Anchor on Base" button (ProofBadge or Profile row)
  │
  ├─► writeContract()           ← wagmi, sends real tx to Base mainnet
  │     contract: PrediXICommitments.submitCommitment(bytes32)
  │     gas: ~21k + contract overhead (~50k total, ~$0.001 on Base)
  │
  ├─► tx pending  → ProofBadge shows spinner + "Anchoring…"
  ├─► tx confirmed → PATCH /api/predictions  { id, txHash, submittedOnchain: true }
  └─► ProofBadge upgrades: blue "proof ready" → emerald "onchain" + BaseScan link
```

---

## 3. Current Code State

### `src/lib/onchain/commitment.ts` *(updated Step 2A.5)*
- `createPredictionCommitment({ walletAddress, matchId, outcome, placedAt, predictionId? })`
  - **Now includes `predictionId` (Supabase UUID)** when provided — guarantees uniqueness per row
  - Backward-compatible: calls without `predictionId` still work (legacy rows)
- `createDailyXICommitment` — unchanged, `walletAddress + entryDate` is sufficient
- `createWCCommitment` — unchanged, `walletAddress + predictionKey` is sufficient

### `src/app/api/predictions/route.ts` *(updated Step 2A.5)*
Match prediction POST flow now follows a two-step write:
1. Upsert prediction row (outcome + placed_at) — no `commitment_hash` yet
2. Read returned `prediction.id` (stable UUID for this profile+match)
3. Compute `commitmentHash` with `predictionId = prediction.id`
4. `UPDATE predictions SET commitment_hash = ? WHERE id = ?`

This guarantees every `commitment_hash` in the DB is provably tied to exactly one row.

### `src/lib/onchain/client.ts`
- `OnchainSubmitStatus`: `'not-implemented' | 'broadcasting' | 'confirming' | 'success' | 'error' | 'pending'`
- `submitCommitmentToBase(hash)` — stub, returns `not-implemented`
- `submitPredictionCommitment(hash)` — stub
- `submitDailyXICommitment(hash)` — stub
- `submitWCCommitment(hash)` — stub
- `getCommitmentReceipt(hash)` — stub, `anchoredAt?: number`
- `getCommitmentStatus(txHash)` — stub

All stubs have the Base Mainnet implementation spelled out in JSDoc. No breaking changes required — just replace stub bodies.

### `src/lib/onchain/contracts.ts`
- `COMMITMENT_REGISTRY_ABI` — full ABI defined, type-safe, matches deployed contract
- `toBytes32(hash)` — validates 0x-prefix + 66-char length
- `getCommitmentContractAddress()` — reads env var, returns null if unset
- `getTargetChainId()` — defaults to 8453 (Base mainnet)
- `CONTRACT_NAMES.COMMITMENT_REGISTRY` = `'PredixiCommitmentRegistry'`

**No changes needed to `contracts.ts` for Base Mainnet launch.**

---

## 4. Transaction Lifecycle & UI States

### 4.1 States

| State | Label | ProofBadge color | Action available |
|---|---|---|---|
| `proof-ready` | Hash stored, not anchored | Blue | "Anchor on Base" button |
| `broadcasting` | `writeContract()` called, awaiting wallet | Spinner | Cancel (wallet UI) |
| `confirming` | Tx hash returned, awaiting block | Spinner + BaseScan link | None |
| `onchain` | Receipt confirmed, DB patched | Emerald green | BaseScan explorer link |
| `error` | Tx reverted or wallet rejected | Red / yellow | Retry |

### 4.2 Flow pseudocode (Phase 3 client implementation)

```typescript
// In submitPredictionCommitment() — replace stub body with:

import { writeContract, waitForTransactionReceipt } from 'wagmi/actions'
import { getWagmiConfig } from '@/lib/wagmi'   // existing export
import { COMMITMENT_REGISTRY_ABI, getCommitmentContractAddress, toBytes32 } from './contracts'

const address = getCommitmentContractAddress()
if (!address) return notImplemented(commitmentHash)

// 1. Broadcast — wallet prompts user (gas approval sheet)
const txHash = await writeContract(getWagmiConfig(), {
  address,
  abi:          COMMITMENT_REGISTRY_ABI,
  functionName: 'submitCommitment',
  args:         [toBytes32(commitmentHash)],
})
// → state: 'broadcasting' → 'confirming' (txHash returned)

// 2. Wait for 1 confirmation on Base (~2s average block time)
const receipt = await waitForTransactionReceipt(getWagmiConfig(), {
  hash:               txHash,
  confirmations:      1,
  pollingInterval:    1_000,   // ms
  timeout:            120_000, // 2 min ceiling
})

if (receipt.status !== 'success') {
  return { status: 'error', txHash, error: 'Transaction reverted on Base.' }
}

// 3. Patch backend
await fetch('/api/predictions', {
  method: 'PATCH',
  body: JSON.stringify({ id: predictionId, txHash, submittedOnchain: true }),
})

return { status: 'success', txHash, commitmentHash }
```

---

## 5. Backend Changes Required (Phase 3)

### 5.1 PATCH endpoints

Each prediction type needs a PATCH handler. Add to the existing route files:

```
PATCH /api/predictions   → { id: string, txHash: string, submittedOnchain: true }
PATCH /api/daily-xi      → { wallet: string, date: string, txHash: string, submittedOnchain: true }
PATCH /api/wc-predictions → { wallet: string, predictionKey: string, txHash: string, submittedOnchain: true }
```

Each PATCH must:
1. Verify the tx on Base (read receipt via `publicClient.getTransactionReceipt`) — do not trust the client's claim alone
2. Verify the `commitmentHash` in the receipt's event log matches the DB record
3. Update `submitted_onchain = true`, `tx_hash = txHash` in Supabase
4. Require the same wallet-signature auth as POST (or a session token — TBD)

### 5.2 Supabase schema additions (Phase 3)

```sql
-- Already exists (Phase 2): commitment_hash TEXT
-- Add in Phase 3:
ALTER TABLE predictions     ADD COLUMN submitted_onchain BOOLEAN DEFAULT FALSE;
ALTER TABLE predictions     ADD COLUMN tx_hash          TEXT;
ALTER TABLE daily_xi_entries ADD COLUMN submitted_onchain BOOLEAN DEFAULT FALSE;
ALTER TABLE daily_xi_entries ADD COLUMN tx_hash          TEXT;
ALTER TABLE wc_predictions  ADD COLUMN submitted_onchain BOOLEAN DEFAULT FALSE;
ALTER TABLE wc_predictions  ADD COLUMN tx_hash          TEXT;
```

---

## 6. Gas Estimation & Cost

| Action | Estimated gas | Cost at 0.001 gwei base fee (Base) |
|---|---|---|
| `submitCommitment(bytes32)` | ~45,000–60,000 | ~$0.001–0.003 |
| Contract deploy (one-time) | ~200,000–300,000 | ~$0.005–0.010 |

Base mainnet gas is extremely cheap. A prediction anchor costs less than $0.01 under normal conditions. Spikes are possible during Base congestion but rare.

**Gas estimation failure handling:**
- `estimateGas` call before `writeContract` — if it throws, the contract is likely misconfigured or the hash was already submitted (duplicate)
- Surface as: "Unable to estimate gas — this hash may already be anchored."
- Never let an estimateGas failure silently proceed to `writeContract`

---

## 7. Risk Analysis

### 7.1 Mobile wallet interruptions (Base App / Coinbase Wallet)
**Risk:** User backgrounds app mid-transaction; wallet loses context; tx is in-flight with no UI feedback.  
**Mitigation:**
- Store `{ txHash, status: 'confirming' }` in `localStorage` immediately after `writeContract` returns
- On remount/visibility-change: re-query `getCommitmentStatus(txHash)` and restore UI
- Use `visibilitychange` listener already wired in wagmi setup — no new listener needed

### 7.2 Duplicate submits (same hash twice)
**Risk:** User taps "Anchor" twice; two tx broadcasted; second will revert on-contract (the hash is already stored).  
**Mitigation:**
- Disable the anchor button immediately after first `writeContract()` call
- Contract-level deduplication: `PrediXICommitments.submitCommitment` should revert on duplicate hash (enforced in Solidity: `require(commitments[hash] == 0, "already anchored")`)
- Backend PATCH is idempotent — updating to the same `tx_hash` is safe

### 7.3 Transaction replacement / speedup
**Risk:** User or wallet replaces the tx with a higher gas version; original `txHash` is now invalid.  
**Mitigation:**
- `waitForTransactionReceipt` with wagmi handles replacement natively via `onReplaced` callback
- Log the replacement txHash and patch the DB with the new hash
- Do not surface this to the user unless the replacement fails

### 7.4 Backend desync (tx confirmed but PATCH fails)
**Risk:** Tx confirms on-chain, backend call fails (network, Supabase timeout). DB still shows `submitted_onchain = false`.  
**Mitigation:**
- PATCH is idempotent — retry on failure
- On next app load, ProofBadge can re-query `getCommitmentReceipt(hash)` → if `anchoredAt > 0`, trigger a background PATCH automatically
- Manual recovery: admin can run a reconciliation script against Base RPC

### 7.5 Contract address misconfigured
**Risk:** `NEXT_PUBLIC_PREDIXI_COMMITMENT_CONTRACT` set to wrong address; writes go to nowhere or a malicious contract.  
**Mitigation:**
- `getCommitmentContractAddress()` validates 0x prefix but not correctness
- Add a one-time `readContract` sanity check on app init: call `getCommitmentTimestamp(0x0)` — if it throws a specific revert reason that matches the expected contract, proceed; otherwise, surface a warning to devs (not users)

### 7.6 Chain ID mismatch
**Risk:** User wallet is on Ethereum mainnet instead of Base; tx lands on wrong chain.  
**Mitigation:**
- Use wagmi's `chainId` from `useAccount` — compare against `getTargetChainId()` before calling `writeContract`
- If mismatch: prompt user to switch to Base (`useSwitchChain` from wagmi)
- wagmi's `writeContract` will throw if the connected chain doesn't match the contract's deployment chain (when properly configured)

### 7.7 Tx reverted (duplicate hash, contract paused, etc.)
**Risk:** `waitForTransactionReceipt` returns `status: 'reverted'`.  
**Mitigation:**
- `return { status: 'error', txHash, error: 'Transaction reverted on Base.' }`
- Surface to user: "Anchoring failed. Your prediction hash is still saved off-chain. [View on BaseScan]"
- The commitment hash in DB is unaffected — prediction proof is intact, just not chain-anchored

---

## 8. ProofBadge Upgrade Path

The `ProofBadge` component already handles two visual states (`proof-ready` and `onchain`). Phase 3 adds intermediate states:

```typescript
// Current (Phase 2):
type ProofState = 'proof-ready' | 'onchain'

// Phase 3:
type ProofState =
  | 'proof-ready'    // hash in DB, not anchored
  | 'broadcasting'   // writeContract() called, wallet open
  | 'confirming'     // txHash returned, waiting for block
  | 'onchain'        // receipt confirmed, DB patched
  | 'anchor-error'   // tx reverted or wallet rejected
```

The "Anchor on Base" CTA should live in the ProofBadge component (or adjacent to it in the Profile prediction row) — not embedded deep in the prediction flow itself. Anchoring is a post-hoc, optional action.

---

## 9. Explorer Links

All confirmed transactions should link to BaseScan:

```typescript
// Base mainnet
const baseScanTx = (txHash: string) =>
  `https://basescan.org/tx/${txHash}`

// Base Sepolia testnet (dev/staging)
const baseSepoliaScanTx = (txHash: string) =>
  `https://sepolia.basescan.org/tx/${txHash}`

export function getExplorerUrl(txHash: string): string {
  return getTargetChainId() === 84532
    ? baseSepoliaScanTx(txHash)
    : baseScanTx(txHash)
}
```

Add `getExplorerUrl` to `src/lib/onchain/contracts.ts` in Phase 3.

---

## 10. Phase 3 Launch Checklist

- [ ] Deploy `PrediXICommitments.sol` to Base Sepolia, verify ABI matches `COMMITMENT_REGISTRY_ABI`
- [ ] Test `submitCommitment` + `getCommitmentTimestamp` on Sepolia
- [ ] Set `NEXT_PUBLIC_PREDIXI_COMMITMENT_CONTRACT` (Sepolia address) + `NEXT_PUBLIC_BASE_CHAIN_ID=84532`
- [ ] Implement `submitPredictionCommitment`, `submitDailyXICommitment`, `submitWCCommitment` in `client.ts`
- [ ] Add PATCH handlers to `/api/predictions`, `/api/daily-xi`, `/api/wc-predictions`
- [ ] Add Supabase columns: `submitted_onchain`, `tx_hash` per table
- [ ] Add `broadcasting` / `confirming` states to ProofBadge
- [ ] Add "Anchor on Base" CTA to Profile prediction rows
- [ ] Add `getExplorerUrl` to `contracts.ts`
- [ ] QA on Base Sepolia: happy path, duplicate hash, wallet rejection, chain mismatch
- [ ] Switch to Base mainnet address + `NEXT_PUBLIC_BASE_CHAIN_ID=8453`
- [ ] Deploy to Vercel production

---

## 11. What Does NOT Change

- The `signMessage` auth flow for prediction submission — unchanged in Phase 3
- Commitment hash generation in `src/lib/onchain/commitment.ts` — unchanged
- ProofBadge display for non-anchored predictions — unchanged (blue "proof ready")
- Supabase schema for `commitment_hash` — already correct, only adding 2 columns
- All existing API route auth (signature verification) — unchanged
- Daily XI, WC, Match Prediction UX — no forced changes; anchoring is a separate optional action

---

*Last updated: 2026-05-20 · Phase 2 live · Phase 3 pending contract deploy*
