/**
 * GET /api/admin/health
 *
 * Admin-only pipeline health check.
 * Returns structured status for database, fixtures, cron jobs, XP pipeline,
 * proof pipeline, and environment readiness.
 *
 * Auth:   x-admin-key header vs ADMIN_SETTLEMENT_KEY env var
 * Safety: read-only — no writes, no mutations, no cron execution.
 *         Env vars are reported as booleans only — values never exposed.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'

// ─────────────────────────────────────────────────────────────────────────────
// Response types
// ─────────────────────────────────────────────────────────────────────────────

type HealthState = 'healthy' | 'warning' | 'error' | 'unknown'

type DatabaseCheck = {
  state:       HealthState
  reachable:   boolean
  latencyMs?:  number
  error?:      string
}

type FixturesCheck = {
  state:            HealthState
  upcomingCount:    number
  latestKickoff?:   string | null   // ISO timestamp of next scheduled match
  oldestUpcoming?:  string | null
  lastSyncedAt?:    string | null   // inserted_at of most recently inserted match row
  error?:           string
}

type CronJobStatus = {
  route:      string
  lastRanAt:  string | null
  status:     string | null
  ageMinutes: number | null         // minutes since last run; null = never run
  stale:      boolean               // true if > 30 min since last run (or never)
}

type CronCheck = {
  state:   HealthState
  jobs:    CronJobStatus[]
  error?:  string
}

type XpPipelineCheck = {
  state:              HealthState
  latestEventAt?:     string | null
  totalEventCount?:   number
  leaderboardRows?:   number
  error?:             string
}

type ProofPipelineCheck = {
  state:                  HealthState
  recentWithHash?:        number   // predictions with commitment_hash in last 100 rows
  recentWithoutHash?:     number   // predictions without commitment_hash in last 100 rows
  wcWithHash?:            number
  dailyXiWithHash?:       number
  error?:                 string
}

type EnvCheck = {
  state:                          HealthState
  FOOTBALL_DATA_TOKEN:            boolean
  CRON_SECRET:                    boolean
  ADMIN_SETTLEMENT_KEY:           boolean
  NEXT_PUBLIC_SUPABASE_URL:       boolean
  NEXT_PUBLIC_SUPABASE_ANON_KEY:  boolean
  SUPABASE_SERVICE_ROLE_KEY:      boolean
}

type HealthResponse = {
  success:      boolean
  generatedAt:  string
  checks: {
    database:      DatabaseCheck
    fixtures:      FixturesCheck
    cron:          CronCheck
    xpPipeline:    XpPipelineCheck
    proofPipeline: ProofPipelineCheck
    env:           EnvCheck
  }
  error?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

function errResponse(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

const CRON_ROUTES = [
  '/api/cron/sync-fixtures',
  '/api/cron/sync-results',
  '/api/cron/score-daily-xi',
  '/api/cron/auto-settle',
] as const

// ─────────────────────────────────────────────────────────────────────────────
// Individual checks
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkDatabase(supabase: ReturnType<typeof import('@/lib/supabase/server').getServerSupabaseClient>): Promise<DatabaseCheck> {
  const t0 = Date.now()
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1)
    const latencyMs = Date.now() - t0
    if (error) {
      return { state: 'error', reachable: false, latencyMs, error: error.message }
    }
    return {
      state:      latencyMs > 2000 ? 'warning' : 'healthy',
      reachable:  true,
      latencyMs,
    }
  } catch (e) {
    return { state: 'error', reachable: false, error: String(e) }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkFixtures(supabase: ReturnType<typeof import('@/lib/supabase/server').getServerSupabaseClient>): Promise<FixturesCheck> {
  try {
    // Count upcoming matches
    const { count: upcomingCount, error: countErr } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'upcoming')

    if (countErr) {
      return { state: 'error', upcomingCount: 0, error: countErr.message }
    }

    // Latest kickoff (next match)
    const { data: nextMatch } = await supabase
      .from('matches')
      .select('kickoff_time, inserted_at')
      .eq('status', 'upcoming')
      .order('kickoff_time', { ascending: true })
      .limit(1)
      .single()

    // Most recently inserted match (freshness indicator)
    const { data: latestInserted } = await supabase
      .from('matches')
      .select('inserted_at')
      .order('inserted_at', { ascending: false })
      .limit(1)
      .single()

    const count = upcomingCount ?? 0

    let state: HealthState = 'healthy'
    if (count === 0) state = 'warning'

    return {
      state,
      upcomingCount:  count,
      latestKickoff:  nextMatch?.kickoff_time  ?? null,
      lastSyncedAt:   latestInserted?.inserted_at ?? null,
    }
  } catch (e) {
    return { state: 'error', upcomingCount: 0, error: String(e) }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkCron(supabase: ReturnType<typeof import('@/lib/supabase/server').getServerSupabaseClient>): Promise<CronCheck> {
  try {
    const jobs: CronJobStatus[] = []
    const now = Date.now()

    for (const route of CRON_ROUTES) {
      const { data } = await supabase
        .from('cron_runs')
        .select('ran_at, status')
        .eq('route', route)
        .order('ran_at', { ascending: false })
        .limit(1)
        .single()

      const lastRanAt  = data?.ran_at  ?? null
      const status     = data?.status  ?? null
      const ageMinutes = lastRanAt
        ? Math.round((now - new Date(lastRanAt).getTime()) / 60_000)
        : null

      jobs.push({
        route,
        lastRanAt,
        status,
        ageMinutes,
        stale: ageMinutes === null || ageMinutes > 30,
      })
    }

    const anyError  = jobs.some(j => j.status === 'error')
    const allStale  = jobs.every(j => j.stale)
    const someStale = jobs.some(j => j.stale)

    const state: HealthState =
      anyError  ? 'error'   :
      allStale  ? 'warning' :
      someStale ? 'warning' :
      'healthy'

    return { state, jobs }
  } catch (e) {
    return { state: 'error', jobs: [], error: String(e) }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkXpPipeline(supabase: ReturnType<typeof import('@/lib/supabase/server').getServerSupabaseClient>): Promise<XpPipelineCheck> {
  try {
    // Latest XP event
    const { data: latestEvent } = await supabase
      .from('xp_events')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Total event count
    const { count: totalCount } = await supabase
      .from('xp_events')
      .select('*', { count: 'exact', head: true })

    // Leaderboard row count
    const { count: lbCount } = await supabase
      .from('leaderboard_stats')
      .select('*', { count: 'exact', head: true })

    const latestEventAt = latestEvent?.created_at ?? null
    const ageMs = latestEventAt ? Date.now() - new Date(latestEventAt).getTime() : null
    const ageDays = ageMs !== null ? ageMs / 86_400_000 : null

    const state: HealthState =
      (totalCount ?? 0) === 0 ? 'warning' :
      ageDays !== null && ageDays > 3 ? 'warning' :
      'healthy'

    return {
      state,
      latestEventAt,
      totalEventCount: totalCount ?? 0,
      leaderboardRows: lbCount    ?? 0,
    }
  } catch (e) {
    return { state: 'error', error: String(e) }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkProofPipeline(supabase: ReturnType<typeof import('@/lib/supabase/server').getServerSupabaseClient>): Promise<ProofPipelineCheck> {
  try {
    // Predictions: last 100 rows — count with/without commitment_hash
    const { data: predRows } = await supabase
      .from('predictions')
      .select('commitment_hash')
      .order('placed_at', { ascending: false })
      .limit(100)

    const predWithHash    = (predRows ?? []).filter(r => r.commitment_hash).length
    const predWithoutHash = (predRows ?? []).filter(r => !r.commitment_hash).length

    // WC predictions: count with hash
    const { count: wcWithHash } = await supabase
      .from('wc_predictions')
      .select('*', { count: 'exact', head: true })
      .not('commitment_hash', 'is', null)

    // Daily XI entries: count with hash
    const { count: dailyXiWithHash } = await supabase
      .from('daily_xi_entries')
      .select('*', { count: 'exact', head: true })
      .not('commitment_hash', 'is', null)

    // State: warning if many recent predictions lack hashes (shouldn't happen post-Step 6)
    const missingRatio = (predRows ?? []).length > 0
      ? predWithoutHash / (predRows ?? []).length
      : 0

    const state: HealthState =
      missingRatio > 0.5 ? 'warning' : 'healthy'

    return {
      state,
      recentWithHash:    predWithHash,
      recentWithoutHash: predWithoutHash,
      wcWithHash:        wcWithHash    ?? 0,
      dailyXiWithHash:   dailyXiWithHash ?? 0,
    }
  } catch (e) {
    return { state: 'error', error: String(e) }
  }
}

function checkEnv(): EnvCheck {
  const has = (key: string) => {
    const v = process.env[key]
    return typeof v === 'string' && v.trim().length > 0
  }

  const ftConfigured   = has('FOOTBALL_DATA_TOKEN')
  const cronConfigured = has('CRON_SECRET')
  const adminConfigured = has('ADMIN_SETTLEMENT_KEY')
  const supaUrlConfigured  = has('NEXT_PUBLIC_SUPABASE_URL')
  const supaAnonConfigured = has('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const supaRoleConfigured = has('SUPABASE_SERVICE_ROLE_KEY')

  const allCore = supaUrlConfigured && supaAnonConfigured && supaRoleConfigured
  const allOps  = ftConfigured && cronConfigured && adminConfigured

  const state: HealthState =
    !allCore ? 'error' :
    !allOps  ? 'warning' :
    'healthy'

  return {
    state,
    FOOTBALL_DATA_TOKEN:           ftConfigured,
    CRON_SECRET:                   cronConfigured,
    ADMIN_SETTLEMENT_KEY:          adminConfigured,
    NEXT_PUBLIC_SUPABASE_URL:      supaUrlConfigured,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supaAnonConfigured,
    SUPABASE_SERVICE_ROLE_KEY:     supaRoleConfigured,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const adminKey = process.env.ADMIN_SETTLEMENT_KEY
  if (!adminKey)                                    return errResponse('Admin key not configured', 500)
  if (req.headers.get('x-admin-key') !== adminKey) return errResponse('Unauthorized', 401)

  try {
    const supabase = getServerSupabaseClient()

    // Run all checks in parallel
    const [database, fixtures, cron, xpPipeline, proofPipeline] = await Promise.all([
      checkDatabase(supabase),
      checkFixtures(supabase),
      checkCron(supabase),
      checkXpPipeline(supabase),
      checkProofPipeline(supabase),
    ])

    // Env check is synchronous
    const env = checkEnv()

    const response: HealthResponse = {
      success:     true,
      generatedAt: new Date().toISOString(),
      checks: { database, fixtures, cron, xpPipeline, proofPipeline, env },
    }

    return NextResponse.json(response)
  } catch (e) {
    console.error('[GET /api/admin/health]', e)
    return errResponse('Health check failed: ' + String(e), 500)
  }
}
