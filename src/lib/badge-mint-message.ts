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

// ─────────────────────────────────────────────────────────────────────────────
// Confirm mint message — used by PATCH /api/badges
//
// The user wallet signs this message after the mintBadge() TX confirms on Base.
// The message binds wallet + badgeId + tokenId + txHash + nonce so the
// PATCH signature cannot be replayed for a different badge, tx, or nonce.
// ─────────────────────────────────────────────────────────────────────────────

export interface BadgeMintConfirmParams {
  /** Ethereum wallet address — normalised to lowercase in the output. */
  walletAddress: string
  /** Badge string ID (e.g. 'first-pred'). */
  badgeId: string
  /** ERC-1155 token ID (1–19). */
  tokenId: number
  /** 0x-prefixed 64-hex Base Mainnet transaction hash from mintBadge() call. */
  txHash: string
  /** bytes32 nonce from badge_mint_nonces (returned by GET mint-signature). */
  nonce: string
  /** ISO 8601 timestamp — embed Date.now() before signing. */
  signedAt: string
}

/**
 * Returns the canonical EIP-191 personal_sign message for confirming that a
 * badge has been minted on Base and requesting the backend to persist the state.
 *
 * Example output:
 *   PrediXI Badge Mint
 *   Action: Confirm badge mint on Base
 *   Wallet: 0x29f38b1ed360acf9c09aaf46de9933d9d19770fb
 *   Badge ID: first-pred
 *   Token ID: 1
 *   Tx Hash: 0x10f60f220cbd79ea5c09e8385ca7e158946805f5297f4c3acf2b91cdb5edfc4d
 *   Nonce: 0x3f7a...
 *   Timestamp: 2026-06-04T12:00:00.000Z
 */
export function buildBadgeMintConfirmMessage(params: BadgeMintConfirmParams): string {
  return [
    'PrediXI Badge Mint',
    `Action: ${BADGE_MINT_CONFIRM_ACTION}`,
    `Wallet: ${params.walletAddress.toLowerCase()}`,
    `Badge ID: ${params.badgeId}`,
    `Token ID: ${params.tokenId}`,
    `Tx Hash: ${params.txHash.toLowerCase()}`,
    `Nonce: ${params.nonce.toLowerCase()}`,
    `Timestamp: ${params.signedAt}`,
  ].join('\n')
}

/** Canonical action string embedded in every mint confirm message. */
export const BADGE_MINT_CONFIRM_ACTION = 'Confirm badge mint on Base'
