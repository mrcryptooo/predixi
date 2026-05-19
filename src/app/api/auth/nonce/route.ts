/**
 * GET /api/auth/nonce?wallet=0x...
 *
 * Returns a stateless nonce and a pre-built sign-in message for the wallet.
 * The client signs the returned message with personal_sign / eth_sign, then
 * includes the signature in write requests as:
 *   x-wallet-message: <message>
 *   x-wallet-signature: <0x signature>
 *
 * Nonce is timestamp-based (no DB required).  Freshness is enforced by the
 * Timestamp field embedded in the message — stale messages will be rejected
 * when enforcement is enabled (ENFORCE_WALLET_AUTH=true, Phase 2).
 *
 * No secrets. No auth required to call this endpoint.
 * Rate-limiting should be added at the edge layer when needed.
 */

import { type NextRequest, NextResponse } from 'next/server'
import {
  buildPredixiAuthMessage,
  generateNonce,
  normalizeWalletAddress,
  isValidWalletAddress,
} from '@/lib/auth/wallet-signature'

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')
  const action = req.nextUrl.searchParams.get('action') ?? 'sign-in'

  if (!wallet)                       return err('wallet query parameter is required', 400)
  if (!isValidWalletAddress(wallet)) return err('Invalid wallet address', 400)

  const normalized = normalizeWalletAddress(wallet)
  const nonce      = generateNonce()
  const message    = buildPredixiAuthMessage(normalized, action, nonce)

  return NextResponse.json({
    success: true,
    nonce,
    message,
    wallet:  normalized,
    action,
    // Clients should sign within this window; backend will validate freshness on enforcement
    expiresInMs: 10 * 60 * 1000,   // 10 minutes
  })
}
