/**
 * API Route — /api/predictions
 *
 * POST → submit a prediction (verify Base TX → upsert profile + match + prediction)
 * GET  → fetch predictions for a wallet address
 *
 * Transaction-first: every POST must include a confirmed Base txHash from
 * submitCommitment() on PredixiCommitmentRegistry. The server verifies the
 * on-chain CommitmentSubmitted event before writing to Supabase.
 * No wallet message signatures are used or accepted.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'
import { getMatchById }                   from '@/data/matches'
import { createPredictionCommitment }     from '@/lib/onchain/commitment'
import { checkAndAwardBadges }            from '@/lib/badges/checkAndAward'
import { verifyOnchainSubmission }        from '@/lib/onchain/verifySubmission'

// ─────────────────────────────────────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────────────────────────────────────

type DbOutcome = 'H' | 'D' | 'A'
const VALID_OUTCOMES = new Set<DbOutcome>(['H', 'D', 'A'])

function isValidAddress(addr: unknown): addr is string {
  return typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/i.test(addr.trim())
}

function isValidOutcome(o: unknown): o is DbOutcome {
  return typeof o === 'string' && VALID_OUTCOMES.has(o as DbOutcome)
}

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/predictions
// Body: { walletAddress, matchId, predictedOutcome, txHash, clientNonce,
//         clientTimestamp, pointsAwarded? }
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return err('Invalid JSON body', 400)

    const {
      walletAddress,
      matchId,
      predictedOutcome,
      txHash,
      clientNonce,
      clientTimestamp,
      pointsAwarded,
    } = body as Record<string, unknown>

    // ── Input validation ─────────────────────────────────────────────────────
    if (!isValidAddress(walletAddress)) {
      return err('Invalid walletAddress — must be a 0x Ethereum address', 400)
    }
    if (!matchId || typeof matchId !== 'string' || matchId.trim() === '') {
      return err('Invalid matchId', 400)
    }
    if ((matchId as string).trim().length > 200) {
      return err('matchId must be 200 characters or fewer', 400)
    }
    if (!isValidOutcome(predictedOutcome)) {
      return err('Invalid predictedOutcome — must be H, D, or A', 400)
    }

    // ── TX fields required ───────────────────────────────────────────────────
    if (!txHash || typeof txHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      return err('txHash is required — must be 0x-prefixed 64-hex transaction hash', 400)
    }
    if (!clientNonce || typeof clientNonce !== 'string' || clientNonce.trim() === '') {
      return err('clientNonce is required', 400)
    }
    if (!clientTimestamp || typeof clientTimestamp !== 'string' || clientTimestamp.trim() === '') {
      return err('clientTimestamp is required', 400)
    }

    const normalizedAddress = (walletAddress as string).toLowerCase()
    const cleanMatchId      = (matchId as string).trim()

    // ── Re-derive commitment hash from client inputs ──────────────────────────
    const { commitmentHash } = createPredictionCommitment({
      walletAddress:   normalizedAddress,
      matchId:         cleanMatchId,
      outcome:         predictedOutcome as string,
      clientTimestamp: (clientTimestamp as string).trim(),
      clientNonce:     (clientNonce as string).trim(),
    })

    // ── Verify on-chain TX — must precede any DB write ────────────────────────
    const verify = await verifyOnchainSubmission(
      txHash as string,
      normalizedAddress,
      commitmentHash,
    )
    if (!verify.ok) {
      console.warn('[POST /api/predictions] TX verification failed:', verify.error)
      return err(`Transaction verification failed: ${verify.error}`, 400)
    }

    // ── All checks passed — proceed with Supabase writes ─────────────────────
    const points = typeof pointsAwarded === 'number' && pointsAwarded >= 0
      ? pointsAwarded
      : 10

    const supabase = getServerSupabaseClient()

    // ── 1. Upsert profile ────────────────────────────────────────────────────
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .upsert(
        { wallet_address: normalizedAddress },
        { onConflict: 'wallet_address' },
      )
      .select('id, wallet_address, xp, rank, streak, total_predictions, correct_predictions, created_at')
      .single()

    if (profileErr || !profile) {
      console.error('[POST /api/predictions] profile upsert:', profileErr)
      return err('Failed to create or fetch profile', 500)
    }

    // ── 2. Ensure match exists in DB ─────────────────────────────────────────
    const { data: existingMatch } = await supabase
      .from('matches')
      .select('id, kickoff, status')
      .eq('id', cleanMatchId)
      .maybeSingle()

    let matchKickoff: string | null = existingMatch?.kickoff ?? null

    if (!existingMatch) {
      const mock = getMatchById(cleanMatchId)
      if (!mock) return err(`Unknown matchId: ${matchId}`, 404)

      matchKickoff = mock.kickoff

      const { error: matchErr } = await supabase.from('matches').insert({
        id:               mock.id,
        league_id:        mock.leagueId,
        home_team_id:     mock.homeTeam.id,
        home_team_name:   mock.homeTeam.name,
        home_team_short:  mock.homeTeam.shortName,
        away_team_id:     mock.awayTeam.id,
        away_team_name:   mock.awayTeam.name,
        away_team_short:  mock.awayTeam.shortName,
        kickoff:          mock.kickoff,
        status:           mock.status,
        home_score:       mock.homeScore,
        away_score:       mock.awayScore,
        matchday:         mock.matchday,
        venue:            mock.venue,
        community_home:   mock.community?.home ?? null,
        community_draw:   mock.community?.draw ?? null,
        community_away:   mock.community?.away ?? null,
      })

      if (matchErr && matchErr.code !== '23505') {
        console.error('[POST /api/predictions] match insert:', matchErr)
        return err('Failed to seed match record', 500)
      }
    }

    // ── 3. Kickoff lock ──────────────────────────────────────────────────────
    if (!matchKickoff) {
      return NextResponse.json(
        { success: false, error: 'Match has no kickoff time', locked: true },
        { status: 400 },
      )
    }
    const kickoffMs = new Date(matchKickoff).getTime()
    if (isNaN(kickoffMs)) {
      return NextResponse.json(
        { success: false, error: 'Match has an invalid kickoff time', locked: true },
        { status: 400 },
      )
    }
    if (Date.now() >= kickoffMs) {
      return NextResponse.json(
        {
          success:     false,
          error:       'Predictions are locked after kickoff',
          locked:      true,
          kickoffTime: matchKickoff,
        },
        { status: 403 },
      )
    }

    // ── 4. Upsert prediction with commitment_hash, tx_hash, submitted_onchain ─
    const placedAt = new Date().toISOString()
    const { data: prediction, error: predErr } = await supabase
      .from('predictions')
      .upsert(
        {
          profile_id:       profile.id,
          match_id:         cleanMatchId,
          outcome:          predictedOutcome as DbOutcome,
          placed_at:        placedAt,
          commitment_hash:  commitmentHash,
          submitted_onchain: true,
          tx_hash:          (txHash as string).toLowerCase(),
        },
        { onConflict: 'profile_id,match_id' },
      )
      .select('id, match_id, outcome, placed_at, points_awarded, is_correct')
      .single()

    if (predErr || !prediction) {
      console.error('[POST /api/predictions] prediction upsert:', predErr)
      return err('Failed to save prediction', 500)
    }

    // ── 5. Badge check (fire-and-forget) ─────────────────────────────────────
    try {
      await checkAndAwardBadges({
        walletAddress:    normalizedAddress,
        profileId:        profile.id as string,
        profileCreatedAt: profile.created_at as string,
        trigger:          'prediction_post',
        supabase,
      })
    } catch (badgeErr) {
      console.warn('[POST /api/predictions] badge award error (non-fatal):', badgeErr)
    }

    return NextResponse.json({
      success: true,
      commitmentHash,
      prediction: {
        id:            prediction.id,
        matchId:       prediction.match_id,
        outcome:       prediction.outcome,
        placedAt:      prediction.placed_at,
        pointsAwarded: prediction.points_awarded,
        isCorrect:     prediction.is_correct,
      },
      profile: {
        id:                 profile.id,
        walletAddress:      profile.wallet_address,
        xp:                 profile.xp,
        rank:               profile.rank,
        streak:             profile.streak,
        totalPredictions:   profile.total_predictions,
        correctPredictions: profile.correct_predictions,
      },
    })
  } catch (error) {
    console.error('[POST /api/predictions] unhandled:', error)
    return err('Internal server error', 500)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/predictions?walletAddress=0x...
// Returns all predictions for a given wallet. Read-only — no signature needed.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const walletAddress = req.nextUrl.searchParams.get('walletAddress')

    if (!walletAddress) {
      return err('walletAddress query parameter is required', 400)
    }
    if (!isValidAddress(walletAddress)) {
      return err('Invalid walletAddress', 400)
    }

    const supabase = getServerSupabaseClient()

    // Find profile (may not exist yet)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('wallet_address', walletAddress.toLowerCase())
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ success: true, predictions: [] })
    }

    // Fetch predictions newest-first
    const { data: predictions, error: predErr } = await supabase
      .from('predictions')
      .select('id, match_id, outcome, placed_at, points_awarded, is_correct, commitment_hash, submitted_onchain, tx_hash')
      .eq('profile_id', profile.id)
      .order('placed_at', { ascending: false })

    if (predErr) {
      console.error('[GET /api/predictions]', predErr)
      return err('Failed to fetch predictions', 500)
    }

    return NextResponse.json({
      success: true,
      predictions: (predictions ?? []).map((p) => ({
        id:               p.id,
        matchId:          p.match_id,
        outcome:          p.outcome,
        placedAt:         p.placed_at,
        pointsAwarded:    p.points_awarded,
        isCorrect:        p.is_correct,
        commitmentHash:   p.commitment_hash   ?? null,
        submittedOnchain: p.submitted_onchain ?? false,
        txHash:           p.tx_hash           ?? null,
      })),
    })
  } catch (error) {
    console.error('[GET /api/predictions] unhandled:', error)
    return err('Internal server error', 500)
  }
}

