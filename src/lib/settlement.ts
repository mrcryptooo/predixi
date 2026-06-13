// ─────────────────────────────────────────────────────────────────────────────
// Settlement Engine — core logic for settling match predictions
//
// Used by: /api/admin/settle-match
// Integrates: xp_events ledger + leaderboard_stats + predictions + profiles
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import { computeRank as computeRankFromXP } from '@/lib/ranks'
import { awardReferralBonus }               from '@/lib/referrals/awardReferralBonus'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const CORRECT_PREDICTION_XP = 25   // XP awarded for a correct prediction
export const WRONG_PREDICTION_XP   = 0    // XP awarded for a wrong prediction

export type MatchOutcome = 'home' | 'draw' | 'away'

/** Maps the API-facing outcome strings to the DB outcome codes used in the predictions table. */
export const OUTCOME_TO_DB: Record<MatchOutcome, string> = {
  home: 'H',
  draw: 'D',
  away: 'A',
}

// ─────────────────────────────────────────────────────────────────────────────
// XP helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns XP to award based on whether the prediction was correct. */
export function calculatePredictionXP(isCorrect: boolean): number {
  return isCorrect ? CORRECT_PREDICTION_XP : WRONG_PREDICTION_XP
}

/**
 * Derives rank tier from total XP.
 * Delegates to the canonical implementation in src/lib/ranks.ts.
 */
export function computeRank(xp: number): string {
  return computeRankFromXP(xp)
}

// ─────────────────────────────────────────────────────────────────────────────
// awardXPEvent — write to xp_events ledger (duplicate-safe)
// ─────────────────────────────────────────────────────────────────────────────

export type AwardXPEventInput = {
  supabase:      SupabaseClient
  walletAddress: string          // lowercased
  matchId:       string
  predictionId:  string
  xpAmount:      number
  isCorrect:     boolean
}

/**
 * Inserts one record into xp_events for this match prediction settlement.
 * Duplicate-safe — unique constraint (wallet, source_type, source_id, reason)
 * means re-running settlement on the same prediction is a no-op.
 *
 * Returns { success, duplicate, error? }
 */
export async function awardXPEvent(input: AwardXPEventInput): Promise<{
  success:   boolean
  duplicate: boolean
  error?:    string
}> {
  const { supabase, walletAddress, matchId, predictionId, xpAmount, isCorrect } = input

  const { error } = await supabase
    .from('xp_events')
    .insert({
      wallet_address: walletAddress,
      source_type:    'match_prediction',
      source_id:      predictionId,
      xp_amount:      xpAmount,
      reason:         isCorrect ? 'correct_prediction' : 'wrong_prediction',
      metadata: {
        match_id:   matchId,
        is_correct: isCorrect,
        xp_awarded: xpAmount,
      },
    })

  if (error) {
    if (error.code === '23505') {
      return { success: true, duplicate: true }
    }
    return { success: false, duplicate: false, error: error.message }
  }

  return { success: true, duplicate: false }
}

// ─────────────────────────────────────────────────────────────────────────────
// updateLeaderboardStats — upsert leaderboard_stats for all_time + weekly
// ─────────────────────────────────────────────────────────────────────────────

export type UpdateLeaderboardInput = {
  supabase:     SupabaseClient
  profileId:    string
  xpDelta:      number   // XP to add (0 for wrong predictions)
  isCorrect:    boolean
}

/**
 * Upserts leaderboard_stats rows for `all_time` and `weekly` periods.
 * Increments xp, weekly_xp, total_predictions, correct_predictions, accuracy.
 * On first-time insert (no existing row), starts from zero + delta.
 *
 * Returns { success, errors[] }
 */
export async function updateLeaderboardStats(input: UpdateLeaderboardInput): Promise<{
  success: boolean
  errors:  string[]
}> {
  const { supabase, profileId, xpDelta, isCorrect } = input
  const errors: string[] = []

  const periods: Array<'all_time' | 'weekly'> = ['all_time', 'weekly']

  for (const period of periods) {
    // Fetch existing row (if any)
    const { data: existing } = await supabase
      .from('leaderboard_stats')
      .select('id, xp, weekly_xp, total_predictions, correct_predictions')
      .eq('profile_id', profileId)
      .eq('period', period)
      .maybeSingle()

    const prevXp      = existing?.xp                  ?? 0
    const prevWeekly  = existing?.weekly_xp            ?? 0
    const prevTotal   = existing?.total_predictions    ?? 0
    const prevCorrect = existing?.correct_predictions  ?? 0

    const newXp       = prevXp + xpDelta
    const newWeekly   = period === 'weekly' ? prevWeekly + xpDelta : prevWeekly
    const newTotal    = prevTotal + 1
    const newCorrect  = prevCorrect + (isCorrect ? 1 : 0)
    const newAccuracy = newTotal > 0
      ? parseFloat(((newCorrect / newTotal) * 100).toFixed(2))
      : 0

    if (existing) {
      const { error } = await supabase
        .from('leaderboard_stats')
        .update({
          xp:                  newXp,
          weekly_xp:           newWeekly,
          total_predictions:   newTotal,
          correct_predictions: newCorrect,
          accuracy:            newAccuracy,
          computed_at:         new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (error) {
        errors.push(`leaderboard_stats [${period}] update: ${error.message}`)
      }
    } else {
      const { error } = await supabase
        .from('leaderboard_stats')
        .insert({
          profile_id:          profileId,
          period,
          xp:                  newXp,
          weekly_xp:           newWeekly,
          total_predictions:   newTotal,
          correct_predictions: newCorrect,
          accuracy:            newAccuracy,
          position:            null,
          computed_at:         new Date().toISOString(),
        })

      if (error) {
        errors.push(`leaderboard_stats [${period}] insert: ${error.message}`)
      }
    }
  }

  return { success: errors.length === 0, errors }
}

// ─────────────────────────────────────────────────────────────────────────────
// settlePrediction — settle one prediction row end-to-end
// ─────────────────────────────────────────────────────────────────────────────

export type PredictionRecord = {
  id:         string
  outcome:    string
  profile_id: string
  profiles:   {
    id:                  string
    wallet_address:      string
    xp:                  number | null
    correct_predictions: number | null
    total_predictions:   number | null
  } | Array<{
    id:                  string
    wallet_address:      string
    xp:                  number | null
    correct_predictions: number | null
    total_predictions:   number | null
  }> | null
}

export type SettlePredictionResult = {
  predictionId: string
  profileId:    string
  isCorrect:    boolean
  xpAwarded:    number
  duplicate:    boolean
  errors:       string[]
}

/**
 * Settles a single prediction end-to-end:
 * 1. Marks prediction row (is_correct, points_awarded)
 * 2. Updates profiles.xp / rank / counts
 * 3. Inserts into xp_events (duplicate-safe)
 * 4. Upserts leaderboard_stats (all_time + weekly)
 *
 * Returns a result summary — never throws.
 */
export async function settlePrediction(
  supabase:   SupabaseClient,
  pred:       PredictionRecord,
  outcome:    string,   // DB outcome code: 'H' | 'D' | 'A'
  matchId:    string,
): Promise<SettlePredictionResult> {
  const errors: string[] = []
  const isCorrect   = pred.outcome === outcome
  const xpAwarded   = calculatePredictionXP(isCorrect)
  let   isDuplicate = false

  const profile = Array.isArray(pred.profiles) ? pred.profiles[0] : pred.profiles

  // ── 1. Mark prediction row ─────────────────────────────────────────────────
  const { error: predErr } = await supabase
    .from('predictions')
    .update({ is_correct: isCorrect, points_awarded: xpAwarded })
    .eq('id', pred.id)

  if (predErr) {
    errors.push(`prediction update: ${predErr.message}`)
    return { predictionId: pred.id, profileId: pred.profile_id, isCorrect, xpAwarded: 0, duplicate: false, errors }
  }

  // ── 2. Update profiles ─────────────────────────────────────────────────────
  if (!profile) {
    errors.push('profile not found')
  } else {
    const newXp      = (profile.xp                  ?? 0) + xpAwarded
    const newCorrect = (profile.correct_predictions  ?? 0) + (isCorrect ? 1 : 0)
    const newTotal   = (profile.total_predictions    ?? 0) + 1
    const newRank    = computeRank(newXp)

    // Update non-XP fields (rank, counts) — xp handled atomically below
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({
        correct_predictions: newCorrect,
        total_predictions:   newTotal,
        rank:                newRank,
      })
      .eq('id', pred.profile_id)

    if (profileErr) {
      errors.push(`profile update: ${profileErr.message}`)
    }

    // Atomically increment profiles.xp — avoids read-then-write race
    if (xpAwarded > 0) {
      const { error: xpRpcErr } = await supabase
        .rpc('increment_profile_xp', { p_id: pred.profile_id, p_delta: xpAwarded })
      if (xpRpcErr) {
        errors.push(`profile xp rpc: ${xpRpcErr.message}`)
      }
    }

    // ── 3. xp_events ledger ──────────────────────────────────────────────────
    const xpResult = await awardXPEvent({
      supabase,
      walletAddress: profile.wallet_address.toLowerCase(),
      matchId,
      predictionId:  pred.id,
      xpAmount:      xpAwarded,
      isCorrect,
    })

    if (!xpResult.success) {
      errors.push(`xp_events: ${xpResult.error ?? 'unknown error'}`)
    }
    if (xpResult.duplicate) {
      isDuplicate = true
    }

    // ── 3b. Referral bonus — 10% of earned XP to referrer (non-fatal) ────────
    if (xpResult.success && !xpResult.duplicate && xpAwarded > 0) {
      try {
        await awardReferralBonus({
          supabase,
          referredWallet:     profile.wallet_address.toLowerCase(),
          originalXp:         xpAwarded,
          originalSourceType: 'match_prediction',
          originalSourceId:   pred.id,
        })
      } catch (e) {
        console.warn('[settlePrediction] referral bonus error:', e)
      }
    }

    // ── 4. leaderboard_stats ─────────────────────────────────────────────────
    const lbResult = await updateLeaderboardStats({
      supabase,
      profileId: pred.profile_id,
      xpDelta:   xpAwarded,
      isCorrect,
    })

    if (!lbResult.success) {
      errors.push(...lbResult.errors)
    }
  }

  return {
    predictionId: pred.id,
    profileId:    pred.profile_id,
    isCorrect,
    xpAwarded,
    duplicate:    isDuplicate,
    errors,
  }
}
