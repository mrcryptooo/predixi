/**
 * API Route — /api/predictions
 *
 * POST  → submit a prediction (verify signature → upsert profile + match + prediction)
 * GET   → fetch predictions for a wallet address
 *
 * Server-side only. Uses service role key via getServerSupabaseClient().
 *
 * Phase 4D: Every POST request must include a wallet signature that proves the
 * caller owns the wallet address in the request body.  Requests without a valid
 * signature are rejected with 401 Unauthorized before any DB write occurs.
 *
 * Signature verification uses viem's publicClient.verifyMessage on the Base chain,
 * which supports both EOA (ecrecover) and smart-wallet (ERC-1271 / ERC-6492)
 * signatures.  This is necessary because Base Account uses ERC-6492 wrapped
 * signatures that are incompatible with the standalone verifyMessage utility.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createPublicClient, custom }      from 'viem'
import { base }                            from 'viem/chains'
import { ProxyAgent, fetch as undiciF }    from 'undici'
import { getServerSupabaseClient }         from '@/lib/supabase/server'
import { getMatchById }                    from '@/data/matches'
import { SIGNATURE_MAX_AGE_MS }            from '@/lib/prediction-message'
import { createPredictionCommitment }      from '@/lib/onchain/commitment'
import { checkAndAwardBadges }             from '@/lib/badges/checkAndAward'

// ─────────────────────────────────────────────────────────────────────────────
// Base public client — proxy-aware, created once at module load
//
// publicClient.verifyMessage supports:
//   • EOA wallets (standard 65-byte ecrecover signatures)
//   • ERC-1271 smart contract wallets (calls isValidSignature on-chain)
//   • ERC-6492 counterfactual smart wallets (Base Account, Coinbase Smart Wallet)
//
// The RPC calls go through the same HTTPS_PROXY env var as the Supabase client
// (server.ts pattern) so that local Windows dev behind nekobox / v2ray works.
// On Vercel no proxy is configured and the plain fetch path is used.
// ─────────────────────────────────────────────────────────────────────────────

function buildBaseClient() {
  const proxyUrl =
    process.env.HTTPS_PROXY ??
    process.env.https_proxy ??
    process.env.HTTP_PROXY  ??
    process.env.http_proxy

  const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined

  const rpcFetch = dispatcher
    ? (url: string, init?: RequestInit) =>
        undiciF(url, { ...init, dispatcher } as Parameters<typeof undiciF>[1]) as unknown as Promise<Response>
    : fetch

  const rpcProvider = {
    async request({ method, params }: { method: string; params?: unknown[] }) {
      const res  = await rpcFetch('https://mainnet.base.org', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
      })
      const json = await res.json() as {
        result?: unknown
        error?:  { code: number; message: string }
      }
      if (json.error) throw new Error(`RPC ${json.error.code}: ${json.error.message}`)
      return json.result
    },
  }

  return createPublicClient({ chain: base, transport: custom(rpcProvider) })
}

const baseClient = buildBaseClient()

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
// Body: { walletAddress, matchId, predictedOutcome, message, signature, signedAt, pointsAwarded? }
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return err('Invalid JSON body', 400)

    const {
      walletAddress,
      matchId,
      predictedOutcome,
      message,
      signature,
      signedAt,
      pointsAwarded,
    } = body as Record<string, unknown>

    // ── Basic input validation ───────────────────────────────────────────────
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

    // ── Phase 4D: Signature fields required ──────────────────────────────────
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return err('Missing message — wallet signature required', 401)
    }
    if (!signature || typeof signature !== 'string' || !signature.startsWith('0x')) {
      return err('Missing or invalid signature', 401)
    }
    if (!signedAt || typeof signedAt !== 'string') {
      return err('Missing signedAt timestamp', 401)
    }

    const normalizedAddress = (walletAddress as string).toLowerCase()

    // ── Phase 4D: Verify the signature via Base public client ────────────────
    // publicClient.verifyMessage handles EOA (ecrecover), ERC-1271 (deployed
    // smart wallets), and ERC-6492 (counterfactual / Base Account) signatures.
    let isValid = false
    try {
      isValid = await baseClient.verifyMessage({
        address:   walletAddress as `0x${string}`,
        message:   message as string,
        signature: signature as `0x${string}`,
      })
    } catch (verifyErr: unknown) {
      const detail = verifyErr instanceof Error ? verifyErr.message : String(verifyErr)
      console.error('[POST /api/predictions] verifyMessage error:', detail)
      return err('Signature verification failed', 401)
    }

    if (!isValid) {
      return err('Invalid signature — request rejected', 401)
    }

    // ── Phase 4D: Verify message content matches the request body ────────────
    // Re-checking the message text prevents a valid signature from being
    // recycled for a different match or outcome.
    const cleanMessage = message as string
    if (!cleanMessage.includes(`Wallet: ${normalizedAddress}`)) {
      return err('Signature mismatch: wallet address', 401)
    }
    if (!cleanMessage.includes(`Match ID: ${(matchId as string).trim()}`)) {
      return err('Signature mismatch: match ID', 401)
    }
    if (!cleanMessage.includes(`Outcome: ${predictedOutcome as string}`)) {
      return err('Signature mismatch: outcome', 401)
    }

    // ── Phase 4D: Reject expired signatures (anti-replay) ───────────────────
    // Extract the timestamp that was embedded in the signed message and reject
    // signatures that are older than SIGNATURE_MAX_AGE_MS (10 minutes).
    const tsMatch = cleanMessage.match(/Timestamp: (.+)/)
    if (tsMatch) {
      const signedTime = new Date(tsMatch[1].trim()).getTime()
      if (isNaN(signedTime) || Date.now() - signedTime > SIGNATURE_MAX_AGE_MS) {
        return err('Signature expired — please submit a fresh prediction', 401)
      }
    }

    // ── All checks passed — proceed with Supabase writes ────────────────────
    const points = typeof pointsAwarded === 'number' && pointsAwarded >= 0
      ? pointsAwarded
      : 10

    const supabase = getServerSupabaseClient()

    // ── 1. (after lock check) Upsert profile (create on first connection) ───
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

    // ── 2. Ensure match exists in DB — seed from mock data if needed ────────
    // Also fetch kickoff + status so we can enforce the kickoff lock below.
    const { data: existingMatch } = await supabase
      .from('matches')
      .select('id, kickoff, status')
      .eq('id', (matchId as string).trim())
      .maybeSingle()

    // Track the authoritative kickoff for the lock check.
    let matchKickoff: string | null = existingMatch?.kickoff ?? null

    if (!existingMatch) {
      const mock = getMatchById((matchId as string).trim())
      if (!mock) return err(`Unknown matchId: ${matchId}`, 404)

      matchKickoff = mock.kickoff   // use mock kickoff for lock check

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
        community_home:   mock.community.home,
        community_draw:   mock.community.draw,
        community_away:   mock.community.away,
      })

      if (matchErr && matchErr.code !== '23505') {
        // 23505 = unique_violation (race condition — another request seeded it first)
        console.error('[POST /api/predictions] match insert:', matchErr)
        return err('Failed to seed match record', 500)
      }
    }

    // ── 3. Kickoff lock — server time only, no client trust ─────────────────
    // Predictions are closed as soon as the server clock reaches kickoff.
    // Covers: live, finished, postponed, and upcoming-but-past-kickoff matches.
    if (!matchKickoff) {
      return NextResponse.json(
        { success: false, error: 'Match has no kickoff time — cannot accept predictions', locked: true },
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

    // ── 4. Lock-in placedAt — shared between the upsert row and the hash ──────
    const placedAt = new Date().toISOString()

    // ── 5. Upsert prediction — without commitment_hash (added in step 6) ─────
    //
    // We upsert first to obtain the stable DB row UUID (prediction.id).
    // The UUID is included in the commitment hash so each hash is provably
    // unique per row, independently of timestamp precision or retry timing.
    //
    // On conflict (profile_id, match_id): updates outcome + placed_at only.
    // The existing commitment_hash is left untouched by the upsert and will
    // be overwritten by the explicit UPDATE in step 6.
    //
    // commitment_hash is nullable in the schema, so omitting it here is safe.
    const { data: prediction, error: predErr } = await supabase
      .from('predictions')
      .upsert(
        {
          profile_id: profile.id,
          match_id:   (matchId as string).trim(),
          outcome:    predictedOutcome as DbOutcome,
          placed_at:  placedAt,
        },
        { onConflict: 'profile_id,match_id' },
      )
      .select('id, match_id, outcome, placed_at, points_awarded, is_correct')
      .single()

    if (predErr || !prediction) {
      console.error('[POST /api/predictions] prediction upsert:', predErr)
      return err('Failed to save prediction', 500)
    }

    // ── 6. Compute commitment hash — includes DB row UUID for uniqueness ──────
    //
    // Now that prediction.id is known, include it in the hash payload.
    // This guarantees: same wallet + same match + same outcome + same UUID
    // always produces the same hash (deterministic), and no two different
    // prediction rows can ever share a hash (unique).
    const { commitmentHash } = createPredictionCommitment({
      walletAddress: normalizedAddress,
      matchId:       (matchId as string).trim(),
      outcome:       predictedOutcome as string,
      placedAt,
      predictionId:  prediction.id as string,
    })

    // ── 7. Stamp commitment_hash onto the row ─────────────────────────────────
    const { error: hashErr } = await supabase
      .from('predictions')
      .update({ commitment_hash: commitmentHash })
      .eq('id', prediction.id)

    if (hashErr) {
      console.error('[POST /api/predictions] commitment_hash update:', hashErr)
      return err('Failed to record commitment hash', 500)
    }

    // ── 8. Badge check (fire-and-forget — never blocks the main response) ─────
    // Runs after all core writes succeed. Badge errors are logged but suppressed
    // so a badge system failure never causes the prediction POST to return 500.
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

    // walletAuth: mandatory verification already passed above (Phase 4D)
    return NextResponse.json({
      success: true,
      walletAuth: { checked: true, verified: true },
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
