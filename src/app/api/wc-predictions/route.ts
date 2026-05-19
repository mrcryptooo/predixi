/**
 * API Route — /api/wc-predictions
 *
 * GET  ?wallet=0x...  → all wc_predictions rows for that wallet
 * POST               → upsert one prediction (wallet + key = unique)
 *
 * Server-only. Uses service role key.
 * No wallet signature required — predictions are low-stakes MVP persistence.
 * XP settlement is NOT done here; status stays 'pending'.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }         from '@/lib/supabase/server'
import { verifyOptionalWalletAuth }        from '@/lib/auth/wallet-signature'
import { createWCCommitment }             from '@/lib/onchain/commitment'

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
// Returns all WC prediction rows for the given wallet.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const wallet = req.nextUrl.searchParams.get('wallet')

    if (!wallet) return err('wallet query parameter is required', 400)
    if (!isValidAddress(wallet)) return err('Invalid wallet address', 400)

    const supabase = getServerSupabaseClient()

    const { data, error } = await supabase
      .from('wc_predictions')
      .select('prediction_key, prediction_type, selected_value, xp_reward, status, deadline, created_at, updated_at')
      .eq('wallet_address', wallet.toLowerCase())

    if (error) {
      console.error('[GET /api/wc-predictions]', error)
      return err('Failed to fetch WC predictions', 500)
    }

    return NextResponse.json({
      success:     true,
      predictions: (data ?? []).map(r => ({
        predictionKey:  r.prediction_key,
        predictionType: r.prediction_type,
        selectedValue:  r.selected_value as string[],
        xpReward:       r.xp_reward,
        status:         r.status,
        deadline:       r.deadline,
        createdAt:      r.created_at,
        updatedAt:      r.updated_at,
      })),
    })
  } catch (e) {
    console.error('[GET /api/wc-predictions] unhandled:', e)
    return err('Internal server error', 500)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/wc-predictions
// Body: { walletAddress, predictionKey, predictionType, selectedValue, xpReward, deadline? }
// Upserts on (wallet_address, prediction_key). status stays 'pending'.
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
    } = body as Record<string, unknown>

    // ── Validation ────────────────────────────────────────────────────────────
    if (!isValidAddress(walletAddress)) {
      return err('Invalid walletAddress — must be a 0x Ethereum address', 400)
    }
    if (!predictionKey || typeof predictionKey !== 'string' || predictionKey.trim() === '') {
      return err('predictionKey is required', 400)
    }
    if (!predictionType || typeof predictionType !== 'string' || predictionType.trim() === '') {
      return err('predictionType is required', 400)
    }
    if (!Array.isArray(selectedValue) || selectedValue.length === 0) {
      return err('selectedValue must be a non-empty array', 400)
    }
    if (typeof xpReward !== 'number' || xpReward < 0) {
      return err('xpReward must be a non-negative number', 400)
    }

    const normalizedWallet = (walletAddress as string).toLowerCase()
    const deadlineTs = typeof deadline === 'string' && deadline.trim() !== ''
      ? deadline.trim()
      : null

    // ── Optional wallet auth (not enforced yet) ───────────────────────────────
    // TODO (Phase 2): reject when walletAuth.verified === false
    const walletAuth = await verifyOptionalWalletAuth(req, normalizedWallet, 'wc-prediction')
    if (walletAuth.checked && !walletAuth.verified) {
      console.warn('[POST /api/wc-predictions] wallet auth failed:', walletAuth.reason)
    }

    // ── Upsert ───────────────────────────────────────────────────────────────
    const supabase = getServerSupabaseClient()

    const { data, error } = await supabase
      .from('wc_predictions')
      .upsert(
        {
          wallet_address:  normalizedWallet,
          prediction_key:  (predictionKey as string).trim(),
          prediction_type: (predictionType as string).trim(),
          selected_value:  selectedValue,
          xp_reward:       xpReward as number,
          status:          'pending',
          deadline:        deadlineTs,
          updated_at:      new Date().toISOString(),
        },
        { onConflict: 'wallet_address,prediction_key' },
      )
      .select('prediction_key, status, updated_at')
      .single()

    if (error) {
      console.error('[POST /api/wc-predictions]', error)
      return err('Failed to save WC prediction', 500)
    }

    // Commitment hash — Phase 2: save to wc_predictions.commitment_hash after migration
    const { commitmentHash } = createWCCommitment({
      walletAddress: normalizedWallet,
      predictionKey: (predictionKey as string).trim(),
      selectedValue: selectedValue as string[],
      xpReward:      xpReward as number,
    })

    return NextResponse.json({
      success: true,
      commitmentHash,
      prediction: {
        predictionKey: data.prediction_key,
        status:        data.status,
        updatedAt:     data.updated_at,
      },
      walletAuth,
    })
  } catch (e) {
    console.error('[POST /api/wc-predictions] unhandled:', e)
    return err('Internal server error', 500)
  }
}
