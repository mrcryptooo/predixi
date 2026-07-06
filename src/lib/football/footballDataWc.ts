/**
 * football-data.org — World Cup 2026 fetcher.
 *
 * WHY THIS EXISTS: API-Football's free plan does not have access to the WC
 * 2026 season at all (verified against the live API — every /fixtures call
 * for league=1&season=2026 returns
 * `{"plan":"Free plans do not have access to this season, try from 2022 to 2024."}`,
 * regardless of date range). football-data.org's free tier DOES expose the
 * full WC 2026 schedule (group stage + entire knockout bracket, updated
 * live), so it is the actual working data source for the automatic sync —
 * API-Football is kept wired in (see wcFixtureUpsert.ts / apiFootball.ts)
 * as a no-cost, no-op fallback that will start contributing automatically
 * the moment the plan is upgraded, with zero code changes required.
 *
 * One call to /v4/competitions/WC/matches returns the ENTIRE tournament
 * (group stage + every knockout round) in a single response — no date
 * windowing needed, unlike API-Football. Free tier limit is 10 req/min
 * (no separate daily cap) — safe to call every 3 minutes indefinitely.
 */

import { ProxyAgent, fetch as undiciF } from 'undici'

// ─────────────────────────────────────────────────────────────────────────────
// Stage → internal round-label mapping
//
// Mapped to the SAME string vocabulary `parseKnockoutRound()` (lib/football/
// knockoutUtils.ts) already recognizes for API-Football's `round` strings —
// zero changes needed to bracket-building logic.
// ─────────────────────────────────────────────────────────────────────────────

const FD_STAGE_TO_ROUND: Record<string, string> = {
  GROUP_STAGE:     'Group Stage',
  LAST_32:         'Round of 32',
  LAST_16:         'Round of 16',
  QUARTER_FINALS:  'Quarter-finals',
  SEMI_FINALS:     'Semi-finals',
  THIRD_PLACE:     '3rd Place Final',
  FINAL:           'Final',
}

/** Maps a football-data.org `stage` value to the internal round label. Returns null for unknown stages. */
export function mapFdStageToRound(stage: string): string | null {
  return FD_STAGE_TO_ROUND[stage] ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// Outcome mapping — football-data.org gives the winner directly
// ─────────────────────────────────────────────────────────────────────────────

/** Maps football-data.org's `score.winner` directly to H/D/A. Returns null while undecided. */
export function mapFdWinner(winner: string | null): 'H' | 'D' | 'A' | null {
  if (winner === 'HOME_TEAM') return 'H'
  if (winner === 'AWAY_TEAM') return 'A'
  if (winner === 'DRAW')      return 'D'
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Types — subset of the football-data.org v4 match payload we use
// ─────────────────────────────────────────────────────────────────────────────

export type FdWcTeam = {
  id:        number
  name:      string | null   // null when this round's participant isn't decided yet
  shortName: string | null
  tla:       string | null
  crest:     string | null
}

export type FdWcMatch = {
  id:       number
  utcDate:  string
  status:   string            // 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'POSTPONED' | 'SUSPENDED' | 'CANCELLED'
  stage:    string             // 'GROUP_STAGE' | 'LAST_32' | 'LAST_16' | 'QUARTER_FINALS' | 'SEMI_FINALS' | 'THIRD_PLACE' | 'FINAL'
  matchday: number | null
  homeTeam: FdWcTeam
  awayTeam: FdWcTeam
  score: {
    winner: string | null      // 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null
    fullTime: { home: number | null; away: number | null }
  }
  venue?: string | null
}

export type FdWcResult =
  | { ok: true;  matches: FdWcMatch[] }
  | { ok: false; error: string; rateLimitHit?: boolean }

// ─────────────────────────────────────────────────────────────────────────────
// Proxy-aware fetch (same pattern as the rest of the football-data integration)
// ─────────────────────────────────────────────────────────────────────────────

function proxyFetch() {
  const p = process.env.HTTPS_PROXY ?? process.env.https_proxy ?? process.env.HTTP_PROXY ?? process.env.http_proxy
  if (!p) return fetch
  const dispatcher = new ProxyAgent(p)
  return (url: string, init?: RequestInit) =>
    undiciF(url, { ...init, dispatcher } as Parameters<typeof undiciF>[1]) as unknown as Promise<Response>
}

// ─────────────────────────────────────────────────────────────────────────────
// fetchFdWcMatches — the entire WC 2026 schedule in one call
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchFdWcMatches(): Promise<FdWcResult> {
  const token = process.env.FOOTBALL_DATA_TOKEN
  if (!token) return { ok: false, error: 'FOOTBALL_DATA_TOKEN is not configured' }

  const url = 'https://api.football-data.org/v4/competitions/WC/matches'

  try {
    const f   = proxyFetch()
    const res = await f(url, { headers: { 'X-Auth-Token': token } })

    if (res.status === 429) {
      return { ok: false, error: 'football-data.org rate limit exceeded (HTTP 429)', rateLimitHit: true }
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, error: `football-data.org HTTP ${res.status}: ${text.slice(0, 200)}` }
    }

    const data = await res.json() as { matches?: FdWcMatch[] }
    return { ok: true, matches: data.matches ?? [] }
  } catch (e) {
    return { ok: false, error: `Network error: ${e instanceof Error ? e.message : String(e)}` }
  }
}
