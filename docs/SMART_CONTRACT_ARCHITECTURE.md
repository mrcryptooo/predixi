# PrediXI — Smart Contract Architecture

**Status:** Planning only. No contract deployed. No transactions occur.  
**Target network:** Base mainnet (chain ID 8453)  
**Phase:** Future (Phase 3+)

---

## 1. Purpose of Onchain Commitments

PrediXI stores a `commitment_hash` for every prediction, Daily XI, and World Cup pick.
The hash is a deterministic `keccak256` digest of the prediction payload — generated at
submission time, stored in the database, and surfaced in the UI via `ProofBadge`.

Anchoring that hash on Base achieves two things:

1. **Tamper evidence.** A hash recorded on a public blockchain cannot be retroactively
   altered. If a user later disputes a prediction outcome, the on-chain record proves
   what was committed to — and when.
2. **Trustless XP proof.** In a future phase, earned XP can be proven against the
   commitment: the oracle that scores the match reveals the outcome, and anyone can
   verify `hash(payload) == onchain_commitment` to confirm the score was applied to
   the right prediction.

---

## 2. Why Only Hashes Go Onchain

Raw prediction data (wallet address, match, chosen outcome) is **not written to the
contract**. Only the 32-byte `commitment_hash` is submitted.

**Reasons:**

| Concern | Decision |
|---|---|
| Privacy | Outcome choices are not exposed in calldata or contract storage |
| Cost | A 32-byte value costs a few thousand gas on Base; full prediction structs would cost far more |
| Flexibility | The off-chain schema can evolve without requiring contract upgrades |
| Simplicity | The contract stays minimal, auditable, and upgradeable independently |

The hash is computed with `keccak256(deterministicJSON(payload))` — see
`src/lib/onchain/commitment.ts` for the canonical algorithm. Because the serialisation
is deterministic (sorted keys, no whitespace), any party holding the payload can verify
the hash independently without trusting PrediXI's servers.

---

## 3. Privacy Model

```
User prediction data                  On-chain record
─────────────────────────────────     ──────────────────────────
walletAddress  ─┐                     bytes32 commitmentHash
matchId         ├─► keccak256  ───►   address submitter
outcome         │                     uint256 timestamp
placedAt       ─┘                     (nothing else)
```

- The contract **does not store** match IDs, outcomes, or player selections.
- A `commitmentHash` alone reveals nothing about the prediction.
- Only users who possess the original payload can prove what the hash represents.
- The PrediXI backend holds the payload in Supabase. Users can request their data
  at any time (standard GDPR right of access). The on-chain hash remains even if
  off-chain data is deleted — it proves something was committed, but not what.

---

## 4. Future Contract Responsibilities

### 4.1 PrediXI Commitment Registry (`PrediXICommitments`)

A single, minimal contract on Base with one primary function:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract PrediXICommitments {
    event CommitmentRecorded(
        address indexed submitter,
        bytes32 indexed commitmentHash,
        uint256 timestamp
    );

    mapping(bytes32 => uint256) public commitmentTimestamp;

    /// @notice Record a commitment hash on-chain.
    /// @param commitmentHash keccak256 of the deterministic JSON payload.
    function submitCommitment(bytes32 commitmentHash) external {
        require(commitmentTimestamp[commitmentHash] == 0, "already submitted");
        commitmentTimestamp[commitmentHash] = block.timestamp;
        emit CommitmentRecorded(msg.sender, commitmentHash, block.timestamp);
    }

    /// @notice Verify a commitment exists and return its timestamp.
    function getCommitmentTimestamp(bytes32 commitmentHash)
        external view returns (uint256) {
        return commitmentTimestamp[commitmentHash];
    }
}
```

**Deliberately omitted from Phase 3 contract:**
- Outcome settlement — stays off-chain
- XP minting — stays off-chain (future separate token contract if needed)
- Admin roles — kept minimal; contract is append-only
- Upgradeability — the registry is immutable; new versions get new addresses

### 4.2 Contract Surface Area (Minimal by Design)

| What the contract does | What it does NOT do |
|---|---|
| Accept `bytes32 commitmentHash` | Store raw prediction data |
| Emit `CommitmentRecorded` event | Score predictions |
| Record block timestamp | Award XP |
| Allow duplicate-rejection | Gate any feature |
| Public `getCommitmentTimestamp` read | Transfer value |

---

## 5. What Stays Off-Chain

Everything that would cost gas, require privacy, or change frequently stays in
Supabase and the PrediXI API:

- **Prediction payloads** — wallet, match, outcome, timestamp
- **Daily XI player selections** — full 11-player arrays
- **World Cup pick selections** — selected values
- **XP accounting** — all scoring, ledger, rank computation
- **Settlement logic** — auto-settle cron, football-data.org result fetching
- **Match data** — schedules, kickoff times, results
- **User profiles** — rank, streak, accuracy

The on-chain record is a thin, immutable fingerprint of the off-chain state.

---

## 6. Settlement Relationship

Prediction scoring remains entirely off-chain:

```
1. User submits prediction
   → commitment_hash computed (server-side, keccak256)
   → stored in DB
   → [future Phase 3] user triggers submitCommitment(hash) from wallet

2. Match result arrives (football-data.org API → auto-settle cron)
   → is_correct, points_awarded written to DB
   → XP ledger updated

3. Proof verification (future, optional)
   → anyone can recompute hash from payload
   → compare against on-chain commitmentTimestamp > 0
   → confirms prediction existed before match result was known
```

The contract timestamp proves pre-match commitment; the DB stores the scored result.
These two data points together form the complete, verifiable proof.

---

## 7. XP Proof Model

Future XP claims can be verified as follows:

| Step | Data source | Verifiable by |
|---|---|---|
| Prediction existed at time T | `commitmentTimestamp` on Base | Anyone |
| Prediction matched outcome | DB `is_correct = true` + payload reveal | PrediXI (trusted) |
| XP was awarded | XP ledger event in DB | PrediXI (trusted) |
| XP amount correct | Known scoring rules (public) | Anyone |

Phase 3 makes Step 1 trustless. Steps 2–4 remain centralised unless a future
decentralised oracle (e.g., Chainlink Sports, UMA Optimistic Oracle) is integrated
in Phase 4+.

The roadmap does not commit to a decentralised oracle at this time.

---

## 8. Base Deployment Plan

### Environment Variables Required

```env
# Set at Phase 3 deploy time — not yet assigned
NEXT_PUBLIC_PREDIXI_COMMITMENT_CONTRACT=0x0000000000000000000000000000000000000000
NEXT_PUBLIC_BASE_CHAIN_ID=8453
```

### Deployment Sequence (Phase 3, future)

1. Finalise and audit `PrediXICommitments.sol`
2. Deploy to **Base Sepolia** testnet, run integration tests
3. Deploy to **Base mainnet**; record verified contract address
4. Set `NEXT_PUBLIC_PREDIXI_COMMITMENT_CONTRACT` in Vercel env
5. Implement `submitPredictionCommitment()` / `submitDailyXICommitment()` /
   `submitWCCommitment()` in `src/lib/onchain/client.ts` (stubs already in place)
6. Update `tx_hash` + `submitted_onchain` columns in DB after successful submission
7. `ProofBadge` upgrades from "proof ready" to "onchain" state automatically —
   no UI changes needed

### Gas Estimate (Base mainnet)

| Operation | Estimated gas | Cost at 0.001 gwei base fee |
|---|---|---|
| `submitCommitment(bytes32)` | ~25 000 gas | < $0.001 |
| `getCommitmentTimestamp(bytes32)` | ~2 500 gas (read) | free (view call) |

Base's ultra-low fees make per-prediction commitments economically viable for users.

---

## 9. How `commitment_hash` Maps to the Future Contract Call

Currently (Phase 2):

```
API POST /api/predictions
  → createPredictionCommitment({ walletAddress, matchId, outcome, placedAt })
  → commitment_hash stored in DB
  → commitment_hash returned to client
  → ProofBadge shows "proof ready" state
  → submitted_onchain = false, tx_hash = null
```

Phase 3 flow (not yet implemented):

```
User clicks "Anchor on Base" (future UI, Phase 3)
  → client reads commitment_hash from API (already computed)
  → submitPredictionCommitment(commitmentHash) called in client.ts
  → wagmi writeContract → PrediXICommitments.submitCommitment(bytes32)
  → tx submitted to Base; user's wallet signs
  → on confirmation: PATCH /api/predictions → submitted_onchain=true, tx_hash=0x...
  → ProofBadge upgrades to "onchain" state (emerald green chip)
```

The commitment hash computed in Phase 2 is exactly what Phase 3 will submit. No
recomputation or migration needed — the DB column is already populated.

---

## 10. Risks and Open Questions

| Risk | Mitigation / Status |
|---|---|
| User loses wallet that submitted commitment | Hash is indexed by hash, not wallet — any wallet can submit the same hash. Submitter address is logged but not authoritative. |
| Duplicate submissions | Contract `require(timestamp == 0)` rejects duplicates. First submitter wins. |
| DB and onchain state desync (tx confirmed but PATCH fails) | `tx_hash` can be re-applied from event logs via admin script. `submitted_onchain` is cosmetic — the on-chain record is authoritative. |
| Contract needs upgrading | New contract address = new env var. Old commitments remain valid on old address. Both can be queried. |
| Oracle integration for trustless scoring | Out of scope for Phase 3. Centralised API result scoring continues. Flagged for Phase 4+ evaluation. |
| Regulatory (prediction = gambling?) | PrediXI is XP-only; no monetary value. On-chain commitments record activity, not wagers. Legal review recommended before token/value integration. |
| Base network outage | submitCommitment is a UX enhancement, not a gate. Predictions remain valid without on-chain submission. |
| ABI drift between contract versions | ABIs versioned in `src/lib/onchain/contracts.ts`. Old ABIs retained under version keys. |

---

*Document owner: PrediXI engineering*  
*Last updated: Phase 2 (Step 8 planning)*  
*Do not deploy until Phase 3 prerequisites are met.*
