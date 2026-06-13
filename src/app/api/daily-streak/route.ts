/**
 * API Route — /api/daily-streak
 *
 * GET  ?wallet=0x...  → streak data + canClaimToday flag
 * POST               → claim daily streak (once per UTC day, 5 XP)
 *
 * Server-only. Service role key. UTC dates throughout.
 * Duplicate-safe: xp_events unique constraint + last_claim_date pre-check.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }         from '@/lib/supabase/server'
import { verifyBaseWalletAuth }            from '@/lib/auth/verify-base-wallet'
import { awardReferralBonus }              from '@/lib/referrals/awardReferralBonus'

const XP_REWARD = 5

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isValidAddress(addr: unknown): addr is string {
  return typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/i.test(addr.trim())
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

function yesterdayUTC(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/daily-streak?wallet=0x...
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const wallet = req.nextUrl.searchParams.get('wallet')

    if (!wallet)                 return err('wallet query parameter is required', 400)
    if (!isValidAddress(wallet)) return err('Invalid wallet address', 400)

    const supabase = getServerSupabaseClient()
    const today    = todayUTC()

    const { data, error } = await supabase
      .from('daily_streaks')
      .select('current_streak, longest_streak, last_claim_date')
      .eq('wallet_address', wallet.toLowerCase())
      .maybeSingle()

    if (error) {
      console.error('[GET /api/daily-streak]', error)
      return err('Failed to fetch streak data', 500)
    }

    const currentStreak  = data?.current_streak  ?? 0
    const longestStreak  = data?.longest_streak  ?? 0
    const lastClaimDate  = data?.last_claim_date ?? null
    const canClaimToday  = lastClaimDate !== today

    return NextResponse.json({
      success: true,
      currentStreak,
      longestStreak,
      lastClaimDate,
      canClaimToday,
      xpReward: XP_REWARD,
    })
  } catch (e) {
    console.error('[GET /api/daily-streak] unhandled:', e)
    return err('Internal server error', 500)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/daily-streak
// Body: { walletAddress }
// Headers: x-wallet-message, x-wallet-signature (encodeURIComponent encoded)
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return err('Invalid JSON body', 400)

    const { walletAddress } = body as Record<string, unknown>

    if (!isValidAddress(walletAddress)) {
      return err('Invalid walletAddress — must be a 0x Ethereum address', 400)
    }

    const normalizedWallet = (walletAddress as string).toLowerCase()

    // ── Wallet auth ───────────────────────────────────────────────────────────
    const walletAuth = await verifyBaseWalletAuth(req, normalizedWallet, 'daily-streak')
    if (!walletAuth.verified) {
      const reason = walletAuth.reason ?? 'missing'
      return NextResponse.json(
        {
          success:    false,
          error:      reason === 'missing-headers'
            ? 'Wallet signature required'
            : 'Signature verification failed — please try again',
          walletAuth: { checked: walletAuth.checked, verified: false, reason },
        },
        { status: 401 },
      )
    }

    const supabase  = getServerSupabaseClient()
    const today     = todayUTC()
    const yesterday = yesterdayUTC()

    // ── Fetch current streak row ──────────────────────────────────────────────
    const { data: existing, error: fetchErr } = await supabase
      .from('daily_streaks')
      .select('id, current_streak, longest_streak, last_claim_date, profile_id')
      .eq('wallet_address', normalizedWallet)
      .maybeSingle()

    if (fetchErr) {
      console.error('[POST /api/daily-streak] fetch streak:', fetchErr)
      return err('Failed to read streak data', 500)
    }

    // ── Already claimed today ─────────────────────────────────────────────────
    if (existing?.last_claim_date === today) {
      return NextResponse.json({
        success:       true,
        claimed:       false,
        alreadyClaimed: true,
        message:       'Already claimed today — come back tomorrow!',
        currentStreak: existing.current_streak,
        longestStreak: existing.longest_streak,
        lastClaimDate: existing.last_claim_date,
        xpReward:      XP_REWARD,
      })
    }

    // ── Calculate new streak ──────────────────────────────────────────────────
    const prevStreak    = existing?.current_streak ?? 0
    const lastDate      = existing?.last_claim_date ?? null
    const newStreak     = lastDate === yesterday ? prevStreak + 1 : 1
    const newLongest    = Math.max(existing?.longest_streak ?? 0, newStreak)

    // ── Get profile_id (needed for leaderboard_stats) ─────────────────────────
    let profileId: string | null = existing?.profile_id ?? null
    if (!profileId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('wallet_address', normalizedWallet)
        .maybeSingle()
      profileId = profile?.id ?? null
    }

    // ── Upsert daily_streaks ──────────────────────────────────────────────────
    const { error: upsertErr } = await supabase
      .from('daily_streaks')
      .upsert(
        {
          wallet_address:  normalizedWallet,
          profile_id:      profileId,
          current_streak:  newStreak,
          longest_streak:  newLongest,
          last_claim_date: today,
          updated_at:      new Date().toISOString(),
        },
        { onConflict: 'wallet_address' },
      )

    if (upsertErr) {
      console.error('[POST /api/daily-streak] upsert streak:', upsertErr)
      return err('Failed to update streak', 500)
    }

    // ── Insert XP event (duplicate-safe via unique constraint) ────────────────
    // source_id is deterministic per wallet+date — prevents double-claim even if
    // the last_claim_date check is somehow bypassed.
    const sourceId = `daily-streak:${normalizedWallet}:${today}`
    const { error: xpErr } = await supabase
      .from('xp_events')
      .insert({
        wallet_address: normalizedWallet,
        source_type:    'daily_streak',
        source_id:      sourceId,
        xp_amount:      XP_REWARD,
        reason:         'daily_streak_claim',
        metadata:       { streak: newStreak, date: today },
      })

    if (xpErr) {
      if (xpErr.code === '23505') {
        // Unique constraint: XP already recorded for today — not an error
        return NextResponse.json({
          success:       true,
          claimed:       false,
          alreadyClaimed: true,
          message:       'Already claimed today — come back tomorrow!',
          currentStreak: newStreak,
          longestStreak: newLongest,
          xpReward:      XP_REWARD,
        })
      }
      console.error('[POST /api/daily-streak] xp_events insert:', xpErr)
      return err('Failed to record XP event', 500)
    }

    // ── Referral bonus — 10% of streak XP to referrer (non-fatal) ────────────
    try {
      await awardReferralBonus({
        supabase,
        referredWallet:     normalizedWallet,
        originalXp:         XP_REWARD,
        originalSourceType: 'daily_streak',
        originalSourceId:   sourceId,
      })
    } catch (e) {
      console.warn('[daily-streak] referral bonus error:', e)
    }

    // ── Update leaderboard_stats (all_time + weekly) ──────────────────────────
    // Read current row first, then insert-or-update. Avoids upsert overwrite bug.
    if (profileId) {
      const now = new Date().toISOString()
      for (const period of ['all_time', 'weekly'] as const) {
        try {
          const { data: lbRow } = await supabase
            .from('leaderboard_stats')
            .select('id, xp, weekly_xp')
            .eq('profile_id', profileId)
            .eq('period', period)
            .maybeSingle()

          if (lbRow) {
            const { error: lbUpdateErr } = await supabase
              .from('leaderboard_stats')
              .update({
                xp:          lbRow.xp + XP_REWARD,
                weekly_xp:   period === 'weekly' ? lbRow.weekly_xp + XP_REWARD : lbRow.weekly_xp,
                computed_at: now,
              })
              .eq('id', lbRow.id)
            if (lbUpdateErr) {
              console.error(`[daily-streak] leaderboard_stats update (${period}):`, lbUpdateErr.message)
            }
          } else {
            const { error: lbInsertErr } = await supabase
              .from('leaderboard_stats')
              .insert({
                profile_id:  profileId,
                period,
                xp:          XP_REWARD,
                weekly_xp:   period === 'weekly' ? XP_REWARD : 0,
                computed_at: now,
              })
            if (lbInsertErr) {
              console.error(`[daily-streak] leaderboard_stats insert (${period}):`, lbInsertErr.message)
            }
          }
        } catch (e) {
          console.warn('[daily-streak] leaderboard_stats update skipped:', e)
        }
      }

      // ── Sync profiles.streak + atomically increment profiles.xp ─────────────
      try {
        // streak is a non-XP field — plain update is fine (no race on this field)
        await supabase
          .from('profiles')
          .update({ streak: newStreak })
          .eq('wallet_address', normalizedWallet)
        // XP increment is atomic — no read-then-write race
        if (profileId) {
          const { error: xpRpcErr } = await supabase
            .rpc('increment_profile_xp', { p_id: profileId, p_delta: XP_REWARD })
          if (xpRpcErr) {
            console.warn('[daily-streak] profiles.xp rpc error:', xpRpcErr.message)
          }
        }
      } catch (e) {
        console.warn('[daily-streak] profiles update skipped:', e)
      }
    }

    return NextResponse.json({
      success:       true,
      claimed:       true,
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastClaimDate: today,
      xpReward:      XP_REWARD,
      message:       `+${XP_REWARD} XP · Day ${newStreak} streak!`,
    })
  } catch (e) {
    console.error('[POST /api/daily-streak] unhandled:', e)
    return err('Internal server error', 500)
  }
}
