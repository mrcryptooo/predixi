/**
 * Canonical anchor-on-Base message builder for Daily XI entries.
 *
 * Both the frontend (AnchorDailyXIButton, before signing) and the server
 * (PATCH /api/daily-xi, before verifying) import this module so the message
 * format can never diverge between the two sides.
 *
 * Action string "Anchor daily xi on Base" is distinct from the match-prediction
 * anchor ("Anchor prediction on Base") — a valid prediction anchor signature
 * cannot be replayed for a Daily XI anchor, and vice versa.
 *
 * Binding walletAddress + entryDate + txHash inside the signed message means:
 *   • the signature is tied to one specific wallet (wallet binding)
 *   • the signature is tied to one specific day's entry (date binding)
 *   • the signature is tied to one specific Base transaction (tx binding)
 *   • re-using the same signature for a different day or tx is cryptographically
 *     impossible
 */

export interface DailyXIAnchorMessageParams {
  /** Ethereum wallet address — normalised to lowercase in the output. */
  walletAddress: string
  /** Entry date in YYYY-MM-DD format. */
  entryDate: string
  /** 0x-prefixed 64-hex transaction hash from the confirmed Base Mainnet tx. */
  txHash: string
  /** ISO 8601 timestamp — call new Date().toISOString() immediately before signing. */
  signedAt: string
}

/**
 * Returns the canonical EIP-191 personal_sign message for anchoring a
 * Daily XI entry on Base Mainnet.
 *
 * Example output:
 *   PrediXI Anchor on Base
 *   Action: Anchor daily xi on Base
 *   Wallet: 0x29f38b1ed360acf9c09aaf46de9933d9d19770fb
 *   Entry Date: 2026-06-09
 *   Tx Hash: 0xe4f7f56c37cf460f31ec91b528bc073ce2260edf948c227e0e675a5c1135f7f6
 *   Timestamp: 2026-06-09T12:34:56.789Z
 */
export function buildDailyXIAnchorMessage(params: DailyXIAnchorMessageParams): string {
  return [
    'PrediXI Anchor on Base',
    'Action: Anchor daily xi on Base',
    `Wallet: ${params.walletAddress.toLowerCase()}`,
    `Entry Date: ${params.entryDate}`,
    `Tx Hash: ${params.txHash.toLowerCase()}`,
    `Timestamp: ${params.signedAt}`,
  ].join('\n')
}

/** Maximum age before the server rejects a Daily XI anchor signature (10 minutes). */
export const DAILY_XI_ANCHOR_MAX_AGE_MS = 10 * 60 * 1000
