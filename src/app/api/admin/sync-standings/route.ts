/**
 * POST /api/admin/sync-standings
 *
 * Fetches current league standings from API-Football and upserts them into
 * the `standings` table for all configured leagues.
 *
 * Auth:   x-admin-key header vs ADMIN_SETTLEMENT_KEY
 * Logic:  Delegates to runStandingsSync() in src/lib/football/syncStandings.ts
 *         (shared with the daily cron at GET /api/cron/sync-standings)
 *
 * Request body (all optional):
 *   {
 *     "dryRun":  boolean   // true = call API, log results, no DB writes
 *     "season":  number    // override APF_CURRENT_SEASON for this request
 *   }
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'
import { runStandingsSync }               from '@/lib/football/syncStandings'
import { APF_CURRENT_SEASON }             from '@/lib/football/apiFootballConfig'

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
  const season = typeof body.season === 'number' && Number.isFinite(body.season)
    ? Math.floor(body.season as number)
    : APF_CURRENT_SEASON

  if (!process.env.API_FOOTBALL_KEY) {
    return err('API_FOOTBALL_KEY is not configured', 500)
  }

  // ── Delegate to shared sync logic ─────────────────────────────────────────────
  const supabase = getServerSupabaseClient()
  const result   = await runStandingsSync(supabase, { season, dryRun })

  return NextResponse.json(result, {
    status: result.ok ? 200 : 502,
  })
}
