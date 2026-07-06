/**
 * GET /api/cron/sync-wc-results
 *
 * Called by Cloudflare Worker every 3 minutes.
 * Fetches the FIFA World Cup 2026 schedule and updates the matches table
 * with current status, scores, round, and outcomes.
 *
 * This route is the ONE automatic, unattended WC sync path. Both this route
 * and the manual /api/admin/sync-wc-fixtures endpoint share a single upsert
 * function (lib/football/wcFixtureUpsert) — there is no second/duplicate
 * sync pipeline.
 *
 * ── Data source ──────────────────────────────────────────────────────────────
 * PRIMARY: football-data.org — verified live to have full free-tier access to
 *   the WC 2026 schedule (group stage + entire knockout bracket) via a single
 *   call to /v4/competitions/WC/matches. Free tier allows 10 req/min (no
 *   daily cap), so calling it every 3 minutes is trivially safe.
 *
 * SECONDARY (best-effort, currently a no-op): API-Football. Its free plan
 *   has NO access to the WC 2026 season at all — every /fixtures call for
 *   league=1&season=2026 returns
 *   `{"plan":"Free plans do not have access to this season, try from 2022 to 2024."}`,
 *   confirmed against the live API regardless of date range. This pass is
 *   kept wired (harmless — errors are swallowed, never fail the route) so it
 *   starts contributing automatically the moment the plan is upgraded, with
 *   zero further code changes.
 *
 * football-data.org pre-creates a fixture "shell" (real id/date/stage) for
 * every knockout slot before the participants are known; `upsertWcFixtureFromFd`
 * skips writing those until both team names are populated — until then the
 * client-side bracket (`knockoutUtils.buildBracketData`) derives the likely
 * matchup from the already-finished previous round. The real row supersedes
 * the derived one automatically the moment football-data.org fills it in.
 *
 * Auth:   Authorization: Bearer <CRON_SECRET>
 *
 * Settlement runs in a separate auto-settle cron (every 5 min via Cloudflare
 * Worker) — not inline here. Keeps this route single-responsibility and
 * eliminates concurrent-settlement race conditions.
 *
 * Idempotent: safe to call multiple times; only changed fields are written.
 * Safety:     never overwrites a settled actual_outcome (see wcFixtureUpsert).
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
  type WcUpsertStats,
} from '@/lib/football/wcFixtureUpsert'
import { logCronRun } from '@/lib/cron/logCronRun'

const CRON_ROUTE = '/api/cron/sync-wc-results'

// ─────────────────────────────────────────────────────────────────────────────
// Primary pass — football-data.org, one call covers the whole tournament
// ─────────────────────────────────────────────────────────────────────────────

type FdPassResult =
  | { ok: true;  scanned: number; stats: WcUpsertStats }
  | { ok: false; error: string; rateLimitHit?: boolean }

async function runFdPass(supabase: ReturnType<typeof getServerSupabaseClient>): Promise<FdPassResult> {
  const result = await fetchFdWcMatches()
  if (!result.ok) return { ok: false, error: result.error, rateLimitHit: result.rateLimitHit }

  const stats = newWcUpsertStats()
  for (const m of result.matches) {
    await upsertWcFixtureFromFd(supabase, m, stats)
  }
  return { ok: true, scanned: result.matches.length, stats }
}

// ─────────────────────────────────────────────────────────────────────────────
// Secondary pass — API-Football, best-effort, currently a no-op on the free
// plan. Never allowed to fail the route; any error here is swallowed and
// merely reported in the response for visibility.
// ─────────────────────────────────────────────────────────────────────────────

function dateStr(d: Date): string { return d.toISOString().slice(0, 10) }
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setUTCDate(r.getUTCDate() + n); return r
}

type ApfPassResult =
  | { ok: true;  scanned: number; stats: WcUpsertStats }
  | { ok: false; error: string; budgetExceeded?: boolean; rateLimitHit?: boolean }

async function runApfPass(supabase: ReturnType<typeof getServerSupabaseClient>, now: Date): Promise<ApfPassResult> {
  if (!process.env.API_FOOTBALL_KEY) return { ok: false, error: 'API_FOOTBALL_KEY not configured' }

  const from = dateStr(addDays(now, -2))
  const to   = dateStr(addDays(now, 1))

  const result = await fetchApfFixtures({ league: APF_WORLD_CUP.id, season: APF_WORLD_CUP.season, from, to })
  if (!result.ok) {
    return { ok: false, error: result.error, budgetExceeded: result.budgetExceeded, rateLimitHit: result.rateLimitHit }
  }

  const stats = newWcUpsertStats()
  for (const fx of result.data) {
    await upsertWcFixture(supabase, fx, stats)
  }
  return { ok: true, scanned: result.data.length, stats }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET handler
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron/sync-wc-results] CRON_SECRET env var not set')
    return NextResponse.json({ success: false, error: 'Cron secret not configured' }, { status: 500 })
  }
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getServerSupabaseClient()
  const now      = new Date()

  // ── Primary: football-data.org ──────────────────────────────────────────────
  const fd = await runFdPass(supabase)

  // ── Secondary: API-Football (best-effort — never fails the route) ──────────
  let apf: ApfPassResult | null = null
  try {
    apf = await runApfPass(supabase, now)
  } catch (e) {
    apf = { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  const errors: string[] = []
  if (!fd.ok) errors.push(`fd: ${fd.error}`)
  // API-Football is expected to fail on the free plan — log it but don't
  // treat it as a route-level error unless fd also failed.
  if (!apf.ok && !fd.ok) errors.push(`apf: ${apf.error}`)

  const fdSummary  = fd.ok  ? { scanned: fd.scanned,  ...fd.stats }  : { error: fd.error }
  const apfSummary = apf.ok ? { scanned: apf.scanned, ...apf.stats } : { error: apf.error }

  console.info(`[cron/sync-wc-results] fd=${JSON.stringify(fdSummary)} apf=${JSON.stringify(apfSummary)}`)

  const anyChange =
    (fd.ok  && (fd.stats.inserted  > 0 || fd.stats.updated  > 0)) ||
    (apf.ok && (apf.stats.inserted > 0 || apf.stats.updated > 0))

  // Log only when something changed or the primary source failed — avoids
  // ~480 no-op rows/day while still surfacing real problems.
  if (anyChange || !fd.ok) {
    await logCronRun({
      supabase,
      route:   CRON_ROUTE,
      status:  fd.ok ? 'success' : 'error',
      summary: { fd: fdSummary, apf: apfSummary },
      error:   errors.length > 0 ? errors.join('; ') : null,
    })
  }

  return NextResponse.json({
    success: fd.ok,
    fd:      fdSummary,
    apf:     apfSummary,
    ...(errors.length > 0 && { errors }),
  })
}
