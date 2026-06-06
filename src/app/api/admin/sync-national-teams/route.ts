/**
 * POST /api/admin/sync-national-teams
 *
 * Fetches all FIFA World Cup 2026 national teams from API-Football and upserts
 * them into the `national_teams` table.
 *
 * Auth:    x-admin-key header vs ADMIN_SETTLEMENT_KEY
 * APF:     GET /teams?league=1&season=2026  (1 request total)
 *
 * Request body (all optional):
 *   { "dryRun": boolean }   // default false
 *
 * Enrichment (no extra APF calls):
 *   - short_code is inferred by matching APF team name against the hardcoded
 *     worldCupGroups data in src/data/worldcup.ts (48 teams with shortCode).
 *   - group_code is inferred the same way.
 *   - If the name doesn't match exactly, normalisation is attempted
 *     (trim, lowercase, ignore punctuation).
 *   - If still unmatched, short_code/group_code remain null — sync proceeds.
 *
 * Response:
 *   { ok, dryRun, teamsFound, rowsUpserted, apiCallsUsed, callsToday,
 *     missingLogos, inferredGroups, errors }
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'
import { fetchApfTeams }                  from '@/lib/football/apiFootball'
import { APF_WORLD_CUP }                  from '@/lib/football/apiFootballConfig'
import { worldCupGroups }                 from '@/data/worldcup'
import type { InsertNationalTeam }        from '@/lib/supabase/types'

// ─────────────────────────────────────────────────────────────────────────────
// Build a lookup map from normalised team name → { shortCode, groupCode }
// sourced from the hardcoded worldcup.ts (48 WC 2026 teams).
// ─────────────────────────────────────────────────────────────────────────────

function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')   // strip punctuation
    .replace(/\s+/g, ' ')
    .trim()
}

const WC_LOOKUP = new Map<string, { shortCode: string; groupCode: string }>()
for (const group of worldCupGroups) {
  const letter = group.name.replace('Group ', '').trim()   // 'A' through 'L'
  for (const team of group.teams) {
    WC_LOOKUP.set(normaliseName(team.name), {
      shortCode: team.shortCode,
      groupCode: letter,
    })
  }
}

// Extra aliases — APF occasionally uses different name variants
const NAME_ALIASES: Record<string, string> = {
  'czech republic':    'czechia',
  'usa':               'united states',
  'united states':     'united states',
  'korea republic':    'south korea',
  'republic of ireland': 'ireland',
  'ir iran':           'iran',
  // APF "Bosnia & Herzegovina" normalises to "bosnia herzegovina" (& stripped, space kept)
  // worldcup.ts "Bosnia-Herzegovina" normalises to "bosniaherzegovina" (hyphen stripped → no space)
  'bosnia herzegovina': 'bosniaherzegovina',
  // APF "Congo DR" vs worldcup.ts "DR Congo" — word order reversed
  'congo dr':          'dr congo',
  'ivory coast':       'ivory coast',
  'cote divoire':      'ivory coast',
}

function inferFromWcData(apfName: string): { shortCode: string | null; groupCode: string | null } {
  const normalised = normaliseName(apfName)
  const aliased    = NAME_ALIASES[normalised] ?? normalised

  const match = WC_LOOKUP.get(normalised) ?? WC_LOOKUP.get(aliased)
  if (match) return { shortCode: match.shortCode, groupCode: match.groupCode }

  // Partial match fallback — find first entry whose key includes the normalised name
  for (const [key, value] of WC_LOOKUP.entries()) {
    if (key.includes(normalised) || normalised.includes(key)) {
      return { shortCode: value.shortCode, groupCode: value.groupCode }
    }
  }

  return { shortCode: null, groupCode: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

function err(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

export async function POST(req: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const adminKey = process.env.ADMIN_SETTLEMENT_KEY
  if (!adminKey)                                    return err('Admin key not configured', 500)
  if (req.headers.get('x-admin-key') !== adminKey) return err('Unauthorized', 401)

  // ── Parse body ────────────────────────────────────────────────────────────────
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* empty body is valid */ }

  const dryRun = body.dryRun === true

  if (!process.env.API_FOOTBALL_KEY) {
    return err('API_FOOTBALL_KEY is not configured', 500)
  }

  // ── Fetch teams from API-Football ─────────────────────────────────────────────
  const result = await fetchApfTeams({
    league: APF_WORLD_CUP.id,
    season: APF_WORLD_CUP.season,
  })

  if (!result.ok) {
    return NextResponse.json({
      ok:           false,
      error:        result.error,
      apiCallsUsed: 1,
      callsToday:   result.callsToday ?? 0,
      ...(result.budgetExceeded && { budgetExceeded: true }),
      ...(result.rateLimitHit   && { rateLimitHit:   true }),
    }, { status: result.budgetExceeded ? 429 : 502 })
  }

  const teams      = result.data
  const teamsFound = teams.length

  if (teamsFound === 0) {
    return NextResponse.json({
      ok: true, dryRun, teamsFound: 0, rowsUpserted: 0,
      apiCallsUsed: 1, callsToday: result.callsToday,
      message: 'APF returned 0 teams for WC 2026 — may not be available yet.',
    })
  }

  // ── Build rows ────────────────────────────────────────────────────────────────
  let missingLogos  = 0
  let inferredGroups = 0
  const errors: string[] = []

  const rows: InsertNationalTeam[] = teams.map(entry => {
    const { shortCode, groupCode } = inferFromWcData(entry.team.name)
    if (!entry.team.logo) missingLogos++
    if (groupCode)        inferredGroups++

    return {
      apf_team_id:    entry.team.id,
      team_id:        `apf-team-${entry.team.id}`,
      name:           entry.team.name,
      short_code:     shortCode,
      country:        entry.team.country ?? null,
      group_code:     groupCode,
      world_cup_year: APF_WORLD_CUP.season,    // 2026
      source:         'apf',
      logo_url:       entry.team.logo  ?? null,
      flag_url:       null,   // APF /teams does not return country.flag — use standings data if needed
    }
  })

  if (dryRun) {
    const sample = rows.slice(0, 5).map(r =>
      `${r.name} (${r.short_code ?? '?'}) group=${r.group_code ?? '?'} logo=${r.logo_url ? '✓' : 'null'}`
    )
    console.log(`[sync-national-teams] dryRun: ${rows.length} teams, skipping DB`)
    return NextResponse.json({
      ok: true, dryRun: true,
      teamsFound, rowsUpserted: rows.length,
      apiCallsUsed: 1, callsToday: result.callsToday,
      missingLogos, inferredGroups,
      sampleRows: sample,
      message: `Dry run — ${rows.length} teams found. Run with dryRun:false to write.`,
    })
  }

  // ── Upsert ────────────────────────────────────────────────────────────────────
  // Deduplicate by team_id before upsert (same pattern as WC standings fix)
  const rowMap = new Map<string, InsertNationalTeam>()
  for (const row of rows) rowMap.set(row.team_id, row)
  const uniqueRows = Array.from(rowMap.values())

  const supabase = getServerSupabaseClient()

  const { error: upsertErr, count } = await supabase
    .from('national_teams')
    .upsert(uniqueRows, { onConflict: 'team_id' })
    .select()

  if (upsertErr) {
    console.error('[sync-national-teams] upsert error:', upsertErr.message)
    errors.push(upsertErr.message)
    return NextResponse.json({
      ok: false, error: `DB upsert failed: ${upsertErr.message}`,
      teamsFound, apiCallsUsed: 1, callsToday: result.callsToday,
    }, { status: 500 })
  }

  const rowsUpserted = count ?? uniqueRows.length

  console.log(
    `[sync-national-teams] ${rowsUpserted} rows upserted, ` +
    `inferredGroups=${inferredGroups}/${teamsFound}, missingLogos=${missingLogos}`
  )

  return NextResponse.json({
    ok: true, dryRun: false,
    teamsFound,
    rowsUpserted,
    apiCallsUsed: 1,
    callsToday: result.callsToday,
    missingLogos,
    inferredGroups,
    errors: errors.length > 0 ? errors : undefined,
    message: `National teams sync complete — ${rowsUpserted} teams upserted.`,
  })
}
