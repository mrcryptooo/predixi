/**
 * GET /api/standings?leagueId=PL&season=2025
 *
 * DB-backed league standings. Reads from the `standings` table populated by
 * POST /api/admin/sync-standings — no external API calls are made here.
 *
 * Query params:
 *   leagueId  string   optional  default: 'PL'   — competition code
 *   season    number   optional  default: APF_CURRENT_SEASON
 *
 * Valid leagueId values: PL, PD, BL1, SA, FL1, CL
 *
 * Response (200):
 *   {
 *     ok:        true,
 *     leagueId,  season,  count,  updatedAt,
 *     league:    { id, name, logo, country, countryFlag },
 *     standings: [ { position, teamId, teamName, teamLogo,
 *                    played, won, drawn, lost,
 *                    goalsFor, goalsAgainst, goalDiff,
 *                    points, form, description } ]
 *   }
 *
 * Response (404):
 *   { ok: false, error: "No standings found for PL season 2025 ..." }
 *
 * Cache headers:
 *   Cache-Control: public, max-age=60, s-maxage=300
 *   Standings update once daily — browser caches 1 min, CDN 5 min.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'
import { APF_CURRENT_SEASON }             from '@/lib/football/apiFootballConfig'
import type { StandingRow }               from '@/lib/supabase/types'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const VALID_LEAGUE_IDS = new Set(['PL', 'PD', 'BL1', 'SA', 'FL1', 'CL', 'WC'])

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=60, s-maxage=300',
}

// ─────────────────────────────────────────────────────────────────────────────
// GET handler
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams

  // ── Parse leagueId ─────────────────────────────────────────────────────────
  const rawLeague = (sp.get('leagueId') ?? 'PL').trim().toUpperCase()
  if (!VALID_LEAGUE_IDS.has(rawLeague)) {
    return NextResponse.json(
      {
        ok:    false,
        error: `Unknown leagueId '${rawLeague}'. Valid values: ${[...VALID_LEAGUE_IDS].join(', ')}`,
      },
      { status: 400 },
    )
  }

  // ── Parse season ───────────────────────────────────────────────────────────
  const rawSeason = sp.get('season')
  const season    = rawSeason ? parseInt(rawSeason, 10) : APF_CURRENT_SEASON
  if (isNaN(season) || season < 2020 || season > 2030) {
    return NextResponse.json(
      { ok: false, error: `Invalid season '${rawSeason}'. Expected a year between 2020 and 2030.` },
      { status: 400 },
    )
  }

  // ── Query standings table ──────────────────────────────────────────────────
  try {
    const supabase = getServerSupabaseClient()

    // The server client is createClient<any> (intentionally untyped per server.ts).
    // Supabase's generic inference resolves to GenericStringError for unlisted
    // tables, so we assert the query result to the correct row type.
    const { data: rawRows, error } = await supabase
      .from('standings')
      .select(
        'league_id, league_name, league_logo, country, country_flag, season,' +
        'team_id, team_name, team_logo,' +
        'position, points, played, won, drawn, lost,' +
        'goals_for, goals_against, goal_diff,' +
        'form, description, updated_at',
      )
      .eq('league_id', rawLeague)
      .eq('season', season)
      .order('position', { ascending: true })

    const rows = rawRows as StandingRow[] | null

    if (error) {
      console.error('[GET /api/standings]', error)
      return NextResponse.json(
        { ok: false, error: 'Failed to load standings' },
        { status: 500 },
      )
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        {
          ok:    false,
          error: `No standings found for ${rawLeague} season ${season}. Run POST /api/admin/sync-standings to populate.`,
        },
        { status: 404 },
      )
    }

    // ── Extract league metadata from first row ─────────────────────────────
    const first     = rows[0]
    const updatedAt = rows.reduce(
      (latest, r) => r.updated_at > latest ? r.updated_at : latest,
      rows[0].updated_at,
    )

    // ── Map rows to camelCase response ─────────────────────────────────────
    const standings = rows.map(r => ({
      position:     r.position,
      teamId:       r.team_id,
      teamName:     r.team_name,
      teamLogo:     r.team_logo     ?? null,
      played:       r.played,
      won:          r.won,
      drawn:        r.drawn,
      lost:         r.lost,
      goalsFor:     r.goals_for,
      goalsAgainst: r.goals_against,
      goalDiff:     r.goal_diff,
      points:       r.points,
      form:         r.form         ?? null,
      description:  r.description  ?? null,
    }))

    return NextResponse.json(
      {
        ok: true,
        leagueId:  rawLeague,
        season,
        count:     standings.length,
        updatedAt,
        league: {
          name:        first.league_name,
          logo:        first.league_logo   ?? null,
          country:     first.country       ?? null,
          countryFlag: first.country_flag  ?? null,
        },
        standings,
      },
      { headers: CACHE_HEADERS },
    )
  } catch (e) {
    console.error('[GET /api/standings] unhandled:', e)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
