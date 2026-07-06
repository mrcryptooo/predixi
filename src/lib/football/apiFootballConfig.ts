/**
 * API-Football canonical league + season configuration.
 *
 * Single source of truth for:
 *   - Current season number (driven by APF_CURRENT_SEASON env var)
 *   - League IDs mapped to internal competition codes used throughout PrediXI
 *
 * ── Media fields to preserve in future phases ────────────────────────────────
 *
 *   Every APF response that includes the following must store the URL in
 *   Supabase — never fetch media per page view from the frontend.
 *
 *   team.logo      → matches.home_team_crest / matches.away_team_crest
 *                    (future: teams.logo_url)
 *   league.logo    → leagues.logo_url (future table)
 *   country.flag   → countries.flag_url (future table)
 *   player.photo   → players.photo_url (future table)
 *   coach.photo    → coaches.photo_url (future table)
 *
 * ── Season rollover ───────────────────────────────────────────────────────────
 *
 *   To update the season: set APF_CURRENT_SEASON=2026 in Vercel env vars.
 *   No code change or redeploy of source code is required — just env + redeploy.
 *
 * ── League ID verification ────────────────────────────────────────────────────
 *
 *   IDs were verified via GET /api/admin/football/leagues?current=true&season=2025
 *   on 2026-06-05. Re-run that endpoint at the start of each season to confirm
 *   IDs remain stable and the active season is correct.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Season config
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Current football season year.
 * Driven by APF_CURRENT_SEASON env var (server-only, not NEXT_PUBLIC_).
 * Defaults to 2025 if not set.
 *
 * API-Football uses the year the season *starts* in, e.g. 2025 = 2025/26.
 */
export const APF_CURRENT_SEASON: number = (() => {
  const raw = process.env.APF_CURRENT_SEASON
  if (!raw) return 2025
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n >= 2020 && n <= 2030 ? n : 2025
})()

// ─────────────────────────────────────────────────────────────────────────────
// League definitions
// ─────────────────────────────────────────────────────────────────────────────

export type ApfLeague = {
  /** API-Football numeric league ID */
  id:      number
  /** Internal competition code used in PrediXI matches.league_id */
  code:    string
  /** Human-readable name for logging and admin UI */
  name:    string
  /** ISO country code or 'International' */
  country: string
}

/**
 * Canonical list of leagues synced from API-Football into PrediXI.
 * Add new leagues here before adding them to sync routes.
 *
 * IDs verified 2026-06-05 via /leagues?current=true&season=2025.
 */
export const APF_LEAGUES: readonly ApfLeague[] = [
  { id:  39, code: 'PL',  name: 'Premier League',    country: 'England'  },
  { id: 140, code: 'PD',  name: 'La Liga',            country: 'Spain'    },
  { id:  78, code: 'BL1', name: 'Bundesliga',         country: 'Germany'  },
  { id: 135, code: 'SA',  name: 'Serie A',            country: 'Italy'    },
  { id:  61, code: 'FL1', name: 'Ligue 1',            country: 'France'   },
  { id:   2, code: 'CL',  name: 'Champions League',   country: 'International' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Lookup helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the league config for a given internal code (e.g. 'PL'), or undefined. */
export function getApfLeagueByCode(code: string): ApfLeague | undefined {
  return APF_LEAGUES.find(l => l.code === code)
}

/** Returns the league config for a given API-Football numeric ID, or undefined. */
export function getApfLeagueById(id: number): ApfLeague | undefined {
  return APF_LEAGUES.find(l => l.id === id)
}

/** Returns all API-Football league IDs as an array. */
export function getApfLeagueIds(): number[] {
  return APF_LEAGUES.map(l => l.id)
}

/** Returns all internal competition codes as an array. */
export function getApfLeagueCodes(): string[] {
  return APF_LEAGUES.map(l => l.code)
}

// ─────────────────────────────────────────────────────────────────────────────
// World Cup 2026 config
//
// Kept separate from APF_LEAGUES so the daily club-league crons are NOT
// affected. WC sync uses dedicated admin endpoints:
//   POST /api/admin/sync-wc-fixtures
//   POST /api/admin/sync-wc-standings
//
// APF_CURRENT_SEASON is 2025 for club leagues — do NOT use it for WC.
// The WC always uses the tournament year (2026) explicitly.
// ─────────────────────────────────────────────────────────────────────────────

export const APF_WORLD_CUP = {
  /** API-Football numeric league ID for FIFA World Cup */
  id:      1,
  /** Internal competition code — matches matches.league_id for WC rows */
  code:    'WC',
  /** Human-readable name */
  name:    'FIFA World Cup 2026',
  country: 'International',
  /** Season year = tournament year (WC uses the year of the tournament, not start year) */
  season:  2026,
} as const

/**
 * Final match date (with a 2-day buffer for extra time / rescheduling).
 * Used as the upper bound for the wide knockout-discovery fetch in
 * /api/cron/sync-wc-results — never search past the tournament's own end.
 */
export const APF_WORLD_CUP_END_DATE = '2026-07-21'
