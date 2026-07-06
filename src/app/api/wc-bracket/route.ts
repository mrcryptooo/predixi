/**
 * GET /api/wc-bracket
 *
 * Returns the structured WC knockout bracket, ready for the KnockoutBracket
 * component to consume.
 *
 * All data is read from the `matches` table (league_id = 'WC').
 * No external API calls — served entirely from Supabase.
 *
 * Response:
 *   {
 *     ok:                   true,
 *     stage:                BracketStage,
 *     totalKnockoutMatches: number,
 *     r32:   BracketMatch[],
 *     r16:   BracketMatch[],
 *     qf:    BracketMatch[],
 *     sf:    BracketMatch[],
 *     final: BracketMatch[],
 *     third: BracketMatch[],
 *   }
 *
 * Stale-while-revalidate: 60s browser, 120s CDN.
 * During live matches the cron sync updates the DB every minute, so
 * the bracket auto-updates without a hard refresh.
 */

import { NextResponse }            from 'next/server'
import { getServerSupabaseClient } from '@/lib/supabase/server'
import { buildBracketData }        from '@/lib/football/knockoutUtils'
import type { RawMatchRow }        from '@/lib/football/knockoutUtils'

function err(msg: string, status = 500) {
  return NextResponse.json({ ok: false, error: msg }, { status })
}

export async function GET() {
  try {
    const supabase = getServerSupabaseClient()

    // Fetch all WC matches (group stage + knockout).
    // buildBracketData filters out group stage rows internally.
    const { data, error } = await supabase
      .from('matches')
      .select(
        'id, league_id, ' +
        'home_team_id, home_team_name, home_team_short, home_team_crest, ' +
        'away_team_id, away_team_name, away_team_short, away_team_crest, ' +
        'kickoff, status, home_score, away_score, actual_outcome, round'
      )
      .eq('league_id', 'WC')
      .order('kickoff', { ascending: true })

    if (error) {
      console.error('[GET /api/wc-bracket]', error)
      return err('Failed to fetch WC matches')
    }

    const rows = (data ?? []) as unknown as RawMatchRow[]
    const bracket = buildBracketData(rows)

    return NextResponse.json(
      {
        ok:                   true,
        stage:                bracket.stage,
        totalKnockoutMatches: bracket.totalKnockoutMatches,
        r32:                  bracket.r32,
        r16:                  bracket.r16,
        qf:                   bracket.qf,
        sf:                   bracket.sf,
        final:                bracket.final,
        third:                bracket.third,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=300',
        },
      }
    )
  } catch (e) {
    console.error('[GET /api/wc-bracket] unhandled:', e)
    return err('Internal server error')
  }
}
