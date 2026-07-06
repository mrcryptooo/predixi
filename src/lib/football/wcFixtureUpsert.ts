/**
 * wcFixtureUpsert — single shared upsert path for World Cup fixtures.
 *
 * Used by BOTH:
 *   - POST /api/admin/sync-wc-fixtures  (manual/backfill)
 *   - GET  /api/cron/sync-wc-results    (automatic, every 3 min)
 *
 * There is exactly one function that writes a WC fixture row into `matches`
 * (`upsertRow`, below). Every field (score, status, actual_outcome/winner,
 * round) is written there — nowhere else — so every caller and every data
 * source always updates the same set of columns for the same event.
 *
 * Two source-specific row builders feed that one function:
 *   - `buildWcMatchRow`     — from API-Football's fixture payload
 *   - `buildWcMatchRowFromFd` — from football-data.org's match payload
 *
 * ── Why two sources ──────────────────────────────────────────────────────────
 * API-Football's free plan has NO access to the WC 2026 season at all
 * (verified live: every /fixtures call for league=1&season=2026 returns
 * `{"plan":"Free plans do not have access to this season, try from 2022 to 2024."}`
 * regardless of date range or whether a season is scoped to a date window).
 * football-data.org's free tier DOES expose the full WC 2026 schedule
 * (group stage + entire knockout bracket) in a single call, so it is the
 * real, working data source. The API-Football path is kept fully wired —
 * it will start contributing automatically the moment the plan is upgraded,
 * with zero further code changes.
 *
 * Never overwrites a settled `actual_outcome` once one has been written —
 * settlement is a one-way transition.
 */

import type { getServerSupabaseClient }   from '@/lib/supabase/server'
import { normalizeApfStatus, normalizeFdStatus, inferOutcome, validateFixture } from '@/lib/football/status'
import { APF_WORLD_CUP }                  from '@/lib/football/apiFootballConfig'
import type { ApfFixturePayload }         from '@/lib/football/apiFootball'
import { mapFdStageToRound, mapFdWinner } from '@/lib/football/footballDataWc'
import type { FdWcMatch }                 from '@/lib/football/footballDataWc'
import { isSameTeam }                     from '@/lib/football/teamAliases'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type WcMatchRow = {
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
  round:           string | null
  venue:           string | null
  actual_outcome:  string | null
  updated_at:      string
  home_team_crest: string | null
  away_team_crest: string | null
  league_logo:     string | null
  country_flag:    string | null
  api_source:      string
}

export type WcUpsertStats = {
  inserted:  number
  updated:   number
  unchanged: number
  invalid:   number
  skipped:   number   // e.g. FD shell fixtures with participants not decided yet
  errors:    string[]
}

export function newWcUpsertStats(): WcUpsertStats {
  return { inserted: 0, updated: 0, unchanged: 0, invalid: 0, skipped: 0, errors: [] }
}

// ─────────────────────────────────────────────────────────────────────────────
// Row builder — API-Football fixture payload → matches table row
// ─────────────────────────────────────────────────────────────────────────────

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

export function buildWcMatchRow(fx: ApfFixturePayload): WcMatchRow {
  const status = normalizeApfStatus(fx.fixture.status.short)
  const h       = fx.goals.home
  const a       = fx.goals.away

  return {
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
    round:           fx.league.round ?? null,
    venue:           fx.fixture.venue.name ?? null,
    actual_outcome:  inferOutcome(h, a, status),
    updated_at:      new Date().toISOString(),
    // Media URLs (stored in DB, never hotlinked from frontend)
    home_team_crest: fx.teams.home.logo ?? null,
    away_team_crest: fx.teams.away.logo ?? null,
    league_logo:     fx.league.logo     ?? null,
    country_flag:    fx.league.flag     ?? null,
    api_source:      'apf',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Row builder — football-data.org match payload → matches table row
//
// football-data.org pre-creates a "shell" fixture (real id, real date, real
// stage) for every knockout slot at the start of the tournament, filling in
// the participant names only once the previous round decides them. Returns
// null while either side is still undecided — the caller should skip the
// row entirely in that case and let the client-side bracket projection
// (`deriveProjectedSlots` in knockoutUtils.ts) derive the likely matchup
// from the already-finished previous round instead. The moment
// football-data.org fills in both names, this returns a real row and the
// projected placeholder is automatically superseded.
// ─────────────────────────────────────────────────────────────────────────────

export function buildWcMatchRowFromFd(m: FdWcMatch): WcMatchRow | null {
  if (!m.homeTeam.name || !m.awayTeam.name) return null // shell fixture — not decided yet

  const status = normalizeFdStatus(m.status)
  const round  = mapFdStageToRound(m.stage)

  return {
    id:              `fd-${m.id}`,
    league_id:       APF_WORLD_CUP.code,       // 'WC' — same league_id regardless of source
    home_team_id:    `fd-team-${m.homeTeam.id}`,
    home_team_name:  m.homeTeam.name,
    home_team_short: (m.homeTeam.tla ?? m.homeTeam.shortName ?? m.homeTeam.name).slice(0, 3).toUpperCase(),
    away_team_id:    `fd-team-${m.awayTeam.id}`,
    away_team_name:  m.awayTeam.name,
    away_team_short: (m.awayTeam.tla ?? m.awayTeam.shortName ?? m.awayTeam.name).slice(0, 3).toUpperCase(),
    kickoff:         m.utcDate,
    status,
    home_score:      m.score.fullTime.home,
    away_score:      m.score.fullTime.away,
    matchday:        round === 'Group Stage' ? m.matchday : null,
    round,
    venue:           m.venue ?? null,
    actual_outcome:  mapFdWinner(m.score.winner),
    updated_at:      new Date().toISOString(),
    home_team_crest: m.homeTeam.crest ?? null,
    away_team_crest: m.awayTeam.crest ?? null,
    league_logo:     null,
    country_flag:    null,
    api_source:      'fd',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// upsertRow — the ONE function that writes a WC fixture row into `matches`
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inserts/updates/skips a single already-built WC fixture row.
 *
 * - Missing row               → full insert (score, status, round, winner, etc.)
 * - Existing, nothing changed → no write, `stats.unchanged++`
 * - Existing, something changed → update (score, status, round; never
 *   overwrites a settled actual_outcome once one exists)
 * - Fails `validateFixture`   → skipped, `stats.invalid++`
 */
async function upsertRow(
  supabase: ReturnType<typeof getServerSupabaseClient>,
  row:      WcMatchRow,
  stats:    WcUpsertStats,
): Promise<void> {
  const check = validateFixture({
    id:           row.id,
    kickoff:      row.kickoff,
    homeTeamId:   row.home_team_id,
    homeTeamName: row.home_team_name,
    awayTeamId:   row.away_team_id,
    awayTeamName: row.away_team_name,
  })
  if (!check.valid) {
    stats.invalid++
    stats.errors.push(check.reason)
    return
  }

  const { data: existing, error: fetchErr } = await supabase
    .from('matches')
    .select('id, status, home_score, away_score, round, actual_outcome')
    .eq('id', row.id)
    .maybeSingle()

  if (fetchErr) {
    stats.errors.push(`${row.id}: fetch error — ${fetchErr.message}`)
    return
  }

  if (!existing) {
    const { error: insertErr } = await supabase.from('matches').upsert(row, { onConflict: 'id' })
    if (insertErr) stats.errors.push(`${row.id}: insert — ${insertErr.message}`)
    else stats.inserted++
    return
  }

  const noChange =
    existing.status     === row.status &&
    existing.home_score === row.home_score &&
    existing.away_score === row.away_score &&
    existing.round      === row.round

  if (noChange) { stats.unchanged++; return }

  // Never overwrite a settled actual_outcome
  const safeOutcome = existing.actual_outcome ?? row.actual_outcome

  const { error: updateErr } = await supabase
    .from('matches')
    .update({
      status:         row.status,
      home_score:     row.home_score,
      away_score:     row.away_score,
      round:          row.round,
      matchday:       row.matchday,
      actual_outcome: safeOutcome,
      updated_at:     row.updated_at,
    })
    .eq('id', row.id)

  if (updateErr) stats.errors.push(`${row.id}: update — ${updateErr.message}`)
  else stats.updated++
}

// ─────────────────────────────────────────────────────────────────────────────
// Cross-provider reconciliation
//
// Real user predictions reference `matches.id` (e.g. `apf-1568100`), created
// back when the API-Football sync path worked. That path is now permanently
// blocked for the WC 2026 season on the free plan, so those rows can never
// update again on their own. A football-data.org fixture for the SAME real
// match must reconcile INTO that existing row (patching only its score,
// status, round, and outcome) — never insert a second, disconnected `fd-`
// row for a fixture that already has one under a different provider prefix.
// Otherwise those predictions would be orphaned and could never settle.
//
// Matched by kickoff proximity (±6h, generous enough for provider timezone/
// scheduling quirks, tight enough to never cross into a different fixture)
// AND both team names resolving to the same canonical name (see
// teamAliases.ts — handles provider naming differences like
// "Czech Republic" vs "Czechia").
// ─────────────────────────────────────────────────────────────────────────────

async function resolveExistingWcRowId(
  supabase: ReturnType<typeof getServerSupabaseClient>,
  row:      WcMatchRow,
): Promise<string | null> {
  const kickoffMs = Date.parse(row.kickoff)
  if (isNaN(kickoffMs)) return null

  const windowStart = new Date(kickoffMs - 6 * 60 * 60 * 1000).toISOString()
  const windowEnd   = new Date(kickoffMs + 6 * 60 * 60 * 1000).toISOString()

  const { data: candidates, error } = await supabase
    .from('matches')
    .select('id, home_team_name, away_team_name')
    .eq('league_id', row.league_id)
    .gte('kickoff', windowStart)
    .lte('kickoff', windowEnd)

  if (error || !candidates) return null

  const match = (candidates as { id: string; home_team_name: string; away_team_name: string }[]).find(c =>
    c.id !== row.id &&
    isSameTeam(c.home_team_name, row.home_team_name) &&
    isSameTeam(c.away_team_name, row.away_team_name)
  )

  return match ? match.id : null
}

// ─────────────────────────────────────────────────────────────────────────────
// Public entry points — one per source, both delegate to `upsertRow`
// ─────────────────────────────────────────────────────────────────────────────

/** Upserts a single API-Football fixture. No-op-safe once the free plan is upgraded. */
export async function upsertWcFixture(
  supabase: ReturnType<typeof getServerSupabaseClient>,
  fx:       ApfFixturePayload,
  stats:    WcUpsertStats,
): Promise<void> {
  await upsertRow(supabase, buildWcMatchRow(fx), stats)
}

/**
 * Upserts a single football-data.org match. Skips shell fixtures whose
 * participants aren't decided yet.
 *
 * Cross-provider reconciliation only applies the FIRST time this fixture is
 * ever seen from football-data.org (no `fd-{id}` row exists yet) — it then
 * looks for an existing legacy `apf-` twin to patch instead of inserting a
 * disconnected duplicate. Once a fixture has its own established `fd-{id}`
 * row (whether from a previous sync or this one), it is always updated
 * directly and never redirected — redirecting an already-existing row with
 * its own predictions onto a different twin would silently stop that row
 * from ever being updated again while touching the wrong row instead.
 */
export async function upsertWcFixtureFromFd(
  supabase: ReturnType<typeof getServerSupabaseClient>,
  m:        FdWcMatch,
  stats:    WcUpsertStats,
): Promise<void> {
  const row = buildWcMatchRowFromFd(m)
  if (!row) { stats.skipped++; return }

  const { data: ownRow } = await supabase
    .from('matches')
    .select('id')
    .eq('id', row.id)
    .maybeSingle()

  const existingId = ownRow ? null : await resolveExistingWcRowId(supabase, row)
  const targetRow  = existingId ? { ...row, id: existingId } : row

  await upsertRow(supabase, targetRow, stats)
}
