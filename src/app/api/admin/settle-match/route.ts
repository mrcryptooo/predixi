/**
 * POST /api/admin/settle-match
 *
 * Admin-only route. Settles a match by:
 *   1. Marking each unsettled prediction (is_correct, points_awarded)
 *   2. Updating profiles.xp / rank / counts
 *   3. Writing to xp_events ledger (duplicate-safe — re-runs are idempotent)
 *   4. Upserting leaderboard_stats for all_time + weekly periods
 *
 * Auth:   x-admin-key header must match ADMIN_SETTLEMENT_KEY env var.
 * Body:   { matchId: string, actualResult: "home" | "draw" | "away" }
 *
 * XP:    25 for correct predictions · 0 for incorrect
 *
 * Idempotency:
 *   - Checks matches.actual_outcome first — already-settled match → 409
 *   - Only processes predictions where is_correct IS NULL
 *   - xp_events unique constraint prevents double XP ledger entries
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'
import {
  OUTCOME_TO_DB,
  settlePrediction,
  type MatchOutcome,
  type PredictionRecord,
} from '@/lib/settlement'
import { checkAndAwardBadges }            from '@/lib/badges/checkAndAward'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const VALID_RESULTS = new Set<MatchOutcome>(['home', 'draw', 'away'])

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/settle-match
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const adminKey = process.env.ADMIN_SETTLEMENT_KEY
  if (!adminKey) {
    console.error('[admin/settle-match] ADMIN_SETTLEMENT_KEY env var not set')
    return err('Settlement not configured on this server', 500)
  }
  const headerKey = req.headers.get('x-admin-key')
  if (!headerKey || headerKey !== adminKey) {
    return err('Unauthorized', 401)
  }

  // ── 2. Parse + validate body ───────────────────────────────────────────────
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return err('Invalid JSON body', 400) }

  const { matchId, actualResult } = body

  if (!matchId || typeof matchId !== 'string' || matchId.trim() === '') {
    return err('matchId is required', 400)
  }
  if (!actualResult || !VALID_RESULTS.has(actualResult as MatchOutcome)) {
    return err('actualResult must be one of: home, draw, away', 400)
  }

  const matchIdClean = (matchId as string).trim()
  const result       = actualResult as MatchOutcome
  const dbOutcome    = OUTCOME_TO_DB[result]   // 'H' | 'D' | 'A'
  const supabase     = getServerSupabaseClient()

  // ── 3. Check if match already settled ─────────────────────────────────────
  const { data: match } = await supabase
    .from('matches')
    .select('id, actual_outcome')
    .eq('id', matchIdClean)
    .maybeSingle()

  if (match?.actual_outcome) {
    return NextResponse.json({
      success:        false,
      alreadySettled: true,
      error: `Match ${matchIdClean} is already settled (${match.actual_outcome}). No changes made.`,
    }, { status: 409 })
  }

  // ── 4. Fetch unsettled predictions ────────────────────────────────────────
  const { data: predictions, error: predErr } = await supabase
    .from('predictions')
    .select(`
      id,
      outcome,
      profile_id,
      is_correct,
      profiles (
        id,
        wallet_address,
        xp,
        correct_predictions,
        total_predictions,
        created_at
      )
    `)
    .eq('match_id', matchIdClean)
    .is('is_correct', null)

  if (predErr) {
    console.error('[admin/settle-match] fetch predictions:', predErr)
    return err('Failed to fetch predictions', 500)
  }

  if (!predictions || predictions.length === 0) {
    return NextResponse.json({
      success:   true,
      matchId:   matchIdClean,
      result,
      settled:   0,
      correct:   0,
      xpAwarded: 0,
      message:   'No unsettled predictions found for this match.',
    })
  }

  // ── 5. Settle each prediction ──────────────────────────────────────────────
  let settledCount = 0
  let correctCount = 0
  let totalXp      = 0
  let duplicates   = 0
  const allErrors: string[] = []

  for (const pred of predictions as unknown as PredictionRecord[]) {
    const res = await settlePrediction(supabase, pred, dbOutcome, matchIdClean)

    if (res.errors.length > 0) {
      allErrors.push(...res.errors.map(e => `[pred:${res.predictionId}] ${e}`))
    } else {
      settledCount++
      if (res.isCorrect)  { correctCount++; totalXp += res.xpAwarded }
      if (res.duplicate)  { duplicates++ }
    }
  }

  // ── 6. Mark match as settled ───────────────────────────────────────────────
  if (match) {
    const { error: matchErr } = await supabase
      .from('matches')
      .update({ actual_outcome: dbOutcome })
      .eq('id', matchIdClean)

    if (matchErr) {
      console.error('[admin/settle-match] update match:', matchErr)
      // Non-fatal — predictions are settled; log and continue
    }
  }

  // ── 7. Settlement-time badge checks — streak + hat-trick ──────────────────
  // Run for every unique wallet affected by this match settlement.
  // Fire-and-forget: badge errors are logged but never block the settlement
  // response.  All badge writes are idempotent (DB unique constraints).
  if (settledCount > 0 && predictions && predictions.length > 0) {
    const seenProfiles = new Set<string>()

    for (const pred of predictions as unknown as Array<PredictionRecord & {
      profiles: { wallet_address: string; created_at?: string } | null | Array<{ wallet_address: string; created_at?: string }>
    }>) {
      const profile = Array.isArray(pred.profiles) ? pred.profiles[0] : pred.profiles
      if (!profile || seenProfiles.has(pred.profile_id)) continue
      seenProfiles.add(pred.profile_id)

      try {
        // Access created_at via Record cast — the untyped Supabase select
        // includes it because we added it to the profiles sub-select above,
        // but the PredictionRecord type in settlement.ts predates that addition.
        const profileCreatedAt =
          ((profile as Record<string, unknown>).created_at as string | undefined)
          ?? new Date().toISOString()

        await checkAndAwardBadges({
          walletAddress:    profile.wallet_address.toLowerCase(),
          profileId:        pred.profile_id,
          profileCreatedAt,
          trigger:          'settlement_sweep',
          supabase,
        })
      } catch (badgeErr) {
        console.warn(
          `[admin/settle-match] badge check error for profile ${pred.profile_id}:`,
          badgeErr instanceof Error ? badgeErr.message : String(badgeErr),
        )
      }
    }
  }

  // ── 8. Response ────────────────────────────────────────────────────────────
  return NextResponse.json({
    success:    allErrors.length === 0,
    matchId:    matchIdClean,
    result,
    dbOutcome,
    settled:    settledCount,
    correct:    correctCount,
    xpAwarded:  totalXp,
    duplicates: duplicates > 0 ? duplicates : undefined,
    errors:     allErrors.length > 0 ? allErrors : undefined,
  })
}
