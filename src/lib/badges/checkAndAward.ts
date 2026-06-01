/**
 * Badge Award Engine — Phase B
 *
 * SERVER-ONLY helper. Never import from client components.
 *
 * ── What it does ─────────────────────────────────────────────────────────────
 *
 *   Evaluates simple badge unlock conditions for a connected wallet, awards any
 *   newly earned badges, records an xp_events row for each, increments
 *   profiles.xp, and updates leaderboard_stats (all_time + weekly).
 *
 *   All writes are idempotent:
 *   • user_badges  UNIQUE(profile_id, badge_id)                  → 23505 = skip
 *   • xp_events    UNIQUE(wallet, source_type, source_id, reason) → 23505 = skip
 *   • profiles.xp and leaderboard_stats only updated when user_badges insert
 *     succeeded (i.e. new badge, not a duplicate)
 *
 * ── Leaderboard consistency ───────────────────────────────────────────────────
 *
 *   /api/leaderboard reads leaderboard_stats first (fallback: profiles).
 *   All other inline XP routes (daily-streak, score-daily-xi, worldcup-settlement)
 *   update BOTH profiles.xp AND leaderboard_stats.  Badge awards follow the same
 *   pattern via incrementLeaderboardXP() below.
 *
 * ── Badges implemented here ──────────────────────────────────────────────────
 *
 *   Trigger: 'prediction_post'  (called after match prediction POST succeeds)
 *     • first-pred    — 1st prediction placed              → 50 XP
 *     • centurion     — 100+ predictions placed            → 500 XP
 *     • veteran       — 250+ predictions placed            → 1,000 XP
 *     • early-adopter — joined before Season 1 end         → 1,000 XP
 *
 *   Trigger: 'worldcup_post'  (called after WC prediction POST succeeds)
 *     • worldcup-2026 — 10+ WC predictions placed          → 800 XP
 *     • early-adopter — same date check as above
 *
 * ── Deferred (require settlement / aggregation / background jobs) ────────────
 *
 *   streak-3, streak-5, streak-9, streak-10  — consecutive correct streak
 *   sharp-eye                                — 60%+ accuracy over 50 preds
 *   oracle                                   — 70%+ accuracy over 200 preds
 *   hat-trick                                — 3+ correct on same matchday
 *   pl-expert / la-liga-expert / bundesliga-expert / ligue1-expert / ucl-expert
 *   el-clasico                               — needs fixture tagging
 *   worldcup-champion                        — tournament result not known yet
 *
 * ── XP race-condition note ───────────────────────────────────────────────────
 *
 *   profiles.xp and leaderboard_stats use a fetch-then-update pattern (same as
 *   daily-streak and referral bonus).  The race window is tiny — badge awards are
 *   infrequent — and the consequence is benign (XP ±delta, not lost).
 *   TODO (Phase C+): replace with an atomic Postgres RPC to eliminate the window.
 */

import { getBadgeById }            from '@/data/badges'
import { getServerSupabaseClient } from '@/lib/supabase/server'

// ─────────────────────────────────────────────────────────────────────────────
// Season 1 end date — for early-adopter badge
//
// ── Design intent ────────────────────────────────────────────────────────────
//
//   Early Adopter is intentionally broad: any user who created a profile
//   before Season 1 ends earns 1 000 XP. This rewards everyone who joined
//   during the beta / launch period and predates the World Cup 2026 final.
//
//   The condition is checked on the FIRST prediction or WC action, not on
//   registration, so even users who signed up but never predicted will NOT
//   receive it unexpectedly.
//
// ── Updating this value ───────────────────────────────────────────────────────
//
//   TODO: replace 2026-09-01 with the official Season 1 cutoff once confirmed.
//   Changing this date only affects FUTURE badge checks — users already awarded
//   keep their badge (user_badges rows are never deleted).
//
// ── XP amount ────────────────────────────────────────────────────────────────
//
//   1 000 XP — generous but intentional.  Early supporters deserve a meaningful
//   head-start before the general public arrives in large numbers.
//   This matches the badge definition in src/data/badges.ts (xpReward: 1000).
//
// ─────────────────────────────────────────────────────────────────────────────
const SEASON_1_END_DATE = new Date('2026-09-01T00:00:00Z')

// ─────────────────────────────────────────────────────────────────────────────
// World Cup champion prediction key(s)
//
// The wc_predictions.prediction_key value used for the WC 2026 champion card.
// Convention from the admin settlement UI and route JSDoc: "wc-champion".
// If the actual prediction card used a different key, add it here.
// The admin_sweep checks all of these keys for status='won'.
// ─────────────────────────────────────────────────────────────────────────────
const WC_CHAMPION_KEYS = ['wc-champion'] as const

// ─────────────────────────────────────────────────────────────────────────────
// El Clásico team detection
//
// Team IDs vary by data source:
//   • Mock data (src/data/matches.ts):  'realmadrid' / 'barcelona'
//   • football-data.org (fd- prefix):  'fd-team-86' / 'fd-team-81'
//   • api-football (apf- prefix):      'apf-team-541' / 'apf-team-529'
//
// Name-based detection is the primary guard — team names from all APIs
// consistently contain "Real Madrid" and "FC Barcelona" / "Barcelona".
// ID sets are a fast secondary check that also catches mock data.
//
// Barcelona check uses exact name matching to avoid false positives on
// clubs like "FC Barcelona B" or any team with "Barcelona" in the city name.
// ─────────────────────────────────────────────────────────────────────────────

const REAL_MADRID_IDS = new Set(['realmadrid', 'fd-team-86',  'apf-team-541'])
const BARCELONA_IDS   = new Set(['barcelona',  'fd-team-81',  'apf-team-529'])

function teamIsRealMadrid(id: string, name: string): boolean {
  const n = name.toLowerCase().trim()
  return REAL_MADRID_IDS.has(id) || n.includes('real madrid')
}

function teamIsBarcelona(id: string, name: string): boolean {
  const n = name.toLowerCase().trim()
  return BARCELONA_IDS.has(id) || n === 'fc barcelona' || n === 'barcelona'
}

function isClasico(
  homeId: string, homeName: string,
  awayId: string, awayName: string,
): boolean {
  return (
    (teamIsRealMadrid(homeId, homeName) && teamIsBarcelona(awayId, awayName)) ||
    (teamIsBarcelona(homeId, homeName) && teamIsRealMadrid(awayId, awayName))
  )
}

/**
 * Returns true if the profile has at least one correct settled prediction
 * for a Real Madrid vs Barcelona match (El Clásico).
 *
 * Queries all correct settled predictions for the profile, joins to matches
 * for team metadata, and tests each match with isClasico().
 * Handles both mock slugs and real API team IDs.
 */
async function hasCorrectClasicoPrediction(
  supabase:  ReturnType<typeof getServerSupabaseClient>,
  profileId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('predictions')
    .select('id, matches!inner(home_team_id, home_team_name, away_team_id, away_team_name)')
    .eq('profile_id', profileId)
    .eq('is_correct', true)

  if (error || !data) return false

  return data.some(pred => {
    const raw = pred.matches
    const m   = (Array.isArray(raw) ? raw[0] : raw) as {
      home_team_id?:   string
      home_team_name?: string
      away_team_id?:   string
      away_team_name?: string
    } | null
    if (!m) return false
    return isClasico(
      m.home_team_id   ?? '', m.home_team_name ?? '',
      m.away_team_id   ?? '', m.away_team_name ?? '',
    )
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// League ID mapping
//
// The matches.league_id column holds two possible sets of values:
//   • Real API data written by sync-fixtures: 'PL', 'PD', 'BL1', 'FL1', 'CL'
//   • Mock/seed data from src/data/matches.ts: 'premier-league', 'la-liga', etc.
//
// Each badge check queries BOTH slugs for its league so that mock-data predictions
// and real API predictions both count toward the threshold.
// ─────────────────────────────────────────────────────────────────────────────

const LEAGUE_IDS: Record<string, string[]> = {
  'pl-expert':         ['PL', 'premier-league'],
  'la-liga-expert':    ['PD', 'la-liga'],
  'bundesliga-expert': ['BL1', 'bundesliga'],
  'ligue1-expert':     ['FL1', 'ligue-1'],
  'ucl-expert':        ['CL', 'champions-league'],
}

/** Minimum settled predictions and accuracy required per league badge. */
const LEAGUE_THRESHOLDS: Record<string, { minPredictions: number; minAccuracy: number }> = {
  'pl-expert':         { minPredictions: 30, minAccuracy: 0.65 },
  'la-liga-expert':    { minPredictions: 30, minAccuracy: 0.65 },
  'bundesliga-expert': { minPredictions: 30, minAccuracy: 0.65 },
  'ligue1-expert':     { minPredictions: 30, minAccuracy: 0.65 },
  'ucl-expert':        { minPredictions: 20, minAccuracy: 0.65 },
}

// ─────────────────────────────────────────────────────────────────────────────
// Settlement-time badge query helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the current and all-time maximum consecutive-correct streak for a
 * profile, ordered by match kickoff (not prediction placed_at).
 *
 * Only settled predictions (is_correct IS NOT NULL) are counted.
 * Wrong predictions reset the streak to zero.
 *
 * Used by: streak-3, streak-5, streak-9, streak-10 badge conditions.
 */
async function getCorrectPredictionStreak(
  supabase:  ReturnType<typeof getServerSupabaseClient>,
  profileId: string,
): Promise<{ currentStreak: number; maxStreak: number }> {
  const { data, error } = await supabase
    .from('predictions')
    .select('is_correct, matches(kickoff)')
    .eq('profile_id', profileId)
    .not('is_correct', 'is', null)   // settled only

  if (error || !data || data.length === 0) {
    return { currentStreak: 0, maxStreak: 0 }
  }

  // Sort by match kickoff ascending (earliest match first).
  // The untyped Supabase client may return `matches` as a single object or
  // an array; extractKickoff handles both shapes safely.
  function extractKickoff(raw: unknown): string {
    if (!raw) return ''
    if (Array.isArray(raw)) return (raw[0] as { kickoff?: string })?.kickoff ?? ''
    return (raw as { kickoff?: string }).kickoff ?? ''
  }

  const sorted = [...data].sort((a, b) => {
    const ak = extractKickoff(a.matches)
    const bk = extractKickoff(b.matches)
    return ak < bk ? -1 : ak > bk ? 1 : 0
  })

  let currentStreak = 0
  let maxStreak     = 0

  for (const pred of sorted) {
    if (pred.is_correct) {
      currentStreak++
      if (currentStreak > maxStreak) maxStreak = currentStreak
    } else {
      currentStreak = 0
    }
  }

  return { currentStreak, maxStreak }
}

/**
 * Returns the maximum number of correct settled predictions on a single
 * calendar day (UTC, grouped by kickoff date).
 *
 * "Same matchday" = matches kicked off on the same UTC calendar date.
 * This avoids the cross-league ambiguity of the `matchday` integer field
 * (matchday 5 in PL ≠ matchday 5 in La Liga).
 *
 * Used by: hat-trick badge condition (≥ 3 correct on the same day).
 */
async function getMaxCorrectPerMatchday(
  supabase:  ReturnType<typeof getServerSupabaseClient>,
  profileId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('predictions')
    .select('matches(kickoff)')
    .eq('profile_id', profileId)
    .eq('is_correct', true)   // correct and settled only

  if (error || !data || data.length === 0) return 0

  // Group by kickoff date (YYYY-MM-DD UTC) and count
  const countByDate: Record<string, number> = {}
  for (const pred of data) {
    const raw     = pred.matches
    const kickoff = (Array.isArray(raw) ? (raw[0] as { kickoff?: string })?.kickoff : (raw as { kickoff?: string } | null)?.kickoff) ?? null
    if (!kickoff) continue
    const date = kickoff.slice(0, 10)   // 'YYYY-MM-DD'
    countByDate[date] = (countByDate[date] ?? 0) + 1
  }

  const values = Object.values(countByDate)
  return values.length > 0 ? Math.max(...values) : 0
}

/**
 * Returns settled prediction counts and accuracy ratio for a profile.
 *
 * Queries the `predictions` table directly (the canonical source) rather than
 * relying on `profiles.correct_predictions` / `profiles.total_predictions`,
 * which are maintained via a fetch-then-update pattern and could be slightly
 * stale under concurrent requests.
 *
 * Only settled predictions (is_correct IS NOT NULL) are counted.
 * Pending predictions (is_correct IS NULL) are excluded.
 *
 * accuracy = totalCorrect / totalSettled  (0.0 – 1.0)
 *
 * Used by: sharp-eye (≥50 settled, ≥60%), oracle (≥200 settled, ≥70%).
 */
async function getAccuracyStats(
  supabase:  ReturnType<typeof getServerSupabaseClient>,
  profileId: string,
): Promise<{ totalSettled: number; totalCorrect: number; accuracy: number }> {
  // Total settled (is_correct IS NOT NULL — correct OR incorrect)
  const { count: settled, error: settledErr } = await supabase
    .from('predictions')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .not('is_correct', 'is', null)

  if (settledErr) {
    console.error('[getAccuracyStats] settled count:', settledErr)
    return { totalSettled: 0, totalCorrect: 0, accuracy: 0 }
  }

  const totalSettled = settled ?? 0
  if (totalSettled === 0) return { totalSettled: 0, totalCorrect: 0, accuracy: 0 }

  // Correct settled (is_correct = true)
  const { count: correct, error: correctErr } = await supabase
    .from('predictions')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .eq('is_correct', true)

  if (correctErr) {
    console.error('[getAccuracyStats] correct count:', correctErr)
    return { totalSettled, totalCorrect: 0, accuracy: 0 }
  }

  const totalCorrect = correct ?? 0
  const accuracy     = totalCorrect / totalSettled   // 0.0 – 1.0

  return { totalSettled, totalCorrect, accuracy }
}

/**
 * Returns settled prediction counts and accuracy for a profile within a
 * specific league.
 *
 * `leagueIds` must include both the real API code ('PL') and the mock slug
 * ('premier-league') so that predictions seeded from src/data/matches.ts
 * and predictions synced from football APIs both count toward the threshold.
 *
 * Uses an INNER JOIN via Supabase's `matches!inner(league_id)` syntax to
 * only include predictions whose associated match record exists in the DB
 * and belongs to the specified league(s).
 *
 * Used by: pl-expert, la-liga-expert, bundesliga-expert, ligue1-expert, ucl-expert.
 */
async function getLeagueAccuracyStats(
  supabase:  ReturnType<typeof getServerSupabaseClient>,
  profileId: string,
  leagueIds: string[],   // e.g. ['PL', 'premier-league']
): Promise<{ totalSettledInLeague: number; totalCorrectInLeague: number; accuracy: number }> {
  // Total settled in this league (is_correct IS NOT NULL)
  const { count: settled, error: settledErr } = await supabase
    .from('predictions')
    .select('id, matches!inner(league_id)', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .not('is_correct', 'is', null)
    .in('matches.league_id', leagueIds)

  if (settledErr) {
    console.error('[getLeagueAccuracyStats] settled count:', settledErr)
    return { totalSettledInLeague: 0, totalCorrectInLeague: 0, accuracy: 0 }
  }

  const totalSettledInLeague = settled ?? 0
  if (totalSettledInLeague === 0) {
    return { totalSettledInLeague: 0, totalCorrectInLeague: 0, accuracy: 0 }
  }

  // Correct settled in this league (is_correct = true)
  const { count: correct, error: correctErr } = await supabase
    .from('predictions')
    .select('id, matches!inner(league_id)', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .eq('is_correct', true)
    .in('matches.league_id', leagueIds)

  if (correctErr) {
    console.error('[getLeagueAccuracyStats] correct count:', correctErr)
    return { totalSettledInLeague, totalCorrectInLeague: 0, accuracy: 0 }
  }

  const totalCorrectInLeague = correct ?? 0
  const accuracy             = totalCorrectInLeague / totalSettledInLeague   // 0.0 – 1.0

  return { totalSettledInLeague, totalCorrectInLeague, accuracy }
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helper — mirrors the pattern used by daily-streak, score-daily-xi,
// and worldcup-settlement so badge XP is visible in /api/leaderboard rankings.
//
// /api/leaderboard reads leaderboard_stats first; if no rows exist it falls
// back to profiles.  Skipping this update means badge XP appears in a user's
// profile but is invisible in leaderboard rankings — a silent ranking bug.
// ─────────────────────────────────────────────────────────────────────────────

async function incrementLeaderboardXP(
  supabase:  ReturnType<typeof getServerSupabaseClient>,
  profileId: string,
  xpDelta:   number,
): Promise<void> {
  if (xpDelta <= 0) return

  const now     = new Date().toISOString()
  const periods = ['all_time', 'weekly'] as const

  for (const period of periods) {
    try {
      const { data: existing } = await supabase
        .from('leaderboard_stats')
        .select('id, xp, weekly_xp')
        .eq('profile_id', profileId)
        .eq('period', period)
        .maybeSingle()

      if (existing) {
        const newXp     = (existing.xp      ?? 0) + xpDelta
        const newWeekly = period === 'weekly'
          ? (existing.weekly_xp ?? 0) + xpDelta
          : (existing.weekly_xp ?? 0)
        await supabase
          .from('leaderboard_stats')
          .update({ xp: newXp, weekly_xp: newWeekly, computed_at: now })
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
            computed_at:         now,
          })
      }
    } catch (e) {
      // Non-fatal — leaderboard stats are a derived view.  Missing an update
      // here is corrected when the next settlement run rebuilds leaderboard_stats.
      console.warn(`[checkAndAwardBadges] leaderboard_stats update skipped (${period}):`, e)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type BadgeTrigger =
  | 'prediction_post'    // after a match prediction is saved
  | 'worldcup_post'      // after a WC prediction is saved
  | 'admin_sweep'        // retroactive sweep — checks ALL badge conditions at once
  | 'settlement_sweep'   // after match settlement — checks streak + hat-trick for affected wallets
  | 'worldcup_settle'    // after WC champion settlement — caller confirmed wallet is a winner

export type CheckAndAwardInput = {
  /** Lowercase 0x Ethereum address */
  walletAddress:    string
  /** profiles.id UUID */
  profileId:        string
  /** profiles.created_at ISO timestamp — used for early-adopter check */
  profileCreatedAt: string
  /** Which action triggered this check */
  trigger:          BadgeTrigger
  /** Caller's Supabase service-role client — reuse, don't create a new one */
  supabase:         ReturnType<typeof getServerSupabaseClient>
  /**
   * Dry-run mode — evaluates all conditions and reports which badges WOULD be
   * awarded, but skips all DB writes (user_badges, xp_events, profiles.xp,
   * leaderboard_stats).  The returned AwardedBadge[] represents "would award".
   * Default: false.
   */
  dryRun?:          boolean
}

export type AwardedBadge = {
  badgeId:   string
  badgeName: string
  xpAwarded: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check unlock conditions and award any newly earned badges.
 *
 * Returns the list of badges awarded in this call (empty if none new).
 * Never throws — errors are logged and the function returns what it can.
 * Call sites should wrap in try/catch anyway so badge failures never block
 * the primary user action.
 */
export async function checkAndAwardBadges(
  input: CheckAndAwardInput,
): Promise<AwardedBadge[]> {
  const { walletAddress, profileId, profileCreatedAt, trigger, supabase, dryRun = false } = input
  const awarded: AwardedBadge[] = []

  // ── 1. Load already-earned badge IDs (single query, used throughout) ────────
  const { data: existingRows, error: existingErr } = await supabase
    .from('user_badges')
    .select('badge_id')
    .eq('profile_id', profileId)

  if (existingErr) {
    console.error('[checkAndAwardBadges] user_badges fetch:', existingErr)
    return []  // bail gracefully — no awards this call
  }

  const alreadyEarned = new Set<string>(
    (existingRows ?? []).map(r => r.badge_id as string),
  )

  // ── 2. Inner helper: award one badge ────────────────────────────────────────
  async function tryAward(badgeId: string): Promise<void> {
    // Fast-path: skip if already in the in-memory set (avoids a DB round-trip)
    if (alreadyEarned.has(badgeId)) return

    const badge = getBadgeById(badgeId)
    if (!badge) {
      console.warn('[checkAndAwardBadges] unknown badgeId:', badgeId)
      return
    }

    // ── Dry-run: report eligibility without touching the DB ──────────────────
    // alreadyEarned was loaded from DB above, so this accurately reflects
    // "would be newly awarded" — not re-awarding badges already held.
    if (dryRun) {
      awarded.push({ badgeId, badgeName: badge.name, xpAwarded: badge.xpReward })
      return
    }

    // ── Insert into user_badges ──────────────────────────────────────────────
    // UNIQUE(profile_id, badge_id) — error code 23505 = already exists (race).
    const { error: insertErr } = await supabase
      .from('user_badges')
      .insert({ profile_id: profileId, badge_id: badgeId })

    if (insertErr) {
      if (insertErr.code === '23505') {
        // Lost a race — another request just awarded the same badge; nothing to do.
        alreadyEarned.add(badgeId)
        return
      }
      console.error(`[checkAndAwardBadges] user_badges insert (${badgeId}):`, insertErr)
      return  // skip XP to avoid partial state
    }

    // Mark as earned so subsequent tryAward calls in this request don't retry
    alreadyEarned.add(badgeId)

    // ── Record XP event ──────────────────────────────────────────────────────
    // source_id format: 'badge:{badgeId}' — short and deterministic.
    // The unique constraint (wallet, source_type, source_id, reason) prevents
    // double-XP even if this function is called concurrently.
    const sourceId = `badge:${badgeId}`
    const reason   = `Badge unlocked: ${badge.name}`

    const { error: xpEventErr } = await supabase
      .from('xp_events')
      .insert({
        wallet_address: walletAddress,
        source_type:    'badge',
        source_id:      sourceId,
        xp_amount:      badge.xpReward,
        reason,
        metadata:       {
          badgeId,
          badgeName: badge.name,
          rarity:    badge.rarity,
          category:  badge.category,
        },
      })

    if (xpEventErr && xpEventErr.code !== '23505') {
      // Log but continue — badge is awarded even if XP event fails
      console.error(`[checkAndAwardBadges] xp_events insert (${badgeId}):`, xpEventErr)
    }

    // ── Increment profiles.xp ─────────────────────────────────────────────────
    // Fetch-then-update pattern (same as daily-streak and referral bonus).
    // TODO (Phase C+): replace with atomic RPC to eliminate race window.
    if (badge.xpReward > 0) {
      const { data: prof, error: profFetchErr } = await supabase
        .from('profiles')
        .select('xp')
        .eq('id', profileId)
        .single()

      if (profFetchErr) {
        console.error(`[checkAndAwardBadges] profiles.xp fetch (${badgeId}):`, profFetchErr)
      } else if (prof) {
        const { error: profUpdateErr } = await supabase
          .from('profiles')
          .update({ xp: (prof.xp ?? 0) + badge.xpReward })
          .eq('id', profileId)

        if (profUpdateErr) {
          console.error(`[checkAndAwardBadges] profiles.xp update (${badgeId}):`, profUpdateErr)
        }
      }

      // ── Update leaderboard_stats (all_time + weekly) ───────────────────────
      // /api/leaderboard reads leaderboard_stats first; without this update,
      // badge XP is invisible in leaderboard rankings even though profiles.xp
      // is correct.  Matches the pattern in daily-streak and score-daily-xi.
      await incrementLeaderboardXP(supabase, profileId, badge.xpReward)
    }

    awarded.push({ badgeId, badgeName: badge.name, xpAwarded: badge.xpReward })
    console.log(`[checkAndAwardBadges] awarded ${badgeId} (+${badge.xpReward} XP) to ${walletAddress}`)
  }

  // ── 3. Evaluate conditions per trigger ──────────────────────────────────────

  if (trigger === 'prediction_post') {
    // Count ALL predictions for this profile (UPSERT means same match = same row)
    const { count, error: countErr } = await supabase
      .from('predictions')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', profileId)

    if (countErr) {
      console.error('[checkAndAwardBadges] predictions count:', countErr)
    } else {
      const totalPredictions = count ?? 0

      if (totalPredictions >= 1)   await tryAward('first-pred')
      if (totalPredictions >= 100) await tryAward('centurion')
      if (totalPredictions >= 250) await tryAward('veteran')
    }

    // Early adopter — check profile creation date
    if (new Date(profileCreatedAt) < SEASON_1_END_DATE) {
      await tryAward('early-adopter')
    }
  }

  if (trigger === 'worldcup_post') {
    // Count WC predictions for this wallet
    const { count: wcCount, error: wcCountErr } = await supabase
      .from('wc_predictions')
      .select('prediction_key', { count: 'exact', head: true })
      .eq('wallet_address', walletAddress)

    if (wcCountErr) {
      console.error('[checkAndAwardBadges] wc_predictions count:', wcCountErr)
    } else if ((wcCount ?? 0) >= 10) {
      await tryAward('worldcup-2026')
    }

    // Early adopter — same check
    if (new Date(profileCreatedAt) < SEASON_1_END_DATE) {
      await tryAward('early-adopter')
    }
  }

  // ── settlement_sweep: streak + hat-trick badges after a match settles ────────
  // Called from POST /api/admin/settle-match for each wallet affected by the
  // settlement.  Checks all settlement-dependent badges.
  //
  // Does NOT re-check early-adopter / first-pred / centurion / veteran —
  // those are already covered by 'prediction_post' and 'admin_sweep'.
  if (trigger === 'settlement_sweep') {
    // ── Consecutive correct streak ───────────────────────────────────────────
    const { maxStreak } = await getCorrectPredictionStreak(supabase, profileId)

    if (maxStreak >= 3)  await tryAward('streak-3')
    if (maxStreak >= 5)  await tryAward('streak-5')
    if (maxStreak >= 9)  await tryAward('streak-9')
    if (maxStreak >= 10) await tryAward('streak-10')

    // ── Hat-trick: 3+ correct predictions on the same calendar day ───────────
    const maxPerDay = await getMaxCorrectPerMatchday(supabase, profileId)
    if (maxPerDay >= 3) await tryAward('hat-trick')

    // ── Accuracy badges ───────────────────────────────────────────────────────
    // Evaluated after each settlement because accuracy changes with every result.
    // Threshold checks are cheap (two COUNT queries) so running on each
    // settlement is acceptable.
    const { totalSettled, accuracy } = await getAccuracyStats(supabase, profileId)
    if (totalSettled >= 50  && accuracy >= 0.60) await tryAward('sharp-eye')
    if (totalSettled >= 200 && accuracy >= 0.70) await tryAward('oracle')

    // ── League expert badges ──────────────────────────────────────────────────
    // Iterates the LEAGUE_IDS map — each entry covers both real API codes and
    // mock slugs so predictions from either source count toward the threshold.
    for (const [badgeId, leagueIds] of Object.entries(LEAGUE_IDS)) {
      const threshold = LEAGUE_THRESHOLDS[badgeId]
      if (!threshold) continue
      try {
        const { totalSettledInLeague, accuracy: leagueAccuracy } =
          await getLeagueAccuracyStats(supabase, profileId, leagueIds)
        if (
          totalSettledInLeague >= threshold.minPredictions &&
          leagueAccuracy       >= threshold.minAccuracy
        ) {
          await tryAward(badgeId)
        }
      } catch (e) {
        console.warn(`[checkAndAwardBadges] league badge check skipped (${badgeId}):`, e)
      }
    }

    // ── El Clásico ─────────────────────────────────────────────────────────────
    // Check if the profile has ever correctly predicted a Real Madrid vs Barcelona
    // match.  Handles mock IDs, fd-team-* IDs, and apf-team-* IDs transparently.
    try {
      if (await hasCorrectClasicoPrediction(supabase, profileId)) {
        await tryAward('el-clasico')
      }
    } catch (e) {
      console.warn('[checkAndAwardBadges] el-clasico check skipped:', e)
    }
  }

  // ── worldcup_settle: award WC champion badge after settle-worldcup route ──────
  // Called only for wallets the settle-worldcup route has already confirmed as
  // WC champion prediction winners (status='won').  The correctness check is done
  // upstream; this block simply awards the badge via the standard tryAward flow.
  if (trigger === 'worldcup_settle') {
    await tryAward('worldcup-champion')
  }

  // ── admin_sweep: check ALL badge conditions in one retroactive pass ──────────
  // Used by POST /api/admin/badges/sweep for full backfill.
  // Covers both simple volume/date badges AND settlement-time streak/hat-trick.
  if (trigger === 'admin_sweep') {
    // ── Match predictions ────────────────────────────────────────────────────
    const { count: predCount, error: predCountErr } = await supabase
      .from('predictions')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', profileId)

    if (predCountErr) {
      console.error('[checkAndAwardBadges] admin_sweep predictions count:', predCountErr)
    } else {
      const totalPredictions = predCount ?? 0
      if (totalPredictions >= 1)   await tryAward('first-pred')
      if (totalPredictions >= 100) await tryAward('centurion')
      if (totalPredictions >= 250) await tryAward('veteran')
    }

    // ── World Cup predictions ────────────────────────────────────────────────
    const { count: wcCount, error: wcCountErr } = await supabase
      .from('wc_predictions')
      .select('prediction_key', { count: 'exact', head: true })
      .eq('wallet_address', walletAddress)

    if (wcCountErr) {
      console.error('[checkAndAwardBadges] admin_sweep wc_predictions count:', wcCountErr)
    } else if ((wcCount ?? 0) >= 10) {
      await tryAward('worldcup-2026')
    }

    // ── Early adopter ────────────────────────────────────────────────────────
    if (new Date(profileCreatedAt) < SEASON_1_END_DATE) {
      await tryAward('early-adopter')
    }

    // ── Streak badges (uses settled prediction history) ──────────────────────
    const { maxStreak } = await getCorrectPredictionStreak(supabase, profileId)
    if (maxStreak >= 3)  await tryAward('streak-3')
    if (maxStreak >= 5)  await tryAward('streak-5')
    if (maxStreak >= 9)  await tryAward('streak-9')
    if (maxStreak >= 10) await tryAward('streak-10')

    // ── Hat-trick: 3+ correct on the same calendar day ───────────────────────
    const maxPerDay = await getMaxCorrectPerMatchday(supabase, profileId)
    if (maxPerDay >= 3) await tryAward('hat-trick')

    // ── Accuracy badges ───────────────────────────────────────────────────────
    const { totalSettled: sweepSettled, accuracy: sweepAccuracy } =
      await getAccuracyStats(supabase, profileId)
    if (sweepSettled >= 50  && sweepAccuracy >= 0.60) await tryAward('sharp-eye')
    if (sweepSettled >= 200 && sweepAccuracy >= 0.70) await tryAward('oracle')

    // ── League expert badges ──────────────────────────────────────────────────
    for (const [badgeId, leagueIds] of Object.entries(LEAGUE_IDS)) {
      const threshold = LEAGUE_THRESHOLDS[badgeId]
      if (!threshold) continue
      try {
        const { totalSettledInLeague, accuracy: leagueAccuracy } =
          await getLeagueAccuracyStats(supabase, profileId, leagueIds)
        if (
          totalSettledInLeague >= threshold.minPredictions &&
          leagueAccuracy       >= threshold.minAccuracy
        ) {
          await tryAward(badgeId)
        }
      } catch (e) {
        console.warn(`[checkAndAwardBadges] admin_sweep league badge skipped (${badgeId}):`, e)
      }
    }

    // ── World Cup champion ─────────────────────────────────────────────────────
    // Award retroactively if the wallet has a settled 'won' WC champion prediction.
    // Only fires once the final has been settled via /api/admin/settle-worldcup.
    // If the result is not yet known (status still 'pending'), this is a no-op.
    const { data: wcChampionWin, error: wcChampErr } = await supabase
      .from('wc_predictions')
      .select('id')
      .eq('wallet_address', walletAddress)
      .in('prediction_key', [...WC_CHAMPION_KEYS])
      .eq('status', 'won')
      .maybeSingle()

    if (wcChampErr) {
      console.warn('[checkAndAwardBadges] admin_sweep wc champion check skipped:', wcChampErr)
    } else if (wcChampionWin) {
      await tryAward('worldcup-champion')
    }

    // ── El Clásico ─────────────────────────────────────────────────────────────
    try {
      if (await hasCorrectClasicoPrediction(supabase, profileId)) {
        await tryAward('el-clasico')
      }
    } catch (e) {
      console.warn('[checkAndAwardBadges] admin_sweep el-clasico check skipped:', e)
    }
  }

  return awarded
}
