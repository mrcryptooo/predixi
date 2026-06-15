// ─────────────────────────────────────────────────────────────────────────────
// SPIN Engine — probability table, cooldown logic, and leaderboard XP writes
//
// Used by:
//   /api/spin/prepare   (outcome selection + cooldown check)
//   /api/spin/claim     (leaderboard XP update)
//   /api/spin/status    (cooldown check)
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'

// ── Constants ─────────────────────────────────────────────────────────────────

export const SPINS_PER_DAY       = 3
export const SPIN_COOLDOWN_HOURS = 8
export const SPIN_EXPIRY_MINUTES = 15

// ── Probability table (Table A — Jackpot-Heavy) ───────────────────────────────
//
// EV = 13.3 XP/spin · 39.9 XP/day (3 spins)
//
// Visual-only segments ($1 / $5 / $10) are defined in VISUAL_ONLY_SEGMENTS.
// They carry probability = 0 and are NEVER included in the server-side draw.
// The client may display them on the wheel; the outcome engine ignores them.

export const SPIN_REWARD_TIERS = [
  { xp:   5, probability: 0.500, segmentIndex: 0, label:   '5 XP' },
  { xp:  10, probability: 0.250, segmentIndex: 1, label:  '10 XP' },
  { xp:  15, probability: 0.120, segmentIndex: 2, label:  '15 XP' },
  { xp:  25, probability: 0.070, segmentIndex: 3, label:  '25 XP' },
  { xp:  50, probability: 0.040, segmentIndex: 4, label:  '50 XP' },
  { xp: 100, probability: 0.015, segmentIndex: 5, label: '100 XP' },
  { xp: 250, probability: 0.005, segmentIndex: 6, label: '250 XP' },
] as const

// Visual-only — probability = 0, never returned by selectSpinOutcome()
export const VISUAL_ONLY_SEGMENTS = [
  { label: '$1',  segmentIndex: 7 },
  { label: '$5',  segmentIndex: 8 },
  { label: '$10', segmentIndex: 9 },
] as const

// ── Types ─────────────────────────────────────────────────────────────────────

export type SpinOutcome = {
  xp:           number
  segmentIndex: number
  label:        string
}

export type SpinStatus = {
  spinsToday:     number
  spinsRemaining: number
  cooldownActive: boolean
  nextSpinAt:     string | null   // ISO — when next spin is available; null if ready now
  canSpin:        boolean
  reason?:        'daily_limit_reached' | 'cooldown_active'
}

// ── Outcome selection ─────────────────────────────────────────────────────────

/**
 * Draws a spin outcome from SPIN_REWARD_TIERS using cumulative probability.
 * Dollar segments ($1/$5/$10) are excluded from this draw — they exist only
 * as visual wheel segments and can never be returned here.
 */
export function selectSpinOutcome(): SpinOutcome {
  const rand = Math.random()
  let cumulative = 0
  for (const tier of SPIN_REWARD_TIERS) {
    cumulative += tier.probability
    if (rand < cumulative) {
      return { xp: tier.xp, segmentIndex: tier.segmentIndex, label: tier.label }
    }
  }
  // Floating-point edge: rand is exactly 1.0 — fall back to first tier
  const first = SPIN_REWARD_TIERS[0]
  return { xp: first.xp, segmentIndex: first.segmentIndex, label: first.label }
}

// ── Cooldown + daily-limit check ──────────────────────────────────────────────

export async function getSpinStatus(
  supabase:      SupabaseClient,
  walletAddress: string,
): Promise<SpinStatus> {
  const wallet      = walletAddress.toLowerCase()
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // How many claimed spins in the last 24 h?
  const { count } = await supabase
    .from('spin_entries')
    .select('id', { count: 'exact', head: true })
    .eq('wallet_address', wallet)
    .eq('status', 'claimed')
    .gte('claimed_at', windowStart)

  const spinsToday  = count ?? 0
  const remaining   = Math.max(0, SPINS_PER_DAY - spinsToday)

  if (remaining === 0) {
    // Next spin available when the oldest spin in the 24 h window ages out
    const { data: oldest } = await supabase
      .from('spin_entries')
      .select('claimed_at')
      .eq('wallet_address', wallet)
      .eq('status', 'claimed')
      .gte('claimed_at', windowStart)
      .order('claimed_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    const nextSpinAt = oldest?.claimed_at
      ? new Date(new Date(oldest.claimed_at).getTime() + 24 * 60 * 60 * 1000).toISOString()
      : null

    return {
      spinsToday,
      spinsRemaining: 0,
      cooldownActive: true,
      nextSpinAt,
      canSpin:        false,
      reason:         'daily_limit_reached',
    }
  }

  // Check 8-hour cooldown from the most recent claimed spin
  const { data: lastSpin } = await supabase
    .from('spin_entries')
    .select('claimed_at')
    .eq('wallet_address', wallet)
    .eq('status', 'claimed')
    .order('claimed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastSpin?.claimed_at) {
    const cooldownUntil = new Date(
      new Date(lastSpin.claimed_at).getTime() + SPIN_COOLDOWN_HOURS * 60 * 60 * 1000,
    )
    if (cooldownUntil > new Date()) {
      return {
        spinsToday,
        spinsRemaining: remaining,
        cooldownActive: true,
        nextSpinAt:     cooldownUntil.toISOString(),
        canSpin:        false,
        reason:         'cooldown_active',
      }
    }
  }

  return {
    spinsToday,
    spinsRemaining: remaining,
    cooldownActive: false,
    nextSpinAt:     null,
    canSpin:        true,
  }
}

// ── Leaderboard XP update (SPIN-specific) ────────────────────────────────────
//
// Unlike updateLeaderboardStats in settlement.ts, this function only touches
// xp / weekly_xp columns — it does NOT increment total_predictions or
// correct_predictions, which are prediction-only metrics.

export async function updateLeaderboardXpForSpin(
  supabase:  SupabaseClient,
  profileId: string,
  xpDelta:   number,
): Promise<{ success: boolean; errors: string[] }> {
  const errors:  string[] = []
  const periods: Array<'all_time' | 'weekly'> = ['all_time', 'weekly']

  for (const period of periods) {
    const { data: existing } = await supabase
      .from('leaderboard_stats')
      .select('id, xp, weekly_xp')
      .eq('profile_id', profileId)
      .eq('period', period)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from('leaderboard_stats')
        .update({
          xp:          (existing.xp       ?? 0) + xpDelta,
          weekly_xp:   period === 'weekly'
                         ? (existing.weekly_xp ?? 0) + xpDelta
                         : (existing.weekly_xp ?? 0),
          computed_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
      if (error) errors.push(`leaderboard_stats [${period}] update: ${error.message}`)
    } else {
      const { error } = await supabase
        .from('leaderboard_stats')
        .insert({
          profile_id:          profileId,
          period,
          xp:                  xpDelta,
          weekly_xp:           period === 'weekly' ? xpDelta : 0,
          total_predictions:   0,
          correct_predictions: 0,
          accuracy:            0,
          position:            null,
          computed_at:         new Date().toISOString(),
        })
      if (error) errors.push(`leaderboard_stats [${period}] insert: ${error.message}`)
    }
  }

  return { success: errors.length === 0, errors }
}
