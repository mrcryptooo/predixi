/**
 * POST /api/admin/sync-results
 *
 * Admin-only smart sync. Fetches current status/scores from football APIs
 * for matches that are not yet finished or are missing scores, within a
 * configurable kickoff window. Updates matches table only — no settlement.
 *
 * Auth:   x-admin-key header vs ADMIN_SETTLEMENT_KEY env var
 * APIs:   football-data.org (fd- prefix)  →  FOOTBALL_DATA_TOKEN
 *         api-football       (apf- prefix) →  API_FOOTBALL_KEY
 *
 * Request body (all optional — safe defaults shown):
 *   {
 *     "daysBack":    number   // how far back to scan (default 1, max 60)
 *     "daysForward": number   // how far forward to scan (default 1, max 7)
 *     "limit":       number   // max candidates to check (default 20, max 100)
 *     "dryRun":      boolean  // true = list candidates, no API calls or DB writes
 *   }
 *
 * To backfill stale past matches (e.g. 30 days of stuck-upcoming fd- matches):
 *   { "daysBack": 30, "daysForward": 1, "limit": 50, "dryRun": true }
 *   then re-run with dryRun:false once the candidate list looks correct.
 *
 * Notes:
 *   - dryRun skips all API calls and DB updates — safe to call anytime
 *   - dryRun:false makes one API call per syncable candidate (watch rate limits)
 *   - Does NOT settle predictions; run auto-settle afterwards
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'
import { normalizeFdStatus, normalizeApfStatus } from '@/lib/football/status'

// ── Limits ────────────────────────────────────────────────────────────────────
const CANDIDATE_LIMIT_DEFAULT  = 20
const CANDIDATE_LIMIT_MAX      = 100
const DAYS_BACK_DEFAULT        = 1
const DAYS_BACK_MAX            = 60    // covers ~2 months of stale matches
const DAYS_FORWARD_DEFAULT     = 1
const DAYS_FORWARD_MAX         = 7     // no need to look far ahead

type ApiResult =
  | { status: string; homeScore: number | null; awayScore: number | null }
  | { error: string; rateLimit?: boolean }

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

function inferOutcome(home: number, away: number): 'H' | 'D' | 'A' {
  return home > away ? 'H' : away > home ? 'A' : 'D'
}

// ── football-data.org ──────────────────────────────────────────────────────────

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

// ── api-football (api-sports.io) ───────────────────────────────────────────────

async function fetchApfFixture(numericId: string, apiKey: string): Promise<ApiResult> {
  const url = `https://v3.football.api-sports.io/fixtures?id=${numericId}`
  try {
    const res = await fetch(url, { headers: { 'x-apisports-key': apiKey } })
    if (res.status === 429) return { error: 'Rate limit exceeded', rateLimit: true }
    if (!res.ok)            return { error: `HTTP ${res.status}` }
    const data = await res.json() as {
      response?: Array<{
        fixture: { status: { short: string } }
        goals:   { home: number | null; away: number | null }
      }>
    }
    const fixture = data.response?.[0]
    if (!fixture) return { error: 'No data returned' }
    return {
      status:    normalizeApfStatus(fixture.fixture.status.short),
      homeScore: fixture.goals.home,
      awayScore: fixture.goals.away,
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

// ── Route ──────────────────────────────────────────────────────────────────────

type UpdatedMatch = {
  matchId:   string
  homeTeam:  string
  awayTeam:  string
  status:    string
  score:     string
  outcome:   string | null
}

type DryCandidate = {
  matchId:       string
  homeTeam:      string
  awayTeam:      string
  kickoff:       string
  currentStatus: string
  currentScore:  string | null
  apiPrefix:     'fd' | 'apf' | 'mock'
  canSync:       boolean
}

export async function POST(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const adminKey = process.env.ADMIN_SETTLEMENT_KEY
  if (!adminKey) return err('Admin key not configured', 500)
  if (req.headers.get('x-admin-key') !== adminKey) return err('Unauthorized', 401)

  // ── Parse body (all fields optional — safe defaults apply) ─────────────────
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* empty body is valid — use defaults */ }

  const daysBack    = Math.min(
    Math.max(0, Math.floor(typeof body.daysBack    === 'number' ? body.daysBack    : DAYS_BACK_DEFAULT)),
    DAYS_BACK_MAX,
  )
  const daysForward = Math.min(
    Math.max(0, Math.floor(typeof body.daysForward === 'number' ? body.daysForward : DAYS_FORWARD_DEFAULT)),
    DAYS_FORWARD_MAX,
  )
  const limit       = Math.min(
    Math.max(1, Math.floor(typeof body.limit       === 'number' ? body.limit       : CANDIDATE_LIMIT_DEFAULT)),
    CANDIDATE_LIMIT_MAX,
  )
  const dryRun      = body.dryRun === true

  const fdToken  = process.env.FOOTBALL_DATA_TOKEN
  const apfKey   = process.env.API_FOOTBALL_KEY

  const supabase = getServerSupabaseClient()

  // ── Candidate window ────────────────────────────────────────────────────────
  const now  = new Date()
  const from = new Date(now); from.setUTCDate(from.getUTCDate() - daysBack)
  const to   = new Date(now); to.setUTCDate(to.getUTCDate() + daysForward)

  // Shared window metadata attached to every response
  const windowMeta = {
    daysBack,
    daysForward,
    limit,
    windowFrom: from.toISOString().slice(0, 10),
    windowTo:   to.toISOString().slice(0, 10),
  }

  const { data: candidates, error: queryErr } = await supabase
    .from('matches')
    .select('id, home_team_name, away_team_name, status, home_score, away_score, kickoff')
    .or('status.neq.finished,home_score.is.null,away_score.is.null')
    .gte('kickoff', from.toISOString())
    .lte('kickoff', to.toISOString())
    .order('kickoff', { ascending: true })
    .limit(limit)

  if (queryErr) {
    return err(`Failed to query candidates: ${queryErr.message}`, 500)
  }

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({
      success: true, dryRun, ...windowMeta,
      scanned: 0, apiCallsUsed: 0,
      updated: 0, skipped: 0, errors: [],
      updatedMatches: [],
      message: 'No candidates in window.',
    })
  }

  // ── dryRun: return candidate list — no API calls, no DB writes ───────────────
  if (dryRun) {
    const dryCandidates: DryCandidate[] = candidates.map(m => {
      const id      = m.id as string
      const prefix  = id.startsWith('fd-')  ? 'fd'
                    : id.startsWith('apf-') ? 'apf'
                    : 'mock'
      const canSync = (prefix === 'fd'  && !!fdToken)
                   || (prefix === 'apf' && !!apfKey)
      return {
        matchId:       id,
        homeTeam:      m.home_team_name as string,
        awayTeam:      m.away_team_name as string,
        kickoff:       m.kickoff as string,
        currentStatus: m.status as string,
        currentScore:  m.home_score !== null && m.away_score !== null
          ? `${m.home_score as number}–${m.away_score as number}`
          : null,
        apiPrefix: prefix as DryCandidate['apiPrefix'],
        canSync,
      }
    })

    const syncable = dryCandidates.filter(c => c.canSync).length
    return NextResponse.json({
      success:    true,
      dryRun:     true,
      ...windowMeta,
      scanned:    candidates.length,
      syncable,
      candidates: dryCandidates,
      message:    `${candidates.length} candidate(s) in window — ${syncable} syncable via API. Run with dryRun:false to fetch live results.`,
    })
  }

  // ── Process each candidate ─────────────────────────────────────────────────
  let apiCallsUsed    = 0
  let updated         = 0
  let skipped         = 0
  const errors:        string[]       = []
  const updatedMatches: UpdatedMatch[] = []
  let rateLimitHit    = false

  for (const match of candidates) {
    const id = match.id as string

    // Determine API from ID prefix
    const isFd  = id.startsWith('fd-')
    const isApf = id.startsWith('apf-')

    if (!isFd && !isApf) {
      skipped++
      errors.push(`${id}: unknown ID prefix — cannot determine API source`)
      continue
    }

    if (isFd && !fdToken) {
      skipped++
      errors.push(`${id}: FOOTBALL_DATA_TOKEN not configured`)
      continue
    }

    if (isApf && !apfKey) {
      skipped++
      errors.push(`${id}: API_FOOTBALL_KEY not configured`)
      continue
    }

    if (rateLimitHit) {
      skipped++
      errors.push(`${id}: skipped — rate limit hit earlier`)
      continue
    }

    // Fetch from API
    const numericId = isFd ? id.slice(3) : id.slice(4)
    const result: ApiResult = isFd
      ? await fetchFdMatch(numericId, fdToken!)
      : await fetchApfFixture(numericId, apfKey!)

    apiCallsUsed++

    if ('error' in result) {
      if (result.rateLimit) rateLimitHit = true
      errors.push(`${id}: ${result.error}`)
      skipped++
      continue
    }

    // Build update payload — only write fields that changed
    const newStatus    = result.status
    const newHome      = result.homeScore
    const newAway      = result.awayScore
    const newOutcome   = (newStatus === 'finished' && newHome !== null && newAway !== null)
      ? inferOutcome(newHome, newAway)
      : null

    const noChange =
      match.status    === newStatus  &&
      match.home_score === newHome   &&
      match.away_score === newAway

    if (noChange) {
      skipped++
      continue
    }

    const patch: Record<string, unknown> = {
      status:     newStatus,
      home_score: newHome,
      away_score: newAway,
      updated_at: new Date().toISOString(),
    }
    if (newOutcome !== null) patch.actual_outcome = newOutcome

    const { error: updateErr } = await supabase
      .from('matches')
      .update(patch)
      .eq('id', id)

    if (updateErr) {
      errors.push(`${id}: DB update failed — ${updateErr.message}`)
      skipped++
      continue
    }

    updated++
    updatedMatches.push({
      matchId:  id,
      homeTeam: match.home_team_name as string,
      awayTeam: match.away_team_name as string,
      status:   newStatus,
      score:    newHome !== null && newAway !== null ? `${newHome}–${newAway}` : '–',
      outcome:  newOutcome,
    })
  }

  return NextResponse.json({
    success:       errors.length === 0,
    dryRun:        false,
    ...windowMeta,
    scanned:       candidates.length,
    apiCallsUsed,
    updated,
    skipped,
    errors:        errors.length > 0 ? errors : undefined,
    updatedMatches,
  })
}
