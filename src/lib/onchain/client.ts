/**
 * Onchain Client — Phase 2 placeholder
 *
 * Stubs for future Base onchain submission.
 * All write functions return a `not-implemented` result until Phase 3.
 * Read functions (getCommitmentReceipt) are also stubbed — they will use a
 * public RPC call (no wallet required) once the contract is deployed.
 *
 * ── Developer notes ──────────────────────────────────────────────────────────
 *
 *   How commitment_hash maps to a contract call (Phase 3):
 *
 *   1. Server generates commitment_hash via createPredictionCommitment() in
 *      src/lib/onchain/commitment.ts and stores it in DB (already live, Phase 2).
 *
 *   2. Client reads commitment_hash from the API response (returned in GET
 *      /api/predictions, /api/daily-xi, /api/wc-predictions — already live).
 *
 *   3. User triggers "Anchor on Base" (Phase 3 UI, not yet built).
 *      Client calls submitPredictionCommitment(commitmentHash) from this file.
 *
 *   4. Implementation (Phase 3) replaces the stub body with:
 *        import { getCommitmentContractAddress, COMMITMENT_REGISTRY_ABI, toBytes32 }
 *          from './contracts'
 *        const config = getWagmiConfig()               // from wagmi setup
 *        const txHash = await writeContract(config, {
 *          address: getCommitmentContractAddress()!,
 *          abi:     COMMITMENT_REGISTRY_ABI,
 *          functionName: 'submitCommitment',
 *          args:    [toBytes32(commitmentHash), context],
 *          //        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 *          //        context = 'match-prediction' | 'daily-xi' | 'wc-prediction'
 *          //        Stored in event log only — not in contract storage.
 *        })
 *        return { status: 'success', txHash, commitmentHash }
 *
 *   5. After tx confirms: PATCH /api/... → submitted_onchain=true, tx_hash=txHash
 *      ProofBadge automatically upgrades from "proof ready" (blue) to "onchain"
 *      (emerald green) — no UI changes needed.
 *
 *   No private prediction data is ever stored onchain.
 *   The bytes32 commitmentHash reveals nothing about the prediction content.
 *   See docs/SMART_CONTRACT_ARCHITECTURE.md §2 and §3 for the full privacy model.
 *
 * ── Environment variables (Phase 3) ──────────────────────────────────────────
 *
 *   NEXT_PUBLIC_PREDIXI_COMMITMENT_CONTRACT=0x...   (Base mainnet address)
 *   NEXT_PUBLIC_BASE_CHAIN_ID=8453
 *
 * ── Required packages (already installed) ────────────────────────────────────
 *
 *   wagmi  — wallet connection + writeContract (already installed)
 *   viem   — keccak256, toBytes, type utilities (already installed)
 *
 * ── See also ─────────────────────────────────────────────────────────────────
 *
 *   src/lib/onchain/contracts.ts   — ABI, address helpers, type utilities
 *   src/lib/onchain/commitment.ts  — hash generation (server-side)
 *   docs/SMART_CONTRACT_ARCHITECTURE.md
 */

import { getCommitmentContractAddress } from './contracts'

// ── Result types ──────────────────────────────────────────────────────────────

export type OnchainSubmitStatus =
  | 'not-implemented'
  | 'broadcasting'   // writeContract() called, waiting for wallet approval
  | 'confirming'     // tx hash returned, waiting for block confirmation
  | 'success'
  | 'error'
  | 'pending'        // legacy alias — prefer 'confirming' in new code

export type OnchainSubmitResult = {
  status:          OnchainSubmitStatus
  txHash?:         string
  commitmentHash?: string
  error?:          string
}

// ── Internal helper ───────────────────────────────────────────────────────────

/** Shared not-implemented response with contract-readiness hint in the message. */
function notImplemented(commitmentHash?: string, context?: string): OnchainSubmitResult {
  const contractAddr = getCommitmentContractAddress()
  const hint = contractAddr
    ? `Contract found at ${contractAddr} — Phase 3 implementation pending.`
    : 'Contract address not yet configured (NEXT_PUBLIC_PREDIXI_COMMITMENT_CONTRACT unset).'
  return {
    status:         'not-implemented',
    commitmentHash,
    error: [
      'Onchain submission not yet implemented.',
      context ?? '',
      hint,
      'Commitment hash is preserved in the DB for future anchoring.',
    ].filter(Boolean).join(' '),
  }
}

// ── Generic commitment submit ─────────────────────────────────────────────────

/**
 * Submit any commitment hash to Base.
 *
 * TODO (Phase 3): replace body with wagmi writeContract call.
 *   ABI: COMMITMENT_REGISTRY_ABI.submitCommitment(bytes32, string)
 *        args: [toBytes32(commitmentHash), context]
 *   Address: getCommitmentContractAddress()
 *   Contract: contracts/src/PredixiCommitmentRegistry.sol
 *
 * IMPORTANT: this function must only be called from client-side code (browser).
 * It requires a connected wallet (wagmi). Never call from server-side API routes.
 */
export async function submitCommitmentToBase(
  commitmentHash: string,
): Promise<OnchainSubmitResult> {
  console.log('[onchain/client] submitCommitmentToBase called (not implemented):', commitmentHash)
  return notImplemented(commitmentHash)
}

// ── Per-type commitment submitters ────────────────────────────────────────────

/**
 * Submit a match prediction commitment to Base.
 *
 * @param commitmentHash  The bytes32 hex hash from /api/predictions response.
 *
 * TODO (Phase 3): implement. Payload that was hashed (for reference only —
 * the hash itself is all that goes onchain):
 *   { type: 'prediction', walletAddress, matchId, outcome, placedAt }
 *
 * After Phase 3:
 *   PATCH /api/predictions  { id, submittedOnchain: true, txHash }
 */
export async function submitPredictionCommitment(
  commitmentHash: string,
): Promise<OnchainSubmitResult> {
  console.log('[onchain/client] submitPredictionCommitment called (not implemented):', commitmentHash)
  return notImplemented(commitmentHash, 'Type: match prediction.')
}

/**
 * Submit a Daily XI commitment to Base.
 *
 * @param commitmentHash  The bytes32 hex hash from /api/daily-xi response.
 *
 * TODO (Phase 3): implement. Payload that was hashed (for reference only):
 *   { type: 'daily-xi', walletAddress, entryDate, playerIds (sorted), projectedMaxXp }
 *
 * After Phase 3:
 *   PATCH /api/daily-xi  { wallet, date, submittedOnchain: true, txHash }
 */
export async function submitDailyXICommitment(
  commitmentHash: string,
): Promise<OnchainSubmitResult> {
  console.log('[onchain/client] submitDailyXICommitment called (not implemented):', commitmentHash)
  return notImplemented(commitmentHash, 'Type: Daily XI.')
}

/**
 * Submit a World Cup prediction commitment to Base.
 *
 * @param commitmentHash  The bytes32 hex hash from /api/wc-predictions response.
 *
 * TODO (Phase 3): implement. Payload that was hashed (for reference only):
 *   { type: 'wc-prediction', walletAddress, predictionKey, selectedValue, xpReward }
 *
 * After Phase 3:
 *   PATCH /api/wc-predictions  { wallet, predictionKey, submittedOnchain: true, txHash }
 */
export async function submitWCCommitment(
  commitmentHash: string,
): Promise<OnchainSubmitResult> {
  console.log('[onchain/client] submitWCCommitment called (not implemented):', commitmentHash)
  return notImplemented(commitmentHash, 'Type: World Cup pick.')
}

// ── Receipt / status read ─────────────────────────────────────────────────────

/**
 * Read the on-chain commitment record for a given hash.
 *
 * Returns the block timestamp (seconds) when the commitment was anchored,
 * or 0 if the hash has never been submitted.
 *
 * @param commitmentHash  The bytes32 hex hash to look up.
 *
 * TODO (Phase 3): implement with viem readContract (no wallet required):
 *   import { createPublicClient, http } from 'viem'
 *   import { base } from 'viem/chains'
 *   const publicClient = createPublicClient({ chain: base, transport: http() })
 *   const ts = await publicClient.readContract({
 *     address: getCommitmentContractAddress()!,
 *     abi:     COMMITMENT_REGISTRY_ABI,
 *     functionName: 'getCommitmentTimestamp',
 *     args:    [toBytes32(commitmentHash)],
 *   })
 *   return { status: 'success', commitmentHash, anchoredAt: Number(ts) }
 */
export async function getCommitmentReceipt(
  commitmentHash: string,
): Promise<OnchainSubmitResult & { anchoredAt?: number }> {
  console.log('[onchain/client] getCommitmentReceipt called (not implemented):', commitmentHash)
  return {
    ...notImplemented(commitmentHash, 'Read: commitment timestamp.'),
    anchoredAt: undefined,
  }
}

/**
 * Check the on-chain status of a previously submitted commitment by tx hash.
 *
 * TODO (Phase 3): query Base for the tx receipt and return confirmed/pending.
 *   const receipt = await publicClient.getTransactionReceipt({ hash: txHash })
 *   return receipt.status === 'success'
 *     ? { status: 'success', txHash }
 *     : { status: 'error', error: 'Transaction reverted' }
 */
export async function getCommitmentStatus(
  txHash: string,
): Promise<OnchainSubmitResult> {
  console.log('[onchain/client] getCommitmentStatus called (not implemented):', txHash)
  return {
    status: 'not-implemented',
    txHash,
    error:  'On-chain status check not yet implemented.',
  }
}
