/**
 * World Cup Settlement — pure settlement helpers, no HTTP/routes.
 *
 * Used by: /api/admin/settle-worldcup
 *
 * Design:
 * - settleWCPrediction() handles one wc_predictions row end-to-end:
 *     update status → insert xp_events → update leaderboard_stats
 * - Duplicate-safe: xp_events unique constraint (wallet, source_type, source_id)
 * - Idempotent: already-settled rows are detected and skipped by the caller
 *   (query filters on status='pending')
 * - No blockchain, no public UI, no bracket logic
 */

import { getServerSupabaseClient } from '@/lib/supabase/server'
import { awardReferralBonus }       from '@/lib/referrals/awardReferralBonus'

type Supabase = ReturnType<typeof getServerSupabaseClient>

// ── Public types ──────────────────────────────────────────────────────────────

export type WCPredictionRow = {
  id:             string
  wallet_address: string
  prediction_key: string
  selected_value: string[]
  xp_reward:      number
  status:         string
}

export type WCSettleResult = {
  predictionId:   string
  walletAddress:  string
  predictionKey:  string
  isWinner:       boolean
  xpAwarded:      number
  xpDuplicate:    boolean
  error?:         string
}

// ── Correctness check ─────────────────────────────────────────────────────────
// Comparison is case-insensitive and trim-normalized.
//
// Single-pick ("wc-champion"): selected_value = ["Brazil"]
//   → correct if "brazil" is in the correctValues set
//
// Multi-pick ("wc-finalist"): selected_value = ["Brazil", "France"]
//   → correct if every selected value is in the correctValues set
//
// An empty selection is always incorrect.

export function isWCPredictionCorrect(
  selected:      string[],
  correctValues: string[],
): boolean {
  if (selected.length === 0 || correctValues.length === 0) return false
  const normalize = (s: string) => s.trim().toLowerCase()
  const correct   = new Set(correctValues.map(normalize))
  return selected.map(normalize).every(v => correct.has(v))
}

// ── Leaderboard XP increment (XP-only — no prediction count changes) ──────────

async function incrementLeaderboardXP(
  supabase:  Supabase,
  profileId: string,
  xpDelta:   number,
): Promise<void> {
  const periods = ['all_time', 'weekly'] as const

  for (const period of periods) {
    const { data: existing } = await supabase
      .from('leaderboard_stats')
      .select('id, xp, weekly_xp')
      .eq('profile_id', profileId)
      .eq('period', period)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('leaderboard_stats')
        .update({
          xp:          (existing.xp      ?? 0) + xpDelta,
          weekly_xp:   period === 'weekly'
            ? (existing.weekly_xp ?? 0) + xpDelta
            : (existing.weekly_xp ?? 0),
          computed_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    } else {
      await supabase
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
    }
  }
}

// ── Core settlement function ───────────────────────────────────────────────────
//
// Settles one wc_predictions row.
// Caller must guarantee the row is in 'pending' status before calling.

export async function settleWCPrediction(
  supabase:      Supabase,
  row:           WCPredictionRow,
  correctValues: string[],
): Promise<WCSettleResult> {
  const result: WCSettleResult = {
    predictionId:  row.id,
    walletAddress: row.wallet_address,
    predictionKey: row.prediction_key,
    isWinner:      false,
    xpAwarded:     0,
    xpDuplicate:   false,
  }

  try {
    const isWinner = isWCPredictionCorrect(row.selected_value, correctValues)
    result.isWinner = isWinner
    const xpAwarded = isWinner ? (row.xp_reward ?? 0) : 0
    result.xpAwarded = xpAwarded

    // ── Update wc_predictions status ─────────────────────────────────────────
    const { error: updateErr } = await supabase
      .from('wc_predictions')
      .update({
        status:     isWinner ? 'won' : 'lost',
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)

    if (updateErr) {
      result.error = `status update failed: ${updateErr.message}`
      return result
    }

    // ── xp_events (winners only, duplicate-safe) ──────────────────────────────
    if (isWinner && xpAwarded > 0) {
      const { error: xpErr } = await supabase
        .from('xp_events')
        .insert({
          wallet_address: row.wallet_address,
          source_type:    'wc_prediction',
          source_id:      row.id,
          xp_amount:      xpAwarded,
          reason:         'wc_prediction_correct',
          metadata:       {
            predictionKey:  row.prediction_key,
            selectedValue:  row.selected_value,
            correctValues,
          },
        })

      if (xpErr) {
        if (xpErr.code === '23505') {
          result.xpDuplicate = true   // XP already inserted — idempotent, not an error
        } else {
          console.error(`[settle-worldcup] xp_events [${row.id}]:`, xpErr)
          // Non-fatal — status already updated, continue
        }
      }

      // ── leaderboard_stats XP increment (skip if XP already inserted) ───────
      if (!result.xpDuplicate) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('wallet_address', row.wallet_address)
          .maybeSingle()

        if (profile?.id) {
          // Atomically increment profiles.xp — was previously missing from this path
          const { error: xpRpcErr } = await supabase
            .rpc('increment_profile_xp', { p_id: profile.id as string, p_delta: xpAwarded })
          if (xpRpcErr) {
            console.warn('[settleWCPrediction] profiles.xp rpc error:', xpRpcErr.message)
          }

          await incrementLeaderboardXP(supabase, profile.id as string, xpAwarded)
        }

        // ── Referral bonus — 10% of earned XP to referrer (non-fatal) ────────
        try {
          await awardReferralBonus({
            supabase,
            referredWallet:     row.wallet_address.toLowerCase(),
            originalXp:         xpAwarded,
            originalSourceType: 'wc_prediction',
            originalSourceId:   row.id,
          })
        } catch (e) {
          console.warn('[settleWCPrediction] referral bonus error:', e)
        }
      }
    }

  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e)
  }

  return result
}
