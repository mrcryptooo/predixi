/**
 * POST /api/admin/sync-standings
 *
 * Fetches current league standings from API-Football and upserts them into
 * the `standings` table for all configured leagues.
 *
 * Auth:   x-admin-key header vs ADMIN_SETTLEMENT_KEY
 * APIs:   API-Football /standings?league&season (budget-tracked via wrapper)
 *
 * Request body (all optional):
 *   {
 *     "dryRun":  boolean   // true = call API, log results, but do NOT write DB
 *     "season":  number    // override APF_CURRENT_SEASON for this request
 *   }
 *
 * Notes:
 *   - dryRun calls the APF API (6 calls, one per league) but skips all DB writes.
 *   - dryRun:false upserts rows on UNIQUE(league_id, season, team_id) — safe to re-run.
 *   - Does NOT sync fixtures or results; run sync-fixtures separately.
 *   - Recommended cron: once daily at 01:00 UTC (after sync-fixtures at 00:30 UTC).
 *
 * Response:
 *   {
 *     ok, dryRun, season,
 *     leaguesScanned, apiCallsUsed, rowsUpserted, errors, callsToday
 *   }
 *
 * Media URL storage:
 *   league_logo, country_flag, team_logo are stored as APF CDN URLs.
 *   They are served from Supabase — never fetched per page view from APF.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'
import { fetchApfStandings }              from '@/lib/football/apiFootball'
import {
  APF_CURRENT_SEASON,
  APF_LEAGUES,
}                                         from '@/lib/football/apiFootballConfig'
import type { InsertStanding }            from '@/lib/supabase/types'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function err(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

// ─────────────────────────────────────────────────────────────────────────────
// POST handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const adminKey = process.env.ADMIN_SETTLEMENT_KEY
  if (!adminKey)                                    return err('Admin key not configured', 500)
  if (req.headers.get('x-admin-key') !== adminKey) return err('Unauthorized', 401)

  // ── Parse body ────────────────────────────────────────────────────────────────
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* empty body is valid */ }

  const dryRun = body.dryRun === true
  const season = typeof body.season === 'number' && Number.isFinite(body.season)
    ? Math.floor(body.season)
    : APF_CURRENT_SEASON

  // ── Validate API key is configured ───────────────────────────────────────────
  if (!process.env.API_FOOTBALL_KEY) {
    return err('API_FOOTBALL_KEY is not configured', 500)
  }

  const supabase       = getServerSupabaseClient()
  const errors:        string[]         = []
  let   leaguesScanned = 0
  let   apiCallsUsed   = 0
  let   rowsUpserted   = 0
  let   callsToday     = 0

  // ── Sync each configured league ───────────────────────────────────────────────
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

    // APF returns standings as an array of groups (e.g. Group A, Group B).
    // For single-table leagues, standings[0] is the full table.
    // For knockout competitions (CL), there may be multiple groups.
    // Flatten all groups into a single set of rows.
    const allEntries = payload.league.standings.flat()

    if (!allEntries.length) {
      errors.push(`[${league.code}]: no standings entries in response (off-season?)`)
      continue
    }

    // Build upsert rows
    const rows: InsertStanding[] = allEntries.map(entry => ({
      league_id:     league.code,
      league_name:   payload.league.name,
      league_logo:   payload.league.logo   ?? null,   // ← media URL: stored, not hotlinked
      country:       payload.league.country ?? null,
      country_flag:  payload.league.flag   ?? null,   // ← media URL: stored, not hotlinked
      season,
      team_id:       `apf-team-${entry.team.id}`,     // matches matches.home/away_team_id format
      team_name:     entry.team.name,
      team_logo:     entry.team.logo       ?? null,   // ← media URL: stored, not hotlinked
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
      // Dry-run: report what would be written but skip DB
      console.log(`[sync-standings] dryRun [${league.code}]: ${rows.length} rows ready, skipping DB write`)
      rowsUpserted += rows.length  // count as "would upsert"
      continue
    }

    // Upsert into standings table (UNIQUE on league_id, season, team_id)
    const { error: upsertErr, count } = await supabase
      .from('standings')
      .upsert(rows, { onConflict: 'league_id,season,team_id' })
      .select()   // needed for count

    if (upsertErr) {
      errors.push(`[${league.code}]: DB upsert failed — ${upsertErr.message}`)
      continue
    }

    rowsUpserted += count ?? rows.length
  }

  return NextResponse.json({
    ok:             errors.length === 0 || (errors.length > 0 && rowsUpserted > 0),
    dryRun,
    season,
    leaguesScanned,
    apiCallsUsed,
    rowsUpserted,
    callsToday,
    errors:         errors.length > 0 ? errors : undefined,
    message:        dryRun
      ? `Dry run complete — ${rowsUpserted} rows would be upserted across ${leaguesScanned} leagues. Run with dryRun:false to write.`
      : `Standings sync complete — ${rowsUpserted} rows upserted.`,
  })
}
