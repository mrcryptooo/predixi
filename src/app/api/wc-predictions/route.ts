/**
 * API Route — /api/wc-predictions
 *
 * GET  ?wallet=0x...  → all wc_predictions rows for that wallet
 * POST               → upsert one prediction — requires confirmed Base txHash
 *
 * Transaction-first: POST must include a confirmed Base txHash from
 * submitCommitment() on PredixiCommitmentRegistry. Server verifies the
 * CommitmentSubmitted event before writing to Supabase.
 * No wallet message signatures are used or accepted.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'
import { createWCCommitment }             from '@/lib/onchain/commitment'
import { checkAndAwardBadges }            from '@/lib/badges/checkAndAward'
import { verifyOnchainSubmission }        from '@/lib/onchain/verifySubmission'
import { getCanonicalWCXpReward }         from '@/lib/wc-prediction-config'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isValidAddress(addr: unknown): addr is string {
  return typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/i.test(addr.trim())
}

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/wc-predictions?wallet=0x...
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const wallet = req.nextUrl.searchParams.get('wallet')

    if (!wallet) return err('wallet query parameter is required', 400)
    if (!isValidAddress(wallet)) return err('Invalid wallet address', 400)

    const supabase = getServerSupabaseClient()

    const { data, error } = await supabase
      .from('wc_predictions')
      .select('prediction_key, prediction_type, selected_value, xp_reward, status, deadline, commitment_hash, submitted_onchain, tx_hash, created_at, updated_at')
      .eq('wallet_address', wallet.toLowerCase())

    if (error) {
      console.error('[GET /api/wc-predictions]', error)
      return err('Failed to fetch WC predictions', 500)
    }

    return NextResponse.json({
      success:     true,
      predictions: (data ?? []).map(r => ({
        predictionKey:    r.prediction_key,
        predictionType:   r.prediction_type,
        selectedValue:    r.selected_value as string[],
        xpReward:         r.xp_reward,
        status:           r.status,
        deadline:         r.deadline,
        commitmentHash:   r.commitment_hash   ?? null,
        submittedOnchain: r.submitted_onchain ?? false,
        txHash:           r.tx_hash           ?? null,
        createdAt:        r.created_at,
        updatedAt:        r.updated_at,
      })),
    })
  } catch (e) {
    console.error('[GET /api/wc-predictions] unhandled:', e)
    return err('Internal server error', 500)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/wc-predictions
// Body: { walletAddress, predictionKey, predictionType, selectedValue,
//         xpReward, deadline?, txHash }
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return err('Invalid JSON body', 400)

    const {
      walletAddress,
      predictionKey,
      predictionType,
      selectedValue,
      xpReward,
      deadline,
      txHash,
    } = body as Record<string, unknown>

    // ── Validation ────────────────────────────────────────────────────────────
    if (!isValidAddress(walletAddress)) {
      return err('Invalid walletAddress — must be a 0x Ethereum address', 400)
    }
    if (!predictionKey || typeof predictionKey !== 'string' || predictionKey.trim() === '') {
      return err('predictionKey is required', 400)
    }
    if ((predictionKey as string).trim().length > 200) {
      return err('predictionKey must be 200 characters or fewer', 400)
    }
    if (!predictionType || typeof predictionType !== 'string' || predictionType.trim() === '') {
      return err('predictionType is required', 400)
    }
    if ((predictionType as string).trim().length > 100) {
      return err('predictionType must be 100 characters or fewer', 400)
    }
    if (!Array.isArray(selectedValue) || selectedValue.length === 0) {
      return err('selectedValue must be a non-empty array', 400)
    }
    if ((selectedValue as unknown[]).length > 10) {
      return err('selectedValue may contain at most 10 items', 400)
    }
    if (!(selectedValue as unknown[]).every(v => typeof v === 'string')) {
      return err('selectedValue items must be strings', 400)
    }
    if (typeof xpReward !== 'number' || !Number.isFinite(xpReward) || xpReward < 0) {
      return err('xpReward must be a non-negative finite number', 400)
    }
    if (!txHash || typeof txHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      return err('txHash is required — must be 0x-prefixed 64-hex transaction hash', 400)
    }

    const normalizedWallet = (walletAddress as string).toLowerCase()
    const cleanKey         = (predictionKey as string).trim()
    const deadlineTs = typeof deadline === 'string' && deadline.trim() !== ''
      ? deadline.trim()
      : null

    // ── Validate xpReward against server-side canonical config ────────────────
    // The canonical value is the source of truth.  Rejecting mismatches means
    // an attacker cannot inflate XP by submitting an on-chain tx with a higher
    // xpReward — the server recomputes the hash with the canonical value, so any
    // tampered hash in the on-chain event will not match.
    const canonicalXp = getCanonicalWCXpReward(cleanKey)
    if (canonicalXp === null) {
      return err(`Unknown predictionKey '${cleanKey}' — not a recognised WC prediction`, 400)
    }
    if ((xpReward as number) !== canonicalXp) {
      return err(`xpReward ${xpReward} does not match the configured value for '${cleanKey}' (expected ${canonicalXp})`, 400)
    }

    // ── Compute commitment hash using canonical XP (not the raw client value) ─
    const { commitmentHash } = createWCCommitment({
      walletAddress: normalizedWallet,
      predictionKey: cleanKey,
      selectedValue: selectedValue as string[],
      xpReward:      canonicalXp,
    })

    // ── Verify on-chain TX — must precede any DB write ────────────────────────
    const verify = await verifyOnchainSubmission(
      txHash as string,
      normalizedWallet,
      commitmentHash,
    )
    if (!verify.ok) {
      console.warn('[POST /api/wc-predictions] TX verification failed:', verify.error)
      return err(`Transaction verification failed: ${verify.error}`, 400)
    }

    // ── Upsert ───────────────────────────────────────────────────────────────
    const supabase = getServerSupabaseClient()
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('wc_predictions')
      .upsert(
        {
          wallet_address:      normalizedWallet,
          prediction_key:      cleanKey,
          prediction_type:     (predictionType as string).trim(),
          selected_value:      selectedValue,
          xp_reward:           canonicalXp,
          status:              'pending',
          deadline:            deadlineTs,
          commitment_hash:     commitmentHash,
          submitted_onchain:   true,
          tx_hash:             (txHash as string).toLowerCase(),
          onchain_verified_at: now,
          updated_at:          now,
        },
        { onConflict: 'wallet_address,prediction_key' },
      )
      .select('prediction_key, status, updated_at')
      .single()

    if (error) {
      console.error('[POST /api/wc-predictions]', error)
      return err('Failed to save WC prediction', 500)
    }

    // ── Badge check (fire-and-forget) ─────────────────────────────────────────
    try {
      const { data: wcProfile } = await supabase
        .from('profiles')
        .select('id, created_at')
        .eq('wallet_address', normalizedWallet)
        .maybeSingle()

      if (wcProfile) {
        await checkAndAwardBadges({
          walletAddress:    normalizedWallet,
          profileId:        wcProfile.id as string,
          profileCreatedAt: wcProfile.created_at as string,
          trigger:          'worldcup_post',
          supabase,
        })
      }
    } catch (badgeErr) {
      console.warn('[POST /api/wc-predictions] badge award error (non-fatal):', badgeErr)
    }

    return NextResponse.json({
      success: true,
      commitmentHash,
      prediction: {
        predictionKey: data.prediction_key,
        status:        data.status,
        updatedAt:     data.updated_at,
      },
    })
  } catch (e) {
    console.error('[POST /api/wc-predictions] unhandled:', e)
    return err('Internal server error', 500)
  }
}
