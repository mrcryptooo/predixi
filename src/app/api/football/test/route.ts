/**
 * GET /api/football/test
 *
 * Server-side only. Verifies connectivity to API-Football using API_FOOTBALL_KEY.
 * Calls the /status endpoint which returns account + quota info.
 * Never returns or logs the API key.
 */

import { NextResponse }           from 'next/server'
import { ProxyAgent, fetch as undiciF } from 'undici'

// ─────────────────────────────────────────────────────────────────────────────
// Proxy-aware fetch (same pattern as server.ts — works locally + on Vercel)
// ─────────────────────────────────────────────────────────────────────────────

function buildFetch() {
  const proxyUrl =
    process.env.HTTPS_PROXY ??
    process.env.https_proxy ??
    process.env.HTTP_PROXY  ??
    process.env.http_proxy

  if (!proxyUrl) return fetch

  const dispatcher = new ProxyAgent(proxyUrl)
  return (url: string, init?: RequestInit) =>
    undiciF(url, { ...init, dispatcher } as Parameters<typeof undiciF>[1]) as unknown as Promise<Response>
}

// ─────────────────────────────────────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'API_FOOTBALL_KEY is not configured on this server' },
      { status: 500 }
    )
  }

  try {
    const proxyFetch = buildFetch()
    const res = await proxyFetch('https://v3.football.api-sports.io/status', {
      method:  'GET',
      headers: { 'x-apisports-key': apiKey },
    })

    const data = await res.json() as {
      response?: {
        account?: { firstname: string; lastname: string; email: string }
        requests?: { current: number; limit_day: number }
        subscription?: { plan: string; end: string; active: boolean }
      }
      errors?: unknown
    }

    const hasErrors = Array.isArray(data.errors) ? data.errors.length > 0 : !!data.errors
    if (!res.ok || hasErrors) {
      return NextResponse.json(
        { success: false, provider: 'api-football', httpStatus: res.status, errors: data.errors },
        { status: 502 }
      )
    }

    const r = data.response
    return NextResponse.json({
      success:    true,
      provider:   'api-football',
      httpStatus: res.status,
      account: {
        name:  `${r?.account?.firstname ?? ''} ${r?.account?.lastname ?? ''}`.trim(),
        plan:  r?.subscription?.plan,
        active: r?.subscription?.active,
      },
      quota: {
        usedToday: r?.requests?.current,
        dailyLimit: r?.requests?.limit_day,
        remaining:  (r?.requests?.limit_day ?? 0) - (r?.requests?.current ?? 0),
      },
    })
  } catch (e) {
    console.error('[GET /api/football/test]', e instanceof Error ? e.message : e)
    return NextResponse.json(
      { success: false, provider: 'api-football', error: 'Request failed' },
      { status: 500 }
    )
  }
}
