/**
 * POST /api/admin/sync-wc-standings
 *
 * Fetches FIFA World Cup 2026 group standings from API-Football and upserts
 * them into the `standings` table with league_id='WC' and season=2026.
 *
 * Auth:    x-admin-key header vs ADMIN_SETTLEMENT_KEY
 * League:  API-Football league ID 1 (FIFA World Cup), season 2026
 *
 * Request body (all optional):
 *   { "dryRun": boolean }   // default false
 *
 * Notes:
 *   - Uses season 2026 explicitly — NOT APF_CURRENT_SEASON (which is 2025 for club leagues).
 *   - APF returns WC standings as an array of groups (Group A, Group B, ..., Group L).
 *     All groups are flattened into a single upsert so each team has exactly one row
 *     per season keyed by UNIQUE(league_id='WC', season=2026, team_id='apf-team-{id}').
 *   - Before the tournament starts (Jun 11, 2026) APF may return 0 rows or empty standings.
 *     That is not an error — report fixturesFound:0 and return ok:true.
 *   - dryRun calls APF (1 request) but skips all DB writes — safe for verification.
 *   - team_id format 'apf-team-{id}' matches matches.home/away_team_id convention.
 *
 * Response:
 *   { ok, dryRun, season, groupsFound, rowsUpserted, apiCallsUsed, callsToday, errors }
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'
import { fetchApfStandings }              from '@/lib/football/apiFootball'
import { APF_WORLD_CUP }                  from '@/lib/football/apiFootballConfig'
import type { InsertStanding }            from '@/lib/supabase/types'

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

  const dryRun = body.dryRun === true

  if (!process.env.API_FOOTBALL_KEY) {
    return err('API_FOOTBALL_KEY is not configured', 500)
  }

  // ── Fetch from API-Football ───────────────────────────────────────────────────
  const result = await fetchApfStandings({
    league: APF_WORLD_CUP.id,
    season: APF_WORLD_CUP.season,   // always 2026 — never APF_CURRENT_SEASON
  })

  if (!result.ok) {
    return NextResponse.json({
      ok:           false,
      error:        result.error,
      season:       APF_WORLD_CUP.season,
      apiCallsUsed: 1,
      callsToday:   result.callsToday ?? 0,
      ...(result.budgetExceeded && { budgetExceeded: true }),
      ...(result.rateLimitHit   && { rateLimitHit:   true }),
    }, { status: result.budgetExceeded ? 429 : 502 })
  }

  const payload = result.data[0]

  if (!payload) {
    // APF returned an empty response — tournament data not yet available
    return NextResponse.json({
      ok:           true,
      dryRun,
      season:       APF_WORLD_CUP.season,
      groupsFound:  0,
      rowsUpserted: 0,
      apiCallsUsed: 1,
      callsToday:   result.callsToday,
      message:      'APF returned no standings data for WC 2026 — tournament may not have started yet.',
    })
  }

  // APF returns standings as array of groups: [ [GroupA entries], [GroupB entries], ... ]
  const groups      = payload.league.standings
  const groupsFound = groups.length
  const allEntries  = groups.flat()

  if (allEntries.length === 0) {
    return NextResponse.json({
      ok:           true,
      dryRun,
      season:       APF_WORLD_CUP.season,
      groupsFound,
      rowsUpserted: 0,
      apiCallsUsed: 1,
      callsToday:   result.callsToday,
      message:      `WC standings: ${groupsFound} group(s) found but no team entries yet.`,
    })
  }

  // ── Build upsert rows ─────────────────────────────────────────────────────────
  const rows: InsertStanding[] = allEntries.map(entry => ({
    league_id:     APF_WORLD_CUP.code,          // 'WC'
    league_name:   APF_WORLD_CUP.name,          // 'FIFA World Cup 2026'
    league_logo:   payload.league.logo   ?? null,
    country:       payload.league.country ?? null,
    country_flag:  payload.league.flag   ?? null,
    season:        APF_WORLD_CUP.season,         // 2026
    team_id:       `apf-team-${entry.team.id}`,  // matches matches.home/away_team_id format
    team_name:     entry.team.name,
    team_logo:     entry.team.logo       ?? null,
    position:      entry.rank,
    points:        entry.points,
    played:        entry.all.played,
    won:           entry.all.win,
    drawn:         entry.all.draw,
    lost:          entry.all.lose,
    goals_for:     entry.all.goals.for,
    goals_against: entry.all.goals.against,
    goal_diff:     entry.goalsDiff,
    form:          entry.form          ?? null,
    description:   entry.description   ?? null,
  }))

  if (dryRun) {
    console.log(
      `[sync-wc-standings] dryRun: ${rows.length} rows from ${groupsFound} groups, skipping DB`
    )
    return NextResponse.json({
      ok:           true,
      dryRun:       true,
      season:       APF_WORLD_CUP.season,
      groupsFound,
      rowsUpserted: rows.length,   // "would upsert"
      apiCallsUsed: 1,
      callsToday:   result.callsToday,
      message:      `Dry run — ${rows.length} rows from ${groupsFound} WC groups. Run with dryRun:false to write.`,
    })
  }

  // ── Upsert into standings table ───────────────────────────────────────────────
  const supabase = getServerSupabaseClient()

  const { error: upsertErr, count } = await supabase
    .from('standings')
    .upsert(rows, { onConflict: 'league_id,season,team_id' })
    .select()

  if (upsertErr) {
    console.error('[sync-wc-standings] upsert error:', upsertErr.message)
    return NextResponse.json({
      ok:           false,
      error:        `DB upsert failed: ${upsertErr.message}`,
      season:       APF_WORLD_CUP.season,
      groupsFound,
      apiCallsUsed: 1,
      callsToday:   result.callsToday,
    }, { status: 500 })
  }

  const rowsUpserted = count ?? rows.length

  console.log(
    `[sync-wc-standings] ${rowsUpserted} rows upserted from ${groupsFound} WC groups, season=2026`
  )

  return NextResponse.json({
    ok:           true,
    dryRun:       false,
    season:       APF_WORLD_CUP.season,
    groupsFound,
    rowsUpserted,
    apiCallsUsed: 1,
    callsToday:   result.callsToday,
    message:      `WC standings sync complete — ${rowsUpserted} rows upserted.`,
  })
}
