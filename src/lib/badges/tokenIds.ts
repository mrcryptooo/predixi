/**
 * PrediXIBadges ERC-1155 token ID mapping
 *
 * Canonical source of truth for the relationship between string badge IDs
 * (used throughout the app and DB) and integer ERC-1155 token IDs (used
 * on the PrediXIBadges contract at 0x87231AA7FAeB23B3E674E905d7af4B1c91E10B2d).
 *
 * Contract constants (must stay in sync):
 *   MIN_TOKEN_ID = 1   (PrediXIBadges.MIN_TOKEN_ID)
 *   MAX_TOKEN_ID = 25  (PrediXIBadges.MAX_TOKEN_ID)
 *
 * Token IDs 20–25 are reserved for future badges. The metadata endpoint
 * returns 404 for reserved IDs until real badges are assigned to them.
 *
 * NEVER change an assigned token ID once the contract is deployed — token IDs
 * are immutable on-chain. Only append new IDs from the reserved range.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const MIN_BADGE_TOKEN_ID      = 1
export const MAX_ACTIVE_BADGE_TOKEN_ID = 19
export const MAX_BADGE_TOKEN_ID      = 25

// ─────────────────────────────────────────────────────────────────────────────
// Canonical mapping: token ID → badge ID
//
// Token IDs 1–19 correspond to the 19 current badges in src/data/badges.ts.
// Token IDs 20–25 are reserved.
// ─────────────────────────────────────────────────────────────────────────────

export const TOKEN_ID_TO_BADGE_ID: Readonly<Record<number, string>> = {
  1:  'first-pred',
  2:  'centurion',
  3:  'veteran',
  4:  'early-adopter',
  5:  'streak-3',
  6:  'streak-5',
  7:  'streak-9',
  8:  'streak-10',
  9:  'sharp-eye',
  10: 'oracle',
  11: 'hat-trick',
  12: 'pl-expert',
  13: 'la-liga-expert',
  14: 'bundesliga-expert',
  15: 'ligue1-expert',
  16: 'ucl-expert',
  17: 'el-clasico',
  18: 'worldcup-2026',
  19: 'worldcup-champion',
}

// ─────────────────────────────────────────────────────────────────────────────
// Derived reverse mapping: badge ID → token ID
// ─────────────────────────────────────────────────────────────────────────────

export const BADGE_TOKEN_IDS: Readonly<Record<string, number>> = Object.fromEntries(
  Object.entries(TOKEN_ID_TO_BADGE_ID).map(([tokenId, badgeId]) => [badgeId, Number(tokenId)])
)

// ─────────────────────────────────────────────────────────────────────────────
// Lookup helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the ERC-1155 token ID for a given badge string ID.
 * Returns undefined if the badge ID is not mapped (unknown or reserved).
 */
export function getTokenIdForBadge(badgeId: string): number | undefined {
  return BADGE_TOKEN_IDS[badgeId]
}

/**
 * Returns the badge string ID for a given ERC-1155 token ID.
 * Returns undefined for reserved IDs (20–25) and out-of-range IDs.
 */
export function getBadgeIdForTokenId(tokenId: number): string | undefined {
  return TOKEN_ID_TO_BADGE_ID[tokenId]
}

/**
 * Returns true if the token ID is within the valid contract range (1–25).
 * Does NOT distinguish between active (1–19) and reserved (20–25) IDs.
 */
export function isValidBadgeTokenId(tokenId: number): boolean {
  return Number.isInteger(tokenId) && tokenId >= MIN_BADGE_TOKEN_ID && tokenId <= MAX_BADGE_TOKEN_ID
}

/**
 * Returns true if the token ID maps to a currently active badge (1–19).
 * Returns false for reserved IDs (20–25) and out-of-range IDs.
 */
export function isActiveBadgeTokenId(tokenId: number): boolean {
  return isValidBadgeTokenId(tokenId) && tokenId <= MAX_ACTIVE_BADGE_TOKEN_ID
}
