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

import { type NextRequest, NextResponse }  from 'next/server'
import { createPublicClient, custom, decodeEventLog } from 'viem'
import { base }                            from 'viem/chains'
import { ProxyAgent, fetch as undiciF }    from 'undici'
import { getServerSupabaseClient }         from '@/lib/supabase/server'
import {
  getTokenIdForBadge,
  isActiveBadgeTokenId,
}                                          from '@/lib/badges/tokenIds'
import { PREDIXI_BADGE_CONTRACT }          from '@/lib/onchain/predixiBadges'

// ─────────────────────────────────────────────────────────────────────────────
// Base public client — proxy-aware (same pattern as /api/predictions)
// Used by PATCH handler to verify the mintBadge() transaction on-chain.
// ─────────────────────────────────────────────────────────────────────────────

function buildBadgesClient() {
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

const badgesPublicClient = buildBadgesClient()

// ─────────────────────────────────────────────────────────────────────────────
// BadgeMinted event ABI — used to parse TX logs in PATCH handler
// ─────────────────────────────────────────────────────────────────────────────

const BADGE_MINTED_ABI = [{
  type:   'event' as const,
  name:   'BadgeMinted',
  inputs: [
    { name: 'wallet',  type: 'address' as const, indexed: true  },
    { name: 'tokenId', type: 'uint256' as const, indexed: true  },
    { name: 'nonce',   type: 'bytes32' as const, indexed: false },
  ],
}] as const

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

function isValidAddress(addr: unknown): addr is string {
  return typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/i.test(addr.trim())
}

function err(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/
const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/

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
      .select('badge_id, awarded_at, minted_onchain, onchain_tx_hash, token_id, chain_id')
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
        badgeId:       r.badge_id,
        earnedAt:      r.awarded_at,
        mintedOnchain: r.minted_onchain   ?? false,
        onchainTxHash: r.onchain_tx_hash  ?? null,
        tokenId:       r.token_id         ?? null,
        chainId:       r.chain_id         ?? 8453,
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
// Called by the frontend after mintBadge() TX confirms on-chain.
//
// Request body:
//   { badgeId, tokenId, nonce, txHash, walletAddress }
//
// No wallet message signature required.
// Security is enforced by on-chain TX verification:
//   • TX exists and succeeded on Base
//   • A BadgeMinted event was emitted from the PrediXIBadges contract
//   • Event wallet == walletAddress, tokenId == tokenId, nonce == nonce
//
// Since only walletAddress could have sent the TX (EIP-712 binding in the
// contract enforces msg.sender == wallet), verifying the on-chain event
// is sufficient to prove ownership.
//
// No XP awarded here — XP is issued at badge earn time, not mint time.
// ─────────────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    // ── 1. Parse and validate body ────────────────────────────────────────────
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return err('Invalid JSON body', 400)

    const { badgeId, txHash, tokenId, nonce, walletAddress } = body as Record<string, unknown>

    if (!walletAddress || typeof walletAddress !== 'string' || !isValidAddress(walletAddress)) {
      return err('walletAddress must be a valid 0x Ethereum address', 400)
    }
    const signerWallet = (walletAddress as string).trim().toLowerCase()

    if (!badgeId || typeof badgeId !== 'string' || !badgeId.trim()) {
      return err('badgeId is required', 400)
    }
    const normalizedBadgeId = (badgeId as string).trim().toLowerCase()

    const expectedTokenId = getTokenIdForBadge(normalizedBadgeId)
    if (expectedTokenId === undefined || !isActiveBadgeTokenId(expectedTokenId)) {
      return err(`badgeId '${normalizedBadgeId}' is not a valid active badge`, 400)
    }
    const parsedTokenId = Number(tokenId)
    if (!Number.isInteger(parsedTokenId) || parsedTokenId !== expectedTokenId) {
      return err(`tokenId ${parsedTokenId} does not match badge mapping for '${normalizedBadgeId}'`, 400)
    }

    if (!txHash || typeof txHash !== 'string' || !TX_HASH_RE.test(txHash as string)) {
      return err('txHash must be a 0x-prefixed 64-hex transaction hash', 400)
    }
    const normalizedTxHash = (txHash as string).toLowerCase()

    if (!nonce || typeof nonce !== 'string' || !BYTES32_RE.test(nonce as string)) {
      return err('nonce must be a 0x-prefixed bytes32 hex string', 400)
    }
    const normalizedNonce = (nonce as string).toLowerCase()

    // ── 2. DB: resolve profile ────────────────────────────────────────────────
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

    // ── 3. DB: check badge row ────────────────────────────────────────────────
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
    if (!userBadge) return err('Badge not earned by this wallet', 403)

    // ── 4. Idempotency ─────────────────────────────────────────────────────────
    if (userBadge.minted_onchain) {
      if (userBadge.onchain_tx_hash === normalizedTxHash) {
        return NextResponse.json({
          ok: true, badgeId: normalizedBadgeId, tokenId: parsedTokenId,
          mintedOnchain: true, txHash: normalizedTxHash,
        })
      }
      return NextResponse.json(
        { ok: false, error: 'Badge already minted on Base with a different transaction' },
        { status: 409 },
      )
    }

    // ── 5. Verify nonce ownership ─────────────────────────────────────────────
    const { data: nonceRow, error: nonceErr } = await supabase
      .from('badge_mint_nonces')
      .select('nonce, wallet_address, badge_id, token_id, used_at')
      .eq('nonce', normalizedNonce)
      .maybeSingle()

    if (nonceErr) {
      console.error('[PATCH /api/badges] nonce lookup:', nonceErr)
      return err('Failed to verify nonce', 500)
    }
    if (!nonceRow)                               return err('Nonce not found — not issued by this server', 400)
    if (nonceRow.wallet_address !== signerWallet) return err('Nonce was issued to a different wallet', 400)
    if (nonceRow.badge_id       !== normalizedBadgeId) return err('Nonce was issued for a different badge', 400)
    if (nonceRow.token_id       !== parsedTokenId)    return err('Nonce was issued for a different token ID', 400)
    if (nonceRow.used_at        !== null)              return err('Nonce has already been consumed', 400)

    // ── 6. On-chain TX verification ───────────────────────────────────────────
    // Get the transaction receipt from Base Mainnet and parse the BadgeMinted
    // event to confirm the mint actually happened with the claimed args.
    let receipt: Awaited<ReturnType<typeof badgesPublicClient.getTransactionReceipt>>
    try {
      receipt = await badgesPublicClient.getTransactionReceipt({
        hash: normalizedTxHash as `0x${string}`,
      })
    } catch (rpcErr) {
      console.error('[PATCH /api/badges] receipt fetch:', rpcErr)
      return err('Could not fetch transaction receipt from Base — please retry', 500)
    }

    if (receipt.status !== 'success') {
      return err('Transaction reverted on Base — mint did not succeed', 400)
    }

    // Find the BadgeMinted log from the PrediXIBadges contract
    const contractAddr = (PREDIXI_BADGE_CONTRACT ?? '').toLowerCase()
    const badgeLogs = receipt.logs.filter(
      log => log.address.toLowerCase() === contractAddr,
    )

    let mintLog: { wallet: string; tokenId: bigint; nonce: string } | null = null
    for (const log of badgeLogs) {
      try {
        const decoded = decodeEventLog({
          abi:       BADGE_MINTED_ABI,
          data:      log.data,
          topics:    log.topics,
          eventName: 'BadgeMinted',
        })
        mintLog = {
          wallet:  (decoded.args.wallet as string).toLowerCase(),
          tokenId: decoded.args.tokenId as bigint,
          nonce:   (decoded.args.nonce  as string).toLowerCase(),
        }
        break
      } catch {
        // Not a BadgeMinted log — skip
      }
    }

    if (!mintLog) {
      return err('Transaction did not emit a BadgeMinted event from the PrediXIBadges contract', 400)
    }
    if (mintLog.wallet !== signerWallet) {
      return err('On-chain event wallet does not match walletAddress', 400)
    }
    if (Number(mintLog.tokenId) !== parsedTokenId) {
      return err('On-chain event token ID does not match request', 400)
    }
    if (mintLog.nonce !== normalizedNonce) {
      return err('On-chain event nonce does not match request', 400)
    }

    // ── 7. Persist mint state ─────────────────────────────────────────────────
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

    // ── 8. Mark nonce consumed ────────────────────────────────────────────────
    const { error: updateNonceErr } = await supabase
      .from('badge_mint_nonces')
      .update({ used_at: now })
      .eq('nonce', normalizedNonce)

    if (updateNonceErr) {
      // Non-fatal — contract's usedNonces mapping is the authoritative guard.
      console.error('[PATCH /api/badges] nonce used_at update:', updateNonceErr)
    }

    console.log(
      `[PATCH /api/badges] minted '${normalizedBadgeId}' (token ${parsedTokenId})` +
      ` wallet=${signerWallet} tx=${normalizedTxHash}`,
    )

    return NextResponse.json({
      ok: true, badgeId: normalizedBadgeId, tokenId: parsedTokenId,
      mintedOnchain: true, txHash: normalizedTxHash,
    })
  } catch (error) {
    console.error('[PATCH /api/badges] unhandled:', error)
    return err('Internal server error', 500)
  }
}
