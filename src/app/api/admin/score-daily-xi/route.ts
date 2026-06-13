/**
 * POST /api/admin/score-daily-xi
 *
 * Admin-only. Scores a Daily XI entry for a wallet + date using provided player stats.
 * Updates daily_xi_entries (status, earned_xp), inserts xp_events (duplicate-safe),
 * and increments leaderboard_stats XP (all_time + weekly).
 *
 * Auth:      x-admin-key header vs ADMIN_SETTLEMENT_KEY env var
 * Idempotent: re-running on an already-scored entry returns existing result.
 * No settlement. No match prediction logic. No blockchain.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }         from '@/lib/supabase/server'
import { calculateDailyXIScore, type PlayerStats } from '@/lib/daily-xi-scoring'
import { awardReferralBonus }              from '@/lib/referrals/awardReferralBonus'

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

function isValidAddress(addr: unknown): addr is string {
  return typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/i.test((addr as string).trim())
}

function isValidDate(d: unknown): d is string {
  return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test((d as string).trim())
}

// ── Minimal leaderboard XP increment — XP only, no prediction count changes ──

async function incrementLeaderboardXP(
  supabase:      ReturnType<typeof getServerSupabaseClient>,
  profileId:     string,
  xpDelta:       number,
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
      const newXp      = (existing.xp      ?? 0) + xpDelta
      const newWeekly  = period === 'weekly'
        ? (existing.weekly_xp ?? 0) + xpDelta
        : (existing.weekly_xp ?? 0)
      const { error: lbUpdateErr } = await supabase
        .from('leaderboard_stats')
        .update({ xp: newXp, weekly_xp: newWeekly, computed_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (lbUpdateErr) {
        console.error(`[incrementLeaderboardXP:admin-xi] update (${period}):`, lbUpdateErr.message)
      }
    } else {
      const { error: lbInsertErr } = await supabase
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
      if (lbInsertErr) {
        console.error(`[incrementLeaderboardXP:admin-xi] insert (${period}):`, lbInsertErr.message)
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const adminKey = process.env.ADMIN_SETTLEMENT_KEY
  if (!adminKey) return err('Admin key not configured', 500)
  if (req.headers.get('x-admin-key') !== adminKey) return err('Unauthorized', 401)

  // ── Body ───────────────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return err('Invalid JSON body', 400) }

  const { walletAddress, entryDate, playerStats } = body

  if (!isValidAddress(walletAddress))  return err('Invalid walletAddress', 400)
  if (!isValidDate(entryDate))         return err('entryDate must be YYYY-MM-DD', 400)
  if (!Array.isArray(playerStats) || playerStats.length === 0) {
    return err('playerStats must be a non-empty array', 400)
  }

  const wallet = (walletAddress as string).toLowerCase()
  const date   = (entryDate as string).trim()

  // ── Validate playerStats shape ─────────────────────────────────────────────
  const stats: PlayerStats[] = []
  for (const p of playerStats as Record<string, unknown>[]) {
    if (typeof p.playerId !== 'string' || !p.playerId) {
      return err('Each playerStats entry must have a string playerId', 400)
    }
    stats.push({
      playerId:    p.playerId    as string,
      goals:       typeof p.goals       === 'number' ? p.goals       : 0,
      assists:     typeof p.assists     === 'number' ? p.assists      : 0,
      cleanSheet:  p.cleanSheet === true,
      rating:      typeof p.rating      === 'number' ? p.rating       : 0,
      yellowCards: typeof p.yellowCards === 'number' ? p.yellowCards  : 0,
      redCards:    typeof p.redCards    === 'number' ? p.redCards     : 0,
      played:      p.played !== false,  // default true
    })
  }

  const supabase = getServerSupabaseClient()

  // ── Fetch entry ────────────────────────────────────────────────────────────
  const { data: entry, error: fetchErr } = await supabase
    .from('daily_xi_entries')
    .select('id, status, earned_xp, projected_max_xp')
    .eq('wallet_address', wallet)
    .eq('entry_date', date)
    .maybeSingle()

  if (fetchErr) return err(`DB error: ${fetchErr.message}`, 500)
  if (!entry)   return err(`No Daily XI entry found for ${wallet} on ${date}`, 404)

  // ── Idempotent: already scored ─────────────────────────────────────────────
  if (entry.status === 'scored') {
    return NextResponse.json({
      success:    true,
      alreadyScored: true,
      entryId:    entry.id,
      earnedXp:   entry.earned_xp,
      message:    'Entry already scored — no changes made.',
    })
  }

  // ── Score ──────────────────────────────────────────────────────────────────
  const { totalXp, playerBreakdown } = calculateDailyXIScore(stats)

  // ── Update entry ───────────────────────────────────────────────────────────
  const { error: updateErr } = await supabase
    .from('daily_xi_entries')
    .update({
      status:     'scored',
      earned_xp:  totalXp,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entry.id)

  if (updateErr) return err(`Failed to update entry: ${updateErr.message}`, 500)

  // ── xp_events (duplicate-safe via unique constraint) ──────────────────────
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
        metadata:       { entry_date: date, breakdown: playerBreakdown },
      })

    if (xpErr) {
      if (xpErr.code === '23505') {
        xpDuplicate = true
      } else {
        console.error('[score-daily-xi] xp_events insert:', xpErr)
        // Non-fatal — entry already updated, continue
      }
    }
  }

  // ── profiles.xp + leaderboard_stats XP (XP only — no prediction counts) ────
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
        console.warn('[score-daily-xi] profiles.xp rpc error:', xpRpcErr.message)
      }

      await incrementLeaderboardXP(supabase, profile.id as string, totalXp)
    }

    // ── Referral bonus — 10% of Daily XI XP to referrer (non-fatal) ──────────
    try {
      await awardReferralBonus({
        supabase,
        referredWallet:     wallet,
        originalXp:         totalXp,
        originalSourceType: 'daily_xi',
        originalSourceId:   entry.id,
      })
    } catch (e) {
      console.warn('[score-daily-xi] referral bonus error:', e)
    }
  }

  return NextResponse.json({
    success:         true,
    alreadyScored:   false,
    entryId:         entry.id,
    earnedXp:        totalXp,
    xpDuplicate,
    playerBreakdown,
  })
}
