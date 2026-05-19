/**
 * GET /api/leaderboard?limit=50&period=all_time|weekly
 *
 * all_time: queries leaderboard_stats (period='all_time'), falls back to profiles
 * weekly:   queries leaderboard_stats (period='weekly'), returns empty if none yet
 *
 * Read-only — no auth required.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentSeason, getCurrentWeekWindow } from '@/lib/seasons'
import type { LeaderboardEntry } from '@/types'

function truncAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function err(msg: string, status = 500) {
  return NextResponse.json({ success: false, error: msg }, { status })
}

export async function GET(req: NextRequest) {
  try {
    const limit  = Math.min(
      parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10) || 50,
      100,
    )
    const period: 'all_time' | 'weekly' =
      req.nextUrl.searchParams.get('period') === 'weekly' ? 'weekly' : 'all_time'

    const supabase = getServerSupabaseClient()

    // ── Primary: leaderboard_stats ──────────────────────────────────────────
    const { data: statsRows, error: statsErr } = await supabase
      .from('leaderboard_stats')
      .select('profile_id, xp, weekly_xp, total_predictions, correct_predictions, accuracy')
      .eq('period', period)
      .gt('xp', 0)
      .order('xp',                  { ascending: false })
      .order('correct_predictions', { ascending: false })
      .limit(limit)

    if (!statsErr && statsRows && statsRows.length > 0) {
      // Fetch matching profile rows (wallet, rank, streak)
      const profileIds = statsRows.map(r => r.profile_id as string)
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, wallet_address, rank, streak')
        .in('id', profileIds)

      const profileMap = new Map(
        (profileRows ?? []).map(p => [p.id as string, p]),
      )

      const entries: LeaderboardEntry[] = statsRows
        .filter(r => profileMap.has(r.profile_id as string))
        .map((r, i) => {
          const prof     = profileMap.get(r.profile_id as string)!
          const addr     = prof.wallet_address as string
          const total    = (r.total_predictions as number)   ?? 0
          const correct  = (r.correct_predictions as number) ?? 0
          const accuracy = r.accuracy != null
            ? Math.round(r.accuracy as number)
            : total > 0 ? Math.round((correct / total) * 100) : 0

          return {
            position:           i + 1,
            userId:             addr,
            username:           truncAddr(addr),
            displayName:        truncAddr(addr),
            avatar:             '⚡',
            initials:           addr.slice(2, 4).toUpperCase(),
            countryFlag:        '🌐',
            xp:                 (r.xp as number)        ?? 0,
            rank:               ((prof.rank as string)  ?? 'bronze') as LeaderboardEntry['rank'],
            streak:             (prof.streak as number) ?? 0,
            totalPredictions:   total,
            correctPredictions: correct,
            accuracy,
            weeklyXp:           (r.weekly_xp as number) ?? 0,
            badgeIds:           [],
          }
        })

      const { weekId, start, end } = getCurrentWeekWindow()
      return NextResponse.json({
        success: true,
        entries,
        period,
        meta: {
          currentSeason: getCurrentSeason(),
          currentWeek:   weekId,
          weekStart:     start.toISOString(),
          weekEnd:       end.toISOString(),
        },
      })
    }

    // ── Fallback for all_time: query profiles directly ──────────────────────
    if (period === 'weekly') {
      return NextResponse.json({ success: true, entries: [], period })
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('wallet_address, xp, rank, streak, total_predictions, correct_predictions')
      .gt('xp', 0)
      .order('xp',                  { ascending: false })
      .order('correct_predictions', { ascending: false })
      .order('total_predictions',   { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[GET /api/leaderboard]', error)
      return err('Failed to fetch leaderboard')
    }

    const entries: LeaderboardEntry[] = (data ?? []).map((row, i) => {
      const addr    = row.wallet_address as string
      const total   = (row.total_predictions   as number) ?? 0
      const correct = (row.correct_predictions as number) ?? 0
      return {
        position:           i + 1,
        userId:             addr,
        username:           truncAddr(addr),
        displayName:        truncAddr(addr),
        avatar:             '⚡',
        initials:           addr.slice(2, 4).toUpperCase(),
        countryFlag:        '🌐',
        xp:                 (row.xp     as number) ?? 0,
        rank:               ((row.rank  as string) ?? 'bronze') as LeaderboardEntry['rank'],
        streak:             (row.streak as number) ?? 0,
        totalPredictions:   total,
        correctPredictions: correct,
        accuracy:           total > 0 ? Math.round((correct / total) * 100) : 0,
        weeklyXp:           0,
        badgeIds:           [],
      }
    })

    const { weekId, start, end } = getCurrentWeekWindow()
    return NextResponse.json({
      success: true,
      entries,
      period,
      meta: {
        currentSeason: getCurrentSeason(),
        currentWeek:   weekId,
        weekStart:     start.toISOString(),
        weekEnd:       end.toISOString(),
      },
    })
  } catch (e) {
    console.error('[GET /api/leaderboard] unhandled:', e)
    return err('Internal server error')
  }
}
