/**
 * GET /api/cron/score-daily-xi
 *
 * Vercel Cron endpoint — triggered once daily at 02:00 UTC via vercel.json.
 * Finds all pending/locked Daily XI entries with entry_date <= today and scores
 * them automatically using the mock player stats provider.
 *
 * Auth:       Authorization: Bearer <CRON_SECRET>
 *             Vercel sets this header automatically.
 * Provider:   MockPlayerStatsProvider — deterministic, no paid API.
 * Idempotent: already-scored entries are skipped; xp_events unique constraint
 *             prevents duplicate XP even if the cron fires more than once.
 * Safety:     Future dates (entry_date > today) are never scored.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'
import { fetchStatsForPlayers }           from '@/lib/player-stats-provider'
import { calculateDailyXIScore }          from '@/lib/daily-xi-scoring'
import { awardReferralBonus }             from '@/lib/referrals/awardReferralBonus'

const CRON_LIMIT = 25

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

// ── Leaderboard XP increment — XP only, no prediction count changes ───────────

async function incrementLeaderboardXP(
  supabase:  ReturnType<typeof getServerSupabaseClient>,
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

// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // ── Auth: Bearer CRON_SECRET ───────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron/score-daily-xi] CRON_SECRET env var not set')
    return err('Cron not configured on this server', 500)
  }

  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return err('Unauthorized', 401)
  }

  const supabase = getServerSupabaseClient()

  // ── Today's date — never score future entries ──────────────────────────────
  const today = new Date().toISOString().slice(0, 10)

  // ── Fetch pending/locked entries up to the limit ───────────────────────────
  const { data: entries, error: fetchErr } = await supabase
    .from('daily_xi_entries')
    .select('id, wallet_address, entry_date, players, status')
    .in('status', ['pending', 'locked'])
    .lte('entry_date', today)
    .order('entry_date', { ascending: true })
    .limit(CRON_LIMIT)

  if (fetchErr) {
    console.error('[cron/score-daily-xi] fetch entries:', fetchErr)
    return err(`Failed to fetch entries: ${fetchErr.message}`, 500)
  }

  const scanned = entries?.length ?? 0

  if (scanned === 0) {
    return NextResponse.json({
      success:        true,
      scanned:        0,
      scoredEntries:  0,
      totalXPAwarded: 0,
      skipped:        0,
      message:        'No pending Daily XI entries found for today or earlier.',
    })
  }

  // ── Score each entry ───────────────────────────────────────────────────────
  let scoredEntries  = 0
  let totalXPAwarded = 0
  let skipped        = 0
  const errors: string[] = []

  for (const entry of entries ?? []) {
    try {
      const wallet    = (entry.wallet_address as string).toLowerCase()
      const entryDate = entry.entry_date as string

      // Skip already-scored (defensive — query filters by status, but belt+braces)
      if (entry.status === 'scored') {
        skipped++
        continue
      }

      // Extract player IDs from players jsonb array
      const playerList = Array.isArray(entry.players) ? entry.players : []
      const playerIds: string[] = (playerList as Record<string, unknown>[])
        .map(p => (p.id ?? p.playerId) as string)
        .filter(id => typeof id === 'string' && id.length > 0)

      if (playerIds.length === 0) {
        skipped++
        continue
      }

      // Fetch deterministic mock stats for this entry's date
      const stats = await fetchStatsForPlayers(playerIds, entryDate)

      // Calculate score
      const { totalXp, playerBreakdown } = calculateDailyXIScore(stats)

      // Update entry → scored
      const { error: updateErr } = await supabase
        .from('daily_xi_entries')
        .update({
          status:     'scored',
          earned_xp:  totalXp,
          updated_at: new Date().toISOString(),
        })
        .eq('id', entry.id)

      if (updateErr) {
        errors.push(`[${entry.id}] update failed: ${updateErr.message}`)
        continue
      }

      // xp_events — duplicate-safe via unique constraint (wallet, source_type, source_id)
      let xpDuplicate = false
      if (totalXp > 0) {
        const { error: xpErr } = await supabase
          .from('xp_events')
          .insert({
            wallet_address: wallet,
            source_type:    'daily_xi',
            source_id:      entry.id,
            xp_amount:      totalXp,
            reason:         'daily_xi_scored',
            metadata:       { entry_date: entryDate, breakdown: playerBreakdown },
          })

        if (xpErr) {
          if (xpErr.code === '23505') {
            xpDuplicate = true   // already inserted — safe to continue
          } else {
            console.error(`[cron/score-daily-xi] xp_events [${entry.id}]:`, xpErr)
            // Non-fatal — entry already marked scored, continue
          }
        }
      }

      // profiles.xp + leaderboard_stats XP increment
      if (totalXp > 0 && !xpDuplicate) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('wallet_address', wallet)
          .maybeSingle()

        if (profile?.id) {
          // Atomically increment profiles.xp — no read-then-write race
          const { error: xpRpcErr } = await supabase
            .rpc('increment_profile_xp', { p_id: profile.id as string, p_delta: totalXp })
          if (xpRpcErr) {
            console.warn('[cron/score-daily-xi] profiles.xp rpc error:', xpRpcErr.message)
          }

          await incrementLeaderboardXP(supabase, profile.id as string, totalXp)
        }

        // Referral bonus — 10% of Daily XI XP to referrer (non-fatal)
        try {
          await awardReferralBonus({
            supabase,
            referredWallet:     wallet,
            originalXp:         totalXp,
            originalSourceType: 'daily_xi',
            originalSourceId:   entry.id,
          })
        } catch (e) {
          console.warn('[cron/score-daily-xi] referral bonus error:', e)
        }
      }

      scoredEntries++
      totalXPAwarded += totalXp

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`[${entry.id}] unexpected: ${msg}`)
    }
  }

  if (errors.length > 0) {
    console.error('[cron/score-daily-xi] errors:', errors)
  }

  console.log(
    `[cron/score-daily-xi] scanned=${scanned} scored=${scoredEntries} ` +
    `xp=${totalXPAwarded} skipped=${skipped} errors=${errors.length}`,
  )

  return NextResponse.json({
    success:        errors.length < scanned,   // true if at least partial success
    scanned,
    scoredEntries,
    totalXPAwarded,
    skipped,
    errors:         errors.length > 0 ? errors : undefined,
  })
}
