/**
 * POST /api/settle-match
 *
 * Admin-only route. Settles a match by awarding XP to correct predictors.
 *
 * Auth:   x-admin-secret header must match SETTLEMENT_ADMIN_SECRET env var.
 * Body:   { matchId: string, actualOutcome: "H" | "D" | "A" }
 *
 * Idempotency:
 *   - Checks matches.actual_outcome first; if already set → skips (no double award).
 *   - Only processes predictions where is_correct IS NULL (unsettled).
 *
 * XP formula (Phase 1 / MVP):
 *   - Correct:  10 XP, is_correct = true
 *   - Wrong:     0 XP, is_correct = false
 *
 * Rank thresholds: see src/lib/ranks.ts (single source of truth).
 *
 * TODO (future): streak updates, match multiplier, underdog bonus.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'
import { computeRank }                    from '@/lib/ranks'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const BASE_XP      = 10
type Outcome = 'H' | 'D' | 'A'
const VALID_OUTCOMES = new Set<Outcome>(['H', 'D', 'A'])

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function err(msg: string, status: number) {
  return NextResponse.json({ success: false, error: msg }, { status })
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/settle-match
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── 1. Admin secret check ──────────────────────────────────────────────────
  const adminSecret = process.env.SETTLEMENT_ADMIN_SECRET
  if (!adminSecret) {
    console.error('[settle-match] SETTLEMENT_ADMIN_SECRET env var not set')
    return err('Settlement not configured on this server', 500)
  }
  const headerSecret = req.headers.get('x-admin-secret')
  if (!headerSecret || headerSecret !== adminSecret) {
    return err('Unauthorized', 401)
  }

  // ── 2. Parse + validate body ───────────────────────────────────────────────
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return err('Invalid JSON body', 400) }

  const { matchId, actualOutcome } = body
  if (!matchId || typeof matchId !== 'string' || matchId.trim() === '') {
    return err('matchId is required', 400)
  }
  if (!actualOutcome || !VALID_OUTCOMES.has(actualOutcome as Outcome)) {
    return err('actualOutcome must be H, D, or A', 400)
  }

  const matchIdClean    = (matchId as string).trim()
  const outcome         = actualOutcome as Outcome
  const supabase        = getServerSupabaseClient()

  // ── 3. Check if match is already settled ──────────────────────────────────
  const { data: match } = await supabase
    .from('matches')
    .select('id, actual_outcome')
    .eq('id', matchIdClean)
    .maybeSingle()

  if (match?.actual_outcome) {
    return NextResponse.json({
      success:  false,
      alreadySettled: true,
      error:    `Match ${matchIdClean} is already settled (${match.actual_outcome}). No XP awarded.`,
    }, { status: 409 })
  }

  // ── 4. Fetch unsettled predictions for this match ─────────────────────────
  // Join profiles so we can read current xp/counts and write back in one pass.
  const { data: predictions, error: predErr } = await supabase
    .from('predictions')
    .select(`
      id,
      outcome,
      profile_id,
      is_correct,
      profiles (
        id,
        xp,
        correct_predictions,
        total_predictions
      )
    `)
    .eq('match_id', matchIdClean)
    .is('is_correct', null)   // unsettled only

  if (predErr) {
    console.error('[settle-match] fetch predictions:', predErr)
    return err('Failed to fetch predictions', 500)
  }

  if (!predictions || predictions.length === 0) {
    return NextResponse.json({
      success:  true,
      matchId:  matchIdClean,
      settled:  0,
      correct:  0,
      xpAwarded: 0,
      message:  'No unsettled predictions found for this match.',
    })
  }

  // ── 5. Settle each prediction + update its profile ────────────────────────
  let settledCount = 0
  let correctCount = 0
  let totalXp      = 0
  const errors: string[] = []

  for (const pred of predictions) {
    const isCorrect     = pred.outcome === outcome
    const pointsAwarded = isCorrect ? BASE_XP : 0

    // 5a. Update prediction row
    const { error: updatePredErr } = await supabase
      .from('predictions')
      .update({ is_correct: isCorrect, points_awarded: pointsAwarded })
      .eq('id', pred.id)

    if (updatePredErr) {
      errors.push(`prediction ${pred.id}: ${updatePredErr.message}`)
      continue
    }

    // 5b. Update profile
    const profile = Array.isArray(pred.profiles) ? pred.profiles[0] : pred.profiles
    if (!profile) {
      errors.push(`profile missing for prediction ${pred.id}`)
      continue
    }

    const newXp      = (profile.xp ?? 0) + pointsAwarded
    const newCorrect = (profile.correct_predictions ?? 0) + (isCorrect ? 1 : 0)
    const newTotal   = (profile.total_predictions   ?? 0) + 1
    const newRank    = computeRank(newXp)

    const { error: updateProfileErr } = await supabase
      .from('profiles')
      .update({
        xp:                  newXp,
        correct_predictions: newCorrect,
        total_predictions:   newTotal,
        rank:                newRank,
      })
      .eq('id', pred.profile_id)

    if (updateProfileErr) {
      errors.push(`profile ${pred.profile_id}: ${updateProfileErr.message}`)
      continue
    }

    settledCount++
    if (isCorrect) { correctCount++; totalXp += pointsAwarded }
  }

  // ── 6. Mark match as settled ───────────────────────────────────────────────
  // Only if the match row exists in DB (may be absent for mock-data-only matches).
  if (match) {
    const { error: matchErr } = await supabase
      .from('matches')
      .update({ actual_outcome: outcome })
      .eq('id', matchIdClean)

    if (matchErr) {
      console.error('[settle-match] update match:', matchErr)
      // Non-fatal: predictions are settled; log and continue.
    }
  }

  // ── 7. Return summary ──────────────────────────────────────────────────────
  return NextResponse.json({
    success:   errors.length === 0,
    matchId:   matchIdClean,
    outcome,
    settled:   settledCount,
    correct:   correctCount,
    xpAwarded: totalXp,
    errors:    errors.length > 0 ? errors : undefined,
  })
}
