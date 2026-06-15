/**
 * Server-side canonical WC prediction configuration.
 *
 * XP values here are the single source of truth.  POST /api/wc-predictions
 * rejects any request whose client-supplied xpReward does not match exactly,
 * and re-derives the commitment hash using the canonical value — so an attacker
 * cannot inflate their XP by submitting an on-chain tx with a higher xpReward.
 *
 * Group winner keys follow the pattern produced by world-cup/page.tsx:
 *   `wc-group-${g.name.toLowerCase().replace(" ", "-")}`
 * e.g. "Group A" → "wc-group-group-a"
 */

// ── Named predictions ────────────────────────────────────────────────────────

const NAMED_PREDICTION_XP: Record<string, number> = {
  'wc-champion':         200,
  'wc-finalist':         120,
  'wc-golden-boot':      100,
  'wc-golden-glove':      80,
  'wc-dark-horse':       150,
  'wc-most-goals-team':   60,
  'wc-best-young':        80,
  'wc-surprise-team':    120,
  'wc-first-red':         30,
}

// ── Group winner predictions (Groups A–L, XP = 40 each) ─────────────────────

const GROUP_WINNER_XP = 40

// Keys produced by: `wc-group-${g.name.toLowerCase().replace(" ", "-")}`
// for group names "Group A" through "Group L" → "wc-group-group-a" … "wc-group-group-l"
const GROUP_WINNER_RE = /^wc-group-group-[a-l]$/

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the canonical XP reward for a prediction key, or null if the key
 * is not recognised.  A null result means the request should be rejected.
 */
export function getCanonicalWCXpReward(predictionKey: string): number | null {
  const named = NAMED_PREDICTION_XP[predictionKey]
  if (named !== undefined) return named
  if (GROUP_WINNER_RE.test(predictionKey)) return GROUP_WINNER_XP
  return null
}
