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
  | 'prediction_post'   // after a match prediction is saved
  | 'worldcup_post'     // after a WC prediction is saved
  | 'admin_sweep'       // retroactive sweep — checks ALL simple badge conditions at once

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

  // ── admin_sweep: check ALL simple badge conditions in one pass ──────────────
  // Used by POST /api/admin/badges/sweep for retroactive backfill.
  // Evaluates every simple badge so one call covers the full eligible set.
  // Complex badges (streak, accuracy, league-expert, etc.) are NOT evaluated here
  // — they require settlement data and are deferred to Phase D2.
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
  }

  return awarded
}
