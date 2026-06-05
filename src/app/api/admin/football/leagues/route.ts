/**
 * GET /api/admin/football/leagues
 *
 * Admin-only: discover and verify API-Football league IDs.
 * Intended for one-off verification at the start of each season, not cron.
 *
 * Uses ~1 APF request per call — budget is logged automatically.
 *
 * Auth:   x-admin-key header vs ADMIN_SETTLEMENT_KEY
 *
 * Query params (all optional):
 *   current=true       → only leagues with an active season (recommended)
 *   type=League|Cup    → filter by type
 *   season=2025        → filter by season year (defaults to APF_CURRENT_SEASON)
 *   search=...         → partial name search (e.g. "Premier")
 *
 * Response:
 *   {
 *     ok:                  true,
 *     season:              2025,
 *     callsToday:          1,
 *     resultCount:         N,
 *     knownLeagueMatches:  [ { id, code, name, matched: true } ],
 *     leagues:             [ { id, name, type, country, countryCode, flag, logo, currentSeason, active } ]
 *   }
 *
 * knownLeagueMatches cross-references the returned IDs against APF_LEAGUES
 * so you can confirm all six configured leagues are present in the response.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { fetchApfLeagues }                from '@/lib/football/apiFootball'
import {
  APF_CURRENT_SEASON,
  APF_LEAGUES,
}                                         from '@/lib/football/apiFootballConfig'

// ─────────────────────────────────────────────────────────────────────────────
// Response types
// ─────────────────────────────────────────────────────────────────────────────

type KnownLeagueMatch = {
  id:      number
  code:    string
  name:    string
  matched: boolean   // true if the APF response included this league ID
}

type LeagueSummary = {
  id:            number
  name:          string
  type:          string
  country:       string
  countryCode:   string | null
  flag:          string | null   // media URL — country flag
  logo:          string          // media URL — league logo
  currentSeason: number | null   // year of the latest season in response
  active:        boolean         // true if any season has current=true
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

function err(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

export async function GET(req: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const adminKey = process.env.ADMIN_SETTLEMENT_KEY
  if (!adminKey)                                    return err('Admin key not configured', 500)
  if (req.headers.get('x-admin-key') !== adminKey) return err('Unauthorized', 401)

  // ── Parse query params ────────────────────────────────────────────────────────
  const sp      = req.nextUrl.searchParams
  const current = sp.has('current')
    ? sp.get('current') !== 'false'
    : true                                // default: current=true

  const typeParam = sp.get('type') as 'League' | 'Cup' | null
  const season    = sp.has('season')
    ? parseInt(sp.get('season')!, 10)
    : APF_CURRENT_SEASON
  const search    = sp.get('search') ?? undefined

  // ── Call API-Football ─────────────────────────────────────────────────────────
  const result = await fetchApfLeagues({
    current,
    type:   typeParam ?? undefined,
    season: isNaN(season) ? APF_CURRENT_SEASON : season,
    search,
  })

  if (!result.ok) {
    return NextResponse.json({
      ok:         false,
      error:      result.error,
      ...(result.budgetExceeded && { budgetExceeded: true }),
      ...(result.rateLimitHit   && { rateLimitHit:   true }),
      callsToday: result.callsToday ?? 0,
    }, { status: result.budgetExceeded ? 429 : 502 })
  }

  // ── Summarise leagues ─────────────────────────────────────────────────────────
  const leagues: LeagueSummary[] = result.data.map(entry => {
    const latestSeason = entry.seasons.at(-1)
    const isActive     = entry.seasons.some(s => s.current)
    return {
      id:            entry.league.id,
      name:          entry.league.name,
      type:          entry.league.type,
      country:       entry.country.name,
      countryCode:   entry.country.code ?? null,
      flag:          entry.country.flag ?? null,   // media URL — store in DB later
      logo:          entry.league.logo,            // media URL — store in DB later
      currentSeason: latestSeason?.year ?? null,
      active:        isActive,
    }
  })

  // ── Cross-reference against APF_LEAGUES ───────────────────────────────────────
  const returnedIds = new Set(leagues.map(l => l.id))

  const knownLeagueMatches: KnownLeagueMatch[] = APF_LEAGUES.map(known => ({
    id:      known.id,
    code:    known.code,
    name:    known.name,
    matched: returnedIds.has(known.id),
  }))

  const allMatched = knownLeagueMatches.every(m => m.matched)

  return NextResponse.json({
    ok:                 true,
    season:             isNaN(season) ? APF_CURRENT_SEASON : season,
    callsToday:         result.callsToday,
    resultCount:        leagues.length,
    allKnownLeaguesMatched: allMatched,
    knownLeagueMatches,
    leagues,
  })
}
