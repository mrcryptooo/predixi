/**
 * POST /api/admin/sync-wc-fixtures
 *
 * Fetches FIFA World Cup 2026 fixtures from API-Football and upserts them
 * into the `matches` table with league_id='WC' and api_source='apf'.
 *
 * Auth:    x-admin-key header vs ADMIN_SETTLEMENT_KEY
 * League:  API-Football league ID 1 (FIFA World Cup), season 2026
 *
 * Request body (all optional):
 *   {
 *     "dryRun":  boolean   // true = call API, skip DB writes, report what would upsert
 *     "from":    string    // YYYY-MM-DD date range start (default: today)
 *     "to":      string    // YYYY-MM-DD date range end   (default: today + 7 days)
 *   }
 *
 * Notes:
 *   - Uses season 2026 explicitly — NOT APF_CURRENT_SEASON (which is 2025 for club leagues).
 *   - Uses the same status normalization and outcome inference as existing APF fixture sync.
 *   - Never overwrites a settled actual_outcome on existing rows.
 *   - dryRun calls APF (1 request) but skips all DB writes — safe for verification.
 *   - APF may return 0 fixtures before June 11, 2026 (tournament start). That is valid.
 *
 * Response:
 *   { ok, dryRun, leagueId, season, from, to,
 *     apiCallsUsed, fixturesFound, inserted, updated, invalid, errors, callsToday }
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'
import {
  normalizeApfStatus,
  inferOutcome,
  validateFixture,
}                                         from '@/lib/football/status'
import { fetchApfFixtures }               from '@/lib/football/apiFootball'
import { APF_WORLD_CUP }                  from '@/lib/football/apiFootballConfig'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type WcMatchRow = {
  id:              string
  league_id:       string
  home_team_id:    string
  home_team_name:  string
  home_team_short: string
  away_team_id:    string
  away_team_name:  string
  away_team_short: string
  kickoff:         string
  status:          string
  home_score:      number | null
  away_score:      number | null
  matchday:        number | null
  venue:           string | null
  actual_outcome:  string | null
  updated_at:      string
  home_team_crest: string | null
  away_team_crest: string | null
  league_logo:     string | null
  country_flag:    string | null
  api_source:      string
}

type UpsertStats = {
  inserted: number; updated: number; invalid: number; errors: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function err(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

function dateStr(d: Date): string { return d.toISOString().slice(0, 10) }
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setUTCDate(r.getUTCDate() + n); return r
}

function shortName(name: string): string {
  return name
    .replace(/^(FC|CF|AS|AC|RC|CD|SD|UD|RB|SS|SC)\s+/i, '')
    .slice(0, 3)
    .toUpperCase()
}

function parseMatchday(round: string | null | undefined): number | null {
  if (!round) return null
  const m = round.match(/(\d+)/)
  return m ? parseInt(m[1], 10) : null
}

async function upsertMatch(
  supabase: ReturnType<typeof getServerSupabaseClient>,
  row:      WcMatchRow,
  stats:    UpsertStats,
): Promise<void> {
  const { data: existing } = await supabase
    .from('matches')
    .select('id, actual_outcome')
    .eq('id', row.id)
    .maybeSingle()

  // Never overwrite a settled outcome
  const safeRow = existing?.actual_outcome
    ? { ...row, actual_outcome: existing.actual_outcome }
    : row

  const { error } = await supabase
    .from('matches')
    .upsert(safeRow, { onConflict: 'id' })

  if (error) {
    stats.errors.push(`${row.id}: ${error.message}`)
  } else if (existing) {
    stats.updated++
  } else {
    stats.inserted++
  }
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

  const today   = new Date()
  const from    = typeof body.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.from)
    ? body.from
    : dateStr(today)
  const to      = typeof body.to   === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.to)
    ? body.to
    : dateStr(addDays(today, 7))

  if (!process.env.API_FOOTBALL_KEY) {
    return err('API_FOOTBALL_KEY is not configured', 500)
  }

  // ── Fetch from API-Football ───────────────────────────────────────────────────
  const result = await fetchApfFixtures({
    league: APF_WORLD_CUP.id,
    season: APF_WORLD_CUP.season,   // always 2026 — never APF_CURRENT_SEASON
    from,
    to,
  })

  if (!result.ok) {
    return NextResponse.json({
      ok:           false,
      error:        result.error,
      leagueId:     APF_WORLD_CUP.code,
      season:       APF_WORLD_CUP.season,
      from,
      to,
      apiCallsUsed: 1,
      callsToday:   result.callsToday ?? 0,
      ...(result.budgetExceeded && { budgetExceeded: true }),
      ...(result.rateLimitHit   && { rateLimitHit:   true }),
    }, { status: result.budgetExceeded ? 429 : 502 })
  }

  const fixtures     = result.data
  const fixturesFound = fixtures.length
  const stats: UpsertStats = { inserted: 0, updated: 0, invalid: 0, errors: [] }

  if (!dryRun && fixturesFound > 0) {
    const supabase = getServerSupabaseClient()

    for (const fx of fixtures) {
      const status = normalizeApfStatus(fx.fixture.status.short)
      const h = fx.goals.home
      const a = fx.goals.away

      const row: WcMatchRow = {
        id:              `apf-${fx.fixture.id}`,
        league_id:       APF_WORLD_CUP.code,       // 'WC'
        home_team_id:    `apf-team-${fx.teams.home.id}`,
        home_team_name:  fx.teams.home.name,
        home_team_short: shortName(fx.teams.home.name),
        away_team_id:    `apf-team-${fx.teams.away.id}`,
        away_team_name:  fx.teams.away.name,
        away_team_short: shortName(fx.teams.away.name),
        kickoff:         fx.fixture.date,
        status,
        home_score:      h ?? null,
        away_score:      a ?? null,
        matchday:        parseMatchday(fx.league.round),
        venue:           fx.fixture.venue.name ?? null,
        actual_outcome:  inferOutcome(h, a, status),
        updated_at:      new Date().toISOString(),
        // Media URLs (stored in DB, never hotlinked from frontend)
        home_team_crest: fx.teams.home.logo    ?? null,
        away_team_crest: fx.teams.away.logo    ?? null,
        league_logo:     fx.league.logo        ?? null,
        country_flag:    fx.league.flag        ?? null,
        api_source:      'apf',
      }

      const check = validateFixture({
        id:           row.id,
        kickoff:      row.kickoff,
        homeTeamId:   row.home_team_id,
        homeTeamName: row.home_team_name,
        awayTeamId:   row.away_team_id,
        awayTeamName: row.away_team_name,
      })
      if (!check.valid) { stats.invalid++; stats.errors.push(check.reason); continue }

      await upsertMatch(supabase, row, stats)
    }
  }

  const ok = stats.errors.length === 0

  if (dryRun) {
    console.log(`[sync-wc-fixtures] dryRun: ${fixturesFound} fixtures found, skipping DB write`)
  } else {
    console.log(
      `[sync-wc-fixtures] inserted=${stats.inserted} updated=${stats.updated}` +
      ` invalid=${stats.invalid} fixturesFound=${fixturesFound}`
    )
  }

  return NextResponse.json({
    ok:            dryRun ? true : ok,
    dryRun,
    leagueId:      APF_WORLD_CUP.code,
    season:        APF_WORLD_CUP.season,
    from,
    to,
    apiCallsUsed:  1,
    fixturesFound,
    inserted:      dryRun ? 0 : stats.inserted,
    updated:       dryRun ? 0 : stats.updated,
    invalid:       stats.invalid,
    errors:        stats.errors.length > 0 ? stats.errors : undefined,
    callsToday:    result.callsToday,
    message:       dryRun
      ? `Dry run — ${fixturesFound} WC fixtures found for ${from}→${to}. Run with dryRun:false to write.`
      : `WC fixtures sync complete.`,
  })
}
