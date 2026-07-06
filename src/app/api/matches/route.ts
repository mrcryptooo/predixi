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
import { canonicalTeamName }               from '@/lib/football/teamAliases'

function err(msg: string, status: number) {
  return NextResponse.json({ success: false, error: msg }, { status })
}

// ─────────────────────────────────────────────────────────────────────────────
// WC duplicate-row dedup
//
// The `matches` table has, for a large share of WC 2026 fixtures, TWO rows
// for the same real match under different provider prefixes (`apf-...` and
// `fd-...`) — a pre-existing condition from when both API-Football and
// football-data.org were synced independently. API-Football's free plan can
// no longer update WC 2026 data at all, so any `apf-` twin is frozen at
// whatever state it was in when the block took effect, while its `fd-` twin
// keeps receiving live updates.
//
// This collapses each such pair down to ONE row per real match before it
// reaches any page (Matches, Prediction, Match Detail), so users never see a
// duplicate card and never see a stale "upcoming" twin for a match that has
// actually finished. It does NOT touch the database or existing predictions
// — both rows (and any predictions on either) remain exactly as they are;
// this is a display-layer fix only. Grouped by (kickoff hour, canonical team
// names) so provider timezone/naming differences don't prevent matching.
// ─────────────────────────────────────────────────────────────────────────────

type DedupableRow = {
  id: string
  league_id: string
  home_team_name: string
  away_team_name: string
  kickoff: string
  status: string
  round: string | null
}

const STATUS_RANK: Record<string, number> = { finished: 3, live: 2, postponed: 1, upcoming: 0 }

function dedupeWcRows<T extends DedupableRow>(rows: T[]): T[] {
  const groups = new Map<string, T[]>()
  const passthrough: T[] = []

  for (const row of rows) {
    if (row.league_id !== 'WC') { passthrough.push(row); continue }
    const hourBucket = row.kickoff.slice(0, 13) // YYYY-MM-DDTHH — tolerant of minute/provider drift
    const key = `${hourBucket}|${canonicalTeamName(row.home_team_name)}|${canonicalTeamName(row.away_team_name)}`
    const existing = groups.get(key)
    if (existing) existing.push(row)
    else groups.set(key, [row])
  }

  const deduped: T[] = [...passthrough]
  for (const group of groups.values()) {
    if (group.length === 1) { deduped.push(group[0]); continue }
    // Prefer the most-resolved status, then whichever has a populated round,
    // then the football-data.org row (the actively-maintained source).
    const best = group.reduce((a, b) => {
      const rankDiff = (STATUS_RANK[b.status] ?? -1) - (STATUS_RANK[a.status] ?? -1)
      if (rankDiff !== 0) return rankDiff > 0 ? b : a
      if (!!b.round !== !!a.round) return b.round ? b : a
      return b.id.startsWith('fd-') && !a.id.startsWith('fd-') ? b : a
    })
    deduped.push(best)
  }
  return deduped
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
      .select('id, league_id, home_team_name, home_team_short, home_team_crest, away_team_name, away_team_short, away_team_crest, kickoff, status, home_score, away_score, actual_outcome, matchday, round, venue')
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

  // ── Dedup WC provider-duplicate rows (see dedupeWcRows) ─────────────────────
  rows = dedupeWcRows(rows)

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
    round:         (m as Record<string, unknown>).round as string | null ?? null,
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
