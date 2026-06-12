/**
 * GET /api/cron/sync-wc-standings
 *
 * Vercel Cron — fetches FIFA World Cup 2026 group standings from API-Football
 * and upserts them into the standings table.
 * Runs every 5 minutes to keep group tables current after matches finish.
 *
 * Schedule: every-5-minutes  (requires Vercel Pro plan)
 *
 * Auth:   Authorization: Bearer <CRON_SECRET>
 * API:    API-Football (APF), league 1 (FIFA World Cup), season 2026
 *         1 API call per invocation
 * Budget: ~288 APF calls/day — well within the 6,000/day hard cap
 *
 * Idempotent: upserts on UNIQUE(league_id, season, team_id).
 * Before tournament group stage begins APF returns empty — not an error.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'
import { fetchApfStandings }              from '@/lib/football/apiFootball'
import { APF_WORLD_CUP }                  from '@/lib/football/apiFootballConfig'
import type { InsertStanding }            from '@/lib/supabase/types'

export async function GET(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron/sync-wc-standings] CRON_SECRET env var not set')
    return NextResponse.json({ success: false, error: 'Cron secret not configured' }, { status: 500 })
  }
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.API_FOOTBALL_KEY) {
    return NextResponse.json({ success: false, error: 'API_FOOTBALL_KEY not configured' }, { status: 500 })
  }

  // ── Fetch WC standings from API-Football ─────────────────────────────────
  const result = await fetchApfStandings({
    league: APF_WORLD_CUP.id,
    season: APF_WORLD_CUP.season,
  })

  if (!result.ok) {
    console.error('[cron/sync-wc-standings] APF fetch error:', result.error)
    return NextResponse.json({
      success:   false,
      error:     result.error,
      ...(result.budgetExceeded && { budgetExceeded: true }),
      ...(result.rateLimitHit   && { rateLimitHit:   true }),
    }, { status: result.budgetExceeded ? 429 : 502 })
  }

  const payload = result.data[0]

  if (!payload) {
    // Before tournament starts APF returns empty — not an error
    return NextResponse.json({
      success:      true,
      groupsFound:  0,
      rowsUpserted: 0,
      callsToday:   result.callsToday,
      message:      'No WC standings data yet — tournament may not have started.',
    })
  }

  // Deduplicate by team_id (same team can appear in multiple group arrays)
  const rowMap = new Map<string, InsertStanding>()
  for (const entry of payload.league.standings.flat()) {
    const teamId = `apf-team-${entry.team.id}`
    rowMap.set(teamId, {
      league_id:     APF_WORLD_CUP.code,
      league_name:   APF_WORLD_CUP.name,
      league_logo:   payload.league.logo   ?? null,
      country:       payload.league.country ?? null,
      country_flag:  payload.league.flag   ?? null,
      season:        APF_WORLD_CUP.season,
      team_id:       teamId,
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
    })
  }

  const rows        = Array.from(rowMap.values())
  const groupsFound = payload.league.standings.length

  if (rows.length === 0) {
    return NextResponse.json({
      success:      true,
      groupsFound,
      rowsUpserted: 0,
      callsToday:   result.callsToday,
      message:      `WC standings: ${groupsFound} group(s) found but no team entries yet.`,
    })
  }

  const supabase = getServerSupabaseClient()
  const { error: upsertErr, count } = await supabase
    .from('standings')
    .upsert(rows, { onConflict: 'league_id,season,team_id' })
    .select()

  if (upsertErr) {
    console.error('[cron/sync-wc-standings] upsert error:', upsertErr.message)
    return NextResponse.json({
      success:      false,
      error:        `DB upsert failed: ${upsertErr.message}`,
      groupsFound,
      rowsUpserted: 0,
      callsToday:   result.callsToday,
    }, { status: 500 })
  }

  const rowsUpserted = count ?? rows.length
  console.info(
    `[cron/sync-wc-standings] groupsFound=${groupsFound} rowsUpserted=${rowsUpserted}` +
    ` callsToday=${result.callsToday}`
  )

  return NextResponse.json({
    success:      true,
    groupsFound,
    rowsUpserted,
    callsToday:   result.callsToday,
  })
}
