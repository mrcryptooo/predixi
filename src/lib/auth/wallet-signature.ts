/**
 * Wallet Signature Verification — Phase 1 foundation
 *
 * Provides message building, optional signature verification, and address
 * normalisation for PrediXI user-write routes.
 *
 * ── Current enforcement state ────────────────────────────────────────────────
 *
 *   /api/predictions   — MANDATORY (Phase 4D, viem publicClient, ERC-6492)
 *   /api/wc-predictions — OPTIONAL (headers checked, not enforced yet)
 *   /api/daily-xi       — OPTIONAL (headers checked, not enforced yet)
 *
 * TODO (Phase 2): set ENFORCE_WALLET_AUTH=true in env and flip the guard in
 *   verifyOptionalWalletAuth() to reject when verified === false.
 *
 * ── Verification scope ────────────────────────────────────────────────────────
 *
 *   verifyWalletSignature() uses viem's standalone verifyMessage() which
 *   performs pure ecrecover — suitable for EOA wallets only.
 *
 *   Smart wallets (ERC-1271 / ERC-6492, e.g. Base Account) require an on-chain
 *   RPC call.  Use the publicClient.verifyMessage() pattern in
 *   /api/predictions/route.ts for those cases.
 *
 *   The optional layer here is intentionally EOA-only until smart-wallet
 *   coverage is added to the helper.
 *
 * ── Request headers for optional auth ────────────────────────────────────────
 *
 *   x-wallet-message   — the plaintext message that was signed
 *   x-wallet-signature — the 0x-prefixed hex signature
 */

import { type NextRequest } from 'next/server'
import { verifyMessage }    from 'viem'

// ── Address helpers ───────────────────────────────────────────────────────────

export function normalizeWalletAddress(address: string): string {
  return address.trim().toLowerCase()
}

export function isValidWalletAddress(addr: unknown): addr is string {
  return typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/i.test(addr.trim())
}

// ── Message builder ───────────────────────────────────────────────────────────
//
// Format is EIP-191 personal_sign compatible plain UTF-8.
// Changing this format is a breaking change — update the nonce route too.

export function buildPredixiAuthMessage(
  walletAddress: string,
  action:        string,
  nonce:         string,
): string {
  return [
    'Sign in to PrediXI',
    `Action: ${action}`,
    `Wallet: ${normalizeWalletAddress(walletAddress)}`,
    `Nonce: ${nonce}`,
    `Timestamp: ${new Date().toISOString()}`,
  ].join('\n')
}

// Stateless nonce: timestamp in base-36 — good for one-time request freshness.
// Does not require DB storage.  Freshness is validated via the Timestamp line.
export function generateNonce(): string {
  return Date.now().toString(36)
}

// ── Signature verification ────────────────────────────────────────────────────

export type VerifyResult = {
  verified: boolean
  reason?:  string
}

/**
 * Verify an EIP-191 wallet signature against a known message.
 * EOA only — does not perform on-chain ERC-1271 / ERC-6492 calls.
 * Returns false (never throws) on any error.
 */
export async function verifyWalletSignature({
  walletAddress,
  message,
  signature,
}: {
  walletAddress: string
  message:       string
  signature:     string
}): Promise<VerifyResult> {
  if (!isValidWalletAddress(walletAddress)) {
    return { verified: false, reason: 'invalid-address' }
  }
  if (!signature.startsWith('0x')) {
    return { verified: false, reason: 'invalid-signature-format' }
  }

  try {
    const ok = await verifyMessage({
      address:   walletAddress as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    })
    return ok
      ? { verified: true }
      : { verified: false, reason: 'signature-mismatch' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { verified: false, reason: `verify-error: ${msg}` }
  }
}

// ── Optional auth middleware ───────────────────────────────────────────────────
//
// Call this at the top of any write handler that wants to check (not enforce)
// wallet ownership.  Returns walletAuth metadata for the response.
//
// TODO: When ready to enforce, check process.env.ENFORCE_WALLET_AUTH === 'true'
//   and return a 401 when verified === false.

export type WalletAuthResult = {
  checked:   boolean
  verified:  boolean
  reason?:   string
}

export async function verifyOptionalWalletAuth(
  req:           NextRequest,
  walletAddress: string,
  action:        string,
): Promise<WalletAuthResult> {
  const sigHeader = req.headers.get('x-wallet-signature')
  const msgHeader = req.headers.get('x-wallet-message')

  // No headers provided — not checked, not rejected
  if (!sigHeader || !msgHeader) {
    return { checked: false, verified: false, reason: 'missing' }
  }

  // Verify the message contains the expected wallet address for this action
  // (prevents recycling a valid signature from a different action/wallet)
  const normalizedWallet = normalizeWalletAddress(walletAddress)
  if (!msgHeader.includes(`Wallet: ${normalizedWallet}`)) {
    return { checked: true, verified: false, reason: 'wallet-mismatch' }
  }
  if (!msgHeader.includes(`Action: ${action}`)) {
    return { checked: true, verified: false, reason: 'action-mismatch' }
  }

  const result = await verifyWalletSignature({
    walletAddress,
    message:   msgHeader,
    signature: sigHeader,
  })

  return { checked: true, ...result }
}
