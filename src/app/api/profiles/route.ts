import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }   from '@/lib/supabase/server'
import { getRankProgress }           from '@/lib/ranks'
import { verifyBaseWalletAuth }      from '@/lib/auth/verify-base-wallet'

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function GET(req: NextRequest) {
  const walletAddress = req.nextUrl.searchParams.get('walletAddress')
  if (!walletAddress) return err('walletAddress required', 400)
  if (!/^0x[0-9a-fA-F]{40}$/i.test(walletAddress.trim())) return err('Invalid address', 400)

  try {
    const supabase = getServerSupabaseClient()
    const { data } = await supabase
      .from('profiles')
      .select('wallet_address, xp, rank, streak, total_predictions, correct_predictions, created_at, display_name, username')
      .eq('wallet_address', walletAddress.toLowerCase())
      .maybeSingle()

    if (!data) {
      const rankMeta = getRankProgress(0)
      return NextResponse.json({
        success: true,
        exists: false,
        profile: {
          walletAddress: walletAddress.toLowerCase(),
          displayName:   null,
          username:      null,
          xp: 0, rank: 'bronze', streak: 0,
          totalPredictions: 0, correctPredictions: 0,
          accuracy: 0, createdAt: null,
        },
        rankMetadata: {
          tier:        rankMeta.tier.id,
          tierLabel:   rankMeta.tier.label,
          tierColor:   rankMeta.tier.color,
          tierEmoji:   rankMeta.tier.emoji,
          nextTier:    rankMeta.nextTier?.id    ?? null,
          nextTierLabel: rankMeta.nextTier?.label ?? null,
          xpInTier:    rankMeta.xpInTier,
          xpForTier:   rankMeta.xpForTier,
          progressPct: rankMeta.progressPct,
        },
      })
    }

    const accuracy = data.total_predictions > 0
      ? Math.round((data.correct_predictions / data.total_predictions) * 100)
      : 0

    const rankMeta = getRankProgress(data.xp ?? 0)

    return NextResponse.json({
      success: true,
      exists: true,
      profile: {
        walletAddress:      data.wallet_address,
        displayName:        data.display_name  ?? null,
        username:           data.username      ?? null,
        xp:                 data.xp,
        rank:               data.rank,
        streak:             data.streak,
        totalPredictions:   data.total_predictions,
        correctPredictions: data.correct_predictions,
        accuracy,
        createdAt:          data.created_at ?? null,
      },
      rankMetadata: {
        tier:          rankMeta.tier.id,
        tierLabel:     rankMeta.tier.label,
        tierColor:     rankMeta.tier.color,
        tierEmoji:     rankMeta.tier.emoji,
        nextTier:      rankMeta.nextTier?.id    ?? null,
        nextTierLabel: rankMeta.nextTier?.label ?? null,
        xpInTier:      rankMeta.xpInTier,
        xpForTier:     rankMeta.xpForTier,
        progressPct:   rankMeta.progressPct,
      },
    })
  } catch (error) {
    console.error('[GET /api/profiles]', error)
    return err('Internal server error', 500)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/profiles
// Body: { walletAddress, displayName }
// Headers: x-wallet-message, x-wallet-signature (encodeURIComponent encoded)
//
// Updates display_name for the wallet owner. Requires a valid EIP-191 signature
// verified via publicClient.verifyMessage() — supports EOA and Coinbase Smart Wallet.
// ─────────────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return err('Invalid JSON body', 400)

    const { walletAddress, displayName } = body as Record<string, unknown>

    if (!walletAddress || !/^0x[0-9a-fA-F]{40}$/i.test(String(walletAddress))) {
      return err('Invalid walletAddress', 400)
    }
    if (typeof displayName !== 'string') {
      return err('displayName must be a string', 400)
    }

    const trimmed = displayName.trim()
    if (trimmed.length < 2 || trimmed.length > 25) {
      return err('Display name must be 2–25 characters', 400)
    }
    if (/[\x00-\x1f\x7f]/.test(trimmed)) {
      return err('Display name contains invalid characters', 400)
    }

    const normalizedAddress = String(walletAddress).toLowerCase()

    // Verify wallet signature — smart-wallet-compatible (EOA + Coinbase Smart Wallet)
    const walletAuth = await verifyBaseWalletAuth(req, normalizedAddress, 'update-display-name')
    if (!walletAuth.verified) {
      return NextResponse.json(
        {
          success:    false,
          error:      walletAuth.reason === 'missing-headers'
            ? 'Wallet signature required'
            : 'Signature verification failed — please try again',
          walletAuth,
        },
        { status: 401 },
      )
    }

    const supabase = getServerSupabaseClient()

    // Case-insensitive uniqueness check — exclude the current wallet's own row
    const { data: conflict } = await supabase
      .from('profiles')
      .select('wallet_address')
      .ilike('display_name', trimmed)
      .neq('wallet_address', normalizedAddress)
      .maybeSingle()

    if (conflict) {
      return err('This display name is already taken', 409)
    }

    const { data: updated, error: updateErr } = await supabase
      .from('profiles')
      .update({ display_name: trimmed })
      .eq('wallet_address', normalizedAddress)
      .select('wallet_address, display_name, username')
      .single()

    if (updateErr || !updated) {
      console.error('[PATCH /api/profiles]', updateErr)
      return err('Failed to update profile', 500)
    }

    return NextResponse.json({
      success: true,
      profile: {
        walletAddress: updated.wallet_address,
        displayName:   updated.display_name ?? null,
        username:      updated.username     ?? null,
      },
    })
  } catch (e) {
    console.error('[PATCH /api/profiles] unhandled:', e)
    return err('Internal server error', 500)
  }
}
