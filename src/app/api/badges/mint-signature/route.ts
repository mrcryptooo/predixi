/**
 * API Route — GET /api/badges/mint-signature?badgeId=...&walletAddress=0x...
 *
 * Issues a backend EIP-712 MintBadge signature so the caller can invoke
 * mintBadge() on the PrediXIBadges contract.
 *
 * No wallet message signature required. The EIP-712 signature returned is
 * cryptographically bound to walletAddress — only that wallet can call
 * mintBadge() successfully because the contract verifies msg.sender == wallet
 * inside the EIP-712 struct.
 *
 * ── Query params ─────────────────────────────────────────────────────────────
 *
 *   badgeId       — badge string ID (e.g. "first-pred")
 *   walletAddress — 0x Ethereum address of the wallet that will mint
 *
 * ── Eligibility checks ────────────────────────────────────────────────────────
 *
 *   1. walletAddress is a valid 0x Ethereum address
 *   2. badgeId is present and maps to an active token ID (1–19)
 *   3. A profile exists in the DB for walletAddress
 *   4. A user_badges row exists for that profile + badgeId
 *   5. minted_onchain === false
 *
 * ── Success flow ─────────────────────────────────────────────────────────────
 *
 *   1. Generate random bytes32 nonce
 *   2. Insert nonce into badge_mint_nonces (used_at = null)
 *   3. Sign MintBadge(walletAddress, tokenId, nonce) with BADGE_SIGNER_KEY
 *   4. Return { ok, badgeId, tokenId, nonce, signature, expiresAt }
 *
 * ── Response ─────────────────────────────────────────────────────────────────
 *
 *   200  { ok: true, badgeId, tokenId, nonce, signature, expiresAt }
 *   400  missing/invalid params
 *   403  badge not earned by this wallet
 *   409  badge already minted on Base
 *   500  internal error (signer misconfigured, DB error)
 *
 * ── Security model ────────────────────────────────────────────────────────────
 *
 *   • The EIP-712 signature binds to walletAddress as the `wallet` field.
 *     The contract checks msg.sender == wallet, so even if an attacker
 *     requests a signature for another wallet, they cannot use it — only
 *     walletAddress itself can call mintBadge() with the returned signature.
 *   • BADGE_SIGNER_KEY is never logged.
 *   • signMintAuthorization() validates the derived signer matches the
 *     expected contract signer before issuing any signature.
 *   • The nonce is stored before the signature is returned.
 *   • If signing fails after nonce insert, the nonce row is deleted so
 *     the user can retry cleanly.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'
import {
  getTokenIdForBadge,
  isActiveBadgeTokenId,
}                                         from '@/lib/badges/tokenIds'
import {
  generateMintNonce,
  signMintAuthorization,
}                                         from '@/lib/badges/mintAuthorization'
import { BADGE_MINT_REQUEST_MAX_AGE_MS }  from '@/lib/badge-mint-message'

// ─────────────────────────────────────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────────────────────────────────────

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/

function err(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET handler
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    // ── 1. Parse and validate query params ────────────────────────────────────
    const badgeIdParam   = req.nextUrl.searchParams.get('badgeId')
    const walletParam    = req.nextUrl.searchParams.get('walletAddress')

    if (!walletParam || !ADDR_RE.test(walletParam.trim())) {
      return err('walletAddress query param must be a valid 0x Ethereum address', 400)
    }
    const signerWallet = walletParam.trim().toLowerCase()

    if (!badgeIdParam || !badgeIdParam.trim()) {
      return err('badgeId query parameter is required', 400)
    }
    const normalizedBadgeId = badgeIdParam.trim().toLowerCase()

    // ── 2. Resolve token ID ───────────────────────────────────────────────────
    const tokenId = getTokenIdForBadge(normalizedBadgeId)
    if (tokenId === undefined || !isActiveBadgeTokenId(tokenId)) {
      return err(`badgeId '${normalizedBadgeId}' is not a valid active badge`, 400)
    }

    // ── 3. DB: resolve profile ────────────────────────────────────────────────
    const supabase = getServerSupabaseClient()

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('wallet_address', signerWallet)
      .maybeSingle()

    if (profileErr) {
      console.error('[GET /api/badges/mint-signature] profile lookup:', profileErr)
      return err('Failed to look up profile', 500)
    }
    if (!profile) {
      return err('No profile found for this wallet', 403)
    }

    // ── 4. DB: check badge eligibility ────────────────────────────────────────
    const { data: userBadge, error: badgeErr } = await supabase
      .from('user_badges')
      .select('id, minted_onchain')
      .eq('profile_id', profile.id)
      .eq('badge_id', normalizedBadgeId)
      .maybeSingle()

    if (badgeErr) {
      console.error('[GET /api/badges/mint-signature] user_badges lookup:', badgeErr)
      return err('Failed to check badge eligibility', 500)
    }
    if (!userBadge) {
      return err('Badge not earned — mint signature denied', 403)
    }
    if (userBadge.minted_onchain) {
      return NextResponse.json(
        { ok: false, error: 'Badge already minted on Base' },
        { status: 409 },
      )
    }

    // ── 5. Generate nonce ─────────────────────────────────────────────────────
    const nonce = generateMintNonce()

    // ── 6. Insert nonce into badge_mint_nonces (used_at = null) ───────────────
    // Insert before signing — if DB fails, no signature is issued.
    const { error: nonceErr } = await supabase
      .from('badge_mint_nonces')
      .insert({
        nonce,
        wallet_address: signerWallet,
        badge_id:       normalizedBadgeId,
        token_id:       tokenId,
      })

    if (nonceErr) {
      console.error('[GET /api/badges/mint-signature] nonce insert:', nonceErr)
      return err('Failed to store mint nonce — please retry', 500)
    }

    // ── 7. Sign EIP-712 MintBadge struct ──────────────────────────────────────
    let mintAuth: Awaited<ReturnType<typeof signMintAuthorization>>
    try {
      mintAuth = await signMintAuthorization(
        signerWallet as `0x${string}`,
        tokenId,
        nonce,
      )
    } catch (sigErr) {
      // Clean up the nonce so the user can retry once the key is fixed
      await supabase.from('badge_mint_nonces').delete().eq('nonce', nonce)
      console.error('[GET /api/badges/mint-signature] sign error:', sigErr)
      return err('Backend signer error — please contact support', 500)
    }

    // ── 8. Return authorization ───────────────────────────────────────────────
    const expiresAt = new Date(Date.now() + BADGE_MINT_REQUEST_MAX_AGE_MS).toISOString()

    return NextResponse.json({
      ok:        true,
      badgeId:   normalizedBadgeId,
      tokenId,
      nonce:     mintAuth.nonce,
      signature: mintAuth.signature,
      expiresAt,
    })
  } catch (error) {
    console.error('[GET /api/badges/mint-signature] unhandled:', error)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}
