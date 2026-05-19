/**
 * Season & Week Helpers — single source of truth for PrediXI season/period IDs.
 *
 * ── Season IDs ────────────────────────────────────────────────────────────────
 *   "2026-S1"  Jan–Jun (months 1–6)
 *   "2026-S2"  Jul–Dec (months 7–12)
 *
 * ── Week IDs ──────────────────────────────────────────────────────────────────
 *   "2026-W21"  ISO 8601 week number, zero-padded to 2 digits
 *
 * All functions accept an optional `date` parameter (defaults to now).
 * They are pure and never throw.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type SeasonHalf = 'S1' | 'S2'

export type SeasonId = string   // "YYYY-S1" | "YYYY-S2"
export type WeekId   = string   // "YYYY-WNN"

export type WeekWindow = {
  weekId: WeekId
  start:  Date   // Monday 00:00:00 UTC
  end:    Date   // Sunday 23:59:59.999 UTC
}

// ── ISO week helpers ──────────────────────────────────────────────────────────

/**
 * Returns the ISO 8601 week number (1–53) for a given date.
 * Uses the standard algorithm: week 1 is the week containing the first Thursday.
 */
export function getISOWeek(date: Date): number {
  const d    = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day  = d.getUTCDay() || 7   // make Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - day)   // align to Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
}

/**
 * Returns the ISO week year — may differ from calendar year near Jan 1.
 * e.g. 2026-01-01 may belong to ISO week 53 of 2025.
 */
export function getISOWeekYear(date: Date): number {
  const d    = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day  = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  return d.getUTCFullYear()
}

// ── Core builders ─────────────────────────────────────────────────────────────

/**
 * Returns the season ID ("YYYY-S1" or "YYYY-S2") for the given date.
 * Defaults to the current UTC date.
 */
export function buildSeasonId(date: Date = new Date()): SeasonId {
  const year  = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1   // 1-based
  const half: SeasonHalf = month <= 6 ? 'S1' : 'S2'
  return `${year}-${half}`
}

/**
 * Returns the weekly period ID ("YYYY-WNN") for the given date.
 * Uses ISO 8601 week numbering. Zero-pads the week number to 2 digits.
 * Defaults to the current UTC date.
 */
export function buildWeeklyPeriod(date: Date = new Date()): WeekId {
  const week = getISOWeek(date)
  const year = getISOWeekYear(date)
  return `${year}-W${String(week).padStart(2, '0')}`
}

// ── Current period getters ────────────────────────────────────────────────────

/**
 * Returns the current season ID (e.g. "2026-S1").
 * Convenience wrapper around buildSeasonId().
 */
export function getCurrentSeason(): SeasonId {
  return buildSeasonId(new Date())
}

/**
 * Returns the full week window for the given date (defaults to now).
 *
 * start = Monday 00:00:00.000 UTC of that ISO week
 * end   = Sunday 23:59:59.999 UTC of that ISO week
 */
export function getCurrentWeekWindow(date: Date = new Date()): WeekWindow {
  const weekId = buildWeeklyPeriod(date)

  // Find Monday of this ISO week
  const d   = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay() || 7   // Sunday → 7
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() - (day - 1))

  const start = new Date(monday)
  start.setUTCHours(0, 0, 0, 0)

  const end = new Date(monday)
  end.setUTCDate(monday.getUTCDate() + 6)
  end.setUTCHours(23, 59, 59, 999)

  return { weekId, start, end }
}

// ── Weekly reset helper ───────────────────────────────────────────────────────

/**
 * Returns true if `lastUpdated` falls in a different ISO week than `now`.
 * Useful as a lightweight check before deciding to reset weekly stats.
 *
 * Does NOT perform any DB writes — caller is responsible for the actual reset.
 */
export function shouldResetWeeklyStats(
  lastUpdated: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!lastUpdated) return true
  const last = typeof lastUpdated === 'string' ? new Date(lastUpdated) : lastUpdated
  if (isNaN(last.getTime())) return true
  return buildWeeklyPeriod(last) !== buildWeeklyPeriod(now)
}
