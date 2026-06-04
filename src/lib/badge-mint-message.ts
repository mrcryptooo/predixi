/**
 * Badge mint message helpers.
 *
 * The two-signature flow (EIP-191 wallet messages for GET mint-signature and
 * PATCH /api/badges) was removed in Phase 6D. The mint flow is now single-
 * transaction — no pre-mint or post-mint wallet message signatures.
 *
 * BADGE_MINT_REQUEST_MAX_AGE_MS is kept as it is still used by
 * GET /api/badges/mint-signature to set the `expiresAt` field on the
 * returned EIP-712 authorisation.
 */

/** Window before which a mint authorisation signature expires (10 minutes). */
export const BADGE_MINT_REQUEST_MAX_AGE_MS = 10 * 60 * 1000
