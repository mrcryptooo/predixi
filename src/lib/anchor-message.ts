/**
 * Canonical anchor-on-Base message builder.
 *
 * Both the frontend (before signing) and PATCH /api/predictions (before
 * verifying) import this module so the format can never diverge between sides.
 *
 * The action string "Anchor prediction on Base" distinguishes these signatures
 * from prediction-submit signatures — a valid prediction signature cannot be
 * replayed here, and vice versa.
 *
 * Binding predictionId + txHash inside the signed message prevents the same
 * signature from being used with a different prediction or a different tx.
 */

export interface AnchorMessageParams {
  /** Ethereum wallet address — normalised to lowercase in the output. */
  walletAddress: string
  /** Supabase UUID of the predictions row being anchored. */
  predictionId: string
  /** 0x-prefixed 64-hex transaction hash from the Base Mainnet tx. */
  txHash: string
  /** ISO 8601 timestamp — embed Date.now() before signing. */
  signedAt: string
}

/**
 * Returns the canonical EIP-191 personal_sign message for anchoring a
 * match prediction on Base Mainnet.
 *
 * Example output:
 *   PrediXI Anchor on Base
 *   Action: Anchor prediction on Base
 *   Wallet: 0x29f38b1ed360acf9c09aaf46de9933d9d19770fb
 *   Prediction ID: 550e8400-e29b-41d4-a716-446655440000
 *   Tx Hash: 0xe4f7f56c37cf460f31ec91b528bc073ce2260edf948c227e0e675a5c1135f7f6
 *   Timestamp: 2026-06-02T12:34:56.789Z
 */
export function buildAnchorMessage(params: AnchorMessageParams): string {
  return [
    'PrediXI Anchor on Base',
    'Action: Anchor prediction on Base',
    `Wallet: ${params.walletAddress.toLowerCase()}`,
    `Prediction ID: ${params.predictionId}`,
    `Tx Hash: ${params.txHash.toLowerCase()}`,
    `Timestamp: ${params.signedAt}`,
  ].join('\n')
}

/** Maximum age before the server rejects an anchor signature (10 minutes). */
export const ANCHOR_SIGNATURE_MAX_AGE_MS = 10 * 60 * 1000
