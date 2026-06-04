/**
 * Badge mint request auth message builder.
 *
 * Both the frontend (before signing) and GET /api/badges/mint-signature
 * (before verifying) import this module so the format can never diverge.
 *
 * The action string "Request badge mint authorization" is distinct from every
 * other PrediXI signature action — a prediction-submit or anchor signature
 * cannot be replayed here, and vice versa.
 *
 * The message binds wallet + badgeId + tokenId so a valid signature for
 * "first-pred" (token 1) cannot be replayed to get a signature for
 * "centurion" (token 2).
 */

export interface BadgeMintRequestParams {
  /** Ethereum wallet address — normalised to lowercase in the output. */
  walletAddress: string
  /** Badge string ID (e.g. 'first-pred'). */
  badgeId: string
  /** ERC-1155 token ID (1–19). */
  tokenId: number
  /** ISO 8601 timestamp — embed Date.now() before signing. */
  signedAt: string
}

/**
 * Returns the canonical EIP-191 personal_sign message for requesting a
 * badge mint signature from the backend.
 *
 * Example output:
 *   PrediXI Badge Mint
 *   Action: Request badge mint authorization
 *   Wallet: 0x29f38b1ed360acf9c09aaf46de9933d9d19770fb
 *   Badge ID: first-pred
 *   Token ID: 1
 *   Timestamp: 2026-06-04T12:00:00.000Z
 */
export function buildBadgeMintRequestMessage(params: BadgeMintRequestParams): string {
  return [
    'PrediXI Badge Mint',
    `Action: ${BADGE_MINT_REQUEST_ACTION}`,
    `Wallet: ${params.walletAddress.toLowerCase()}`,
    `Badge ID: ${params.badgeId}`,
    `Token ID: ${params.tokenId}`,
    `Timestamp: ${params.signedAt}`,
  ].join('\n')
}

/** Canonical action string embedded in every mint request message. */
export const BADGE_MINT_REQUEST_ACTION = 'Request badge mint authorization'

/** Maximum age before the server rejects a mint request signature (10 minutes). */
export const BADGE_MINT_REQUEST_MAX_AGE_MS = 10 * 60 * 1000
