/**
 * POST /api/admin/sync-player-squads
 *
 * Fetches player squad data (including player photos) from API-Football
 * and upserts into the `players` table.
 *
 * Auth:    x-admin-key header vs ADMIN_SETTLEMENT_KEY
 * APF:     GET /players/squads?team={id}  (one request per team)
 *
 * Request body (all optional):
 *   {
 *     "dryRun":     boolean    // default TRUE — always safe by default
 *     "limitTeams": number     // max teams to process (default 1 for safety)
 *     "teamIds":    number[]   // specific APF team IDs; overrides limitTeams
 *   }
 *
 * Safety defaults:
 *   - dryRun defaults to TRUE — explicit { "dryRun": false } required to write DB
 *   - limitTeams defaults to 1 — protects against accidental full sync
 *   - Full 48-team sync requires: { "dryRun": false, "limitTeams": 48 }
 *     or provide all 48 teamIds explicitly
 *
 * Budget:
 *   1 APF call per team. First dry-run: 1 call. Full sync: 48 calls.
 *   Budget-tracked under endpoint 'players/squads'.
 *
 * team_logo_url is populated from the national_teams table (no extra APF call).
 *
 * Response:
 *   { ok, dryRun, teamsScanned, playersFound, rowsUpserted,
 *     missingPhotos, apiCallsUsed, callsToday, errors, samplePlayers }
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'
import { fetchApfPlayerSquads }           from '@/lib/football/apiFootball'
import { APF_WORLD_CUP }                  from '@/lib/football/apiFootballConfig'
import type { InsertPlayer, NationalTeamRow } from '@/lib/supabase/types'

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

function err(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

export async function POST(req: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const adminKey = process.env.ADMIN_SETTLEMENT_KEY
  if (!adminKey)                                    return err('Admin key not configured', 500)
  if (req.headers.get('x-admin-key') !== adminKey) return err('Unauthorized', 401)

  // ── Parse body ────────────────────────────────────────────────────────────────
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* empty body is valid */ }

  // Default dryRun=TRUE for safety — explicit false required to write
  const dryRun    = body.dryRun !== false   // default: true
  const limitTeams = typeof body.limitTeams === 'number' && body.limitTeams > 0
    ? Math.floor(body.limitTeams)
    : 1                                     // default: 1 team max

  const teamIdsFromBody = Array.isArray(body.teamIds)
    ? (body.teamIds as unknown[]).filter((id): id is number => typeof id === 'number')
    : null

  if (!process.env.API_FOOTBALL_KEY) {
    return err('API_FOOTBALL_KEY is not configured', 500)
  }

  const supabase = getServerSupabaseClient()

  // ── Determine which teams to sync ─────────────────────────────────────────────
  let teamsToSync: Array<{ apf_team_id: number; team_id: string; team_name: string; logo_url: string | null }>

  if (teamIdsFromBody && teamIdsFromBody.length > 0) {
    // Explicit team IDs provided — look them up in national_teams
    const { data: teamRows, error: teamErr } = await supabase
      .from('national_teams')
      .select('apf_team_id, team_id, name, logo_url')
      .eq('world_cup_year', APF_WORLD_CUP.season)
      .in('apf_team_id', teamIdsFromBody)

    if (teamErr) return err(`Failed to load national teams: ${teamErr.message}`, 500)

    teamsToSync = (teamRows as NationalTeamRow[]).map(t => ({
      apf_team_id: t.apf_team_id,
      team_id:     t.team_id,
      team_name:   t.name,
      logo_url:    t.logo_url,
    }))
  } else {
    // Load from national_teams, limited to limitTeams
    const { data: teamRows, error: teamErr } = await supabase
      .from('national_teams')
      .select('apf_team_id, team_id, name, logo_url')
      .eq('world_cup_year', APF_WORLD_CUP.season)
      .order('name', { ascending: true })
      .limit(limitTeams)

    if (teamErr) return err(`Failed to load national teams: ${teamErr.message}`, 500)
    if (!teamRows || teamRows.length === 0) {
      return err('No WC 2026 teams found in national_teams — run sync-national-teams first', 400)
    }

    teamsToSync = (teamRows as NationalTeamRow[]).map(t => ({
      apf_team_id: t.apf_team_id,
      team_id:     t.team_id,
      team_name:   t.name,
      logo_url:    t.logo_url,
    }))
  }

  // ── Sync each team ─────────────────────────────────────────────────────────────
  const errors:        string[]       = []
  const samplePlayers: string[]       = []
  let   teamsScanned   = 0
  let   playersFound   = 0
  let   rowsUpserted   = 0
  let   missingPhotos  = 0
  let   apiCallsUsed   = 0
  let   callsToday     = 0

  for (const team of teamsToSync) {
    teamsScanned++

    const result = await fetchApfPlayerSquads({ team: team.apf_team_id })
    apiCallsUsed++

    if (!result.ok) {
      if (result.budgetExceeded) {
        errors.push(`[${team.team_name}]: APF budget cap reached — stopping`)
        callsToday = result.callsToday ?? callsToday
        break
      }
      errors.push(`[${team.team_name}]: ${result.error}`)
      callsToday = result.callsToday ?? callsToday
      continue
    }

    callsToday = result.callsToday

    const squadData = result.data[0]
    if (!squadData || squadData.players.length === 0) {
      errors.push(`[${team.team_name}]: empty squad response`)
      continue
    }

    // Build player rows — deduplicate by player_id within this team's batch
    const rowMap = new Map<string, InsertPlayer>()
    for (const p of squadData.players) {
      const playerId = `apf-player-${p.id}`
      if (!p.photo) missingPhotos++

      rowMap.set(playerId, {
        apf_player_id:  p.id,
        player_id:      playerId,
        name:           p.name,
        age:            p.age    ?? null,
        number:         p.number ?? null,
        position:       p.position ?? null,
        nationality:    null,          // /players/squads does not return nationality
        photo_url:      p.photo  ?? null,   // ← APF CDN URL, stored not hotlinked
        apf_team_id:    team.apf_team_id,
        team_id:        team.team_id,
        team_name:      team.team_name,
        team_logo_url:  team.logo_url ?? null,
        world_cup_year: APF_WORLD_CUP.season,
        source:         'apf',
      })
    }

    const rows = Array.from(rowMap.values())
    playersFound += rows.length

    // Sample: first 2 players from the first team only
    if (samplePlayers.length < 4) {
      rows.slice(0, 2).forEach(r =>
        samplePlayers.push(
          `${r.name} (${r.position ?? '?'}) #${r.number ?? '?'} photo=${r.photo_url ? '✓' : 'null'}`
        )
      )
    }

    if (dryRun) {
      rowsUpserted += rows.length  // "would upsert"
      continue
    }

    // Upsert into players table
    const { error: upsertErr, count } = await supabase
      .from('players')
      .upsert(rows, { onConflict: 'apf_player_id,world_cup_year' })
      .select()

    if (upsertErr) {
      errors.push(`[${team.team_name}]: DB upsert failed — ${upsertErr.message}`)
      continue
    }

    rowsUpserted += count ?? rows.length
  }

  const ok = errors.length === 0

  console.log(
    `[sync-player-squads] ${dryRun ? 'dryRun' : 'real'}: ` +
    `teams=${teamsScanned} players=${playersFound} upserted=${rowsUpserted} ` +
    `calls=${apiCallsUsed} callsToday=${callsToday}`
  )

  return NextResponse.json({
    ok:            dryRun ? true : ok,
    dryRun,
    teamsScanned,
    playersFound,
    rowsUpserted,
    missingPhotos,
    apiCallsUsed,
    callsToday,
    errors:        errors.length > 0 ? errors : undefined,
    samplePlayers: samplePlayers.length > 0 ? samplePlayers : undefined,
    message:       dryRun
      ? `Dry run — ${playersFound} players found across ${teamsScanned} team(s). Run with dryRun:false to write.`
      : `Player squads sync complete — ${rowsUpserted} players upserted.`,
  })
}
