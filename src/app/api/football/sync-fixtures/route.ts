/**
 * POST /api/football/sync-fixtures
 * Admin-only. Fetches fixtures from API-Football and upserts into matches.
 * Auth: x-admin-secret header = SETTLEMENT_ADMIN_SECRET
 * Body: { league?, season?, next? }  defaults: 140 / 2024 / 1, next capped at 3
 */

import { type NextRequest, NextResponse } from 'next/server'
import { ProxyAgent, fetch as undiciF }   from 'undici'
import { getServerSupabaseClient }         from '@/lib/supabase/server'

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

function mapStatus(s: string) {
  if (['FT','AET','PEN'].includes(s))                           return 'finished'
  if (['1H','2H','HT','ET','BT','P','LIVE'].includes(s))        return 'live'
  if (['PST','CANC','ABD','WO','AWD','INT'].includes(s))        return 'postponed'
  return 'upcoming'
}

function outcome(h: number|null, a: number|null, status: string) {
  if (status !== 'finished' || h === null || a === null) return null
  return h > a ? 'H' : a > h ? 'A' : 'D'
}

function short(name: string) {
  return name.replace(/^(FC|CF|AS|AC|RC|CD|SD|UD|RB|SS|SC)\s+/i,'').slice(0,3).toUpperCase()
}

function matchday(round: string|null) {
  if (!round) return null
  const m = round.match(/(\d+)/)
  return m ? parseInt(m[1],10) : null
}

type Fixture = {
  fixture: { id:number; date:string; venue:{name:string|null}; status:{short:string} }
  league:  { id:number; season:number; round:string }
  teams:   { home:{id:number;name:string}; away:{id:number;name:string} }
  goals:   { home:number|null; away:number|null }
}

export async function POST(req: NextRequest) {
  const secret = process.env.SETTLEMENT_ADMIN_SECRET
  if (!secret) return err('Admin secret not configured', 500)
  if (req.headers.get('x-admin-secret') !== secret) return err('Unauthorized', 401)

  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) return err('API_FOOTBALL_KEY not configured', 500)

  let body: Record<string,unknown> = {}
  try { body = await req.json() } catch { /* use defaults */ }

  const league = Number(body.league ?? 140)
  const season = Number(body.season ?? 2024)
  const next   = Math.min(Number(body.next ?? 1), 3)

  const apfUrl = `https://v3.football.api-sports.io/fixtures?league=${league}&season=${season}&next=${next}`
  let fixtures: Fixture[] = []

  try {
    const f = proxyFetch()
    const res  = await f(apfUrl, { headers: { 'x-apisports-key': apiKey } })
    const data  = await res.json() as { response?:Fixture[]; errors?:unknown }
    const hasErr = Array.isArray(data.errors) ? data.errors.length > 0 : !!data.errors
    if (!res.ok || hasErr) return NextResponse.json({ success:false, httpStatus:res.status, errors:data.errors },{ status:502 })
    fixtures = data.response ?? []
  } catch(e) {
    return err(`API-Football request failed: ${e instanceof Error ? e.message : String(e)}`, 500)
  }

  if (fixtures.length === 0) {
    return NextResponse.json({ success:true, league, season, next, fetched:0, inserted:0, updated:0,
      message:'No fixtures returned — season may be finished or params are incorrect.' })
  }

  const supabase = getServerSupabaseClient()
  let inserted = 0, updated = 0
  const errors: string[] = []

  for (const f of fixtures) {
    const id     = `apf-${f.fixture.id}`
    const status = mapStatus(f.fixture.status.short)
    const row = {
      id,
      league_id:       String(f.league.id),
      home_team_id:    String(f.teams.home.id),
      home_team_name:  f.teams.home.name,
      home_team_short: short(f.teams.home.name),
      away_team_id:    String(f.teams.away.id),
      away_team_name:  f.teams.away.name,
      away_team_short: short(f.teams.away.name),
      kickoff:         f.fixture.date,
      status,
      home_score:      f.goals.home,
      away_score:      f.goals.away,
      matchday:        matchday(f.league.round),
      venue:           f.fixture.venue.name ?? null,
      actual_outcome:  outcome(f.goals.home, f.goals.away, status),
    }

    const { data: ex } = await supabase.from('matches').select('id').eq('id', id).maybeSingle()
    const { error: uErr } = await supabase.from('matches').upsert(row, { onConflict: 'id' })
    if (uErr) errors.push(`${id}: ${uErr.message}`)
    else ex ? updated++ : inserted++
  }

  return NextResponse.json({ success: errors.length === 0, league, season, next,
    fetched: fixtures.length, inserted, updated,
    errors: errors.length ? errors : undefined })
}
