/**
 * GET /api/admin/cron-runs?route=/api/cron/sync-fixtures
 *
 * Admin-only. Returns the latest 20 cron_runs rows so automatic cron
 * executions can be verified without Vercel runtime log access.
 *
 * Auth:   x-admin-key header vs ADMIN_SETTLEMENT_KEY env var
 * Query:  route (optional) — filter by cron route path
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function GET(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const adminKey = process.env.ADMIN_SETTLEMENT_KEY
  if (!adminKey)                                    return err('Admin key not configured', 500)
  if (req.headers.get('x-admin-key') !== adminKey) return err('Unauthorized', 401)

  // ── Query params ─────────────────────────────────────────────────────────────
  const routeFilter = req.nextUrl.searchParams.get('route')

  const supabase = getServerSupabaseClient()

  let query = supabase
    .from('cron_runs')
    .select('id, route, status, summary, error, ran_at')
    .order('ran_at', { ascending: false })
    .limit(20)

  if (routeFilter) {
    query = query.eq('route', routeFilter)
  }

  const { data, error } = await query

  if (error) {
    console.error('[GET /api/admin/cron-runs]', error)
    // If table doesn't exist yet (migration not applied), return helpful message
    if (error.code === '42P01') {
      return NextResponse.json({
        success: false,
        error:   'cron_runs table not found — run supabase/add-cron-runs.sql migration first',
      }, { status: 503 })
    }
    return err('Failed to fetch cron runs', 500)
  }

  return NextResponse.json({
    success:  true,
    count:    (data ?? []).length,
    route:    routeFilter ?? 'all',
    cronRuns: (data ?? []).map(r => ({
      id:      r.id,
      route:   r.route,
      status:  r.status,
      summary: r.summary,
      error:   r.error ?? null,
      ranAt:   r.ran_at,
    })),
  })
}
