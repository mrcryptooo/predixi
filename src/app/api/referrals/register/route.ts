/**
 * POST /api/referrals/register
 *
 * Links a new user to a referrer via referral code.
 * Awards 200 XP to the referrer (duplicate-safe via xp_events unique constraint).
 *
 * SECURITY: walletAddress is NOT trusted from the request body.
 * The referred wallet identity is derived exclusively from the signed
 * x-wallet-message header (EIP-191, verified via publicClient.verifyMessage
 * which supports EOA + ERC-1271 + ERC-6492 / Coinbase Smart Wallet).
 *
 * Body:
 *   { referralCode: string }
 *
 * Headers (required):
 *   x-wallet-message   — encodeURIComponent(buildPredixiAuthMessage(wallet, 'referral-register', nonce))
 *   x-wallet-signature — 0x-prefixed EIP-191 signature
 *
 * Responses:
 *   200 { ok: true,  status: "registered" | "already_registered", referrerWallet, xpAwarded }
 *   400 { ok: false, error: "INVALID_REFERRAL_CODE" }
 *   401 { ok: false, error: "SIGNATURE_REQUIRED" | "INVALID_SIGNATURE" }
 *   404 { ok: false, error: "REFERRAL_CODE_NOT_FOUND" }
 *   409 { ok: false, error: "SELF_REFERRAL_NOT_ALLOWED" | "ALREADY_REFERRED_BY_ANOTHER_USER"
 *                         | "ALREADY_ACTIVE_USER_CANNOT_BE_REFERRED" }
 *   429 { ok: false, error: "RATE_LIMITED" }
 *   500 { ok: false, error: "REFERRAL_REGISTER_FAILED" }
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }         from '@/lib/supabase/server'
import { registerReferral }                from '@/lib/referrals/registerReferral'
import type { ReferralErrorCode }          from '@/lib/referrals/registerReferral'
import { verifyBaseWalletAuth }            from '@/lib/auth/verify-base-wallet'

// ─────────────────────────────────────────────────────────────────────────────
// In-memory rate limiter
//
// Serverless caveat: this Map resets on cold starts. It provides meaningful
// protection within a warm function instance (burst retries, same-session spam)
// but is not persistent across invocations.
//
// Design: per authenticated wallet, max RATE_MAX_HITS attempts per RATE_WINDOW_MS.
// The limiter is checked AFTER signature verification so only authenticated
// wallets consume quota — an attacker cannot exhaust another wallet's budget
// without possessing its private key.
//
// For persistent rate limiting, Upstash Redis (or a DB table) would be required.
// ─────────────────────────────────────────────────────────────────────────────

const RATE_WINDOW_MS = 60_000   // 1-minute sliding window
const RATE_MAX_HITS  = 5        // max 5 verified attempts per wallet per window

type RateBucket = { count: number; windowStart: number }
const rateBuckets = new Map<string, RateBucket>()

function isRateLimited(wallet: string): boolean {
  const now    = Date.now()
  const bucket = rateBuckets.get(wallet)

  if (!bucket || now - bucket.windowStart > RATE_WINDOW_MS) {
    // New window — reset counter
    rateBuckets.set(wallet, { count: 1, windowStart: now })
    return false
  }

  bucket.count++
  return bucket.count > RATE_MAX_HITS
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isValidAddress(addr: unknown): addr is string {
  return typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/i.test(addr.trim())
}

/** Referral codes are 4–16 uppercase alphanumeric chars. */
function isValidCode(code: unknown): code is string {
  return typeof code === 'string' && /^[A-Z0-9]{4,16}$/.test(code.trim())
}

/**
 * Extract the wallet address embedded in the signed PrediXI auth message.
 * buildPredixiAuthMessage writes: "Wallet: <lowercase 0x address>"
 * Returns null if the line is absent or the address is invalid.
 */
function extractWalletFromMessage(decodedMessage: string): string | null {
  const match = decodedMessage.match(/(?:^|\n)Wallet:\s*(0x[0-9a-fA-F]{40})/i)
  if (!match) return null
  const addr = match[1].trim()
  return isValidAddress(addr) ? addr.toLowerCase() : null
}

const ERROR_STATUS: Record<ReferralErrorCode, number> = {
  SIGNATURE_REQUIRED:                       401,
  INVALID_SIGNATURE:                        401,
  INVALID_WALLET:                           400,
  INVALID_REFERRAL_CODE:                    400,
  REFERRAL_CODE_NOT_FOUND:                  404,
  SELF_REFERRAL_NOT_ALLOWED:                409,
  ALREADY_REFERRED_BY_ANOTHER_USER:         409,
  ALREADY_ACTIVE_USER_CANNOT_BE_REFERRED:   409,
  REFERRAL_REGISTER_FAILED:                 500,
}

// ─────────────────────────────────────────────────────────────────────────────
// POST
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ── 1. Parse body (only referralCode is required) ─────────────────────────
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'INVALID_REFERRAL_CODE' }, { status: 400 })
    }

    const { referralCode } = body as Record<string, unknown>

    if (!isValidCode(referralCode)) {
      return NextResponse.json({ ok: false, error: 'INVALID_REFERRAL_CODE' }, { status: 400 })
    }

    const normalizedCode = (referralCode as string).toUpperCase().trim()

    // ── 2. Check auth headers are present ─────────────────────────────────────
    const rawMsgHeader = req.headers.get('x-wallet-message')
    const sigHeader    = req.headers.get('x-wallet-signature')

    if (!rawMsgHeader || !sigHeader) {
      return NextResponse.json({ ok: false, error: 'SIGNATURE_REQUIRED' }, { status: 401 })
    }

    // ── 3. Decode message (client sends encodeURIComponent to avoid \n in header) ──
    let decodedMessage: string
    try {
      decodedMessage = decodeURIComponent(rawMsgHeader)
    } catch {
      return NextResponse.json({ ok: false, error: 'INVALID_SIGNATURE' }, { status: 401 })
    }

    // ── 4. Extract referred wallet from the signed message — never from body ───
    const referredWallet = extractWalletFromMessage(decodedMessage)
    if (!referredWallet) {
      return NextResponse.json({ ok: false, error: 'INVALID_SIGNATURE' }, { status: 401 })
    }

    // ── 5. Verify signature (ERC-6492 / ERC-1271 / EOA compatible) ────────────
    const walletAuth = await verifyBaseWalletAuth(req, referredWallet, 'referral-register')
    if (!walletAuth.verified) {
      const error: ReferralErrorCode = walletAuth.checked
        ? 'INVALID_SIGNATURE'
        : 'SIGNATURE_REQUIRED'
      // Log reason only — never log the raw message or signature
      console.warn('[POST /api/referrals/register] auth failed:', walletAuth.reason)
      return NextResponse.json({ ok: false, error }, { status: 401 })
    }

    // ── 5b. Per-wallet rate limit (checked after auth — only authentic wallets consume quota) ──
    if (isRateLimited(referredWallet)) {
      console.warn('[POST /api/referrals/register] rate limited:', referredWallet.slice(0, 10))
      return NextResponse.json({ ok: false, error: 'RATE_LIMITED' }, { status: 429 })
    }

    // ── 6. Delegate to helper (wallet is now ownership-verified) ──────────────
    const supabase = getServerSupabaseClient()
    const result   = await registerReferral(supabase, referredWallet, normalizedCode)

    if (!result.ok) {
      const status = ERROR_STATUS[result.error] ?? 500
      return NextResponse.json({ ok: false, error: result.error }, { status })
    }

    return NextResponse.json({
      ok:             true,
      status:         result.status,
      referrerWallet: result.referrerWallet,
      xpAwarded:      result.xpAwarded,
    })
  } catch (e) {
    console.error('[POST /api/referrals/register] unhandled:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ ok: false, error: 'REFERRAL_REGISTER_FAILED' }, { status: 500 })
  }
}
