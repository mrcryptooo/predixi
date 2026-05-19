/**
 * GET /api/matches
 * Returns matches from Supabase. Read-only, no auth required.
 * Query params:
 *   source      = fd | apf | all (default: all)
 *   status      = upcoming | live | finished | postponed
 *   limit       = 1–100 (default: 20)
 *   includePast = true — disables the default kickoff >= today filter (admin/debug)
 *
 * Default behaviour (no includePast):
 *   Only matches with kickoff >= start of today UTC are returned, so stale
 *   past fixtures never appear first. If this yields 0 results, falls back
 *   to the latest 20 matches regardless of date so the page is never empty.
 *
 * Sort order: live first (status=live), then kickoff ASC within each group.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }         from '@/lib/supabase/server'

function err(msg: string, status: number) {
  return NextResponse.json({ success: false, error: msg }, { status })
}

/** Returns today's date as YYYY-MM-DD in UTC. */
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const p           = req.nextUrl.searchParams
  const source      = p.get('source') ?? 'all'
  const status      = p.get('status')
  const limit       = Math.min(parseInt(p.get('limit') ?? '20', 10) || 20, 100)
  const includePast = p.get('includePast') === 'true'

  const supabase = getServerSupabaseClient()

  // ── Build base query ────────────────────────────────────────────────────────
  function buildQuery(withDateFilter: boolean) {
    let q = supabase
      .from('matches')
      .select('id, league_id, home_team_name, home_team_short, home_team_crest, away_team_name, away_team_short, away_team_crest, kickoff, status, home_score, away_score, actual_outcome, matchday, venue')
      .order('kickoff', { ascending: true })
      .limit(limit)

    if (source === 'fd')  q = q.like('id', 'fd-%')
    if (source === 'apf') q = q.like('id', 'apf-%')
    if (status)           q = q.eq('status', status)

    // Default: only current/upcoming matches (kickoff >= start of today UTC)
    if (withDateFilter) {
      q = q.gte('kickoff', `${todayUTC()}T00:00:00Z`)
    }

    return q
  }

  // ── Primary query (with date filter unless includePast) ─────────────────────
  const { data, error } = await buildQuery(!includePast)

  if (error) {
    console.error('[GET /api/matches]', error)
    return err('Failed to fetch matches', 500)
  }

  let rows = data ?? []

  // ── Fallback: if filtered query returned nothing, fetch latest 20 ───────────
  // This keeps the page non-empty when there are no current/upcoming fixtures.
  if (rows.length === 0 && !includePast && !status) {
    const { data: fallback, error: fbErr } = await buildQuery(false)
    if (!fbErr && fallback && fallback.length > 0) {
      rows = fallback.slice(-20)   // latest 20 by kickoff ASC — most recent at end
    }
  }

  // ── Sort: live first, then kickoff ASC ─────────────────────────────────────
  const statusOrder: Record<string, number> = { live: 0, upcoming: 1, postponed: 2, finished: 3 }
  rows = [...rows].sort((a, b) => {
    const sa = statusOrder[a.status as string] ?? 9
    const sb = statusOrder[b.status as string] ?? 9
    if (sa !== sb) return sa - sb
    return (a.kickoff as string) < (b.kickoff as string) ? -1 : 1
  })

  const matches = rows.map(m => ({
    id:            m.id,
    leagueId:      m.league_id,
    homeTeam:      { name: m.home_team_name, shortName: m.home_team_short, crest: m.home_team_crest ?? null },
    awayTeam:      { name: m.away_team_name, shortName: m.away_team_short, crest: m.away_team_crest ?? null },
    kickoffTime:   m.kickoff,
    status:        m.status,
    homeScore:     m.home_score,
    awayScore:     m.away_score,
    actualOutcome: m.actual_outcome,
    matchday:      m.matchday,
    venue:         m.venue,
  }))

  return NextResponse.json({
    success:     true,
    count:       matches.length,
    dateFilter:  !includePast ? `>= ${todayUTC()}` : 'none',
    matches,
  })
}
