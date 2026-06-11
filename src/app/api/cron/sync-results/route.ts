/**
 * GET /api/cron/sync-results
 *
 * Vercel Cron — fetches current scores/statuses from football APIs for matches
 * that are not yet finished or are missing scores within a 2-day lookback window.
 * Schedule: 0 23 * * *  (23:00 UTC — after World Cup evening matches finish)
 *
 * Auth:  Authorization: Bearer <CRON_SECRET>
 *        Vercel sets this header automatically from the CRON_SECRET env var.
 *
 * Does NOT settle predictions — auto-settle runs at 23:30 UTC after this.
 */

import { type NextRequest, NextResponse }         from 'next/server'
import { getServerSupabaseClient }               from '@/lib/supabase/server'
import { normalizeFdStatus, normalizeApfStatus } from '@/lib/football/status'
import { fetchApfFixtures }                      from '@/lib/football/apiFootball'

const DAYS_BACK    = 2   // catch matches from up to 2 days ago still pending
const DAYS_FORWARD = 0   // no need to look ahead — sync active/recent only
const LIMIT        = 30

type ApiResult =
  | { status: string; homeScore: number | null; awayScore: number | null }
  | { error: string; rateLimit?: boolean }

function inferOutcome(home: number, away: number): 'H' | 'D' | 'A' {
  return home > away ? 'H' : away > home ? 'A' : 'D'
}

async function fetchFdMatch(numericId: string, token: string): Promise<ApiResult> {
  const url = `https://api.football-data.org/v4/matches/${numericId}`
  try {
    const res = await fetch(url, { headers: { 'X-Auth-Token': token } })
    if (res.status === 429) return { error: 'Rate limit exceeded', rateLimit: true }
    if (!res.ok)            return { error: `HTTP ${res.status}` }
    const data = await res.json() as {
      status: string
      score:  { fullTime: { home: number | null; away: number | null } }
    }
    return {
      status:    normalizeFdStatus(data.status),
      homeScore: data.score.fullTime.home,
      awayScore: data.score.fullTime.away,
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron/sync-results] CRON_SECRET env var not set')
    return NextResponse.json({ success: false, error: 'Cron secret not configured' }, { status: 500 })
  }
  const authHeader = req.headers.get('authorization') ?? ''
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const fdToken  = process.env.FOOTBALL_DATA_TOKEN
  const apfKey   = process.env.API_FOOTBALL_KEY
  const supabase = getServerSupabaseClient()

  const now  = new Date()
  const from = new Date(now); from.setUTCDate(from.getUTCDate() - DAYS_BACK)
  const to   = new Date(now); to.setUTCDate(to.getUTCDate() + DAYS_FORWARD)

  const { data: candidates, error: queryErr } = await supabase
    .from('matches')
    .select('id, home_team_name, away_team_name, status, home_score, away_score, kickoff')
    .or('status.neq.finished,home_score.is.null,away_score.is.null')
    .gte('kickoff', from.toISOString())
    .lte('kickoff', to.toISOString())
    .order('kickoff', { ascending: true })
    .limit(LIMIT)

  if (queryErr) {
    console.error('[cron/sync-results] query error:', queryErr.message)
    return NextResponse.json({ success: false, error: queryErr.message }, { status: 500 })
  }

  if (!candidates || candidates.length === 0) {
    console.info('[cron/sync-results] no candidates in window')
    return NextResponse.json({ success: true, scanned: 0, updated: 0 })
  }

  let updated      = 0
  let skipped      = 0
  let apiCalls     = 0
  let rateLimitHit = false
  let apfBudgetHit = false
  const errors: string[] = []

  for (const match of candidates) {
    const id    = match.id as string
    const isFd  = id.startsWith('fd-')
    const isApf = id.startsWith('apf-')

    if (!isFd && !isApf)       { skipped++; continue }
    if (isFd  && !fdToken)     { skipped++; errors.push(`${id}: FOOTBALL_DATA_TOKEN missing`); continue }
    if (isApf && !apfKey)      { skipped++; errors.push(`${id}: API_FOOTBALL_KEY missing`);   continue }
    if (rateLimitHit)          { skipped++; continue }
    if (apfBudgetHit && isApf) { skipped++; continue }

    const numericId = isFd ? id.slice(3) : id.slice(4)
    let result: ApiResult

    if (isFd) {
      result = await fetchFdMatch(numericId, fdToken!)
    } else {
      const apfResult = await fetchApfFixtures({ id: parseInt(numericId, 10) })
      if (!apfResult.ok) {
        if (apfResult.budgetExceeded) {
          apfBudgetHit = true
          result = { error: 'APF budget cap reached' }
        } else if (apfResult.rateLimitHit) {
          result = { error: 'Rate limit exceeded', rateLimit: true }
        } else {
          result = { error: apfResult.error }
        }
      } else {
        const fx = apfResult.data[0]
        result = fx
          ? {
              status:    normalizeApfStatus(fx.fixture.status.short),
              homeScore: fx.goals.home,
              awayScore: fx.goals.away,
            }
          : { error: 'No fixture data returned' }
      }
    }

    apiCalls++

    if ('error' in result) {
      if (result.rateLimit) rateLimitHit = true
      errors.push(`${id}: ${result.error}`)
      skipped++
      continue
    }

    const { status: newStatus, homeScore: newHome, awayScore: newAway } = result
    const newOutcome = (newStatus === 'finished' && newHome !== null && newAway !== null)
      ? inferOutcome(newHome, newAway)
      : null

    const noChange =
      match.status     === newStatus &&
      match.home_score === newHome   &&
      match.away_score === newAway

    if (noChange) { skipped++; continue }

    const patch: Record<string, unknown> = {
      status:     newStatus,
      home_score: newHome,
      away_score: newAway,
      updated_at: new Date().toISOString(),
    }
    if (newOutcome !== null) patch.actual_outcome = newOutcome

    const { error: updateErr } = await supabase.from('matches').update(patch).eq('id', id)
    if (updateErr) {
      errors.push(`${id}: DB update failed — ${updateErr.message}`)
      skipped++
      continue
    }

    updated++
  }

  console.info(`[cron/sync-results] scanned=${candidates.length} updated=${updated} skipped=${skipped} apiCalls=${apiCalls}`)
  if (errors.length > 0) console.warn('[cron/sync-results] errors:', errors)

  return NextResponse.json({
    success:  errors.length === 0 || updated > 0,
    scanned:  candidates.length,
    apiCalls,
    updated,
    skipped,
    ...(errors.length > 0 && { errors }),
  })
}
