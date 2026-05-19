/**
 * POST /api/football-data/sync-matches
 * Admin-only. Fetches matches from football-data.org and upserts into matches table.
 * Auth: x-admin-secret = SETTLEMENT_ADMIN_SECRET
 * Body (single):  { competition?, dateFrom?, dateTo? }
 * Body (multi):   { competitions?: string[], dateFrom?, dateTo? }
 * Max 2 competitions per request. Max 20 matches per competition.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { ProxyAgent, fetch as undiciF }   from 'undici'
import { getServerSupabaseClient }         from '@/lib/supabase/server'

const ALLOWED = new Set(['PL','PD','BL1','SA','FL1','WC','CL'])
const MAX_COMPETITIONS = 2
const MAX_MATCHES = 20

function proxyFetch() {
  const p = process.env.HTTPS_PROXY ?? process.env.https_proxy ?? process.env.HTTP_PROXY ?? process.env.http_proxy
  if (!p) return fetch
  const d = new ProxyAgent(p)
  return (url: string, init?: RequestInit) =>
    undiciF(url, { ...init, dispatcher: d } as Parameters<typeof undiciF>[1]) as unknown as Promise<Response>
}

function err(msg: string, status: number) {
  return NextResponse.json({ success: false, error: msg }, { status })
}

function mapStatus(s: string): string {
  if (s === 'FINISHED')                                   return 'finished'
  if (['IN_PLAY','PAUSED','HALFTIME'].includes(s))        return 'live'
  if (['POSTPONED','SUSPENDED','CANCELLED'].includes(s))  return 'postponed'
  return 'upcoming'
}

function computeOutcome(h: number|null, a: number|null, status: string): string|null {
  if (status !== 'finished' || h === null || a === null) return null
  return h > a ? 'H' : a > h ? 'A' : 'D'
}

function short(name: string, shortName?: string): string {
  if (shortName) return shortName.slice(0, 3).toUpperCase()
  return name.replace(/^(FC|CF|AS|AC|RC|CD|SD|UD|RB)\s+/i,'').slice(0,3).toUpperCase()
}

type FdMatch = {
  id: number
  utcDate: string
  status: string
  matchday: number | null
  homeTeam: { id: number; name: string; shortName?: string; crest?: string | null }
  awayTeam: { id: number; name: string; shortName?: string; crest?: string | null }
  score: { fullTime: { home: number|null; away: number|null } }
  venue?: string | null
}

type CompResult = {
  competition: string
  fetched: number
  inserted: number
  updated: number
  errors?: string[]
  message?: string
}

async function syncOne(
  competition: string,
  dateFrom: string,
  dateTo: string,
  fdToken: string,
): Promise<CompResult> {
  const url = `https://api.football-data.org/v4/competitions/${competition}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`
  let matches: FdMatch[] = []

  try {
    const f   = proxyFetch()
    const res = await f(url, { headers: { 'X-Auth-Token': fdToken } })
    if (!res.ok) {
      const text = await res.text()
      return { competition, fetched: 0, inserted: 0, updated: 0, errors: [`HTTP ${res.status}: ${text.slice(0,120)}`] }
    }
    const data = await res.json() as { matches?: FdMatch[] }
    matches = (data.matches ?? []).slice(0, MAX_MATCHES)
  } catch (e) {
    return { competition, fetched: 0, inserted: 0, updated: 0,
      errors: [`Request failed: ${e instanceof Error ? e.message : String(e)}`] }
  }

  if (matches.length === 0) {
    return { competition, fetched: 0, inserted: 0, updated: 0, message: 'No matches for this date range.' }
  }

  const supabase = getServerSupabaseClient()
  let inserted = 0, updated = 0
  const errors: string[] = []

  for (const m of matches) {
    const id     = `fd-${m.id}`
    const status = mapStatus(m.status)
    const row = {
      id,
      league_id:        competition,
      home_team_id:     String(m.homeTeam.id),
      home_team_name:   m.homeTeam.name,
      home_team_short:  short(m.homeTeam.name, m.homeTeam.shortName),
      home_team_crest:  m.homeTeam.crest ?? null,
      away_team_id:     String(m.awayTeam.id),
      away_team_name:   m.awayTeam.name,
      away_team_short:  short(m.awayTeam.name, m.awayTeam.shortName),
      away_team_crest:  m.awayTeam.crest ?? null,
      kickoff:          m.utcDate,
      status,
      home_score:       m.score.fullTime.home,
      away_score:       m.score.fullTime.away,
      matchday:         m.matchday ?? null,
      venue:            m.venue ?? null,
      actual_outcome:   computeOutcome(m.score.fullTime.home, m.score.fullTime.away, status),
    }

    const { data: ex } = await supabase.from('matches').select('id').eq('id', id).maybeSingle()
    const { error: uErr } = await supabase.from('matches').upsert(row, { onConflict: 'id' })
    if (uErr) errors.push(`${id}: ${uErr.message}`)
    else ex ? updated++ : inserted++
  }

  return { competition, fetched: matches.length, inserted, updated,
    errors: errors.length ? errors : undefined }
}

export async function POST(req: NextRequest) {
  const secret = process.env.SETTLEMENT_ADMIN_SECRET
  if (!secret) return err('Admin secret not configured', 500)
  if (req.headers.get('x-admin-secret') !== secret) return err('Unauthorized', 401)

  const fdToken = process.env.FOOTBALL_DATA_TOKEN
  if (!fdToken) return err('FOOTBALL_DATA_TOKEN not configured', 500)

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* use defaults */ }

  const dateFrom = String(body.dateFrom ?? '2026-05-13')
  const dateTo   = String(body.dateTo   ?? '2026-05-19')

  // Resolve competition list — support both single and multi
  let competitions: string[]
  if (Array.isArray(body.competitions)) {
    competitions = (body.competitions as unknown[]).map(c => String(c).toUpperCase())
  } else {
    competitions = [String(body.competition ?? 'PL').toUpperCase()]
  }

  // Validate
  const invalid = competitions.filter(c => !ALLOWED.has(c))
  if (invalid.length) return err(`Unknown competition(s): ${invalid.join(', ')}. Allowed: ${[...ALLOWED].join(', ')}`, 400)
  if (competitions.length > MAX_COMPETITIONS) return err(`Max ${MAX_COMPETITIONS} competitions per request.`, 400)

  // Run sequentially — respect rate limits
  const results: CompResult[] = []
  for (const comp of competitions) {
    results.push(await syncOne(comp, dateFrom, dateTo, fdToken))
  }

  const totalInserted = results.reduce((s, r) => s + r.inserted, 0)
  const totalUpdated  = results.reduce((s, r) => s + r.updated,  0)
  const totalFetched  = results.reduce((s, r) => s + r.fetched,  0)
  const anyErrors     = results.some(r => r.errors?.length)

  return NextResponse.json({
    success: !anyErrors,
    dateFrom, dateTo,
    totalFetched, totalInserted, totalUpdated,
    results,
  })
}
