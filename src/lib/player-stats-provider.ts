/**
 * Player Stats Provider — abstraction layer for Daily XI scoring input.
 *
 * Lets the scoring pipeline fetch player stats from any source without changing
 * the scoring logic or any admin/cron routes.
 *
 * ── Provider selection (env vars) ────────────────────────────────────────────
 *
 *   PLAYER_STATS_PROVIDER=mock          (default — no API key needed)
 *   PLAYER_STATS_PROVIDER=api-football  (requires API_FOOTBALL_KEY)
 *
 * Production is currently mock. To enable real stats later:
 *   1. Set PLAYER_STATS_PROVIDER=api-football in Vercel env vars
 *   2. Set API_FOOTBALL_KEY=<your key>
 *   3. Ensure Daily XI player IDs use the format: apf-player-{numericId}
 *
 * ── Player ID format ─────────────────────────────────────────────────────────
 *
 *   Mock provider:          any string — stats are derived from ID + date hash
 *   ApiFootball provider:   "apf-player-{numericId}" → maps to API Football player {numericId}
 *                           Any other format → safe fallback (played=false, 0 stats)
 */

import { type PlayerStats } from './daily-xi-scoring'

export type { PlayerStats }

// ── Fallback stats — returned for unmapped or failed players ──────────────────

function fallbackStats(playerId: string): PlayerStats {
  return {
    playerId,
    played:      false,
    goals:       0,
    assists:     0,
    cleanSheet:  false,
    rating:      0,
    yellowCards: 0,
    redCards:    0,
  }
}

// ── Provider interface ────────────────────────────────────────────────────────

export interface PlayerStatsProvider {
  readonly name: string
  fetchStats(playerIds: string[], date: string): Promise<PlayerStats[]>
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock provider
// ─────────────────────────────────────────────────────────────────────────────
// Deterministic hash helpers
// djb2 variant — always returns a non-negative 32-bit integer.
// Same seed always produces the same output (no Math.random).

function hashInt(seed: string): number {
  let h = 5381
  for (let i = 0; i < seed.length; i++) {
    h = ((Math.imul(h, 33) ^ seed.charCodeAt(i)) >>> 0)
  }
  return h
}

// Weighted goal count: 0 (65%), 1 (28%), 2 (7%)
function mockGoals(seed: string): number {
  const h = hashInt(`${seed}::g`) % 100
  return h < 65 ? 0 : h < 93 ? 1 : 2
}

// Weighted assist count: 0 (60%), 1 (32%), 2 (8%)
function mockAssists(seed: string): number {
  const h = hashInt(`${seed}::a`) % 100
  return h < 60 ? 0 : h < 92 ? 1 : 2
}

// Rating 5.5–8.5 with central tendency around 7.0.
// Averaging two independent hashes approximates a bell curve.
function mockRating(seed: string): number {
  const h1 = hashInt(`${seed}::r1`) % 16  // 0–15 → 0.0–1.5
  const h2 = hashInt(`${seed}::r2`) % 16  // 0–15 → 0.0–1.5
  return Math.round((5.5 + (h1 + h2) * 0.1) * 10) / 10
}

// Boolean with given probability (0–100)
function hashBool(seed: string, pct: number): boolean {
  return (hashInt(seed) % 100) < pct
}

export class MockPlayerStatsProvider implements PlayerStatsProvider {
  readonly name = 'mock'

  async fetchStats(playerIds: string[], date: string): Promise<PlayerStats[]> {
    return playerIds.map(playerId => {
      const s = `${playerId}::${date}`
      return {
        playerId,
        played:      hashBool(`${s}::played`, 90),
        goals:       mockGoals(s),
        assists:     mockAssists(s),
        cleanSheet:  hashBool(`${s}::clean`, 28),
        rating:      mockRating(s),
        yellowCards: hashBool(`${s}::yellow`, 14) ? 1 : 0,
        redCards:    hashBool(`${s}::red`, 3) ? 1 : 0,
      }
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API Football provider
// ─────────────────────────────────────────────────────────────────────────────
//
// Uses the API-Football v3 endpoint to fetch season-level player statistics,
// then derives a representative per-game stat from the season totals.
//
// ── Why season totals, not match-specific? ────────────────────────────────────
// Match-specific stats require a fixture ID. To get a fixture ID for a given
// date + player you would need to:
//   1. GET /fixtures?date={date}&league={id}&season={year}
//   2. Match the player's team to a fixture in the response
//   3. GET /players?fixture={fixtureId}&id={playerId}
// This costs extra API quota. Season-level stats are used as a first
// implementation. Replace with the fixture-level flow when real per-match
// accuracy is needed.
//
// ── Player ID format ──────────────────────────────────────────────────────────
// Daily XI player IDs must use the format: apf-player-{numericId}
// Example: "apf-player-874" maps to API Football player 874 (Ronaldo, historically).
// Any other format falls back to all-zero safe stats (played=false).
//
// ── Required env vars ─────────────────────────────────────────────────────────
//   PLAYER_STATS_PROVIDER=api-football
//   API_FOOTBALL_KEY=<your key from api-football.com>

// API Football v3 base URL
const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io'

// Infer football season year from a YYYY-MM-DD date string.
// Football seasons typically run Aug–May, so:
//   Jan–Jul 2026 → season 2025   (winter half of 2025/26 season)
//   Aug–Dec 2026 → season 2026   (summer start of 2026/27 season)
function seasonFromDate(date: string): number {
  const year  = parseInt(date.slice(0, 4), 10)
  const month = parseInt(date.slice(5, 7), 10)
  return month >= 8 ? year : year - 1
}

// Parse "apf-player-{numericId}" → numericId, or null if not in that format
function parseApiFootballPlayerId(playerId: string): number | null {
  const m = /^apf-player-(\d+)$/.exec(playerId)
  return m ? parseInt(m[1], 10) : null
}

// Clamp a number to [0, max] and round to integer
function clamp(n: number, max: number): number {
  return Math.max(0, Math.min(max, Math.round(n)))
}

// Shape of API Football /players response we care about
type ApiFootballPlayerResponse = {
  response: Array<{
    player: { id: number; name: string }
    statistics: Array<{
      games:   { appearences: number | null; minutes: number | null; rating: string | null }
      goals:   { total: number | null; assists: number | null; conceded?: number | null; saves?: number | null }
      cards:   { yellow: number | null; red: number | null }
    }>
  }>
}

export class ApiFootballPlayerStatsProvider implements PlayerStatsProvider {
  readonly name = 'api-football'

  private readonly apiKey: string

  constructor() {
    const key = process.env.API_FOOTBALL_KEY
    if (!key || key.trim() === '') {
      throw new Error(
        '[ApiFootballPlayerStatsProvider] API_FOOTBALL_KEY env var is not set. ' +
        'Set it in .env.local or Vercel project settings.',
      )
    }
    this.apiKey = key.trim()
  }

  async fetchStats(playerIds: string[], date: string): Promise<PlayerStats[]> {
    const season = seasonFromDate(date)
    const results: PlayerStats[] = []

    for (const playerId of playerIds) {
      const apiId = parseApiFootballPlayerId(playerId)

      if (apiId === null) {
        // ID not in apf-player-{n} format — return safe fallback
        results.push(fallbackStats(playerId))
        continue
      }

      try {
        const stats = await this.fetchPlayerSeasonStats(apiId, season)
        results.push({ playerId, ...stats })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`[ApiFootballPlayerStatsProvider] player ${playerId}:`, msg)
        results.push(fallbackStats(playerId))
      }
    }

    return results
  }

  // Fetch one player's season stats and return mapped PlayerStats (minus playerId)
  private async fetchPlayerSeasonStats(
    apiId:  number,
    season: number,
  ): Promise<Omit<PlayerStats, 'playerId'>> {
    const url = `${API_FOOTBALL_BASE}/players?id=${apiId}&season=${season}`

    const res = await fetch(url, {
      headers: {
        'x-apisports-key': this.apiKey,
      },
    })

    if (!res.ok) {
      throw new Error(`API Football returned ${res.status} for player ${apiId}`)
    }

    const json = await res.json() as ApiFootballPlayerResponse
    const entry = json.response?.[0]

    if (!entry || !entry.statistics?.length) {
      // Player not found in API or no stats for this season — safe fallback
      return {
        played:      false,
        goals:       0,
        assists:     0,
        cleanSheet:  false,
        rating:      0,
        yellowCards: 0,
        redCards:    0,
      }
    }

    // Use the first statistics entry (first league/competition)
    const s = entry.statistics[0]

    const appearances = s.games.appearences ?? 0
    const perGame     = (n: number | null): number =>
      appearances > 0 ? (n ?? 0) / appearances : 0

    // Per-game averages → representative single-game stats
    const goalsPG       = perGame(s.goals.total)
    const assistsPG     = perGame(s.goals.assists)
    const yellowPG      = perGame(s.cards.yellow)
    const redPG         = perGame(s.cards.red)
    const ratingRaw     = parseFloat(s.games.rating ?? '0') || 0

    // Goals conceded — relevant for goalkeepers / defenders (clean sheet proxy)
    const concededPG    = perGame(s.goals.conceded ?? null)

    return {
      played:      appearances > 0,
      // Scale per-game averages to reasonable integer stats
      goals:       clamp(Math.round(goalsPG),        2),
      assists:     clamp(Math.round(assistsPG),      2),
      // Clean sheet proxy: defender/GK with conceded < 0.3/game
      cleanSheet:  appearances > 0 && concededPG >= 0 && concededPG < 0.3,
      rating:      ratingRaw > 0 ? Math.round(ratingRaw * 10) / 10 : 6.5,
      yellowCards: yellowPG  > 0.12 ? 1 : 0,
      redCards:    redPG     > 0.03 ? 1 : 0,
    }
  }
}

// ── Provider factory ──────────────────────────────────────────────────────────
//
// To switch to API Football:
//   Set env PLAYER_STATS_PROVIDER=api-football
//   Set env API_FOOTBALL_KEY=<your key>
//   Ensure Daily XI playerIds use format: apf-player-{numericId}
//
// Default is always mock — existing behaviour is never broken.

export function getPlayerStatsProvider(): PlayerStatsProvider {
  const mode = process.env.PLAYER_STATS_PROVIDER?.trim().toLowerCase()

  if (mode === 'api-football') {
    // Constructor throws a clear error if API_FOOTBALL_KEY is missing —
    // the calling route will surface a 500 rather than silently using mock.
    return new ApiFootballPlayerStatsProvider()
  }

  return new MockPlayerStatsProvider()
}

// ── Convenience wrapper ───────────────────────────────────────────────────────

export async function fetchStatsForPlayers(
  playerIds: string[],
  date:       string,
  provider?:  PlayerStatsProvider,
): Promise<PlayerStats[]> {
  return (provider ?? getPlayerStatsProvider()).fetchStats(playerIds, date)
}
