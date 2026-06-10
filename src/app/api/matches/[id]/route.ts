/**
 * GET /api/matches/[id]
 *
 * Rich match detail: base data + form guide + head-to-head.
 * All data served from Supabase — zero external API calls.
 *
 * Cache: 30s browser, 2min CDN (data is near-static for upcoming matches).
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type FormRow = {
  id:              string;
  home_team_name:  string;
  home_team_short: string | null;
  away_team_name:  string;
  away_team_short: string | null;
  home_team_crest: string | null;
  away_team_crest: string | null;
  home_score:      number | null;
  away_score:      number | null;
  actual_outcome:  string | null;
  kickoff:         string;
  league_id:       string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const FORM_SELECT =
  'id, home_team_name, home_team_short, away_team_name, away_team_short, ' +
  'home_team_crest, away_team_crest, home_score, away_score, actual_outcome, kickoff, league_id'

function err(msg: string, status: number) {
  return NextResponse.json({ ok: false, error: msg }, { status })
}

function toResult(actual: string | null, isHome: boolean): 'W' | 'D' | 'L' | null {
  if (!actual) return null
  if (actual === 'D') return 'D'
  if (isHome) return actual === 'H' ? 'W' : 'L'
  return actual === 'A' ? 'W' : 'L'
}

// ─────────────────────────────────────────────────────────────────────────────
// Route
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) return err('Match ID required', 400)

  const supabase = getServerSupabaseClient()

  // ── 1. Fetch match row ───────────────────────────────────────────────────
  const { data: m, error: mErr } = await supabase
    .from('matches')
    .select('*')
    .eq('id', id)
    .single()

  if (mErr || !m) return err('Match not found', 404)

  const home   = m.home_team_name as string
  const away   = m.away_team_name as string
  const league = m.league_id     as string

  // ── 2. Form + H2H (6 parallel queries) ──────────────────────────────────
  const [h1, h2, a1, a2, hh1, hh2] = await Promise.all([
    // Home team's recent matches — as home
    supabase.from('matches').select(FORM_SELECT)
      .eq('status', 'finished').eq('league_id', league).eq('home_team_name', home)
      .neq('id', id).order('kickoff', { ascending: false }).limit(5),
    // Home team's recent matches — as away
    supabase.from('matches').select(FORM_SELECT)
      .eq('status', 'finished').eq('league_id', league).eq('away_team_name', home)
      .neq('id', id).order('kickoff', { ascending: false }).limit(5),
    // Away team's recent matches — as home
    supabase.from('matches').select(FORM_SELECT)
      .eq('status', 'finished').eq('league_id', league).eq('home_team_name', away)
      .neq('id', id).order('kickoff', { ascending: false }).limit(5),
    // Away team's recent matches — as away
    supabase.from('matches').select(FORM_SELECT)
      .eq('status', 'finished').eq('league_id', league).eq('away_team_name', away)
      .neq('id', id).order('kickoff', { ascending: false }).limit(5),
    // H2H: home vs away
    supabase.from('matches').select(FORM_SELECT)
      .eq('status', 'finished').eq('home_team_name', home).eq('away_team_name', away)
      .neq('id', id).order('kickoff', { ascending: false }).limit(10),
    // H2H: away vs home
    supabase.from('matches').select(FORM_SELECT)
      .eq('status', 'finished').eq('home_team_name', away).eq('away_team_name', home)
      .neq('id', id).order('kickoff', { ascending: false }).limit(10),
  ])

  // ── Build form results ───────────────────────────────────────────────────
  function buildForm(
    asHomeData: FormRow[] | null,
    asAwayData: FormRow[] | null,
    teamName: string,
  ) {
    const rows = [...(asHomeData ?? []), ...(asAwayData ?? [])]
      .sort((a, b) => ((b.kickoff as string) > (a.kickoff as string) ? 1 : -1))
      .slice(0, 5)

    return rows.map(r => {
      const isHome = r.home_team_name === teamName
      return {
        matchId:       r.id,
        result:        toResult(r.actual_outcome, isHome),
        score:         r.home_score != null ? `${r.home_score}–${r.away_score}` : null,
        opponent:      isHome ? r.away_team_name  : r.home_team_name,
        opponentShort: isHome ? r.away_team_short : r.home_team_short,
        opponentCrest: (isHome ? r.away_team_crest : r.home_team_crest) ?? null,
        isHome,
        date:          (r.kickoff as string)?.slice(0, 10) ?? null,
      }
    })
  }

  // ── Build H2H ────────────────────────────────────────────────────────────
  const h2hRows = [...((hh1.data as FormRow[] | null) ?? []), ...((hh2.data as FormRow[] | null) ?? [])]
    .sort((a, b) => ((b.kickoff as string) > (a.kickoff as string) ? 1 : -1))
    .slice(0, 10)

  let homeWins = 0, draws = 0, awayWins = 0
  const h2hRecent = h2hRows.map(r => {
    const isOrigHome = r.home_team_name === home
    if (r.actual_outcome === 'D') {
      draws++
    } else if (
      (r.actual_outcome === 'H' && isOrigHome) ||
      (r.actual_outcome === 'A' && !isOrigHome)
    ) {
      homeWins++
    } else {
      awayWins++
    }
    return {
      matchId:   r.id,
      date:      (r.kickoff as string)?.slice(0, 10) ?? null,
      homeTeam:  r.home_team_name,
      homeShort: r.home_team_short,
      awayTeam:  r.away_team_name,
      awayShort: r.away_team_short,
      homeCrest: r.home_team_crest ?? null,
      awayCrest: r.away_team_crest ?? null,
      homeScore: r.home_score,
      awayScore: r.away_score,
      outcome:   r.actual_outcome,   // 'H' | 'D' | 'A' | null
    }
  })

  // ── Response ─────────────────────────────────────────────────────────────
  return NextResponse.json(
    {
      ok: true,
      match: {
        id:            m.id,
        leagueId:      m.league_id,
        homeTeam: {
          id:        m.home_team_id,
          name:      m.home_team_name,
          shortName: m.home_team_short,
          crest:     m.home_team_crest  ?? null,
        },
        awayTeam: {
          id:        m.away_team_id,
          name:      m.away_team_name,
          shortName: m.away_team_short,
          crest:     m.away_team_crest  ?? null,
        },
        kickoff:       m.kickoff,
        status:        m.status,
        homeScore:     m.home_score,
        awayScore:     m.away_score,
        actualOutcome: m.actual_outcome,
        matchday:      m.matchday,
        venue:         m.venue,
        leagueLogo:    m.league_logo   ?? null,
        countryFlag:   m.country_flag  ?? null,
        community:     m.community_home != null
          ? { home: m.community_home, draw: m.community_draw, away: m.community_away }
          : null,
      },
      form: {
        home: {
          teamName: home,
          crest:    m.home_team_crest ?? null,
          results:  buildForm(h1.data as FormRow[] | null, h2.data as FormRow[] | null, home),
        },
        away: {
          teamName: away,
          crest:    m.away_team_crest ?? null,
          results:  buildForm(a1.data as FormRow[] | null, a2.data as FormRow[] | null, away),
        },
      },
      h2h: {
        total:        homeWins + draws + awayWins,
        homeWins,
        draws,
        awayWins,
        homeTeamName: home,
        awayTeamName: away,
        recent:       h2hRecent,
      },
    },
    { headers: { 'Cache-Control': 'public, max-age=30, s-maxage=120' } },
  )
}
