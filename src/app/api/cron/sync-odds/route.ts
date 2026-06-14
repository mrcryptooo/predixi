/**
 * GET /api/cron/sync-odds
 *
 * Vercel Cron — fetches and stores pre-match odds for WC 2026 fixtures.
 *
 * Schedule (vercel.json):
 *   Phase 1 — 0 8 * * *   (08:00 UTC): seed odds for next 48 hours
 *   Phase 2 — 0 17 * * *  (17:00 UTC): overwrite with near-final pre-kickoff line
 *
 * Auth:  Authorization: Bearer <CRON_SECRET>
 *
 * Freeze rule: odds for a match are NEVER updated once its kickoff has passed.
 * The Phase 2 run captures the final line ~6h before typical WC kickoffs (23:00 UTC).
 *
 * Bookmaker priority: Bet365 (id=8) → 10Bet (id=1) → William Hill (id=7) → first available
 *
 * Batch strategy: one API call per calendar date covering all WC fixtures that day.
 * For a full WC matchday (up to 8 fixtures), this is 1 API call instead of 8.
 *
 * Scope: World Cup 2026 only (league=1, season=2026) — the only competition
 * with odds coverage on the current Pro plan.
 *
 * Safety:
 *   - Never modifies actual_outcome, scores, or any XP/prediction data
 *   - Only writes odds_home, odds_draw, odds_away, odds_bookmaker, odds_fetched_at
 *   - Idempotent — safe to re-run multiple times per day
 *   - Budget-tracked via apfFetch (api_request_log table)
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'
import { fetchApfOdds }                   from '@/lib/football/apiFootball'
import { APF_WORLD_CUP }                  from '@/lib/football/apiFootballConfig'
import { logCronRun }                     from '@/lib/cron/logCronRun'

// ── Constants ─────────────────────────────────────────────────────────────────

const CRON_ROUTE = '/api/cron/sync-odds'

/** Bookmaker priority order — first match wins */
const BOOKMAKER_PRIORITY = [8, 1, 7, 6, 5] as const  // Bet365, 10Bet, William Hill, Bwin, Unibet

/** Match Winner bet market ID in API-Football */
const MATCH_WINNER_BET_ID = 1

// ── Types ─────────────────────────────────────────────────────────────────────

type OddsRow = {
  fixtureId:   number
  home:        number
  draw:        number
  away:        number
  bookmakerId: number
}

type SyncStats = {
  upserted: number
  skipped:  number
  frozen:   number
  noOdds:   number
  errors:   string[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Pick the best available Match Winner odds from a list of bookmakers.
 * Priority: Bet365 → 10Bet → William Hill → any available.
 * Returns null if no Match Winner market is found on any bookmaker.
 */
function extractBestOdds(
  bookmakers: Array<{ id: number; name: string; bets: Array<{ id: number; name: string; values: Array<{ value: string; odd: string }> }> }>,
  fixtureId: number,
): OddsRow | null {
  // Sort bookmakers by priority
  const sorted = [...bookmakers].sort((a, b) => {
    const ai = BOOKMAKER_PRIORITY.indexOf(a.id as typeof BOOKMAKER_PRIORITY[number])
    const bi = BOOKMAKER_PRIORITY.indexOf(b.id as typeof BOOKMAKER_PRIORITY[number])
    const ap = ai === -1 ? 99 : ai
    const bp = bi === -1 ? 99 : bi
    return ap - bp
  })

  for (const bm of sorted) {
    const mw = bm.bets.find(b => b.id === MATCH_WINNER_BET_ID || b.name === 'Match Winner')
    if (!mw) continue

    const homeVal = mw.values.find(v => v.value === 'Home')
    const drawVal = mw.values.find(v => v.value === 'Draw')
    const awayVal = mw.values.find(v => v.value === 'Away')

    if (!homeVal || !drawVal || !awayVal) continue

    const home = parseFloat(homeVal.odd)
    const draw = parseFloat(drawVal.odd)
    const away = parseFloat(awayVal.odd)

    if (isNaN(home) || isNaN(draw) || isNaN(away)) continue
    if (home <= 1.0 || draw <= 1.0 || away <= 1.0) continue

    return { fixtureId, home, draw, away, bookmakerId: bm.id }
  }

  return null
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = getServerSupabaseClient()

  // ── Auth ─────────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${cronSecret}`) {
    await logCronRun({ supabase, route: CRON_ROUTE, status: 'error', error: 'unauthorized' })
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  // ── Find upcoming APF matches for the next 48h ────────────────────────────
  const now    = new Date()
  const cutoff = new Date(now.getTime() + 48 * 60 * 60 * 1000)

  const { data: upcomingMatches, error: queryErr } = await supabase
    .from('matches')
    .select('id, kickoff, odds_home, odds_fetched_at')
    .eq('api_source', 'apf')
    .neq('status', 'finished')
    .gt('kickoff', now.toISOString())
    .lte('kickoff', cutoff.toISOString())
    .order('kickoff', { ascending: true })

  if (queryErr) {
    const msg = `DB query failed: ${queryErr.message}`
    await logCronRun({ supabase, route: CRON_ROUTE, status: 'error', error: msg })
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }

  if (!upcomingMatches || upcomingMatches.length === 0) {
    await logCronRun({ supabase, route: CRON_ROUTE, status: 'success',
      summary: { scanned: 0, upserted: 0, message: 'no upcoming APF matches in 48h window' } })
    return NextResponse.json({ ok: true, scanned: 0, upserted: 0 })
  }

  // ── Group fixture IDs by date ─────────────────────────────────────────────
  const dateGroups: Record<string, number[]> = {}
  for (const m of upcomingMatches) {
    const fixtureId = parseInt((m.id as string).replace('apf-', ''), 10)
    const date = dateStr(new Date(m.kickoff as string))
    if (!dateGroups[date]) dateGroups[date] = []
    dateGroups[date].push(fixtureId)
  }

  const stats: SyncStats = { upserted: 0, skipped: 0, frozen: 0, noOdds: 0, errors: [] }
  let apiCalls = 0

  // ── Fetch odds per date (1 API call per date) ─────────────────────────────
  for (const [date, fixtureIds] of Object.entries(dateGroups)) {
    const result = await fetchApfOdds({
      league:     APF_WORLD_CUP.id,
      season:     APF_WORLD_CUP.season,
      date,
      bookmaker:  8,  // request Bet365 first — reduce payload size
    })
    apiCalls++

    if (!result.ok) {
      if (result.budgetExceeded) {
        stats.errors.push(`[${date}] APF budget cap — stopping`)
        break
      }
      stats.errors.push(`[${date}] ${result.error}`)
      continue
    }

    // Build a lookup: fixtureId → best odds
    const oddsMap: Record<number, OddsRow> = {}
    for (const item of result.data) {
      const fid = item.fixture.id
      if (!fixtureIds.includes(fid)) continue
      const best = extractBestOdds(item.bookmakers, fid)
      if (best) oddsMap[fid] = best
    }

    // ── Upsert each fixture ──────────────────────────────────────────────────
    for (const fixtureId of fixtureIds) {
      const matchId   = `apf-${fixtureId}`
      const matchRow  = upcomingMatches.find(m => m.id === matchId)
      const kickoff   = matchRow?.kickoff ? new Date(matchRow.kickoff as string) : null

      // FREEZE CHECK: never update odds after kickoff
      if (kickoff && kickoff <= now) {
        stats.frozen++
        continue
      }

      const odds = oddsMap[fixtureId]
      if (!odds) {
        stats.noOdds++
        continue
      }

      const { error: upsertErr } = await supabase
        .from('matches')
        .update({
          odds_home:       odds.home,
          odds_draw:       odds.draw,
          odds_away:       odds.away,
          odds_bookmaker:  odds.bookmakerId,
          odds_fetched_at: new Date().toISOString(),
        })
        .eq('id', matchId)

      if (upsertErr) {
        stats.errors.push(`${matchId}: ${upsertErr.message}`)
        stats.skipped++
      } else {
        stats.upserted++
      }
    }
  }

  const hasErrors = stats.errors.length > 0
  console.log(`[cron/sync-odds] upserted=${stats.upserted} frozen=${stats.frozen} noOdds=${stats.noOdds} apiCalls=${apiCalls} errors=${stats.errors.length}`)

  await logCronRun({
    supabase,
    route:   CRON_ROUTE,
    status:  hasErrors && stats.upserted === 0 ? 'error' : 'success',
    summary: {
      scanned:   upcomingMatches.length,
      dateGroups: Object.keys(dateGroups).length,
      apiCalls,
      upserted:  stats.upserted,
      frozen:    stats.frozen,
      noOdds:    stats.noOdds,
      skipped:   stats.skipped,
      errorCount: stats.errors.length,
    },
    error: hasErrors ? stats.errors.slice(0, 5).join(' | ') : null,
  })

  return NextResponse.json({
    ok:        !hasErrors || stats.upserted > 0,
    scanned:   upcomingMatches.length,
    dateGroups: Object.keys(dateGroups).length,
    apiCalls,
    upserted:  stats.upserted,
    frozen:    stats.frozen,
    noOdds:    stats.noOdds,
    ...(hasErrors && { errors: stats.errors }),
  })
}
