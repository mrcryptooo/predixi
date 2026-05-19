/**
 * Onchain Client — Phase 1 placeholder
 *
 * Stub for future Base onchain submission.
 * All functions return a `not-implemented` result until Phase 3.
 *
 * ── Future integration points ─────────────────────────────────────────────────
 *
 *   TODO (Phase 3): replace submitCommitmentToBase() body with:
 *     1. Import wagmi writeContract or viem walletClient
 *     2. Call PrediXI commitment contract on Base (address TBD)
 *     3. ABI method: submitCommitment(bytes32 commitmentHash)
 *     4. Return tx hash on success
 *
 *   Required env vars (Phase 3):
 *     NEXT_PUBLIC_COMMITMENT_CONTRACT_ADDRESS=0x...
 *     NEXT_PUBLIC_BASE_CHAIN_ID=8453
 *
 *   Required packages (Phase 3):
 *     wagmi (already installed for wallet connection)
 *     viem (already installed)
 */

// ── Result types ──────────────────────────────────────────────────────────────

export type OnchainSubmitStatus = 'not-implemented' | 'success' | 'error' | 'pending'

export type OnchainSubmitResult = {
  status:          OnchainSubmitStatus
  txHash?:         string
  commitmentHash?: string
  error?:          string
}

// ── Placeholder functions ─────────────────────────────────────────────────────

/**
 * Submit a commitment hash to Base.
 *
 * TODO (Phase 3): implement real Base transaction.
 *   - Connect to wagmi walletClient
 *   - Call commitmentContract.submitCommitment(commitmentHash)
 *   - Return { status: 'success', txHash }
 */
export async function submitCommitmentToBase(
  commitmentHash: string,
): Promise<OnchainSubmitResult> {
  // Phase 1: no-op — commitment is stored off-chain only
  console.log('[onchain/client] submitCommitmentToBase called (not implemented):', commitmentHash)

  return {
    status:         'not-implemented',
    commitmentHash,
    error:          'Onchain submission not yet implemented. Commitment hash is preserved in the API response for future anchoring.',
  }
}

/**
 * Check the on-chain status of a previously submitted commitment.
 *
 * TODO (Phase 3): query Base for the tx receipt and return confirmed/pending.
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
