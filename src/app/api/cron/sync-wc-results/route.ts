/**
 * GET /api/cron/sync-wc-results
 *
 * Vercel Cron — fetches FIFA World Cup 2026 fixtures from API-Football and
 * updates the matches table with current status, scores, and outcomes.
 * Runs every 3 minutes to provide near-real-time WC match updates.
 *
 * Schedule: every-3-minutes  (requires Vercel Pro plan)
 *
 * Auth:   Authorization: Bearer <CRON_SECRET>
 * API:    API-Football (APF), league 1 (FIFA World Cup), season 2026
 *         1 API call per invocation (fetches today ± 2 days)
 * Budget: ~480 APF calls/day — well within the 6,000/day hard cap
 *
 * Does NOT settle predictions — auto-settle (every-5-min) runs independently after this.
 * Idempotent: every run is safe to repeat; only changed fields are written.
 * Safety:  Never overwrites a settled actual_outcome.
 */

import { type NextRequest, NextResponse }         from 'next/server'
import { getServerSupabaseClient }               from '@/lib/supabase/server'
import { normalizeApfStatus, inferOutcome }      from '@/lib/football/status'
import { fetchApfFixtures }                      from '@/lib/football/apiFootball'
import { APF_WORLD_CUP }                         from '@/lib/football/apiFootballConfig'

// ── Date helpers ──────────────────────────────────────────────────────────────

function dateStr(d: Date): string { return d.toISOString().slice(0, 10) }
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setUTCDate(r.getUTCDate() + n); return r
}

// ─────────────────────────────────────────────────────────────────────────────
// GET handler
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron/sync-wc-results] CRON_SECRET env var not set')
    return NextResponse.json({ success: false, error: 'Cron secret not configured' }, { status: 500 })
  }
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.API_FOOTBALL_KEY) {
    return NextResponse.json({ success: false, error: 'API_FOOTBALL_KEY not configured' }, { status: 500 })
  }

  // ── Date window: today - 2 days → today + 1 day ───────────────────────────
  // Covers: matches from yesterday still pending, live matches today, upcoming kickoffs
  const now  = new Date()
  const from = dateStr(addDays(now, -2))
  const to   = dateStr(addDays(now, 1))

  // ── Fetch from API-Football ───────────────────────────────────────────────
  const result = await fetchApfFixtures({
    league: APF_WORLD_CUP.id,
    season: APF_WORLD_CUP.season,
    from,
    to,
  })

  if (!result.ok) {
    console.error('[cron/sync-wc-results] APF fetch error:', result.error)
    return NextResponse.json({
      success:   false,
      error:     result.error,
      from,
      to,
      ...(result.budgetExceeded && { budgetExceeded: true }),
      ...(result.rateLimitHit   && { rateLimitHit:   true }),
    }, { status: result.budgetExceeded ? 429 : 502 })
  }

  const fixtures = result.data

  if (fixtures.length === 0) {
    return NextResponse.json({ success: true, from, to, scanned: 0, updated: 0, message: 'No WC fixtures in window.' })
  }

  // ── Upsert each fixture into DB ───────────────────────────────────────────
  const supabase   = getServerSupabaseClient()
  let   updated    = 0
  let   unchanged  = 0
  const errors: string[] = []

  for (const fx of fixtures) {
    const id     = `apf-${fx.fixture.id}`
    const status = normalizeApfStatus(fx.fixture.status.short)
    const h      = fx.goals.home
    const a      = fx.goals.away

    // Fetch existing row to check what needs updating
    const { data: existing, error: fetchErr } = await supabase
      .from('matches')
      .select('id, status, home_score, away_score, actual_outcome')
      .eq('id', id)
      .maybeSingle()

    if (fetchErr) {
      errors.push(`${id}: fetch error — ${fetchErr.message}`)
      continue
    }

    if (!existing) {
      // Match not yet in DB — full upsert
      const { error: insertErr } = await supabase.from('matches').upsert({
        id,
        league_id:       APF_WORLD_CUP.code,
        home_team_id:    `apf-team-${fx.teams.home.id}`,
        home_team_name:  fx.teams.home.name,
        home_team_short: fx.teams.home.name.replace(/^(FC|CF|AS|AC|RC|CD|SD|UD|RB|SS|SC)\s+/i, '').slice(0, 3).toUpperCase(),
        away_team_id:    `apf-team-${fx.teams.away.id}`,
        away_team_name:  fx.teams.away.name,
        away_team_short: fx.teams.away.name.replace(/^(FC|CF|AS|AC|RC|CD|SD|UD|RB|SS|SC)\s+/i, '').slice(0, 3).toUpperCase(),
        kickoff:         fx.fixture.date,
        status,
        home_score:      h ?? null,
        away_score:      a ?? null,
        actual_outcome:  inferOutcome(h, a, status),
        matchday:        (() => { const m = (fx.league.round ?? '').match(/(\d+)/); return m ? parseInt(m[1], 10) : null })(),
        venue:           fx.fixture.venue.name ?? null,
        home_team_crest: fx.teams.home.logo ?? null,
        away_team_crest: fx.teams.away.logo ?? null,
        league_logo:     fx.league.logo     ?? null,
        country_flag:    fx.league.flag     ?? null,
        api_source:      'apf',
        updated_at:      new Date().toISOString(),
      }, { onConflict: 'id' })

      if (insertErr) { errors.push(`${id}: insert — ${insertErr.message}`) }
      else updated++
      continue
    }

    // Check if anything changed worth writing
    const noChange =
      existing.status     === status  &&
      existing.home_score === (h ?? null) &&
      existing.away_score === (a ?? null)

    if (noChange) { unchanged++; continue }

    // Never overwrite a settled actual_outcome
    const newOutcome = inferOutcome(h, a, status)
    const safeOutcome = existing.actual_outcome ?? newOutcome

    const { error: updateErr } = await supabase
      .from('matches')
      .update({
        status,
        home_score:     h ?? null,
        away_score:     a ?? null,
        actual_outcome: safeOutcome,
        updated_at:     new Date().toISOString(),
      })
      .eq('id', id)

    if (updateErr) { errors.push(`${id}: update — ${updateErr.message}`) }
    else updated++
  }

  console.info(
    `[cron/sync-wc-results] scanned=${fixtures.length} updated=${updated}` +
    ` unchanged=${unchanged} errors=${errors.length} from=${from} to=${to}` +
    ` callsToday=${result.callsToday}`
  )
  if (errors.length > 0) console.warn('[cron/sync-wc-results] errors:', errors)

  return NextResponse.json({
    success:   errors.length === 0 || updated > 0,
    from,
    to,
    scanned:   fixtures.length,
    updated,
    unchanged,
    callsToday: result.callsToday,
    ...(errors.length > 0 && { errors }),
  })
}
