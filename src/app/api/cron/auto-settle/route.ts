/**
 * GET /api/cron/auto-settle
 *
 * Vercel Cron endpoint — triggered daily at 03:00 UTC via vercel.json.
 * Also triggered every 5 minutes by the Cloudflare Worker during WC match days.
 * Schedule: 0 3 * * *
 * Scans finished matches and settles unsettled predictions automatically.
 *
 * Auth:  Authorization: Bearer <CRON_SECRET>
 *        Vercel sets this header automatically from the CRON_SECRET env var.
 *        Do not use ADMIN_SETTLEMENT_KEY here — cron uses its own secret.
 *
 * Always runs as a real settlement (dryRun=false, limit=25).
 * Idempotent — safe to call multiple times.
 *
 * Logs every run to cron_runs (route, status, summary, error, ran_at).
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'
import { findQualifiedMatches, runAutoSettle } from '@/lib/auto-settle'
import { logCronRun }                     from '@/lib/cron/logCronRun'

const CRON_LIMIT  = 100
const CRON_ROUTE  = '/api/cron/auto-settle'

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function GET(req: NextRequest) {
  // ── Auth: Bearer CRON_SECRET ───────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron/auto-settle] CRON_SECRET env var not set')
    return err('Cron not configured on this server', 500)
  }

  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return err('Unauthorized', 401)
  }

  // ── Run settlement ─────────────────────────────────────────────────────────
  const supabase = getServerSupabaseClient()

  const { qualified, scanned, error: scanErr } = await findQualifiedMatches(supabase, CRON_LIMIT)

  if (scanErr) {
    console.error('[cron/auto-settle] scan:', scanErr)
    await logCronRun({ supabase, route: CRON_ROUTE, status: 'error', error: `scan: ${scanErr}` })
    return err('Failed to fetch finished matches', 500)
  }

  if (scanned === 0 || qualified.length === 0) {
    // No-op: don't log to cron_runs — these happen every 5 min from CF Worker
    // and would produce hundreds of noise rows per day.
    return NextResponse.json({
      success:  true,
      scanned:  0,
      settled:  0,
      message:  'No finished unsettled matches found.',
    })
  }

  const result = await runAutoSettle(supabase, qualified, scanned)

  if (result.errors.length > 0) {
    console.error('[cron/auto-settle] errors:', result.errors)
  }

  // ── Log to cron_runs (only when there was actual work to do) ───────────────
  await logCronRun({
    supabase,
    route:   CRON_ROUTE,
    status:  result.success ? 'success' : 'error',
    summary: {
      scanned:          result.scanned,
      settledMatches:   result.settledMatches,
      totalPredictions: result.totalPredictions,
      totalCorrect:     result.totalCorrect,
      totalXPAwarded:   result.totalXPAwarded,
    },
    error: result.errors.length > 0 ? result.errors.join('; ') : null,
  })

  return NextResponse.json({
    success:          result.success,
    scanned:          result.scanned,
    settledMatches:   result.settledMatches,
    totalPredictions: result.totalPredictions,
    totalCorrect:     result.totalCorrect,
    totalXPAwarded:   result.totalXPAwarded,
    errors:           result.errors.length > 0 ? result.errors : undefined,
  })
}
