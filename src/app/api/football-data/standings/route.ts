/**
 * GET /api/football-data/standings?competition=PL
 * Read-only. No auth required. Fetches live from football-data.org.
 * Allowed: PL, PD, BL1, SA, FL1
 */

import { type NextRequest, NextResponse } from 'next/server'
import { ProxyAgent, fetch as undiciF }   from 'undici'

const ALLOWED = new Set(['PL', 'PD', 'BL1', 'SA', 'FL1', 'WC'])

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

type FdTableEntry = {
  position: number
  team: { id: number; name: string; shortName?: string; tla?: string; crest?: string }
  playedGames: number
  won: number
  draw: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
  form?: string | null
}

export async function GET(req: NextRequest) {
  const competition = (req.nextUrl.searchParams.get('competition') ?? 'PL').toUpperCase()

  if (!ALLOWED.has(competition)) {
    return err(`Unknown competition. Allowed: ${[...ALLOWED].join(', ')}`, 400)
  }

  const fdToken = process.env.FOOTBALL_DATA_TOKEN
  if (!fdToken) return err('FOOTBALL_DATA_TOKEN not configured', 500)

  const url = `https://api.football-data.org/v4/competitions/${competition}/standings`

  try {
    const f   = proxyFetch()
    const res = await f(url, { headers: { 'X-Auth-Token': fdToken } })
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ success: false, httpStatus: res.status, error: text.slice(0, 200) }, { status: 502 })
    }

    const data = await res.json() as { standings?: { type: string; table: FdTableEntry[] }[] }
    const total = data.standings?.find(s => s.type === 'TOTAL') ?? data.standings?.[0]
    const table = (total?.table ?? []).map(e => ({
      position:       e.position,
      teamId:         String(e.team.id),
      teamName:       e.team.name,
      teamShortName:  e.team.tla ?? e.team.shortName ?? e.team.name.slice(0, 3).toUpperCase(),
      crest:          e.team.crest ?? null,
      played:         e.playedGames,
      won:            e.won,
      draw:           e.draw,
      lost:           e.lost,
      goalsFor:       e.goalsFor,
      goalsAgainst:   e.goalsAgainst,
      goalDifference: e.goalDifference,
      points:         e.points,
      form:           e.form ?? null,
    }))

    return NextResponse.json({ success: true, competition, count: table.length, table })
  } catch (e) {
    return err(`Request failed: ${e instanceof Error ? e.message : String(e)}`, 500)
  }
}
