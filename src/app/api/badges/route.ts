/**
 * API Route — /api/badges
 *
 * GET /api/badges?walletAddress=0x...
 *
 * Returns the earned badges for a given wallet address by querying
 * the user_badges table. Read-only — no writes, no badge awards here.
 *
 * Response:
 *   {
 *     ok:             true,
 *     earnedBadgeIds: string[],          // badge IDs the wallet has earned
 *     earnedBadges:   { badgeId: string, earnedAt: string }[]
 *   }
 *
 * If the wallet has no profile or has earned no badges the arrays are
 * empty — not an error.
 *
 * Phase B (not yet): badge award engine will write to user_badges.
 * This route is intentionally read-only for Phase A.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'
import { verifyBaseWalletAuth }           from '@/lib/auth/verify-base-wallet'
import {
  BADGE_MINT_CONFIRM_ACTION,
  BADGE_MINT_REQUEST_MAX_AGE_MS,
}                                         from '@/lib/badge-mint-message'
import {
  getTokenIdForBadge,
  isActiveBadgeTokenId,
}                                         from '@/lib/badges/tokenIds'

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

function isValidAddress(addr: unknown): addr is string {
  return typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/i.test(addr.trim())
}

function err(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

// Regex for PATCH validation — mirrors patterns in PATCH /api/predictions
const TX_HASH_RE   = /^0x[0-9a-fA-F]{64}$/
const BYTES32_RE   = /^0x[0-9a-fA-F]{64}$/
const WALLET_LINE_RE    = /^Wallet: (0x[0-9a-fA-F]{40})$/im
const BADGE_ID_LINE_RE  = /^Badge ID: (.+)$/im
const TOKEN_ID_LINE_RE  = /^Token ID: (\d+)$/im
const TX_HASH_LINE_RE   = /^Tx Hash: (0x[0-9a-fA-F]{64})$/im
const NONCE_LINE_RE     = /^Nonce: (0x[0-9a-fA-F]{64})$/im
const TIMESTAMP_LINE_RE = /^Timestamp: (.+)$/im

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/badges?walletAddress=0x...
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const walletAddress = req.nextUrl.searchParams.get('walletAddress')

  if (!walletAddress) {
    return err('walletAddress query parameter is required', 400)
  }
  if (!isValidAddress(walletAddress)) {
    return err('Invalid walletAddress — must be a 0x Ethereum address', 400)
  }

  const normalized = walletAddress.toLowerCase()

  try {
    const supabase = getServerSupabaseClient()

    // ── 1. Resolve profile ID ─────────────────────────────────────────────────
    // user_badges is keyed by profile UUID — we need to look it up first.
    // If no profile exists yet (new wallet), return empty arrays — not an error.
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('wallet_address', normalized)
      .maybeSingle()

    if (profileErr) {
      console.error('[GET /api/badges] profile lookup:', profileErr)
      return err('Failed to look up profile', 500)
    }

    if (!profile) {
      // Wallet exists but has never connected — no badges possible yet.
      return NextResponse.json({
        ok:             true,
        earnedBadgeIds: [] as string[],
        earnedBadges:   [] as { badgeId: string; earnedAt: string }[],
      })
    }

    // ── 2. Fetch earned badges for this profile ───────────────────────────────
    // user_badges has a UNIQUE (profile_id, badge_id) constraint — no dupes.
    const { data: userBadges, error: badgesErr } = await supabase
      .from('user_badges')
      .select('badge_id, awarded_at')
      .eq('profile_id', profile.id)
      .order('awarded_at', { ascending: true })   // oldest first → consistent order

    if (badgesErr) {
      console.error('[GET /api/badges] user_badges query:', badgesErr)
      return err('Failed to fetch badges', 500)
    }

    const rows = userBadges ?? []

    return NextResponse.json({
      ok:             true,
      earnedBadgeIds: rows.map(r => r.badge_id),
      earnedBadges:   rows.map(r => ({
        badgeId:  r.badge_id,
        earnedAt: r.awarded_at,
      })),
    })
  } catch (error) {
    console.error('[GET /api/badges] unhandled:', error)
    return err('Internal server error', 500)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/badges
//
// Records that a badge NFT has been successfully minted on Base Mainnet.
// Called by the frontend after mintBadge() TX confirms — no on-chain RPC
// verification in Phase 5B (frontend uses wagmi's useWaitForTransactionReceipt
// before calling this endpoint).
//
// Request body:
//   { badgeId: string, txHash: string, tokenId: number, nonce: string }
//
// Request headers:
//   x-wallet-message   — URL-encoded buildBadgeMintConfirmMessage() output
//   x-wallet-signature — 0x-prefixed ECDSA signature from the wallet
//
// Security model:
//   • Wallet extracted from signed message — never from body.
//   • Signed message binds badgeId + tokenId + txHash + nonce so a confirm
//     signature cannot be replayed across different badges, transactions, or
//     nonces.
//   • Nonce ownership is verified: badge_mint_nonces row must exist with the
//     matching nonce + wallet + badge + token, and used_at must be null.
//   • Idempotent: same txHash already stored → 200, different txHash → 409.
//   • No XP awarded here — XP is issued at badge earn time, not mint time.
//
// DB writes (only on first successful call):
//   user_badges:       minted_onchain=true, minted_at, onchain_tx_hash,
//                      token_id, chain_id
//   badge_mint_nonces: used_at=now()
// ─────────────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    // ── 1. Parse and validate request body ────────────────────────────────────
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return err('Invalid JSON body', 400)

    const { badgeId, txHash, tokenId, nonce } = body as Record<string, unknown>

    if (!badgeId || typeof badgeId !== 'string' || !badgeId.trim()) {
      return err('badgeId is required', 400)
    }
    const normalizedBadgeId = badgeId.trim().toLowerCase()

    // Resolve and validate token ID from mapping
    const expectedTokenId = getTokenIdForBadge(normalizedBadgeId)
    if (expectedTokenId === undefined || !isActiveBadgeTokenId(expectedTokenId)) {
      return err(`badgeId '${normalizedBadgeId}' is not a valid active badge`, 400)
    }

    // body tokenId must match the canonical mapping
    const parsedTokenId = Number(tokenId)
    if (!Number.isInteger(parsedTokenId) || parsedTokenId !== expectedTokenId) {
      return err(
        `tokenId ${parsedTokenId} does not match badge mapping for '${normalizedBadgeId}'`,
        400,
      )
    }

    if (!txHash || typeof txHash !== 'string' || !TX_HASH_RE.test(txHash)) {
      return err('txHash must be a 0x-prefixed 64-hex transaction hash', 400)
    }
    const normalizedTxHash = txHash.toLowerCase()

    if (!nonce || typeof nonce !== 'string' || !BYTES32_RE.test(nonce)) {
      return err('nonce must be a 0x-prefixed bytes32 hex string', 400)
    }
    const normalizedNonce = nonce.toLowerCase()

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
      return err('x-wallet-message could not be URL-decoded', 401)
    }

    // ── 3. Extract wallet from message (never from body) ──────────────────────
    const walletMatch = msgHeader.match(WALLET_LINE_RE)
    if (!walletMatch) return err('Wallet address not found in signed message', 401)
    const signerWallet = walletMatch[1].toLowerCase()

    // ── 4. Verify action string ────────────────────────────────────────────────
    if (!msgHeader.includes(`Action: ${BADGE_MINT_CONFIRM_ACTION}`)) {
      return err('Signed message action mismatch', 401)
    }

    // ── 5. Verify message binds body values (anti-replay) ─────────────────────
    const msgBadgeId = msgHeader.match(BADGE_ID_LINE_RE)?.[1]?.trim().toLowerCase()
    if (msgBadgeId !== normalizedBadgeId) {
      return err('Signed message badge ID does not match body', 401)
    }

    const msgTokenId = msgHeader.match(TOKEN_ID_LINE_RE)?.[1]
    if (Number(msgTokenId) !== parsedTokenId) {
      return err('Signed message token ID does not match body', 401)
    }

    const msgTxHash = msgHeader.match(TX_HASH_LINE_RE)?.[1]?.toLowerCase()
    if (msgTxHash !== normalizedTxHash) {
      return err('Signed message tx hash does not match body', 401)
    }

    const msgNonce = msgHeader.match(NONCE_LINE_RE)?.[1]?.toLowerCase()
    if (msgNonce !== normalizedNonce) {
      return err('Signed message nonce does not match body', 401)
    }

    // ── 6. Timestamp freshness ─────────────────────────────────────────────────
    const tsMatch = msgHeader.match(TIMESTAMP_LINE_RE)
    if (tsMatch) {
      const signedTime = new Date(tsMatch[1].trim()).getTime()
      if (isNaN(signedTime) || Date.now() - signedTime > BADGE_MINT_REQUEST_MAX_AGE_MS) {
        return err('Mint confirm signature has expired — sign a fresh message', 401)
      }
    }

    // ── 7. Cryptographic signature verification (ERC-6492 / smart-wallet safe) ─
    const authResult = await verifyBaseWalletAuth(req, signerWallet, BADGE_MINT_CONFIRM_ACTION)
    if (!authResult.verified) {
      return err('Invalid wallet signature', 401)
    }

    // ── 8. DB: resolve profile ────────────────────────────────────────────────
    const supabase = getServerSupabaseClient()

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('wallet_address', signerWallet)
      .maybeSingle()

    if (profileErr) {
      console.error('[PATCH /api/badges] profile lookup:', profileErr)
      return err('Failed to look up profile', 500)
    }
    if (!profile) return err('No profile found for this wallet', 403)

    // ── 9. DB: check badge row and ownership ──────────────────────────────────
    const { data: userBadge, error: badgeErr } = await supabase
      .from('user_badges')
      .select('id, minted_onchain, onchain_tx_hash')
      .eq('profile_id', profile.id)
      .eq('badge_id', normalizedBadgeId)
      .maybeSingle()

    if (badgeErr) {
      console.error('[PATCH /api/badges] user_badges lookup:', badgeErr)
      return err('Failed to check badge eligibility', 500)
    }
    if (!userBadge) {
      return err('Badge not earned by this wallet', 403)
    }

    // ── 10. Idempotency ────────────────────────────────────────────────────────
    if (userBadge.minted_onchain) {
      if (userBadge.onchain_tx_hash === normalizedTxHash) {
        // Same tx already recorded — safe retry
        return NextResponse.json({
          ok:           true,
          badgeId:      normalizedBadgeId,
          tokenId:      parsedTokenId,
          mintedOnchain: true,
          txHash:       normalizedTxHash,
        })
      }
      // Already minted with a different tx — refuse to overwrite
      return NextResponse.json(
        { ok: false, error: 'Badge already minted on Base with a different transaction' },
        { status: 409 },
      )
    }

    // ── 11. Verify nonce ownership and availability ───────────────────────────
    const { data: nonceRow, error: nonceErr } = await supabase
      .from('badge_mint_nonces')
      .select('nonce, wallet_address, badge_id, token_id, used_at')
      .eq('nonce', normalizedNonce)
      .maybeSingle()

    if (nonceErr) {
      console.error('[PATCH /api/badges] nonce lookup:', nonceErr)
      return err('Failed to verify nonce', 500)
    }
    if (!nonceRow) {
      return err('Nonce not found — was not issued by this server', 401)
    }
    if (nonceRow.wallet_address !== signerWallet) {
      return err('Nonce was issued to a different wallet', 401)
    }
    if (nonceRow.badge_id !== normalizedBadgeId) {
      return err('Nonce was issued for a different badge', 401)
    }
    if (nonceRow.token_id !== parsedTokenId) {
      return err('Nonce was issued for a different token ID', 401)
    }
    if (nonceRow.used_at !== null) {
      return err('Nonce has already been consumed', 401)
    }

    // ── 12. Persist mint state ─────────────────────────────────────────────────
    const now = new Date().toISOString()

    const { error: updateBadgeErr } = await supabase
      .from('user_badges')
      .update({
        minted_onchain:  true,
        minted_at:       now,
        onchain_tx_hash: normalizedTxHash,
        token_id:        parsedTokenId,
        chain_id:        8453,
      })
      .eq('id', userBadge.id)

    if (updateBadgeErr) {
      console.error('[PATCH /api/badges] user_badges update:', updateBadgeErr)
      return err('Failed to record mint state', 500)
    }

    // ── 13. Mark nonce as consumed ────────────────────────────────────────────
    const { error: updateNonceErr } = await supabase
      .from('badge_mint_nonces')
      .update({ used_at: now })
      .eq('nonce', normalizedNonce)

    if (updateNonceErr) {
      // Non-fatal: user_badges was already updated. Log and continue — the
      // nonce is effectively spent (the on-chain contract already used it).
      console.error('[PATCH /api/badges] nonce used_at update:', updateNonceErr)
    }

    console.log(
      `[PATCH /api/badges] minted badge '${normalizedBadgeId}' (token ${parsedTokenId})` +
      ` for ${signerWallet} — tx ${normalizedTxHash}`,
    )

    return NextResponse.json({
      ok:            true,
      badgeId:       normalizedBadgeId,
      tokenId:       parsedTokenId,
      mintedOnchain: true,
      txHash:        normalizedTxHash,
    })
  } catch (error) {
    console.error('[PATCH /api/badges] unhandled:', error)
    return err('Internal server error', 500)
  }
}
