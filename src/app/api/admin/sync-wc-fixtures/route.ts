/**
 * POST /api/admin/sync-wc-fixtures
 *
 * Manual/backfill entry point for the WC fixture sync. Upserts into the
 * `matches` table with league_id='WC'. Shares the exact same row-build +
 * insert/update/skip logic (`lib/football/wcFixtureUpsert`) as the automatic
 * cron at /api/cron/sync-wc-results — one upsert path, not two.
 *
 * Auth: x-admin-key header vs ADMIN_SETTLEMENT_KEY
 *
 * Request body (all optional):
 *   {
 *     "source":  "fd" | "apf"   // default: "fd" — see note below
 *     "dryRun":  boolean         // true = call the API, skip DB writes, report what would upsert
 *     "from":    string          // YYYY-MM-DD — API-Football only (ignored for fd)
 *     "to":      string          // YYYY-MM-DD — API-Football only (ignored for fd)
 *   }
 *
 * ── Why "fd" is the default ───────────────────────────────────────────────────
 * API-Football's free plan has NO access to the WC 2026 season at all —
 * verified live: every /fixtures call for league=1&season=2026 returns
 * `{"plan":"Free plans do not have access to this season, try from 2022 to 2024."}`,
 * regardless of date range. football-data.org's free tier DOES expose the
 * full WC 2026 schedule (group stage + entire knockout bracket) in one call
 * to /v4/competitions/WC/matches — no date range needed, it always returns
 * the whole tournament. `source: "apf"` is kept available and will start
 * working automatically the moment the API-Football plan is upgraded.
 *
 * Never overwrites a settled actual_outcome on existing rows.
 * dryRun calls the API but skips all DB writes — safe for verification.
 *
 * Response:
 *   { ok, dryRun, source, leagueId, from?, to?,
 *     fixturesFound, inserted, updated, unchanged, invalid, skipped, errors }
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'
import { fetchApfFixtures }               from '@/lib/football/apiFootball'
import { APF_WORLD_CUP }                  from '@/lib/football/apiFootballConfig'
import { fetchFdWcMatches }               from '@/lib/football/footballDataWc'
import {
  upsertWcFixture,
  upsertWcFixtureFromFd,
  newWcUpsertStats,
} from '@/lib/football/wcFixtureUpsert'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function err(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

function dateStr(d: Date): string { return d.toISOString().slice(0, 10) }
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setUTCDate(r.getUTCDate() + n); return r
}

// ─────────────────────────────────────────────────────────────────────────────
// POST handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const adminKey = process.env.ADMIN_SETTLEMENT_KEY
  if (!adminKey)                                    return err('Admin key not configured', 500)
  if (req.headers.get('x-admin-key') !== adminKey) return err('Unauthorized', 401)

  // ── Parse body ────────────────────────────────────────────────────────────────
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* empty body is valid */ }

  const dryRun = body.dryRun === true
  const source = body.source === 'apf' ? 'apf' : 'fd'

  const stats = newWcUpsertStats()
  const supabase = getServerSupabaseClient()

  // ── football-data.org path (default, working) ───────────────────────────────
  if (source === 'fd') {
    const result = await fetchFdWcMatches()

    if (!result.ok) {
      return NextResponse.json({
        ok: false, error: result.error, source, leagueId: APF_WORLD_CUP.code,
        ...(result.rateLimitHit && { rateLimitHit: true }),
      }, { status: result.rateLimitHit ? 429 : 502 })
    }

    const fixturesFound = result.matches.length

    if (!dryRun) {
      for (const m of result.matches) {
        await upsertWcFixtureFromFd(supabase, m, stats)
      }
    }

    console.log(
      dryRun
        ? `[sync-wc-fixtures] dryRun(fd): ${fixturesFound} matches found, skipping DB write`
        : `[sync-wc-fixtures] fd: inserted=${stats.inserted} updated=${stats.updated}` +
          ` unchanged=${stats.unchanged} skipped=${stats.skipped} invalid=${stats.invalid} fixturesFound=${fixturesFound}`
    )

    return NextResponse.json({
      ok:            stats.errors.length === 0,
      dryRun,
      source,
      leagueId:      APF_WORLD_CUP.code,
      fixturesFound,
      inserted:      dryRun ? 0 : stats.inserted,
      updated:       dryRun ? 0 : stats.updated,
      unchanged:     dryRun ? 0 : stats.unchanged,
      skipped:       dryRun ? 0 : stats.skipped,
      invalid:       stats.invalid,
      errors:        stats.errors.length > 0 ? stats.errors : undefined,
      message:       dryRun
        ? `Dry run — ${fixturesFound} WC matches found via football-data.org. Run with dryRun:false to write.`
        : `WC fixtures sync complete (football-data.org).`,
    })
  }

  // ── API-Football path (kept available; not usable on the free plan today) ──
  const today = new Date()
  const from  = typeof body.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.from)
    ? body.from
    : dateStr(today)
  const to    = typeof body.to   === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.to)
    ? body.to
    : dateStr(addDays(today, 7))

  if (!process.env.API_FOOTBALL_KEY) {
    return err('API_FOOTBALL_KEY is not configured', 500)
  }

  const result = await fetchApfFixtures({
    league: APF_WORLD_CUP.id,
    season: APF_WORLD_CUP.season,   // always 2026 — never APF_CURRENT_SEASON
    from,
    to,
  })

  if (!result.ok) {
    return NextResponse.json({
      ok: false, error: result.error, source, leagueId: APF_WORLD_CUP.code,
      season: APF_WORLD_CUP.season, from, to,
      apiCallsUsed: 1, callsToday: result.callsToday ?? 0,
      ...(result.budgetExceeded && { budgetExceeded: true }),
      ...(result.rateLimitHit   && { rateLimitHit:   true }),
    }, { status: result.budgetExceeded ? 429 : 502 })
  }

  const fixtures      = result.data
  const fixturesFound = fixtures.length

  if (!dryRun && fixturesFound > 0) {
    for (const fx of fixtures) {
      await upsertWcFixture(supabase, fx, stats)
    }
  }

  console.log(
    dryRun
      ? `[sync-wc-fixtures] dryRun(apf): ${fixturesFound} fixtures found, skipping DB write`
      : `[sync-wc-fixtures] apf: inserted=${stats.inserted} updated=${stats.updated}` +
        ` unchanged=${stats.unchanged} invalid=${stats.invalid} fixturesFound=${fixturesFound}`
  )

  return NextResponse.json({
    ok:            dryRun ? true : stats.errors.length === 0,
    dryRun,
    source,
    leagueId:      APF_WORLD_CUP.code,
    season:        APF_WORLD_CUP.season,
    from,
    to,
    apiCallsUsed:  1,
    fixturesFound,
    inserted:      dryRun ? 0 : stats.inserted,
    updated:       dryRun ? 0 : stats.updated,
    unchanged:     dryRun ? 0 : stats.unchanged,
    invalid:       stats.invalid,
    errors:        stats.errors.length > 0 ? stats.errors : undefined,
    callsToday:    result.callsToday,
    message:       dryRun
      ? `Dry run — ${fixturesFound} WC fixtures found for ${from}→${to}. Run with dryRun:false to write.`
      : `WC fixtures sync complete (API-Football).`,
  })
}
