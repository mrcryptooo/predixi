/**
 * POST /api/admin/sync-fixtures
 *
 * Fetches upcoming fixtures for today + next 7 days and upserts them into
 * the matches table. Designed for daily use within free-tier API quotas.
 *
 * Auth:     x-admin-key header vs ADMIN_SETTLEMENT_KEY env var
 * APIs:     football-data.org  → FOOTBALL_DATA_TOKEN  (tried first)
 *           api-football       → API_FOOTBALL_KEY      (fallback / supplement)
 * Strategy: One date-range request per competition (football-data) or per
 *           league (api-football). Competitions used in this app only.
 *           Settled actual_outcome is never overwritten.
 *           Existing matches are never deleted.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { ProxyAgent, fetch as undiciF }   from 'undici'
import { getServerSupabaseClient }        from '@/lib/supabase/server'
import {
  normalizeFdStatus,
  normalizeApfStatus,
  inferOutcome,
  validateFixture,
}                                         from '@/lib/football/status'

// ── Constants ─────────────────────────────────────────────────────────────────

/** football-data.org competition codes used in this app */
const FD_COMPETITIONS = ['PL', 'PD', 'BL1', 'SA', 'FL1', 'CL'] as const

/** api-football league IDs → competition codes for these app leagues */
const APF_LEAGUES: Array<{ id: number; code: string; season: number }> = [
  { id:  39, code: 'PL',  season: 2025 },
  { id: 140, code: 'PD',  season: 2025 },
  { id:  78, code: 'BL1', season: 2025 },
  { id: 135, code: 'SA',  season: 2025 },
  { id:  61, code: 'FL1', season: 2025 },
  { id:   2, code: 'CL',  season: 2025 },
]

const SYNC_DAYS = 7   // today + 7 days ahead

// ── Helpers ───────────────────────────────────────────────────────────────────

function proxyFetch() {
  const p =
    process.env.HTTPS_PROXY ?? process.env.https_proxy ??
    process.env.HTTP_PROXY  ?? process.env.http_proxy
  if (!p) return fetch
  const d = new ProxyAgent(p)
  return (url: string, init?: RequestInit) =>
    undiciF(url, { ...init, dispatcher: d } as Parameters<typeof undiciF>[1]) as unknown as Promise<Response>
}

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setUTCDate(r.getUTCDate() + n)
  return r
}

function shortName(name: string, hint?: string | null): string {
  if (hint) return hint.slice(0, 3).toUpperCase()
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

// ── Supabase upsert ───────────────────────────────────────────────────────────

type MatchRow = {
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
}

type UpsertStats = { inserted: number; updated: number; skipped: number; invalid: number; errors: string[] }

async function upsertMatch(
  supabase: ReturnType<typeof getServerSupabaseClient>,
  row:      MatchRow,
  stats:    UpsertStats,
): Promise<void> {
  // Fetch existing to check for settled actual_outcome
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

// ── football-data.org sync ────────────────────────────────────────────────────

type FdTeam   = { id: number; name: string; shortName?: string }
type FdMatch  = {
  id:        number
  utcDate:   string
  status:    string
  matchday:  number | null
  homeTeam:  FdTeam
  awayTeam:  FdTeam
  score:     { fullTime: { home: number | null; away: number | null } }
  venue?:    string | null
}

async function syncFootballData(
  supabase:   ReturnType<typeof getServerSupabaseClient>,
  token:      string,
  dateFrom:   string,
  dateTo:     string,
  stats:      UpsertStats,
): Promise<number> {
  const f = proxyFetch()
  let apiCalls = 0

  for (const comp of FD_COMPETITIONS) {
    const url = `https://api.football-data.org/v4/competitions/${comp}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`
    let matches: FdMatch[] = []

    try {
      apiCalls++
      const res  = await f(url, { headers: { 'X-Auth-Token': token } })
      if (res.status === 429) {
        stats.errors.push(`football-data [${comp}]: rate limited`)
        continue
      }
      if (!res.ok) {
        stats.errors.push(`football-data [${comp}]: HTTP ${res.status}`)
        continue
      }
      const data = await res.json() as { matches?: FdMatch[]; error?: string }
      if (data.error) { stats.errors.push(`football-data [${comp}]: ${data.error}`); continue }
      matches = data.matches ?? []
    } catch (e) {
      stats.errors.push(`football-data [${comp}]: ${e instanceof Error ? e.message : String(e)}`)
      continue
    }

    for (const m of matches) {
      const status = normalizeFdStatus(m.status)
      const h = m.score.fullTime.home
      const a = m.score.fullTime.away
      const row: MatchRow = {
        id:              `fd-${m.id}`,
        league_id:       comp,
        home_team_id:    `fd-team-${m.homeTeam.id}`,
        home_team_name:  m.homeTeam.name,
        home_team_short: shortName(m.homeTeam.name, m.homeTeam.shortName),
        away_team_id:    `fd-team-${m.awayTeam.id}`,
        away_team_name:  m.awayTeam.name,
        away_team_short: shortName(m.awayTeam.name, m.awayTeam.shortName),
        kickoff:         m.utcDate,
        status,
        home_score:      h ?? null,
        away_score:      a ?? null,
        matchday:        m.matchday ?? null,
        venue:           m.venue ?? null,
        actual_outcome:  inferOutcome(h, a, status),
        updated_at:      new Date().toISOString(),
      }
      const check = validateFixture({
        id: row.id, kickoff: row.kickoff,
        homeTeamId: row.home_team_id, homeTeamName: row.home_team_name,
        awayTeamId: row.away_team_id, awayTeamName: row.away_team_name,
      })
      if (!check.valid) { stats.invalid++; stats.errors.push(check.reason); continue }
      await upsertMatch(supabase, row, stats)
    }
  }

  return apiCalls
}

// ── api-football sync ─────────────────────────────────────────────────────────

type ApfFixture = {
  fixture: { id: number; date: string; venue: { name: string | null }; status: { short: string } }
  league:  { id: number; round: string }
  teams:   { home: { id: number; name: string }; away: { id: number; name: string } }
  goals:   { home: number | null; away: number | null }
}

async function syncApiFootball(
  supabase:   ReturnType<typeof getServerSupabaseClient>,
  apiKey:     string,
  dateFrom:   string,
  dateTo:     string,
  stats:      UpsertStats,
): Promise<number> {
  const f = proxyFetch()
  let apiCalls = 0

  for (const league of APF_LEAGUES) {
    const url = `https://v3.football.api-sports.io/fixtures?league=${league.id}&season=${league.season}&from=${dateFrom}&to=${dateTo}`
    let fixtures: ApfFixture[] = []

    try {
      apiCalls++
      const res  = await f(url, { headers: { 'x-apisports-key': apiKey } })
      if (res.status === 429) {
        stats.errors.push(`api-football [${league.code}]: rate limited`)
        continue
      }
      if (!res.ok) {
        stats.errors.push(`api-football [${league.code}]: HTTP ${res.status}`)
        continue
      }
      const data = await res.json() as { response?: ApfFixture[]; errors?: unknown }
      const hasErr = Array.isArray(data.errors) ? data.errors.length > 0 : !!data.errors
      if (hasErr) { stats.errors.push(`api-football [${league.code}]: API error`); continue }
      fixtures = data.response ?? []
    } catch (e) {
      stats.errors.push(`api-football [${league.code}]: ${e instanceof Error ? e.message : String(e)}`)
      continue
    }

    for (const fx of fixtures) {
      const status = normalizeApfStatus(fx.fixture.status.short)
      const h = fx.goals.home
      const a = fx.goals.away
      const row: MatchRow = {
        id:              `apf-${fx.fixture.id}`,
        league_id:       league.code,
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
      }
      const check = validateFixture({
        id: row.id, kickoff: row.kickoff,
        homeTeamId: row.home_team_id, homeTeamName: row.home_team_name,
        awayTeamId: row.away_team_id, awayTeamName: row.away_team_name,
      })
      if (!check.valid) { stats.invalid++; stats.errors.push(check.reason); continue }
      await upsertMatch(supabase, row, stats)
    }
  }

  return apiCalls
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const adminKey = process.env.ADMIN_SETTLEMENT_KEY
  if (!adminKey)                                    return err('Admin key not configured', 500)
  if (req.headers.get('x-admin-key') !== adminKey) return err('Unauthorized', 401)

  // ── Date window ─────────────────────────────────────────────────────────────
  const today    = new Date()
  const dateFrom = dateStr(today)
  const dateTo   = dateStr(addDays(today, SYNC_DAYS))

  const supabase = getServerSupabaseClient()
  const stats: UpsertStats = { inserted: 0, updated: 0, skipped: 0, invalid: 0, errors: [] }
  let apiCallsUsed = 0
  const sources: string[] = []

  // ── football-data.org ────────────────────────────────────────────────────────
  const fdToken = process.env.FOOTBALL_DATA_TOKEN
  if (fdToken) {
    const calls = await syncFootballData(supabase, fdToken, dateFrom, dateTo, stats)
    apiCallsUsed += calls
    sources.push(`football-data.org (${calls} calls)`)
  }

  // ── api-football ─────────────────────────────────────────────────────────────
  const apfKey = process.env.API_FOOTBALL_KEY
  if (apfKey) {
    const calls = await syncApiFootball(supabase, apfKey, dateFrom, dateTo, stats)
    apiCallsUsed += calls
    sources.push(`api-football (${calls} calls)`)
  }

  if (!fdToken && !apfKey) {
    return err('No football API key configured (FOOTBALL_DATA_TOKEN or API_FOOTBALL_KEY)', 500)
  }

  return NextResponse.json({
    success:      stats.errors.length === 0,
    dateFrom,
    dateTo,
    syncDays:     SYNC_DAYS,
    sources,
    apiCallsUsed,
    inserted:     stats.inserted,
    updated:      stats.updated,
    skipped:      stats.skipped,
    invalid:      stats.invalid,
    errors:       stats.errors.length ? stats.errors : undefined,
  })
}
