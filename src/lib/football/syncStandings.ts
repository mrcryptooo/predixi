/**
 * Shared standings sync logic — used by both admin and cron routes.
 *
 * SERVER-ONLY. Never import from client components.
 *
 * Both POST /api/admin/sync-standings and GET /api/cron/sync-standings call
 * runStandingsSync() so the behaviour stays in sync automatically.
 */

import { getServerSupabaseClient } from '@/lib/supabase/server'
import { fetchApfStandings }       from '@/lib/football/apiFootball'
import {
  APF_CURRENT_SEASON,
  APF_LEAGUES,
}                                  from '@/lib/football/apiFootballConfig'
import type { InsertStanding }     from '@/lib/supabase/types'

// ─────────────────────────────────────────────────────────────────────────────
// Return type
// ─────────────────────────────────────────────────────────────────────────────

export type StandingsSyncResult = {
  ok:             boolean
  season:         number
  dryRun:         boolean
  leaguesScanned: number
  apiCallsUsed:   number
  rowsUpserted:   number
  callsToday:     number
  errors:         string[]
  message:        string
}

// ─────────────────────────────────────────────────────────────────────────────
// Core sync function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches standings from API-Football for all configured leagues and
 * upserts them into the `standings` table.
 *
 * @param supabase  Server Supabase client (service role).
 * @param opts.season   Season year to sync (defaults to APF_CURRENT_SEASON).
 * @param opts.dryRun   If true, calls APF but skips DB writes.
 */
export async function runStandingsSync(
  supabase:    ReturnType<typeof getServerSupabaseClient>,
  opts:        { season?: number; dryRun?: boolean } = {},
): Promise<StandingsSyncResult> {
  const season = (typeof opts.season === 'number' && Number.isFinite(opts.season))
    ? Math.floor(opts.season)
    : APF_CURRENT_SEASON
  const dryRun = opts.dryRun === true

  const errors:        string[] = []
  let   leaguesScanned = 0
  let   apiCallsUsed   = 0
  let   rowsUpserted   = 0
  let   callsToday     = 0

  for (const league of APF_LEAGUES) {
    leaguesScanned++

    const result = await fetchApfStandings({ league: league.id, season })
    apiCallsUsed++

    if (!result.ok) {
      if (result.budgetExceeded) {
        errors.push(`[${league.code}]: daily APF budget cap reached — stopping`)
        callsToday = result.callsToday ?? callsToday
        break
      }
      errors.push(`[${league.code}]: ${result.error}`)
      callsToday = result.callsToday ?? callsToday
      continue
    }

    callsToday = result.callsToday

    const payload = result.data[0]
    if (!payload) {
      errors.push(`[${league.code}]: empty response from APF standings`)
      continue
    }

    const allEntries = payload.league.standings.flat()
    if (!allEntries.length) {
      errors.push(`[${league.code}]: no standings entries in response (off-season?)`)
      continue
    }

    const rows: InsertStanding[] = allEntries.map(entry => ({
      league_id:     league.code,
      league_name:   payload.league.name,
      league_logo:   payload.league.logo   ?? null,
      country:       payload.league.country ?? null,
      country_flag:  payload.league.flag   ?? null,
      season,
      team_id:       `apf-team-${entry.team.id}`,
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
      console.log(`[syncStandings] dryRun [${league.code}]: ${rows.length} rows ready, skipping DB`)
      rowsUpserted += rows.length
      continue
    }

    const { error: upsertErr, count } = await supabase
      .from('standings')
      .upsert(rows, { onConflict: 'league_id,season,team_id' })
      .select()

    if (upsertErr) {
      errors.push(`[${league.code}]: DB upsert failed — ${upsertErr.message}`)
      continue
    }

    rowsUpserted += count ?? rows.length
  }

  const ok = errors.length === 0 || (errors.length > 0 && rowsUpserted > 0)
  const message = dryRun
    ? `Dry run — ${rowsUpserted} rows would be upserted across ${leaguesScanned} leagues.`
    : `Standings sync complete — ${rowsUpserted} rows upserted.`

  return { ok, season, dryRun, leaguesScanned, apiCallsUsed, rowsUpserted, callsToday, errors, message }
}
