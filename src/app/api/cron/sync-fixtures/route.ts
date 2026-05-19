/**
 * GET /api/cron/sync-fixtures
 *
 * Vercel Cron endpoint — triggered once daily at 00:30 UTC via vercel.json.
 * Delegates to the admin sync-fixtures route logic to fetch upcoming fixtures
 * for today + 7 days and upsert them into the matches table.
 *
 * Auth:      Authorization: Bearer <CRON_SECRET>
 *            Vercel sets this header automatically.
 * Idempotent: upsert by match id — safe to re-run.
 * Safety:    Never overwrites settled actual_outcome.
 *            Never deletes existing matches.
 *            Never settles anything.
 *
 * Health log: Every invocation (including unauthorized) writes one row to
 * cron_runs in Supabase. Insert failures are swallowed — they never fail
 * the cron response.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { ProxyAgent, fetch as undiciF }   from 'undici'
import { getServerSupabaseClient }        from '@/lib/supabase/server'

// ── Constants ─────────────────────────────────────────────────────────────────

const FD_COMPETITIONS = ['PL', 'PD', 'BL1', 'SA', 'FL1', 'CL'] as const
const APF_LEAGUES: Array<{ id: number; code: string; season: number }> = [
  { id:  39, code: 'PL',  season: 2025 },
  { id: 140, code: 'PD',  season: 2025 },
  { id:  78, code: 'BL1', season: 2025 },
  { id: 135, code: 'SA',  season: 2025 },
  { id:  61, code: 'FL1', season: 2025 },
  { id:   2, code: 'CL',  season: 2025 },
]
const SYNC_DAYS = 7

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

function dateStr(d: Date): string { return d.toISOString().slice(0, 10) }

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setUTCDate(r.getUTCDate() + n); return r
}

function shortName(name: string, hint?: string | null): string {
  if (hint) return hint.slice(0, 3).toUpperCase()
  return name.replace(/^(FC|CF|AS|AC|RC|CD|SD|UD|RB|SS|SC)\s+/i, '').slice(0, 3).toUpperCase()
}

function parseMatchday(round: string | null | undefined): number | null {
  if (!round) return null
  const m = round.match(/(\d+)/); return m ? parseInt(m[1], 10) : null
}

function fdMapStatus(s: string): string {
  if (s === 'FINISHED')                                    return 'finished'
  if (['IN_PLAY', 'PAUSED', 'HALFTIME'].includes(s))       return 'live'
  if (['POSTPONED', 'SUSPENDED', 'CANCELLED'].includes(s)) return 'postponed'
  return 'upcoming'
}

function apfMapStatus(s: string): string {
  if (['FT', 'AET', 'PEN'].includes(s))                        return 'finished'
  if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(s)) return 'live'
  if (['PST', 'CANC', 'ABD', 'WO', 'AWD', 'INT'].includes(s))  return 'postponed'
  return 'upcoming'
}

function inferOutcome(h: number | null, a: number | null, status: string): string | null {
  if (status !== 'finished' || h === null || a === null) return null
  return h > a ? 'H' : a > h ? 'A' : 'D'
}

// ── Upsert ────────────────────────────────────────────────────────────────────

type MatchRow = {
  id: string; league_id: string
  home_team_id: string; home_team_name: string; home_team_short: string
  away_team_id: string; away_team_name: string; away_team_short: string
  kickoff: string; status: string
  home_score: number | null; away_score: number | null
  matchday: number | null; venue: string | null
  actual_outcome: string | null; updated_at: string
}

type Stats = { inserted: number; updated: number; skipped: number; errors: string[] }

async function upsertMatch(
  supabase: ReturnType<typeof getServerSupabaseClient>,
  row: MatchRow, stats: Stats,
): Promise<void> {
  const { data: existing } = await supabase
    .from('matches').select('id, actual_outcome').eq('id', row.id).maybeSingle()
  const safeRow = existing?.actual_outcome
    ? { ...row, actual_outcome: existing.actual_outcome } : row
  const { error } = await supabase.from('matches').upsert(safeRow, { onConflict: 'id' })
  if (error) stats.errors.push(`${row.id}: ${error.message}`)
  else if (existing) stats.updated++
  else stats.inserted++
}

// ── football-data.org ─────────────────────────────────────────────────────────

type FdMatch = {
  id: number; utcDate: string; status: string; matchday: number | null
  homeTeam: { id: number; name: string; shortName?: string }
  awayTeam: { id: number; name: string; shortName?: string }
  score: { fullTime: { home: number | null; away: number | null } }
  venue?: string | null
}

async function syncFD(
  supabase: ReturnType<typeof getServerSupabaseClient>,
  token: string, dateFrom: string, dateTo: string, stats: Stats,
): Promise<number> {
  const f = proxyFetch(); let calls = 0
  for (const comp of FD_COMPETITIONS) {
    const url = `https://api.football-data.org/v4/competitions/${comp}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`
    try {
      calls++
      const res  = await f(url, { headers: { 'X-Auth-Token': token } })
      if (res.status === 429) { stats.errors.push(`fd [${comp}]: rate limited`); continue }
      if (!res.ok)            { stats.errors.push(`fd [${comp}]: HTTP ${res.status}`); continue }
      const data = await res.json() as { matches?: FdMatch[]; error?: string }
      if (data.error)         { stats.errors.push(`fd [${comp}]: ${data.error}`); continue }
      for (const m of data.matches ?? []) {
        const status = fdMapStatus(m.status)
        const h = m.score.fullTime.home, a = m.score.fullTime.away
        await upsertMatch(supabase, {
          id:              `fd-${m.id}`,
          league_id:       comp,
          home_team_id:    `fd-team-${m.homeTeam.id}`,
          home_team_name:  m.homeTeam.name,
          home_team_short: shortName(m.homeTeam.name, m.homeTeam.shortName),
          away_team_id:    `fd-team-${m.awayTeam.id}`,
          away_team_name:  m.awayTeam.name,
          away_team_short: shortName(m.awayTeam.name, m.awayTeam.shortName),
          kickoff: m.utcDate, status,
          home_score: h ?? null, away_score: a ?? null,
          matchday: m.matchday ?? null, venue: m.venue ?? null,
          actual_outcome: inferOutcome(h, a, status),
          updated_at: new Date().toISOString(),
        }, stats)
      }
    } catch (e) {
      stats.errors.push(`fd [${comp}]: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return calls
}

// ── api-football ──────────────────────────────────────────────────────────────

type ApfFixture = {
  fixture: { id: number; date: string; venue: { name: string | null }; status: { short: string } }
  league:  { id: number; round: string }
  teams:   { home: { id: number; name: string }; away: { id: number; name: string } }
  goals:   { home: number | null; away: number | null }
}

async function syncAPF(
  supabase: ReturnType<typeof getServerSupabaseClient>,
  apiKey: string, dateFrom: string, dateTo: string, stats: Stats,
): Promise<number> {
  const f = proxyFetch(); let calls = 0
  for (const league of APF_LEAGUES) {
    const url = `https://v3.football.api-sports.io/fixtures?league=${league.id}&season=${league.season}&from=${dateFrom}&to=${dateTo}`
    try {
      calls++
      const res  = await f(url, { headers: { 'x-apisports-key': apiKey } })
      if (res.status === 429) { stats.errors.push(`apf [${league.code}]: rate limited`); continue }
      if (!res.ok)            { stats.errors.push(`apf [${league.code}]: HTTP ${res.status}`); continue }
      const data = await res.json() as { response?: ApfFixture[]; errors?: unknown }
      const hasErr = Array.isArray(data.errors) ? data.errors.length > 0 : !!data.errors
      if (hasErr)             { stats.errors.push(`apf [${league.code}]: API error`); continue }
      for (const fx of data.response ?? []) {
        const status = apfMapStatus(fx.fixture.status.short)
        const h = fx.goals.home, a = fx.goals.away
        await upsertMatch(supabase, {
          id:              `apf-${fx.fixture.id}`,
          league_id:       league.code,
          home_team_id:    `apf-team-${fx.teams.home.id}`,
          home_team_name:  fx.teams.home.name,
          home_team_short: shortName(fx.teams.home.name),
          away_team_id:    `apf-team-${fx.teams.away.id}`,
          away_team_name:  fx.teams.away.name,
          away_team_short: shortName(fx.teams.away.name),
          kickoff: fx.fixture.date, status,
          home_score: h ?? null, away_score: a ?? null,
          matchday: parseMatchday(fx.league.round), venue: fx.fixture.venue.name ?? null,
          actual_outcome: inferOutcome(h, a, status),
          updated_at: new Date().toISOString(),
        }, stats)
      }
    } catch (e) {
      stats.errors.push(`apf [${league.code}]: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return calls
}

// ── Health log helper ─────────────────────────────────────────────────────────

const CRON_ROUTE = '/api/cron/sync-fixtures'

async function logCronRun(
  supabase:  ReturnType<typeof getServerSupabaseClient>,
  status:    'success' | 'error' | 'unauthorized' | 'skipped',
  summary:   Record<string, unknown>,
  error?:    string,
): Promise<void> {
  try {
    const { error: dbErr } = await supabase.from('cron_runs').insert({
      route:   CRON_ROUTE,
      status,
      summary,
      error:   error ?? null,
    })
    if (dbErr) {
      console.warn('[cron/sync-fixtures] cron_runs insert failed:', dbErr.message)
    }
  } catch (e) {
    console.warn('[cron/sync-fixtures] cron_runs insert threw:', e instanceof Error ? e.message : String(e))
  }
}

// ── GET handler ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = getServerSupabaseClient()

  // ── Auth ────────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return err('CRON_SECRET not configured', 500)
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${cronSecret}`) {
    // Log unauthorized attempt — no secret value recorded
    await logCronRun(supabase, 'unauthorized', { reason: 'invalid or missing Authorization header' })
    return err('Unauthorized', 401)
  }

  // ── Date window ─────────────────────────────────────────────────────────────
  const today    = new Date()
  const dateFrom = dateStr(today)
  const dateTo   = dateStr(addDays(today, SYNC_DAYS))

  const stats: Stats = { inserted: 0, updated: 0, skipped: 0, errors: [] }
  let apiCallsUsed = 0
  const sources: string[] = []

  const fdToken = process.env.FOOTBALL_DATA_TOKEN
  if (fdToken) {
    const calls = await syncFD(supabase, fdToken, dateFrom, dateTo, stats)
    apiCallsUsed += calls
    sources.push(`football-data.org (${calls} calls)`)
  }

  const apfKey = process.env.API_FOOTBALL_KEY
  if (apfKey) {
    const calls = await syncAPF(supabase, apfKey, dateFrom, dateTo, stats)
    apiCallsUsed += calls
    sources.push(`api-football (${calls} calls)`)
  }

  if (!fdToken && !apfKey) {
    console.warn('[cron/sync-fixtures] No API key configured — skipping')
    await logCronRun(supabase, 'skipped', {
      reason: 'no football API key configured',
      dateFrom, dateTo,
    })
    return NextResponse.json({
      success: true, dateFrom, dateTo, sources: [], apiCallsUsed: 0,
      inserted: 0, updated: 0, skipped: 0,
      message: 'No football API key configured — cron skipped',
    })
  }

  const hasErrors = stats.errors.length > 0
  console.log(`[cron/sync-fixtures] ${dateFrom}→${dateTo} | inserted:${stats.inserted} updated:${stats.updated} errors:${stats.errors.length}`)

  // ── Health log ───────────────────────────────────────────────────────────────
  await logCronRun(
    supabase,
    hasErrors ? 'error' : 'success',
    {
      dateFrom,
      dateTo,
      syncDays:     SYNC_DAYS,
      sources,
      apiCallsUsed,
      inserted:     stats.inserted,
      updated:      stats.updated,
      skipped:      stats.skipped,
      errorCount:   stats.errors.length,
    },
    hasErrors ? stats.errors.slice(0, 5).join(' | ') : undefined,
  )

  return NextResponse.json({
    success:      !hasErrors,
    dateFrom,
    dateTo,
    syncDays:     SYNC_DAYS,
    sources,
    apiCallsUsed,
    inserted:     stats.inserted,
    updated:      stats.updated,
    skipped:      stats.skipped,
    errors:       hasErrors ? stats.errors : undefined,
  })
}
