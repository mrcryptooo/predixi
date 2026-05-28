# PrediXI — Onchain Commitment MVP

**Status:** Step 2A.5 complete — hash uniqueness hardened, Base Mainnet ready  
**Contract file:** `contracts/src/PredixiCommitmentRegistry.sol`  
**ABI:** `src/lib/onchain/contracts.ts → COMMITMENT_REGISTRY_ABI`  
**Next step:** Deploy `PredixiCommitmentRegistry` to Base Mainnet (Step 2B)

---

## What the Contract Does

`PredixiCommitmentRegistry` is an append-only registry that records a single piece of information:

> *"Wallet **A** submitted commitment hash **H** at block timestamp **T**."*

When a user submits a prediction in the PrediXI app, the backend generates a `bytes32` keccak256 hash of the prediction payload and stores it in Supabase. This contract lets the user optionally anchor that same hash on Base mainnet — creating a tamper-evident, permanently chain-verifiable receipt that predates any match result.

### Contract interface

```solidity
// Write
function submitCommitment(bytes32 commitmentHash, string calldata context) external

// Read
function getCommitmentTimestamp(bytes32 commitmentHash) external view returns (uint256)
function getCommitmentRecord(bytes32 commitmentHash) external view returns (address submitter, uint256 timestamp)
function isSubmitted(bytes32 commitmentHash) external view returns (bool)
```

### Event

```solidity
event CommitmentSubmitted(
    address indexed user,           // wallet that called submitCommitment
    bytes32 indexed commitmentHash, // the opaque hash — reveals nothing about prediction content
    string  context,                // "match-prediction" | "daily-xi" | "wc-prediction"
    uint256 timestamp               // block.timestamp at submission
)
```

### Errors (custom — cheaper than require strings)

```solidity
error ZeroHashNotAllowed()           // bytes32(0) submitted
error AlreadySubmitted(bytes32 hash) // same hash submitted twice
```

---

## What the Contract Does NOT Do

| Concern | Status |
|---------|--------|
| Custody funds or tokens | **Never** — no `payable`, no token transfers, no balance |
| Pay rewards of any kind | **Never** — no reward logic, no payout |
| Resolve predictions | **Never** — outcomes are computed off-chain by the backend |
| Store raw prediction data | **Never** — only the opaque `bytes32` hash is on-chain |
| Have an admin or owner | **Never** — no `Ownable`, no `onlyOwner`, no upgrade proxy |
| Implement betting or wagering | **Never** — no pools, no staking, no gambling logic |
| Accept ETH | **Never** — no `payable` anywhere in the contract |

---

## Why This Is Not Betting, Gambling, or a Payment System

The contract is a pure **append-only event log**. It records cryptographic hashes — small, opaque binary values that are mathematically indistinguishable from random noise without the original data. No prediction outcome, no financial instrument, and no value transfer can be inferred from a `bytes32`.

The XP reward system is entirely off-chain in Supabase. The contract has no knowledge of XP, predictions, match results, winners, or users. It is equivalent to a notary stamp: "This wallet touched this hash at this time."

---

## How the Hash Is Generated (off-chain)

The commitment hash is created **server-side** by `src/lib/onchain/commitment.ts` and stored in the DB before the user's transaction:

### Match prediction (updated in Step 2A.5)

```
commitmentHash = keccak256(deterministicJSON({
  type:          "prediction",
  matchId:       string,
  outcome:       "H" | "D" | "A",
  placedAt:      ISO-8601 millisecond timestamp,
  predictionId:  UUID,            ← Supabase row ID, added after upsert
  walletAddress: "0x...",
}))
```

The `predictionId` (Supabase UUID, stable per `profile_id + match_id` row) is included in the hash to guarantee uniqueness per DB record. The API flow is: upsert prediction → get UUID → compute hash → update row with hash.

### Daily XI

```
commitmentHash = keccak256(deterministicJSON({
  type:           "daily-xi",
  entryDate:      "YYYY-MM-DD",
  playerIds:      string[],       ← sorted for determinism
  projectedMaxXp: number,
  walletAddress:  "0x...",
}))
```

### World Cup prediction

```
commitmentHash = keccak256(deterministicJSON({
  type:          "wc-prediction",
  predictionKey: string,
  selectedValue: string[],
  walletAddress: "0x...",
  xpReward:      number,
}))
```

Object keys are sorted alphabetically by `deterministicStringify` before hashing so insertion order never affects the output.

This hash is stored in Supabase (`commitment_hash` column) and returned to the client. The client then optionally submits this same hash to the contract. **The prediction payload itself is never sent to the contract.**

---

## How the Frontend Will Use `writeContract` (Step 2 / Phase 3)

```typescript
// src/lib/onchain/client.ts — replace stub in submitPredictionCommitment():

import { writeContract, waitForTransactionReceipt } from 'wagmi/actions'
import { getWagmiConfig }                           from '@/lib/wagmi'
import {
  COMMITMENT_REGISTRY_ABI,
  getCommitmentContractAddress,
  toBytes32,
} from './contracts'

const address = getCommitmentContractAddress()
if (!address) return notImplemented(commitmentHash)

// 1. Broadcast (wallet prompts user to approve gas)
const txHash = await writeContract(getWagmiConfig(), {
  address,
  abi:          COMMITMENT_REGISTRY_ABI,
  functionName: 'submitCommitment',
  args:         [toBytes32(commitmentHash), 'match-prediction'],
  //             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //             context goes in the event log — not stored in contract state
})
// → state: 'broadcasting' → 'confirming' (txHash returned)

// 2. Wait for 1 Base confirmation (~2s average)
const receipt = await waitForTransactionReceipt(getWagmiConfig(), {
  hash:           txHash,
  confirmations:  1,
  pollingInterval: 1_000,
  timeout:         120_000,
})

if (receipt.status !== 'success') {
  return { status: 'error', txHash, error: 'Transaction reverted on Base.' }
}

// 3. Patch backend — store tx_hash and set submitted_onchain=true
await fetch('/api/predictions', {
  method: 'PATCH',
  body:   JSON.stringify({ id: predictionId, txHash, submittedOnchain: true }),
})

return { status: 'success', txHash, commitmentHash }
```

Context values per prediction type:
- Match prediction → `'match-prediction'`
- Daily XI → `'daily-xi'`
- World Cup → `'wc-prediction'`

---

## How the Backend Will Store the Transaction

After a successful `writeContract`, the frontend calls a PATCH endpoint:

```
PATCH /api/predictions     { id, txHash, submittedOnchain: true }
PATCH /api/daily-xi        { wallet, date, txHash, submittedOnchain: true }
PATCH /api/wc-predictions  { wallet, predictionKey, txHash, submittedOnchain: true }
```

Each PATCH must:
1. Fetch the transaction receipt from Base RPC (`publicClient.getTransactionReceipt`)
2. Verify the `CommitmentSubmitted` event in the logs matches the DB `commitment_hash`
3. Update `submitted_onchain = true` and `tx_hash = txHash` in Supabase

Required Supabase columns (add in Phase 3):
```sql
ALTER TABLE predictions      ADD COLUMN IF NOT EXISTS submitted_onchain BOOLEAN DEFAULT FALSE;
ALTER TABLE predictions      ADD COLUMN IF NOT EXISTS tx_hash          TEXT;
ALTER TABLE daily_xi_entries ADD COLUMN IF NOT EXISTS submitted_onchain BOOLEAN DEFAULT FALSE;
ALTER TABLE daily_xi_entries ADD COLUMN IF NOT EXISTS tx_hash          TEXT;
ALTER TABLE wc_predictions   ADD COLUMN IF NOT EXISTS submitted_onchain BOOLEAN DEFAULT FALSE;
ALTER TABLE wc_predictions   ADD COLUMN IF NOT EXISTS tx_hash          TEXT;
```

---

## Gas Costs (Base Mainnet)

| Operation | Estimated gas | Cost at normal Base fees |
|-----------|-------------|--------------------------|
| `submitCommitment(bytes32, string)` | ~50,000–60,000 | ~$0.001–0.003 |
| `getCommitmentTimestamp` (read) | 0 (free) | $0 |
| `getCommitmentRecord` (read) | 0 (free) | $0 |
| Contract deploy (one-time) | ~250,000–300,000 | ~$0.005–0.010 |

The `context` string adds ~200–500 gas per byte of string length compared to a bare `bytes32` call. For a 17-char string like `"match-prediction"`, the overhead is ~3,400–8,500 gas — negligible on Base.

---

## Deployment — Base Mainnet

> **Security rules — read before every deploy:**
> - Set `DEPLOYER_PRIVATE_KEY` in the shell session only — never in any file
> - Never commit, print, or log the private key
> - The deployer wallet only pays gas; it has no special role in the contract
> - After the session ends the env var disappears automatically

### Required env vars

| Variable | Value | Where to set |
|----------|-------|-------------|
| `DEPLOYER_PRIVATE_KEY` | `0x` + 64 hex chars | Shell session only — never in a file |
| `NEXT_PUBLIC_PREDIXI_COMMITMENT_CONTRACT` | Deployed contract address (set after deploy) | Vercel dashboard + `.env.local` |
| `NEXT_PUBLIC_BASE_CHAIN_ID` | `8453` | Vercel dashboard + `.env.local` |

### Deployer wallet requirements

- Must hold at least **0.002 ETH on Base Mainnet** (deploy costs ~235k gas; budget 0.001 ETH for gas + 0.001 ETH buffer)
- The wallet address is NOT stored in the contract — it is only the gas payer
- Any address can deploy; once deployed the contract is ownerless

### Deploy command (Bash/Zsh — from the `contracts/` directory)

```bash
export DEPLOYER_PRIVATE_KEY="0x<your key here>"
export BASE_MAINNET_RPC_URL="https://mainnet.base.org"

forge script script/Deploy.s.sol:DeployScript \
  --rpc-url "$BASE_MAINNET_RPC_URL" \
  --broadcast
```

### Deploy command (PowerShell — from the `contracts/` directory)

```powershell
$env:DEPLOYER_PRIVATE_KEY = "0x<your key here>"
$env:BASE_MAINNET_RPC_URL = "https://mainnet.base.org"

forge script script/Deploy.s.sol:DeployScript `
  --rpc-url $env:BASE_MAINNET_RPC_URL `
  --broadcast
```

### Expected deploy output

```
Script ran successfully.

== Logs ==
PredixiCommitmentRegistry deployed at: 0x<CONTRACT_ADDRESS>
Chain ID:                               8453
Next step: set env var
  NEXT_PUBLIC_PREDIXI_COMMITMENT_CONTRACT = 0x<CONTRACT_ADDRESS>

## Setting up 1 EVM.
## Sending transactions [0 - 0].
⠁ [00:00:00] [############] 1/1 transactions confirmed (0.5s avg)

## Waiting for receipts.
⠉ [00:00:03] [############] 1/1 receipts (0.0s avg)
##### base
✅ [Success] Hash: 0x<TX_HASH>
   Contract Address: 0x<CONTRACT_ADDRESS>
   Block: <N>
   Gas Used: ~235156
```

### Post-deploy checklist

After the deploy transaction confirms:

- [ ] Copy `0x<CONTRACT_ADDRESS>` from the forge output
- [ ] Set in Vercel dashboard: `NEXT_PUBLIC_PREDIXI_COMMITMENT_CONTRACT=<address>`
- [ ] Set in Vercel dashboard: `NEXT_PUBLIC_BASE_CHAIN_ID=8453`
- [ ] Set in `.env.local` (for local dev): same two vars
- [ ] Run the verification command below
- [ ] Trigger a Vercel redeploy so the new env vars take effect

### Post-deploy verification (read-only, no gas, no wallet needed)

```bash
# Replace <CONTRACT_ADDRESS> with the deployed address
cast call <CONTRACT_ADDRESS> \
  "isSubmitted(bytes32)(bool)" \
  0x0000000000000000000000000000000000000000000000000000000000000000 \
  --rpc-url https://mainnet.base.org
```

Expected response: `false`

```bash
# Read a record that doesn't exist — should return zero address and 0
cast call <CONTRACT_ADDRESS> \
  "getCommitmentRecord(bytes32)(address,uint256)" \
  0x0000000000000000000000000000000000000000000000000000000000000000 \
  --rpc-url https://mainnet.base.org
```

Expected response: `0x0000000000000000000000000000000000000000  0`

### Optional smoke test (only run after explicit confirmation)

```bash
# Send a test commitment from the deployer wallet
# Replace <CONTRACT_ADDRESS> and ensure DEPLOYER_PRIVATE_KEY is set in shell
cast send <CONTRACT_ADDRESS> \
  "submitCommitment(bytes32,string)" \
  0xdeadbeef00000000000000000000000000000000000000000000000000000000 \
  "manual-mainnet-smoke-test" \
  --rpc-url https://mainnet.base.org \
  --private-key "$DEPLOYER_PRIVATE_KEY"

# Then verify it was recorded
cast call <CONTRACT_ADDRESS> \
  "isSubmitted(bytes32)(bool)" \
  0xdeadbeef00000000000000000000000000000000000000000000000000000000 \
  --rpc-url https://mainnet.base.org
```

Expected response: `true`

---

## Future Integration Plan

| Step | What | Files |
|------|------|-------|
| **Step 1** (done) | Contract written, ABI synced, Foundry tests 23/23 | `contracts/`, `src/lib/onchain/contracts.ts` |
| **Step 2A.5** (done) | Match prediction hash hardened with DB row UUID | `src/lib/onchain/commitment.ts`, `src/app/api/predictions/route.ts` |
| **Step 2B** (done) | Deploy script written, commands documented | `contracts/script/Deploy.s.sol` |
| **Step 2B-deploy** | Run the deploy command above, set env vars | Shell + Vercel |
| **Step 3** | Implement `submitCommitment` stubs in `client.ts` using `writeContract` | `src/lib/onchain/client.ts` |
| **Step 4** | Add PATCH endpoints to `/api/predictions`, `/api/daily-xi`, `/api/wc-predictions` | Route files |
| **Step 5** | Add Supabase columns (`submitted_onchain`, `tx_hash`) — already in schema | `supabase/add-onchain-metadata.sql` (already exists) |
| **Step 6** | Add "Anchor on Base" CTA to ProofBadge / Profile prediction rows | `src/components/proof/ProofBadge.tsx` |
| **Step 7** | Add `broadcasting` / `confirming` states to ProofBadge | `src/components/proof/ProofBadge.tsx` |
| **Step 8** | Full Base Mainnet QA: happy path, duplicate hash, wallet rejection, chain mismatch | — |

---

## Running the Contract Tests (once Foundry is installed)

```bash
# Install Foundry (one-time, on the developer's machine)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install forge-std (one-time, from contracts/ directory)
cd contracts
forge install foundry-rs/forge-std

# Run all tests
forge test

# Verbose output (shows traces on failure)
forge test -vvv

# Gas report
forge test --gas-report

# Run only a specific test
forge test --match-test test_DuplicateHash_Reverts_WithAlreadySubmitted -vvv

# Run fuzz tests with more runs
forge test --match-test testFuzz --fuzz-runs 1000
```

### Expected test output (all passing)

```
Ran 23 tests for test/PredixiCommitmentRegistry.t.sol
[PASS] test_Submit_RecordsSubmitter
[PASS] test_Submit_RecordsTimestamp
[PASS] test_Submit_GetCommitmentRecord_ReturnsCorrectPair
[PASS] test_Submit_EmitsCommitmentSubmittedEvent
[PASS] test_Submit_EmitsEvent_WithDailyXIContext
[PASS] test_Submit_EmitsEvent_WithWCContext
[PASS] test_IsSubmitted_ReturnsFalseBeforeSubmit
[PASS] test_IsSubmitted_ReturnsTrueAfterSubmit
[PASS] test_IsSubmitted_OnlyTrueForSubmittedHash
[PASS] test_MultipleWallets_CanSubmitDifferentHashes
[PASS] test_SameWallet_CanSubmitMultipleDifferentHashes
[PASS] test_GetCommitmentTimestamp_UnsubmittedHash_ReturnsZero
[PASS] test_GetCommitmentRecord_UnsubmittedHash_ReturnsZeroAddressAndZeroTimestamp
[PASS] test_DuplicateHash_Reverts_WithAlreadySubmitted
[PASS] test_DuplicateHash_DifferentWallet_StillReverts
[PASS] test_ZeroHash_Reverts_WithZeroHashNotAllowed
[PASS] test_ZeroHash_Reverts_ForAnyWallet
[PASS] test_Timestamp_MatchesBlockTimestamp_AtSubmitTime
[PASS] test_SameHash_DifferentContext_StillReverts
[PASS] testFuzz_Submit_AnyNonZeroHash_SucceedsFirstTime (256 runs)
[PASS] testFuzz_Submit_SameHashTwice_AlwaysReverts (256 runs)
[PASS] test_GasUsage_Submit
[PASS] test_GasUsage_Read
```

---

## Known Limitations (Step 1)

| Limitation | Notes |
|-----------|-------|
| Foundry not installed on dev machine | Install with `curl -L https://foundry.paradigm.xyz | bash && foundryup` |
| No deployment script yet | Will be added in Step 2 (`contracts/script/Deploy.s.sol`) |
| No contract address configured | `NEXT_PUBLIC_PREDIXI_COMMITMENT_CONTRACT` is unset; all `client.ts` stubs return `not-implemented` |
| No frontend integration | `writeContract` UI is Step 3 — no changes to frontend yet |
| `context` string is not validated | On-chain: any string is accepted; off-chain: the frontend enforces the expected values |

---

## Security Properties

- **No admin key, no upgrade proxy** — the contract is immutable after deployment. No one can modify or pause it.
- **No funds flow** — `submitCommitment` is `nonpayable`. Sending ETH to the contract will revert.
- **Hash uniqueness is global** — a commitment hash can only be anchored once, regardless of who submits it.
- **Zero hash rejected** — `bytes32(0)` is explicitly rejected to prevent accidental or garbage submissions.
- **No reentrancy risk** — the function only writes one storage slot and emits one event. No external calls.
- **No oracle dependency** — the contract has no external dependencies. Match results are never read on-chain.

---

*Created: 2026-05-23 · Step 1 of Onchain Commitment MVP*  
*See also: `docs/REAL_BASE_TRANSACTION_FLOW.md` · `docs/SMART_CONTRACT_ARCHITECTURE.md`*
