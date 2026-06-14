/**
 * Rank Tier System — single source of truth for PrediXI rank definitions.
 *
 * Replaces the duplicated computeRank() that lived in settlement.ts.
 * Import computeRank from here everywhere — it is a compatibility shim
 * that delegates to getRankFromXP().
 *
 * ── Tier thresholds ───────────────────────────────────────────────────────────
 *
 *   Bronze      0 –   99 XP
 *   Silver    100 –  399 XP
 *   Gold      400 –  999 XP
 *   Platinum 1000 – 1999 XP
 *   Diamond  2000 – 3499 XP
 *   Legend   3500+    XP
 *
 *   Reserved (not yet live): Mythic / GOAT / World Class — future 10 000+ XP prestige tier.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type RankId = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'legend'

export type RankTier = {
  id:        RankId
  label:     string
  minXp:     number
  maxXp:     number | null   // null = no upper bound (Legend)
  color:     string          // CSS hex for UI use
  emoji:     string
}

export type RankProgress = {
  tier:        RankTier
  nextTier:    RankTier | null
  xpInTier:   number   // XP earned within this tier
  xpForTier:  number   // XP span of this tier (0 if Legend)
  progressPct: number  // 0–100 within tier
}

// ── Tier definitions (ordered lowest → highest) ───────────────────────────────

export const RANK_TIERS: readonly RankTier[] = [
  { id: 'bronze',   label: 'Bronze',   minXp:    0, maxXp:   99, color: '#cd7f32', emoji: '🥉' },
  { id: 'silver',   label: 'Silver',   minXp:  100, maxXp:  399, color: '#c0c0c0', emoji: '🥈' },
  { id: 'gold',     label: 'Gold',     minXp:  400, maxXp:  999, color: '#ffd700', emoji: '🥇' },
  { id: 'platinum', label: 'Platinum', minXp: 1000, maxXp: 1999, color: '#e5e4e2', emoji: '💎' },
  { id: 'diamond',  label: 'Diamond',  minXp: 2000, maxXp: 3499, color: '#b9f2ff', emoji: '💠' },
  { id: 'legend',   label: 'Legend',   minXp: 3500, maxXp: null, color: '#ff6b35', emoji: '👑' },
] as const

// ── Core helpers ──────────────────────────────────────────────────────────────

/** Returns the rank tier for a given XP total. Never throws. */
export function getRankFromXP(xp: number): RankTier {
  const safeXp = Math.max(0, xp ?? 0)
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (safeXp >= RANK_TIERS[i].minXp) return RANK_TIERS[i] as RankTier
  }
  return RANK_TIERS[0] as RankTier  // bronze fallback
}

/** Returns the next rank tier, or null if already at Legend. */
export function getNextRank(currentXp: number): RankTier | null {
  const current  = getRankFromXP(currentXp)
  const idx      = RANK_TIERS.findIndex(t => t.id === current.id)
  return idx < RANK_TIERS.length - 1 ? (RANK_TIERS[idx + 1] as RankTier) : null
}

/**
 * Returns full rank progress metadata for a given XP total.
 * Useful for profile pages and rank-progress UI components.
 */
export function getRankProgress(currentXp: number): RankProgress {
  const safeXp  = Math.max(0, currentXp ?? 0)
  const tier     = getRankFromXP(safeXp)
  const nextTier = getNextRank(safeXp)

  if (!nextTier) {
    // Legend — no upper bound
    return {
      tier,
      nextTier:    null,
      xpInTier:   safeXp - tier.minXp,
      xpForTier:  0,
      progressPct: 100,
    }
  }

  const xpInTier   = safeXp - tier.minXp
  const xpForTier  = nextTier.minXp - tier.minXp
  const progressPct = Math.min(100, Math.round((xpInTier / xpForTier) * 100))

  return { tier, nextTier, xpInTier, xpForTier, progressPct }
}

/**
 * Compatibility shim — drop-in replacement for the computeRank() that
 * previously lived in settlement.ts.  Returns lowercase rank ID string.
 */
export function computeRank(xp: number): RankId {
  return getRankFromXP(xp).id
}
