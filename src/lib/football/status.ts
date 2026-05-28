/**
 * Football status normalization — shared across all sync routes.
 *
 * Canonical internal statuses:
 *   upcoming | live | finished | postponed | cancelled
 *
 * Handles both football-data.org and api-football (api-sports.io) codes.
 * Previously duplicated inline in admin/sync-fixtures, cron/sync-fixtures,
 * and admin/sync-results. Single source of truth.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type InternalMatchStatus =
  | 'upcoming'
  | 'live'
  | 'finished'
  | 'postponed'
  | 'cancelled'

// ─────────────────────────────────────────────────────────────────────────────
// football-data.org status codes
// Ref: https://docs.football-data.org/general/v4/lookup_tables.html#_match_status
// ─────────────────────────────────────────────────────────────────────────────

const FD_FINISHED  = new Set(['FINISHED'])
const FD_LIVE      = new Set(['IN_PLAY', 'PAUSED', 'HALFTIME'])
const FD_POSTPONED = new Set(['POSTPONED', 'SUSPENDED'])
const FD_CANCELLED = new Set(['CANCELLED'])
// TBD, SCHEDULED, AWARDED → 'upcoming' (default)

export function normalizeFdStatus(raw: string): InternalMatchStatus {
  if (FD_FINISHED.has(raw))  return 'finished'
  if (FD_LIVE.has(raw))      return 'live'
  if (FD_POSTPONED.has(raw)) return 'postponed'
  if (FD_CANCELLED.has(raw)) return 'cancelled'
  return 'upcoming'
}

// ─────────────────────────────────────────────────────────────────────────────
// api-football / api-sports.io status codes (short form)
// Ref: https://www.api-football.com/documentation-v3#tag/Fixtures/operation/get-fixtures
// ─────────────────────────────────────────────────────────────────────────────

const APF_FINISHED  = new Set(['FT', 'AET', 'PEN'])
const APF_LIVE      = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'])
const APF_POSTPONED = new Set(['PST', 'ABD', 'WO', 'AWD', 'INT'])
const APF_CANCELLED = new Set(['CANC'])
// NS, TBD → 'upcoming' (default)

export function normalizeApfStatus(raw: string): InternalMatchStatus {
  if (APF_FINISHED.has(raw))  return 'finished'
  if (APF_LIVE.has(raw))      return 'live'
  if (APF_POSTPONED.has(raw)) return 'postponed'
  if (APF_CANCELLED.has(raw)) return 'cancelled'
  return 'upcoming'
}

// ─────────────────────────────────────────────────────────────────────────────
// Outcome inference
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Infer H / D / A outcome from scores.
 * Returns null for non-finished matches or when scores are missing.
 */
export function inferOutcome(
  home:   number | null,
  away:   number | null,
  status: InternalMatchStatus,
): 'H' | 'D' | 'A' | null {
  if (status !== 'finished' || home === null || away === null) return null
  return home > away ? 'H' : away > home ? 'A' : 'D'
}

// ─────────────────────────────────────────────────────────────────────────────
// Stale-data / fixture validation
// ─────────────────────────────────────────────────────────────────────────────

/** 5 years in ms — rejects absurdly future-dated fixtures from bad API data. */
const MAX_FUTURE_MS = 5 * 365.25 * 24 * 3600 * 1000

export type FixtureValidation =
  | { valid: true }
  | { valid: false; reason: string }

/**
 * Validate a raw fixture before upserting into the matches table.
 * Any failed check causes the row to be skipped and counted as `invalid`.
 */
export function validateFixture(row: {
  id:           string | null | undefined
  kickoff:      string | null | undefined
  homeTeamId:   string | null | undefined
  homeTeamName: string | null | undefined
  awayTeamId:   string | null | undefined
  awayTeamName: string | null | undefined
}): FixtureValidation {
  if (!row.id || row.id.trim() === '') {
    return { valid: false, reason: 'missing match id' }
  }

  if (!row.kickoff || row.kickoff.trim() === '') {
    return { valid: false, reason: `[${row.id}] missing kickoff` }
  }

  const ms = Date.parse(row.kickoff)
  if (isNaN(ms)) {
    return { valid: false, reason: `[${row.id}] unparseable kickoff: "${row.kickoff}"` }
  }
  if (ms > Date.now() + MAX_FUTURE_MS) {
    return { valid: false, reason: `[${row.id}] kickoff too far in future: "${row.kickoff}"` }
  }

  if (!row.homeTeamName || row.homeTeamName.trim() === '') {
    return { valid: false, reason: `[${row.id}] missing home team name` }
  }
  if (!row.awayTeamName || row.awayTeamName.trim() === '') {
    return { valid: false, reason: `[${row.id}] missing away team name` }
  }
  if (!row.homeTeamId || row.homeTeamId.trim() === '') {
    return { valid: false, reason: `[${row.id}] missing home team id` }
  }
  if (!row.awayTeamId || row.awayTeamId.trim() === '') {
    return { valid: false, reason: `[${row.id}] missing away team id` }
  }

  return { valid: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sort order for public match display
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Numeric sort weight for each internal status.
 * Lower = appears first.
 * live → upcoming → postponed → cancelled → finished
 */
export const MATCH_STATUS_ORDER: Record<InternalMatchStatus, number> = {
  live:      0,
  upcoming:  1,
  postponed: 2,
  cancelled: 3,
  finished:  4,
}
