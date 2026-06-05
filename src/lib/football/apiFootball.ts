/**
 * API-Football (api-sports.io) — typed server-side provider wrapper.
 *
 * SERVER-ONLY — never import from client components or frontend code.
 * All calls go through apfFetch(), which:
 *   1. Checks today's call count against the daily hard cap
 *   2. Makes the HTTP request (proxy-aware)
 *   3. Logs the call to api_request_log in Supabase
 *
 * Base URL: https://v3.football.api-sports.io
 * Auth:     x-apisports-key: ${API_FOOTBALL_KEY}  (server env only)
 *
 * Budget constants (exported for health check):
 *   APF_DAILY_BUDGET        = 7,500  (Pro plan limit)
 *   APF_DAILY_WARNING       = 3,000  (surface warning in health dashboard)
 *   APF_DAILY_HARD_CAP      = 6,000  (block further calls above this)
 *
 * Media fields (to be stored in DB — never fetched per page view):
 *   teams.home.logo / teams.away.logo  → future: matches.home_team_crest
 *   league.logo                        → future: leagues.logo_url
 *   coach.photo                        → future: coaches.photo_url
 *   player.photo                       → future: players.photo_url
 *
 * Return type — every public function returns ApfResult<T>:
 *   { ok: true,  data: T, callsToday: number }
 *   { ok: false, error: string, status?: number,
 *     rateLimitHit?: boolean, budgetExceeded?: boolean, callsToday?: number }
 *
 * Never throws to callers. All errors are captured in the result.
 */

import { ProxyAgent, fetch as undiciF } from 'undici'
import { getServerSupabaseClient }      from '@/lib/supabase/server'

// ─────────────────────────────────────────────────────────────────────────────
// Budget constants
// ─────────────────────────────────────────────────────────────────────────────

/** Pro plan daily request limit. */
export const APF_DAILY_BUDGET    = 7_500
/** Alert threshold — surfaces 'warning' in health dashboard. */
export const APF_DAILY_WARNING   = 3_000
/** Hard cap — requests above this are rejected before hitting the API. */
export const APF_DAILY_HARD_CAP  = 6_000

const APF_PROVIDER  = 'apf' as const
const APF_BASE_URL  = 'https://v3.football.api-sports.io'

// ─────────────────────────────────────────────────────────────────────────────
// Result type
// ─────────────────────────────────────────────────────────────────────────────

export type ApfOk<T> = {
  ok:          true
  data:        T
  callsToday:  number
}

export type ApfErr = {
  ok:              false
  error:           string
  status?:         number
  rateLimitHit?:   boolean
  budgetExceeded?: boolean
  callsToday?:     number
}

export type ApfResult<T> = ApfOk<T> | ApfErr

// ─────────────────────────────────────────────────────────────────────────────
// API-Football response envelope
// ─────────────────────────────────────────────────────────────────────────────

type ApfEnvelope<T> = {
  results:  number
  response: T[]
  errors:   unknown[] | Record<string, string>
  paging?:  { current: number; total: number }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rich payload types (include media URL fields for future DB storage)
// ─────────────────────────────────────────────────────────────────────────────

/** Fixture payload returned by /fixtures */
export type ApfFixturePayload = {
  fixture: {
    id:      number
    date:    string                                 // ISO 8601
    venue:   { name: string | null; city: string | null }
    status:  { short: string; long: string; elapsed: number | null }
  }
  league: {
    id:      number
    name:    string
    country: string
    logo:    string                                 // ← media URL: league logo
    flag:    string | null                          // ← media URL: country flag (null for international)
    round:   string
    season:  number
  }
  teams: {
    home: { id: number; name: string; logo: string; winner: boolean | null }
    //                                ^^^^^^^^^^^^^ media URL: team crest
    away: { id: number; name: string; logo: string; winner: boolean | null }
  }
  goals: { home: number | null; away: number | null }
  score: {
    halftime:  { home: number | null; away: number | null }
    fulltime:  { home: number | null; away: number | null }
    extratime: { home: number | null; away: number | null }
    penalty:   { home: number | null; away: number | null }
  }
}

/** Single standing row from /standings */
export type ApfStandingEntry = {
  rank:      number
  team:      { id: number; name: string; logo: string }   // ← logo: media URL
  points:    number
  goalsDiff: number
  group:     string
  form:      string | null
  status:    string
  description: string | null
  all: {
    played: number; win: number; draw: number; lose: number
    goals:  { for: number; against: number }
  }
  home: {
    played: number; win: number; draw: number; lose: number
    goals:  { for: number; against: number }
  }
  away: {
    played: number; win: number; draw: number; lose: number
    goals:  { for: number; against: number }
  }
  update: string
}

/** Standings payload returned by /standings */
export type ApfStandingsPayload = {
  league: {
    id:         number
    name:       string
    country:    string
    logo:       string              // ← media URL: league logo
    season:     number
    standings:  ApfStandingEntry[][]
  }
}

/** A single match event (goal, card, sub) from /fixtures/events */
export type ApfEventPayload = {
  time:    { elapsed: number; extra: number | null }
  team:    { id: number; name: string; logo: string }     // ← logo: media URL
  player:  { id: number; name: string }
  assist:  { id: number | null; name: string | null }
  type:    string
  detail:  string
  comments: string | null
}

/** Lineup payload returned by /fixtures/lineups */
export type ApfLineupPayload = {
  team:      { id: number; name: string; logo: string; colors: unknown }
  coach:     { id: number; name: string; photo: string }  // ← photo: media URL
  formation: string
  startXI:   Array<{
    player: { id: number; name: string; number: number; pos: string; grid: string | null }
  }>
  substitutes: Array<{
    player: { id: number; name: string; number: number; pos: string; grid: string | null }
  }>
}

/** Team payload returned by /teams */
export type ApfTeamPayload = {
  team: {
    id:       number
    name:     string
    country:  string
    founded:  number | null
    national: boolean
    logo:     string              // ← media URL: team crest
  }
  venue: {
    id:       number | null
    name:     string | null
    address:  string | null
    city:     string | null
    capacity: number | null
    surface:  string | null
    image:    string | null       // ← media URL: stadium image (optional)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Proxy-aware fetch (same pattern as admin/sync-fixtures)
// ─────────────────────────────────────────────────────────────────────────────

function makeFetch() {
  const proxyUrl =
    process.env.HTTPS_PROXY ?? process.env.https_proxy ??
    process.env.HTTP_PROXY  ?? process.env.http_proxy

  if (!proxyUrl) return fetch

  const dispatcher = new ProxyAgent(proxyUrl)
  return (url: string, init?: RequestInit) =>
    undiciF(url, { ...init, dispatcher } as Parameters<typeof undiciF>[1]) as unknown as Promise<Response>
}

// ─────────────────────────────────────────────────────────────────────────────
// Budget tracking helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns today's UTC date string as 'YYYY-MM-DD'. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Reads today's total call count for 'apf' from api_request_log.
 * Returns 0 if the table is empty or has no rows for today.
 * Non-fatal — failures return 0 so we don't block real calls on log read errors.
 */
async function getTodayCallCount(): Promise<number> {
  try {
    const supabase = getServerSupabaseClient()
    const { data, error } = await supabase
      .from('api_request_log')
      .select('calls_this_day')
      .eq('date', todayUtc())
      .eq('provider', APF_PROVIDER)

    if (error || !data) return 0
    return data.reduce((sum, row) => sum + (row.calls_this_day ?? 0), 0)
  } catch {
    return 0
  }
}

/**
 * Increments (or inserts) the api_request_log row for today's endpoint call.
 * Non-fatal — log failures are swallowed so they never block real calls.
 */
async function logCall(endpoint: string): Promise<void> {
  try {
    const supabase = getServerSupabaseClient()
    const today    = todayUtc()
    const now      = new Date().toISOString()

    // Attempt to insert a fresh row for today
    const { error: insertErr } = await supabase
      .from('api_request_log')
      .insert({
        date:            today,
        provider:        APF_PROVIDER,
        endpoint,
        calls_this_day:  1,
        last_called_at:  now,
      })

    if (!insertErr) return   // fresh row inserted — done

    // Row already exists (unique constraint) — increment
    const { data: existing } = await supabase
      .from('api_request_log')
      .select('id, calls_this_day')
      .eq('date', today)
      .eq('provider', APF_PROVIDER)
      .eq('endpoint', endpoint)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('api_request_log')
        .update({
          calls_this_day: existing.calls_this_day + 1,
          last_called_at: now,
        })
        .eq('id', existing.id)
    }
  } catch {
    // Non-fatal — log errors must never block actual API calls
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core fetch wrapper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Internal: executes one authenticated APF request.
 * - Checks budget before calling; returns budgetExceeded if at hard cap.
 * - Logs every successful call to api_request_log.
 * - Never throws; all errors are captured in ApfErr.
 * - API key is never printed or included in error messages.
 */
async function apfFetch<T>(
  endpoint: string,
  params:   Record<string, string | number | undefined>,
): Promise<ApfResult<T>> {
  // ── 1. Env guard ────────────────────────────────────────────────────────────
  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    return { ok: false, error: 'API_FOOTBALL_KEY is not configured' }
  }

  // ── 2. Budget check ──────────────────────────────────────────────────────────
  const callsToday = await getTodayCallCount()
  if (callsToday >= APF_DAILY_HARD_CAP) {
    console.warn(`[apiFootball] Budget hard cap reached: ${callsToday}/${APF_DAILY_HARD_CAP} calls today`)
    return {
      ok:              false,
      error:           `Daily API budget hard cap reached (${callsToday}/${APF_DAILY_HARD_CAP}). No further calls will be made today.`,
      budgetExceeded:  true,
      callsToday,
    }
  }

  if (callsToday >= APF_DAILY_WARNING) {
    console.warn(`[apiFootball] Budget warning: ${callsToday}/${APF_DAILY_BUDGET} calls used today`)
  }

  // ── 3. Build URL ─────────────────────────────────────────────────────────────
  const url = new URL(`${APF_BASE_URL}/${endpoint.replace(/^\//, '')}`)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v))
  }

  // ── 4. HTTP call ─────────────────────────────────────────────────────────────
  const f = makeFetch()
  let res: Response

  try {
    res = await f(url.toString(), {
      headers: { 'x-apisports-key': apiKey },
    })
  } catch (e) {
    return {
      ok:         false,
      error:      `Network error: ${e instanceof Error ? e.message : String(e)}`,
      callsToday,
    }
  }

  // ── 5. Rate-limit detection ──────────────────────────────────────────────────
  if (res.status === 429) {
    await logCall(endpoint)
    return {
      ok:           false,
      error:        'API-Football rate limit exceeded (HTTP 429)',
      status:       429,
      rateLimitHit: true,
      callsToday:   callsToday + 1,
    }
  }

  if (!res.ok) {
    return {
      ok:         false,
      error:      `API-Football HTTP ${res.status}`,
      status:     res.status,
      callsToday,
    }
  }

  // ── 6. Parse response ────────────────────────────────────────────────────────
  let envelope: ApfEnvelope<T>
  try {
    envelope = await res.json() as ApfEnvelope<T>
  } catch {
    return { ok: false, error: 'Failed to parse API-Football response as JSON', callsToday }
  }

  // ── 7. API-level errors ──────────────────────────────────────────────────────
  const hasErrors = Array.isArray(envelope.errors)
    ? envelope.errors.length > 0
    : typeof envelope.errors === 'object' && Object.keys(envelope.errors).length > 0

  if (hasErrors) {
    const errDetail = JSON.stringify(envelope.errors).slice(0, 200)
    return { ok: false, error: `API-Football error: ${errDetail}`, callsToday }
  }

  // ── 8. Log successful call ───────────────────────────────────────────────────
  await logCall(endpoint)

  return {
    ok:          true,
    data:        envelope.response as unknown as T,
    callsToday:  callsToday + 1,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public wrapper functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch fixtures by date range, league, season, or single fixture ID.
 *
 * Response includes team logos (media URLs) — store in DB, don't re-fetch per request.
 *
 * @example
 *   // All fixtures for PL next 7 days
 *   fetchApfFixtures({ league: 39, season: 2025, from: '2026-06-05', to: '2026-06-12' })
 *   // Single fixture by ID
 *   fetchApfFixtures({ id: 123456 })
 *   // Live fixtures
 *   fetchApfFixtures({ live: 'all' })
 */
export function fetchApfFixtures(params: {
  league?:  number
  season?:  number
  from?:    string     // YYYY-MM-DD
  to?:      string     // YYYY-MM-DD
  id?:      number
  live?:    'all'
}): Promise<ApfResult<ApfFixturePayload[]>> {
  return apfFetch<ApfFixturePayload[]>('fixtures', params as Record<string, string | number | undefined>)
}

/**
 * Fetch league standings.
 *
 * Response includes team logos (media URLs) — store in DB.
 *
 * @example
 *   fetchApfStandings({ league: 39, season: 2025 })
 */
export function fetchApfStandings(params: {
  league: number
  season: number
}): Promise<ApfResult<ApfStandingsPayload[]>> {
  return apfFetch<ApfStandingsPayload[]>('standings', params)
}

/**
 * Fetch all events (goals, cards, substitutions) for a single fixture.
 *
 * Response includes team logos (media URLs) — store in DB.
 *
 * @example
 *   fetchApfFixtureEvents(123456)
 */
export function fetchApfFixtureEvents(
  fixtureId: number,
): Promise<ApfResult<ApfEventPayload[]>> {
  return apfFetch<ApfEventPayload[]>('fixtures/events', { fixture: fixtureId })
}

/**
 * Fetch lineups (starting XI + bench + formation + coach) for a single fixture.
 *
 * Response includes coach photos (media URLs) — store in DB.
 *
 * @example
 *   fetchApfFixtureLineups(123456)
 */
export function fetchApfFixtureLineups(
  fixtureId: number,
): Promise<ApfResult<ApfLineupPayload[]>> {
  return apfFetch<ApfLineupPayload[]>('fixtures/lineups', { fixture: fixtureId })
}

/**
 * Fetch team information and venue for all teams in a league.
 *
 * Response includes team logos and venue images (media URLs) — store in DB.
 *
 * @example
 *   fetchApfTeams({ league: 39, season: 2025 })
 */
export function fetchApfTeams(params: {
  league: number
  season: number
}): Promise<ApfResult<ApfTeamPayload[]>> {
  return apfFetch<ApfTeamPayload[]>('teams', params)
}

// ─────────────────────────────────────────────────────────────────────────────
// League discovery payload
// ─────────────────────────────────────────────────────────────────────────────

/** League entry returned by /leagues */
export type ApfLeaguePayload = {
  league: {
    id:   number
    name: string
    type: string   // 'League' | 'Cup'
    logo: string   // ← media URL: league logo
  }
  country: {
    name: string
    code: string | null
    flag: string | null   // ← media URL: country flag
  }
  seasons: Array<{
    year:    number
    start:   string
    end:     string
    current: boolean
    coverage: {
      fixtures:  { events: boolean; lineups: boolean; statistics_fixtures: boolean; statistics_players: boolean }
      standings: boolean
      players:   boolean
      top_scorers: boolean
      injuries:  boolean
      predictions: boolean
      odds:      boolean
    }
  }>
}

// ─────────────────────────────────────────────────────────────────────────────
// League discovery wrapper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch available leagues from API-Football.
 *
 * Intended for admin-level league ID verification, not for cron automation.
 * Uses ~1 of the 7,500 daily budget — call sparingly, only from admin endpoints.
 *
 * Response includes league logos and country flags (media URLs) — store in DB.
 *
 * @example
 *   // Discover all currently active leagues
 *   fetchApfLeagues({ current: true, type: 'League', season: 2025 })
 *   // Search by name
 *   fetchApfLeagues({ search: 'Premier' })
 */
export function fetchApfLeagues(params?: {
  current?: boolean
  type?:    'League' | 'Cup'
  season?:  number
  search?:  string
}): Promise<ApfResult<ApfLeaguePayload[]>> {
  const p: Record<string, string | number | undefined> = {}
  if (params?.current !== undefined) p.current = params.current ? 'true' : 'false'
  if (params?.type    !== undefined) p.type    = params.type
  if (params?.season  !== undefined) p.season  = params.season
  if (params?.search  !== undefined) p.search  = params.search
  return apfFetch<ApfLeaguePayload[]>('leagues', p)
}
