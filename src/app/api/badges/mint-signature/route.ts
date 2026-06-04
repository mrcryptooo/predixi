/**
 * API Route — GET /api/badges/mint-signature?badgeId=...
 *
 * Issues a backend EIP-712 MintBadge signature so the caller can invoke
 * mintBadge() on the PrediXIBadges contract.
 *
 * ── Auth ─────────────────────────────────────────────────────────────────────
 *
 * Requires two request headers carrying an EIP-191 signed message:
 *   x-wallet-message   — URL-encoded output of buildBadgeMintRequestMessage()
 *   x-wallet-signature — 0x-prefixed ECDSA signature from the wallet
 *
 * The wallet address is extracted from the signed message — never from the
 * query string or request body.  If the message timestamp is older than
 * BADGE_MINT_REQUEST_MAX_AGE_MS the request is rejected.
 *
 * ── Eligibility checks ────────────────────────────────────────────────────────
 *
 *   1. badgeId query param is present and active (token ID 1–19)
 *   2. Signed message binds the correct badgeId + tokenId (anti-replay)
 *   3. Wallet owns a profile in the DB
 *   4. user_badges row exists for that profile + badgeId
 *   5. minted_onchain === false
 *
 * ── Success flow ─────────────────────────────────────────────────────────────
 *
 *   1. Generate random bytes32 nonce
 *   2. Insert nonce into badge_mint_nonces (used_at = null)
 *   3. Sign MintBadge(wallet, tokenId, nonce) with BADGE_SIGNER_KEY
 *   4. Return { ok, badgeId, tokenId, nonce, signature, expiresAt }
 *
 * ── Response ─────────────────────────────────────────────────────────────────
 *
 *   200  { ok: true, badgeId, tokenId, nonce, signature, expiresAt }
 *   400  missing/invalid badgeId or malformed headers
 *   401  missing, expired, or invalid wallet signature
 *   403  badge not earned by this wallet
 *   409  badge already minted on Base
 *   500  internal error (signer misconfigured, DB error)
 *
 * ── Security model ────────────────────────────────────────────────────────────
 *
 *   • Wallet is always extracted from the signed message body.
 *   • The signed message includes badgeId + tokenId — prevents using a valid
 *     mint-request signature for one badge to request a signature for another.
 *   • BADGE_SIGNER_KEY is never logged.
 *   • signMintAuthorization() validates the derived signer address matches
 *     the expected contract signer before issuing any signature.
 *   • The nonce is stored before the signature is returned — if the response
 *     is lost, the same nonce cannot be reissued (the insert would conflict).
 *     Phase 6 can implement idempotent re-issuance if needed.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'
import { verifyBaseWalletAuth }           from '@/lib/auth/verify-base-wallet'
import {
  BADGE_MINT_REQUEST_ACTION,
  BADGE_MINT_REQUEST_MAX_AGE_MS,
}                                         from '@/lib/badge-mint-message'
import {
  getTokenIdForBadge,
  isActiveBadgeTokenId,
}                                         from '@/lib/badges/tokenIds'
import {
  generateMintNonce,
  signMintAuthorization,
}                                         from '@/lib/badges/mintAuthorization'

// ─────────────────────────────────────────────────────────────────────────────
// Regex helpers (mirrors pattern used in PATCH /api/predictions)
// ─────────────────────────────────────────────────────────────────────────────

const WALLET_LINE_RE    = /^Wallet: (0x[0-9a-fA-F]{40})$/im
const BADGE_ID_LINE_RE  = /^Badge ID: (.+)$/im
const TOKEN_ID_LINE_RE  = /^Token ID: (\d+)$/im
const TIMESTAMP_LINE_RE = /^Timestamp: (.+)$/im

// ─────────────────────────────────────────────────────────────────────────────
// Response helpers
// ─────────────────────────────────────────────────────────────────────────────

function err(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET handler
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    // ── 1. Read and validate badgeId query param ──────────────────────────────
    const badgeId = req.nextUrl.searchParams.get('badgeId')
    if (!badgeId || typeof badgeId !== 'string' || !badgeId.trim()) {
      return err('badgeId query parameter is required', 400)
    }
    const normalizedBadgeId = badgeId.trim().toLowerCase()

    // Resolve token ID and verify it is an active badge (1–19)
    const tokenId = getTokenIdForBadge(normalizedBadgeId)
    if (tokenId === undefined || !isActiveBadgeTokenId(tokenId)) {
      return err(`badgeId '${normalizedBadgeId}' is not a valid active badge`, 400)
    }

    // ── 2. Decode and validate signed message ─────────────────────────────────
    const rawMsgHeader = req.headers.get('x-wallet-message')
    const sigHeader    = req.headers.get('x-wallet-signature')

    if (!rawMsgHeader || !sigHeader) {
      return err('x-wallet-message and x-wallet-signature headers are required', 401)
    }

    let msgHeader: string
    try {
      msgHeader = decodeURIComponent(rawMsgHeader)
    } catch {
      return err('x-wallet-message header could not be URL-decoded', 401)
    }

    // ── 3. Extract wallet from signed message (never from query/body) ──────────
    const walletMatch = msgHeader.match(WALLET_LINE_RE)
    if (!walletMatch) {
      return err('Wallet address not found in signed message', 401)
    }
    const signerWallet = walletMatch[1].toLowerCase()

    // ── 4. Verify action string (prevents cross-action replay) ─────────────────
    if (!msgHeader.includes(`Action: ${BADGE_MINT_REQUEST_ACTION}`)) {
      return err('Signed message action mismatch', 401)
    }

    // ── 5. Verify message binds the expected badgeId (anti-replay across badges)
    const msgBadgeIdMatch = msgHeader.match(BADGE_ID_LINE_RE)
    const msgBadgeId      = msgBadgeIdMatch?.[1]?.trim().toLowerCase()
    if (msgBadgeId !== normalizedBadgeId) {
      return err('Signed message badge ID does not match query parameter', 401)
    }

    // ── 6. Verify message binds the expected tokenId ───────────────────────────
    const msgTokenIdMatch = msgHeader.match(TOKEN_ID_LINE_RE)
    const msgTokenId      = msgTokenIdMatch ? Number(msgTokenIdMatch[1]) : undefined
    if (msgTokenId !== tokenId) {
      return err('Signed message token ID does not match badge mapping', 401)
    }

    // ── 7. Timestamp freshness check ──────────────────────────────────────────
    const tsMatch = msgHeader.match(TIMESTAMP_LINE_RE)
    if (tsMatch) {
      const signedTime = new Date(tsMatch[1].trim()).getTime()
      if (isNaN(signedTime) || Date.now() - signedTime > BADGE_MINT_REQUEST_MAX_AGE_MS) {
        return err('Mint request signature has expired — sign a fresh message', 401)
      }
    }

    // ── 8. Cryptographic signature verification (ERC-6492 / smart-wallet safe) ─
    const authResult = await verifyBaseWalletAuth(req, signerWallet, BADGE_MINT_REQUEST_ACTION)
    if (!authResult.verified) {
      return err('Invalid wallet signature', 401)
    }

    // ── 9. DB: resolve profile ────────────────────────────────────────────────
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

    // ── 10. DB: check badge eligibility ──────────────────────────────────────
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
      // Badge not earned — do not reveal whether the badge exists
      return err('Badge not earned — mint signature denied', 403)
    }

    if (userBadge.minted_onchain) {
      return NextResponse.json(
        { ok: false, error: 'Badge already minted on Base' },
        { status: 409 },
      )
    }

    // ── 11. Generate nonce ─────────────────────────────────────────────────────
    const nonce = generateMintNonce()

    // ── 12. Insert nonce into badge_mint_nonces (used_at = null) ───────────────
    // Insert before signing — if the DB write fails, no signature is issued.
    // The nonce PRIMARY KEY prevents the same nonce from being double-inserted
    // (astronomically unlikely with randomBytes(32), but guarded anyway).
    const { error: nonceErr } = await supabase
      .from('badge_mint_nonces')
      .insert({
        nonce,
        wallet_address: signerWallet,
        badge_id:       normalizedBadgeId,
        token_id:       tokenId,
        // used_at intentionally omitted — stays null until mint confirms
      })

    if (nonceErr) {
      console.error('[GET /api/badges/mint-signature] nonce insert:', nonceErr)
      return err('Failed to store mint nonce — please retry', 500)
    }

    // ── 13. Sign EIP-712 MintBadge struct ─────────────────────────────────────
    let mintAuth: Awaited<ReturnType<typeof signMintAuthorization>>
    try {
      mintAuth = await signMintAuthorization(
        signerWallet as `0x${string}`,
        tokenId,
        nonce,
      )
    } catch (sigErr) {
      // Delete the nonce so the user can retry after the key is fixed
      await supabase.from('badge_mint_nonces').delete().eq('nonce', nonce)
      console.error('[GET /api/badges/mint-signature] sign error:', sigErr)
      return err('Backend signer error — please contact support', 500)
    }

    // ── 14. Return authorization ───────────────────────────────────────────────
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
    return err('Internal server error', 500)
  }
}
