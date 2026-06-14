// ─────────────────────────────────────────────────────────────────────────────
// Auto-settlement core logic
//
// Shared by:
//   /api/admin/auto-settle  (manual trigger, supports dry run)
//   /api/cron/auto-settle   (Vercel Cron, always real run)
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import { settlePrediction, type PredictionRecord, type MatchOdds } from '@/lib/settlement'
import { checkAndAwardBadges }                                      from '@/lib/badges/checkAndAward'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type MatchCandidate = {
  matchId:                  string
  homeTeam:                 string
  awayTeam:                 string
  score:                    string
  inferredResult:           string
  dbOutcome:                'H' | 'D' | 'A'
  unsettledPredictionCount: number
  odds:                     MatchOdds | null
}

export type AutoSettleRunResult = {
  success:          boolean
  scanned:          number
  settledMatches:   number
  totalPredictions: number
  totalCorrect:     number
  totalXPAwarded:   number
  errors:           string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function inferOutcome(homeScore: number, awayScore: number): 'H' | 'D' | 'A' {
  if (homeScore > awayScore) return 'H'
  if (awayScore > homeScore) return 'A'
  return 'D'
}

export function outcomeLabel(code: 'H' | 'D' | 'A'): string {
  return code === 'H' ? 'home' : code === 'D' ? 'draw' : 'away'
}

// ─────────────────────────────────────────────────────────────────────────────
// findQualifiedMatches
//
// Returns matches that are:
//   - status = 'finished'
//   - actual_outcome IS NULL  (not yet settled)
//   - home_score and away_score are not null
//   - have at least one unsettled prediction (is_correct IS NULL)
// ─────────────────────────────────────────────────────────────────────────────

export async function findQualifiedMatches(
  supabase: SupabaseClient,
  limit:    number,
): Promise<{ qualified: MatchCandidate[]; scanned: number; error?: string }> {
  // Note: actual_outcome IS NULL filter removed — sync-results now populates
  // actual_outcome immediately on status=finished, so using it as a settlement
  // guard blocks auto-settle.  Idempotency is enforced by:
  //   • predictions.is_correct IS NULL  (only unsettled predictions processed)
  //   • xp_events unique constraint      (duplicate XP impossible)
  const { data: candidates, error: matchErr } = await supabase
    .from('matches')
    .select('id, home_team_name, away_team_name, home_score, away_score, kickoff, odds_home, odds_draw, odds_away')
    .eq('status', 'finished')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .order('kickoff', { ascending: true })
    .limit(limit)

  if (matchErr) {
    return { qualified: [], scanned: 0, error: matchErr.message }
  }

  if (!candidates || candidates.length === 0) {
    return { qualified: [], scanned: 0 }
  }

  const qualified: MatchCandidate[] = []

  for (const m of candidates) {
    const homeScore = m.home_score as number
    const awayScore = m.away_score as number
    const dbOutcome = inferOutcome(homeScore, awayScore)

    const { count, error: countErr } = await supabase
      .from('predictions')
      .select('id', { count: 'exact', head: true })
      .eq('match_id', m.id)
      .is('is_correct', null)

    if (countErr) {
      console.warn(`[auto-settle] count predictions for ${m.id}:`, countErr.message)
      continue
    }

    if (!count || count === 0) continue

    const mH = m.odds_home as number | null
    const mD = m.odds_draw as number | null
    const mA = m.odds_away as number | null

    qualified.push({
      matchId:                  m.id,
      homeTeam:                 m.home_team_name,
      awayTeam:                 m.away_team_name,
      score:                    `${homeScore}–${awayScore}`,
      inferredResult:           outcomeLabel(dbOutcome),
      dbOutcome,
      unsettledPredictionCount: count,
      odds: (mH && mD && mA) ? { home: mH, draw: mD, away: mA } : null,
    })
  }

  return { qualified, scanned: candidates.length }
}

// ─────────────────────────────────────────────────────────────────────────────
// runAutoSettle
//
// Settles all qualified matches end-to-end.
// Returns a summary — never throws.
// ─────────────────────────────────────────────────────────────────────────────

export async function runAutoSettle(
  supabase:   SupabaseClient,
  qualified:  MatchCandidate[],
  scanned:    number,
): Promise<AutoSettleRunResult> {
  let settledMatches   = 0
  let totalPredictions = 0
  let totalCorrect     = 0
  let totalXPAwarded   = 0
  const allErrors: string[] = []

  for (const candidate of qualified) {
    const { matchId, dbOutcome, odds } = candidate

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
      .eq('match_id', matchId)
      .is('is_correct', null)

    if (predErr) {
      allErrors.push(`[${matchId}] fetch predictions: ${predErr.message}`)
      continue
    }

    if (!predictions || predictions.length === 0) continue

    let matchSettledCount = 0
    let matchCorrectCount = 0
    let matchXP           = 0
    const matchErrors: string[] = []

    for (const pred of predictions as unknown as PredictionRecord[]) {
      const res = await settlePrediction(supabase, pred, dbOutcome, matchId, odds)
      if (res.errors.length > 0) {
        matchErrors.push(...res.errors.map(e => `[pred:${res.predictionId}] ${e}`))
      } else {
        matchSettledCount++
        if (res.isCorrect) { matchCorrectCount++; matchXP += res.xpAwarded }
      }
    }

    // Mark match as settled
    const { error: matchUpdateErr } = await supabase
      .from('matches')
      .update({ actual_outcome: dbOutcome })
      .eq('id', matchId)

    if (matchUpdateErr) {
      console.error(`[auto-settle] update match ${matchId}:`, matchUpdateErr)
      // Non-fatal — predictions are already settled
    }

    if (matchErrors.length > 0) {
      allErrors.push(...matchErrors.map(e => `[${matchId}] ${e}`))
    } else {
      settledMatches++
    }

    totalPredictions += matchSettledCount
    totalCorrect     += matchCorrectCount
    totalXPAwarded   += matchXP

    // ── Badge sweep — mirrors settle-match/route.ts step 7 ────────────────────
    // Run for every unique profile affected by this match's settlement.
    // Fire-and-forget: badge errors are logged but never block the settlement
    // result or increment allErrors.  All badge writes are idempotent.
    if (matchSettledCount > 0) {
      const seenProfiles = new Set<string>()

      for (const pred of predictions as unknown as Array<PredictionRecord & {
        profiles:
          | { wallet_address: string; created_at?: string }
          | Array<{ wallet_address: string; created_at?: string }>
          | null
      }>) {
        const profile = Array.isArray(pred.profiles) ? pred.profiles[0] : pred.profiles
        if (!profile || seenProfiles.has(pred.profile_id)) continue
        seenProfiles.add(pred.profile_id)

        try {
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
            `[auto-settle] badge check error for profile ${pred.profile_id}:`,
            badgeErr instanceof Error ? badgeErr.message : String(badgeErr),
          )
        }
      }
    }
  }

  return {
    success: allErrors.length === 0,
    scanned,
    settledMatches,
    totalPredictions,
    totalCorrect,
    totalXPAwarded,
    errors: allErrors,
  }
}
