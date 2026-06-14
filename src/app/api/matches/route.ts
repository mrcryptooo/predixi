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
 *
 * Community percentages: computed live from the predictions table using a
 * single GROUP BY query (not N+1). Always fresh — no stale stored values.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }         from '@/lib/supabase/server'
import { MATCH_STATUS_ORDER }              from '@/lib/football/status'

function err(msg: string, status: number) {
  return NextResponse.json({ success: false, error: msg }, { status })
}

/** Returns today's date as YYYY-MM-DD in UTC. */
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Compute community prediction percentages from raw counts.
 * Returns null if no predictions exist.
 * The away percentage absorbs rounding so home+draw+away always equals 100.
 */
function toPct(
  H: number,
  D: number,
  A: number,
): { home: number; draw: number; away: number } | null {
  const total = H + D + A
  if (total === 0) return null
  const home = Math.round((H / total) * 100)
  const draw = Math.round((D / total) * 100)
  const away = 100 - home - draw   // absorbs rounding to guarantee sum = 100
  return { home, draw, away }
}

export async function GET(req: NextRequest) {
  const p           = req.nextUrl.searchParams
  const source      = p.get('source') ?? 'all'
  const status      = p.get('status')
  const includePast = p.get('includePast') === 'true'
  const limitParam  = parseInt(p.get('limit') ?? '20', 10) || 20
  const limit       = Math.min(limitParam, includePast ? 500 : 100)

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

  // ── Filter: drop rows with null/empty kickoff (shouldn't reach DB, but guard here) ──
  rows = rows.filter(m => m.kickoff && typeof m.kickoff === 'string' && m.kickoff.trim() !== '')

  // ── Sort: live first, then kickoff ASC ─────────────────────────────────────
  rows = [...rows].sort((a, b) => {
    const sa = MATCH_STATUS_ORDER[a.status as keyof typeof MATCH_STATUS_ORDER] ?? 9
    const sb = MATCH_STATUS_ORDER[b.status as keyof typeof MATCH_STATUS_ORDER] ?? 9
    if (sa !== sb) return sa - sb
    return (a.kickoff as string) < (b.kickoff as string) ? -1 : 1
  })

  // ── Community percentages: one GROUP BY across all returned matches ─────────
  // Single query — no N+1 per match. Safe at any scale within the limit.
  const matchIds = rows.map(r => r.id as string)

  const communityMap: Record<string, { home: number; draw: number; away: number } | null> = {}

  if (matchIds.length > 0) {
    const { data: predRows } = await supabase
      .from('predictions')
      .select('match_id, outcome')
      .in('match_id', matchIds)

    // Tally counts per match
    const counts: Record<string, { H: number; D: number; A: number }> = {}
    for (const p of (predRows ?? [])) {
      const mid = p.match_id as string
      if (!counts[mid]) counts[mid] = { H: 0, D: 0, A: 0 }
      const o = p.outcome as 'H' | 'D' | 'A'
      if (o === 'H' || o === 'D' || o === 'A') counts[mid][o]++
    }

    for (const mid of matchIds) {
      const c = counts[mid]
      communityMap[mid] = c ? toPct(c.H, c.D, c.A) : null
    }
  }

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
    community:     communityMap[m.id as string] ?? null,
  }))

  return NextResponse.json({
    success:     true,
    count:       matches.length,
    dateFilter:  !includePast ? `>= ${todayUTC()}` : 'none',
    matches,
  })
}
