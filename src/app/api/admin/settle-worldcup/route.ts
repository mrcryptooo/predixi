/**
 * POST /api/admin/settle-worldcup
 *
 * Admin-only. Settles all pending wc_predictions for a given predictionKey.
 * Awards XP to winners through xp_events and updates leaderboard_stats.
 *
 * Auth:      x-admin-key header vs ADMIN_SETTLEMENT_KEY env var
 * Idempotent: only processes rows with status='pending'
 *             xp_events unique constraint prevents duplicate XP
 * Safety:    No public UI changes. No automatic settlement. Admin-triggered only.
 *
 * Body:
 *   { "predictionKey": "wc-champion", "correctValues": ["Brazil"] }
 *
 * Response:
 *   { success, predictionKey, totalPredictions, winners, losers,
 *     totalXPAwarded, duplicates, errors }
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'
import { settleWCPrediction, type WCPredictionRow } from '@/lib/worldcup-settlement'
import { checkAndAwardBadges }                      from '@/lib/badges/checkAndAward'

// WC champion prediction keys that trigger the worldcup-champion badge.
// Must match WC_CHAMPION_KEYS in checkAndAward.ts.
const WC_CHAMPION_KEYS_LOCAL = new Set(['wc-champion'])

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function POST(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const adminKey = process.env.ADMIN_SETTLEMENT_KEY
  if (!adminKey) return err('Admin key not configured', 500)
  if (req.headers.get('x-admin-key') !== adminKey) return err('Unauthorized', 401)

  // ── Body ───────────────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return err('Invalid JSON body', 400) }

  const { predictionKey, correctValues } = body

  if (!predictionKey || typeof predictionKey !== 'string' || !(predictionKey as string).trim()) {
    return err('predictionKey is required', 400)
  }
  if (!Array.isArray(correctValues) || (correctValues as unknown[]).length === 0) {
    return err('correctValues must be a non-empty array of strings', 400)
  }
  // Ensure all correctValues are strings
  const normalizedCorrect = (correctValues as unknown[]).map(v => {
    if (typeof v !== 'string') throw new TypeError('correctValues entries must be strings')
    return v
  })

  const key = (predictionKey as string).trim()

  const supabase = getServerSupabaseClient()

  // ── Fetch all pending rows for this predictionKey ─────────────────────────
  const { data: rows, error: fetchErr } = await supabase
    .from('wc_predictions')
    .select('id, wallet_address, prediction_key, selected_value, xp_reward, status')
    .eq('prediction_key', key)
    .eq('status', 'pending')

  if (fetchErr) return err(`DB error: ${fetchErr.message}`, 500)

  const pending = (rows ?? []) as WCPredictionRow[]

  if (pending.length === 0) {
    return NextResponse.json({
      success:          true,
      predictionKey:    key,
      totalPredictions: 0,
      winners:          0,
      losers:           0,
      totalXPAwarded:   0,
      duplicates:       0,
      message:          'No pending predictions found for this key.',
    })
  }

  // ── Settle each prediction ────────────────────────────────────────────────
  let winners        = 0
  let losers         = 0
  let totalXPAwarded = 0
  let duplicates     = 0
  const errors: string[] = []
  // Track winner wallet addresses for post-loop badge awards
  const winnerWallets: string[] = []

  for (const row of pending) {
    const result = await settleWCPrediction(supabase, row, normalizedCorrect)

    if (result.error) {
      errors.push(`[${result.predictionId}] ${result.walletAddress}: ${result.error}`)
      continue
    }

    if (result.isWinner) {
      winners++
      winnerWallets.push(row.wallet_address.toLowerCase())
      if (result.xpDuplicate) {
        duplicates++
      } else {
        totalXPAwarded += result.xpAwarded
      }
    } else {
      losers++
    }
  }

  // ── Award worldcup-champion badge to winners (champion prediction only) ────
  // Only fires when this settlement is for the WC champion prediction key.
  // Badge logic is fire-and-forget: errors are logged but never block the response.
  if (WC_CHAMPION_KEYS_LOCAL.has(key) && winnerWallets.length > 0) {
    for (const walletAddress of winnerWallets) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, created_at')
          .eq('wallet_address', walletAddress)
          .maybeSingle()

        if (profile) {
          await checkAndAwardBadges({
            walletAddress,
            profileId:        profile.id as string,
            profileCreatedAt: profile.created_at as string,
            trigger:          'worldcup_settle',
            supabase,
          })
        }
      } catch (badgeErr) {
        console.warn(
          `[settle-worldcup] worldcup-champion badge error for ${walletAddress}:`,
          badgeErr instanceof Error ? badgeErr.message : String(badgeErr),
        )
      }
    }
  }

  if (errors.length > 0) {
    console.error('[settle-worldcup] errors:', errors)
  }

  return NextResponse.json({
    success:          errors.length < pending.length,   // true if at least partial
    predictionKey:    key,
    correctValues:    normalizedCorrect,
    totalPredictions: pending.length,
    winners,
    losers,
    totalXPAwarded,
    duplicates,
    errors:           errors.length > 0 ? errors : undefined,
  })
}
