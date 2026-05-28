/**
 * Smart-wallet-compatible signature verification for Base chain.
 *
 * Uses publicClient.verifyMessage() which supports:
 *   - EOA wallets (ecrecover / 65-byte signatures)
 *   - ERC-1271 smart contract wallets (on-chain isValidSignature call)
 *   - ERC-6492 counterfactual smart wallets (Base Account, Coinbase Smart Wallet)
 *
 * The standalone viem verifyMessage() helper is EOA-only and will always fail
 * for Base App wallets. Use this module in any route that must accept smart-wallet
 * signatures.
 *
 * The RPC call goes to mainnet.base.org.  On local Windows dev behind a proxy,
 * set HTTPS_PROXY (or HTTP_PROXY) in .env.local — the same proxy env that the
 * Supabase server client and /api/predictions already use.
 */

import { createPublicClient, custom } from 'viem'
import { base }                        from 'viem/chains'
import { ProxyAgent, fetch as undiciF } from 'undici'
import type { NextRequest }            from 'next/server'
import { normalizeWalletAddress }      from './wallet-signature'

// ─────────────────────────────────────────────────────────────────────────────
// Base public client — proxy-aware, created once at module load
// ─────────────────────────────────────────────────────────────────────────────

function buildBasePublicClient() {
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

export const basePublicClient = buildBasePublicClient()

// ─────────────────────────────────────────────────────────────────────────────
// Verify result type
// ─────────────────────────────────────────────────────────────────────────────

export type BaseWalletVerifyResult = {
  checked:  boolean
  verified: boolean
  reason?:  string
}

// ─────────────────────────────────────────────────────────────────────────────
// verifyBaseWalletAuth
//
// Reads x-wallet-message + x-wallet-signature from the request headers.
// Validates:
//   1. Headers are present
//   2. Message contains the expected wallet address
//   3. Message contains the expected action string
//   4. Signature is cryptographically valid (smart-wallet-compatible)
//
// Returns { verified: false } — never throws — on any error.
// ─────────────────────────────────────────────────────────────────────────────

export async function verifyBaseWalletAuth(
  req:           NextRequest,
  walletAddress: string,
  action:        string,
): Promise<BaseWalletVerifyResult> {
  const rawMsgHeader = req.headers.get('x-wallet-message')
  const sigHeader    = req.headers.get('x-wallet-signature')

  if (!rawMsgHeader || !sigHeader) {
    return { checked: false, verified: false, reason: 'missing-headers' }
  }

  // Client encodes the message with encodeURIComponent to make it header-safe
  // (the message contains \n which is forbidden in HTTP header values).
  // Decode here before any string matching or cryptographic verification.
  let msgHeader: string
  try {
    msgHeader = decodeURIComponent(rawMsgHeader)
  } catch {
    return { checked: true, verified: false, reason: 'message-decode-error' }
  }

  const normalized = normalizeWalletAddress(walletAddress)

  if (!msgHeader.includes(`Wallet: ${normalized}`)) {
    return { checked: true, verified: false, reason: 'wallet-mismatch' }
  }
  if (!msgHeader.includes(`Action: ${action}`)) {
    return { checked: true, verified: false, reason: 'action-mismatch' }
  }

  try {
    const ok = await basePublicClient.verifyMessage({
      address:   walletAddress as `0x${string}`,
      message:   msgHeader,           // original decoded message — what was actually signed
      signature: sigHeader as `0x${string}`,
    })
    return ok
      ? { checked: true, verified: true }
      : { checked: true, verified: false, reason: 'signature-mismatch' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { checked: true, verified: false, reason: `verify-error: ${msg}` }
  }
}
