/**
 * GET /api/cron/sync-standings
 *
 * Vercel Cron endpoint — triggered once daily at 01:00 UTC via vercel.json.
 * Syncs league standings from API-Football into the `standings` table.
 *
 * Schedule: 0 1 * * *
 *   30 min after sync-fixtures (00:30 UTC)
 *   2 hours before auto-settle (03:00 UTC)
 *
 * Auth:   Authorization: Bearer <CRON_SECRET>
 *         Vercel sets this header automatically.
 *
 * APF budget: ~6 calls/day (one per configured league).
 * Idempotent: upsert on UNIQUE(league_id, season, team_id) — safe to re-run.
 *
 * Health log: Every invocation writes one row to `cron_runs`.
 *             Insert failures are swallowed — they never fail the cron.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'
import { runStandingsSync }               from '@/lib/football/syncStandings'

const CRON_ROUTE = '/api/cron/sync-standings'

// ─────────────────────────────────────────────────────────────────────────────
// Health log helper (same pattern as cron/sync-fixtures)
// ─────────────────────────────────────────────────────────────────────────────

async function logCronRun(
  supabase:  ReturnType<typeof getServerSupabaseClient>,
  status:    'success' | 'error' | 'unauthorized' | 'skipped',
  summary:   Record<string, unknown>,
  error?:    string,
): Promise<void> {
  try {
    const { error: dbErr } = await supabase.from('cron_runs').insert({
      route:   CRON_ROUTE,
      status,
      summary,
      error:   error ?? null,
    })
    if (dbErr) console.warn('[cron/sync-standings] cron_runs insert failed:', dbErr.message)
  } catch (e) {
    console.warn('[cron/sync-standings] cron_runs insert threw:', e instanceof Error ? e.message : String(e))
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET handler
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = getServerSupabaseClient()

  // ── Auth: Bearer CRON_SECRET ────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron/sync-standings] CRON_SECRET env var not set')
    await logCronRun(supabase, 'error', {}, 'CRON_SECRET not configured')
    return NextResponse.json({ ok: false, error: 'Cron not configured' }, { status: 500 })
  }

  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    await logCronRun(supabase, 'unauthorized', {})
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  // ── API key guard ────────────────────────────────────────────────────────────
  if (!process.env.API_FOOTBALL_KEY) {
    const msg = 'API_FOOTBALL_KEY is not configured — skipping standings sync'
    console.warn('[cron/sync-standings]', msg)
    await logCronRun(supabase, 'skipped', { reason: msg })
    return NextResponse.json({ ok: false, error: msg }, { status: 200 })
  }

  // ── Run standings sync ────────────────────────────────────────────────────────
  let result: Awaited<ReturnType<typeof runStandingsSync>>

  try {
    result = await runStandingsSync(supabase, { dryRun: false })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[cron/sync-standings] unhandled:', msg)
    await logCronRun(supabase, 'error', {}, msg)
    return NextResponse.json({ ok: false, error: 'Standings sync failed', detail: msg }, { status: 500 })
  }

  // ── Log result to cron_runs ───────────────────────────────────────────────────
  const cronStatus = result.ok ? 'success' : result.errors.length > 0 ? 'error' : 'success'
  await logCronRun(
    supabase,
    cronStatus,
    {
      season:         result.season,
      leaguesScanned: result.leaguesScanned,
      apiCallsUsed:   result.apiCallsUsed,
      rowsUpserted:   result.rowsUpserted,
      callsToday:     result.callsToday,
      errorCount:     result.errors.length,
    },
    result.errors.length > 0 ? result.errors.join('; ') : undefined,
  )

  console.log(
    `[cron/sync-standings] ${cronStatus}: ${result.rowsUpserted} rows upserted` +
    `, season=${result.season}, callsToday=${result.callsToday}`,
  )

  return NextResponse.json({
    ok:             result.ok,
    season:         result.season,
    leaguesScanned: result.leaguesScanned,
    apiCallsUsed:   result.apiCallsUsed,
    rowsUpserted:   result.rowsUpserted,
    callsToday:     result.callsToday,
    errors:         result.errors.length > 0 ? result.errors : undefined,
    message:        result.message,
  })
}
