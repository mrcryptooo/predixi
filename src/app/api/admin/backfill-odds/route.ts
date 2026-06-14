/**
 * POST /api/admin/backfill-odds
 *
 * One-time admin endpoint to populate odds for all WC 2026 matches
 * that don't yet have odds stored (odds_home IS NULL).
 *
 * Includes finished, live, and upcoming matches. For finished/live matches
 * the API still returns the pre-kickoff odds that were set before the match.
 *
 * FREEZE RULE: finished and live matches are treated as frozen — their odds
 * are stored once and never overwritten. Only upcoming matches can be
 * re-synced by the daily cron.
 *
 * Auth: x-admin-key header vs ADMIN_SETTLEMENT_KEY
 *
 * Response:
 *   { ok, total, processed, upserted, noOdds, errors, apiCalls, samples }
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'
import { fetchApfOdds }                   from '@/lib/football/apiFootball'
import { APF_WORLD_CUP }                  from '@/lib/football/apiFootballConfig'

const BOOKMAKER_PRIORITY = [8, 1, 7, 6, 5] as const
const MATCH_WINNER_BET_ID = 1

function extractBestOdds(
  bookmakers: Array<{ id: number; name: string; bets: Array<{ id: number; name: string; values: Array<{ value: string; odd: string }> }> }>,
  fixtureId: number,
): { home: number; draw: number; away: number; bookmakerId: number; bookmakerName: string } | null {
  const sorted = [...bookmakers].sort((a, b) => {
    const ai = BOOKMAKER_PRIORITY.indexOf(a.id as typeof BOOKMAKER_PRIORITY[number])
    const bi = BOOKMAKER_PRIORITY.indexOf(b.id as typeof BOOKMAKER_PRIORITY[number])
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  for (const bm of sorted) {
    const mw = bm.bets.find(b => b.id === MATCH_WINNER_BET_ID || b.name === 'Match Winner')
    if (!mw) continue

    const hv = mw.values.find(v => v.value === 'Home')
    const dv = mw.values.find(v => v.value === 'Draw')
    const av = mw.values.find(v => v.value === 'Away')
    if (!hv || !dv || !av) continue

    const home = parseFloat(hv.odd)
    const draw = parseFloat(dv.odd)
    const away = parseFloat(av.odd)
    if (isNaN(home) || isNaN(draw) || isNaN(away)) continue
    if (home <= 1.0 || draw <= 1.0 || away <= 1.0) continue

    return { home, draw, away, bookmakerId: bm.id, bookmakerName: bm.name }
  }
  return null
}

export async function POST(req: NextRequest) {
  const adminKey = process.env.ADMIN_SETTLEMENT_KEY
  if (!adminKey) return NextResponse.json({ ok: false, error: 'not configured' }, { status: 500 })
  if (req.headers.get('x-admin-key') !== adminKey)
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const supabase = getServerSupabaseClient()

  // Fetch ALL APF matches (any status) that have no odds yet
  const { data: matches, error: queryErr } = await supabase
    .from('matches')
    .select('id, home_team_name, away_team_name, kickoff, status, odds_home')
    .eq('api_source', 'apf')
    .is('odds_home', null)
    .order('kickoff', { ascending: true })
    .limit(200)

  if (queryErr) return NextResponse.json({ ok: false, error: queryErr.message }, { status: 500 })
  if (!matches || matches.length === 0)
    return NextResponse.json({ ok: true, message: 'All matches already have odds', total: 0 })

  // Group by date
  const dateGroups: Record<string, { id: string; fixtureId: number; kickoff: string }[]> = {}
  for (const m of matches) {
    const fid  = parseInt((m.id as string).replace('apf-', ''), 10)
    const date = (m.kickoff as string).slice(0, 10)
    if (!dateGroups[date]) dateGroups[date] = []
    dateGroups[date].push({ id: m.id as string, fixtureId: fid, kickoff: m.kickoff as string })
  }

  let upserted = 0, noOdds = 0, apiCalls = 0
  const errors: string[] = []
  const samples: unknown[] = []

  for (const [date, fixtures] of Object.entries(dateGroups)) {
    const result = await fetchApfOdds({
      league:    APF_WORLD_CUP.id,
      season:    APF_WORLD_CUP.season,
      date,
      bookmaker: 8,
    })
    apiCalls++

    if (!result.ok) {
      if (result.budgetExceeded) { errors.push(`[${date}] budget cap — stopping`); break }
      errors.push(`[${date}] ${result.error}`)
      continue
    }

    const oddsMap: Record<number, ReturnType<typeof extractBestOdds>> = {}
    for (const item of result.data) {
      const best = extractBestOdds(item.bookmakers, item.fixture.id)
      if (best) oddsMap[item.fixture.id] = best
    }

    for (const { id: matchId, fixtureId, kickoff } of fixtures) {
      const odds = oddsMap[fixtureId]
      if (!odds) { noOdds++; continue }

      const { error: uErr } = await supabase
        .from('matches')
        .update({
          odds_home:       odds.home,
          odds_draw:       odds.draw,
          odds_away:       odds.away,
          odds_bookmaker:  odds.bookmakerId,
          odds_fetched_at: new Date().toISOString(),
        })
        .eq('id', matchId)

      if (uErr) { errors.push(`${matchId}: ${uErr.message}`); continue }

      upserted++
      if (samples.length < 8) {
        const m = matches.find(r => r.id === matchId)
        samples.push({
          matchId,
          match: `${m?.home_team_name} vs ${m?.away_team_name}`,
          kickoff: kickoff.slice(0, 10),
          bookmaker: odds.bookmakerName,
          odds: { home: odds.home, draw: odds.draw, away: odds.away },
        })
      }
    }

    // 300ms delay between date batches — stay well under rate limit
    await new Promise(r => setTimeout(r, 300))
  }

  return NextResponse.json({
    ok:        errors.length === 0 || upserted > 0,
    total:     matches.length,
    processed: upserted + noOdds,
    upserted,
    noOdds,
    apiCalls,
    ...(errors.length > 0 && { errors }),
    samples,
  })
}
