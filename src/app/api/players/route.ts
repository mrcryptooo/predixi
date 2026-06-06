/**
 * GET /api/players
 *
 * DB-backed player read API. Reads from the `players` table — zero APF calls.
 * Used by Daily XI and World Cup pages to load real player pools with photos.
 *
 * Query params (all optional):
 *   leagueId  string    default: 'WC'
 *   season    number    default: 2026
 *   position  string    Goalkeeper | Defender | Midfielder | Attacker
 *   teamId    string    'apf-team-{id}' format
 *   limit     number    default: 200, max: 1500
 *
 * Response (200):
 *   {
 *     ok, leagueId, season, count,
 *     players: [ { playerId, apfPlayerId, name, age, number, position,
 *                  photoUrl, teamId, apfTeamId, teamName, teamLogoUrl, nationality } ]
 *   }
 *
 * Response (404):
 *   { ok: false, error: "No players found..." }
 *
 * Cache: public, max-age=60, s-maxage=300
 *   Players update only after squad sync — safe to cache 1 min browser / 5 min CDN.
 *
 * Note on byPosition grouping:
 *   The route returns a flat players[] array rather than grouping by position.
 *   Rationale: the caller (Daily XI) already knows which pool it's building
 *   (Attacker pool, Midfielder pool, etc.) and filters by the `position` param.
 *   Grouping adds JSON overhead for no benefit when the caller already scopes
 *   the request by position. Frontend can group client-side in one pass if needed.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'
import type { PlayerRow }                 from '@/lib/supabase/types'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const VALID_POSITIONS = new Set(['Goalkeeper', 'Defender', 'Midfielder', 'Attacker'])
const DEFAULT_LIMIT   = 200
const MAX_LIMIT       = 1500
const DEFAULT_SEASON  = 2026

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=60, s-maxage=300',
}

// ─────────────────────────────────────────────────────────────────────────────
// GET handler
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams

  // ── Parse params ──────────────────────────────────────────────────────────
  const leagueId = (sp.get('leagueId') ?? 'WC').trim().toUpperCase()
  // Only WC supported for now — extend when other tournaments are added
  if (leagueId !== 'WC') {
    return NextResponse.json(
      { ok: false, error: `leagueId '${leagueId}' is not supported. Currently only 'WC' is available.` },
      { status: 400 },
    )
  }

  const rawSeason = sp.get('season')
  const season    = rawSeason ? parseInt(rawSeason, 10) : DEFAULT_SEASON
  if (isNaN(season) || season < 2024 || season > 2030) {
    return NextResponse.json(
      { ok: false, error: `Invalid season '${rawSeason}'.` },
      { status: 400 },
    )
  }

  const position = sp.get('position')
  if (position && !VALID_POSITIONS.has(position)) {
    return NextResponse.json(
      {
        ok:    false,
        error: `Invalid position '${position}'. Valid values: ${[...VALID_POSITIONS].join(', ')}`,
      },
      { status: 400 },
    )
  }

  const teamId = sp.get('teamId') ?? undefined   // e.g. 'apf-team-6'

  const rawLimit = sp.get('limit')
  const limit    = rawLimit
    ? Math.min(Math.max(1, parseInt(rawLimit, 10)), MAX_LIMIT)
    : DEFAULT_LIMIT

  // ── Query players table ───────────────────────────────────────────────────
  try {
    const supabase = getServerSupabaseClient()

    let query = supabase
      .from('players')
      .select(
        'player_id, apf_player_id, name, age, number, position, photo_url,' +
        'team_id, apf_team_id, team_name, team_logo_url, nationality',
      )
      .eq('world_cup_year', season)
      .order('team_name', { ascending: true })
      .order('position',  { ascending: true })
      .order('name',      { ascending: true })
      .limit(limit)

    if (position) query = query.eq('position', position)
    if (teamId)   query = query.eq('team_id', teamId)

    const { data: rawRows, error } = await query

    if (error) {
      console.error('[GET /api/players]', error)
      return NextResponse.json(
        { ok: false, error: 'Failed to load players' },
        { status: 500 },
      )
    }

    // The server client is createClient<any> (intentionally untyped per server.ts).
    // Double-cast via unknown to get the correct row type.
    const rows = rawRows as unknown as PlayerRow[] | null

    if (!rows || rows.length === 0) {
      const filters = [
        `leagueId=${leagueId}`,
        `season=${season}`,
        position && `position=${position}`,
        teamId   && `teamId=${teamId}`,
      ].filter(Boolean).join(', ')

      return NextResponse.json(
        {
          ok:    false,
          error: `No players found for ${filters}. Run POST /api/admin/sync-player-squads to populate.`,
        },
        { status: 404 },
      )
    }

    // ── Map to camelCase response ─────────────────────────────────────────────
    const players = rows.map(r => ({
      playerId:    r.player_id,
      apfPlayerId: r.apf_player_id,
      name:        r.name,
      age:         r.age     ?? null,
      number:      r.number  ?? null,
      position:    r.position ?? null,
      photoUrl:    r.photo_url     ?? null,   // APF CDN URL — store in DB, not hotlinked
      teamId:      r.team_id,
      apfTeamId:   r.apf_team_id,
      teamName:    r.team_name,
      teamLogoUrl: r.team_logo_url ?? null,
      nationality: r.nationality   ?? null,
    }))

    return NextResponse.json(
      {
        ok: true,
        leagueId,
        season,
        count: players.length,
        players,
      },
      { headers: CACHE_HEADERS },
    )
  } catch (e) {
    console.error('[GET /api/players] unhandled:', e)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
