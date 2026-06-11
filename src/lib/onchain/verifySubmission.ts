/**
 * Server-side transaction receipt verification for PredixiCommitmentRegistry.
 *
 * Called from all three POST handlers (predictions, daily-xi, wc-predictions)
 * to verify a submitCommitment() Base transaction before accepting any submission.
 *
 * Replaces the inline verification code that was previously only in the
 * PATCH /api/daily-xi handler.
 */

import { createPublicClient, custom, decodeEventLog } from 'viem'
import { base }                                        from 'viem/chains'
import { ProxyAgent, fetch as undiciF }                from 'undici'
import {
  COMMITMENT_REGISTRY_ABI,
  getCommitmentContractAddress,
}                                                      from '@/lib/onchain/contracts'

// ── Proxy-aware Base Mainnet public client ────────────────────────────────────
// Same pattern as /api/predictions and /api/daily-xi PATCH — proxy support
// for local Windows dev behind nekobox / v2ray; plain fetch on Vercel.

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

const basePublicClient = buildBasePublicClient()

// ── Verification result type ──────────────────────────────────────────────────

export type VerifyResult =
  | { ok: true;  blockNumber: bigint }
  | { ok: false; error: string }

// ── TX hash format check ──────────────────────────────────────────────────────

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/

// ── Main verification function ────────────────────────────────────────────────

/**
 * Verify that a Base transaction contains a valid CommitmentSubmitted event
 * from PredixiCommitmentRegistry, matching the expected submitter and hash.
 *
 * Checks:
 *   1. txHash is a valid 0x-prefixed 64-hex string
 *   2. Contract address is configured
 *   3. Transaction receipt exists and status === 'success'
 *   4. A CommitmentSubmitted event is present from the registry contract
 *   5. event.user.toLowerCase() === walletAddress.toLowerCase()
 *   6. event.commitmentHash.toLowerCase() === expectedHash.toLowerCase()
 *
 * Smart wallet note: Base Account / Coinbase Smart Wallet routes transactions
 * through the ERC-4337 EntryPoint, so receipt.to points to the EntryPoint, not
 * the registry. We filter by log address (always the registry) instead of receipt.to.
 */
export async function verifyOnchainSubmission(
  txHash:       string,
  walletAddress: string,
  expectedHash: string,
): Promise<VerifyResult> {
  if (!TX_HASH_RE.test(txHash)) {
    return { ok: false, error: 'Invalid txHash format — expected 0x-prefixed 64-hex string' }
  }

  const contractAddress = getCommitmentContractAddress()
  if (!contractAddress) {
    return { ok: false, error: 'Commitment contract not configured — cannot verify transaction' }
  }

  let receipt: Awaited<ReturnType<typeof basePublicClient.getTransactionReceipt>>
  try {
    receipt = await basePublicClient.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `Could not fetch transaction receipt from Base: ${detail}` }
  }

  if (receipt.status !== 'success') {
    return { ok: false, error: 'Transaction reverted — submitCommitment did not succeed' }
  }

  // Filter logs from the registry contract — log.address is always the registry
  // regardless of whether an EOA or a Smart Wallet EntryPoint called it.
  const contractAddrLower = contractAddress.toLowerCase()
  const registryLogs = receipt.logs.filter(
    log => log.address.toLowerCase() === contractAddrLower,
  )

  let commitmentLog: { user: string; commitmentHash: string } | null = null
  for (const log of registryLogs) {
    try {
      const decoded = decodeEventLog({
        abi:       COMMITMENT_REGISTRY_ABI,
        data:      log.data,
        topics:    log.topics,
        eventName: 'CommitmentSubmitted',
      })
      commitmentLog = {
        user:           (decoded.args.user as string).toLowerCase(),
        commitmentHash: (decoded.args.commitmentHash as string).toLowerCase(),
      }
      break
    } catch {
      // Not a CommitmentSubmitted log — skip
    }
  }

  if (!commitmentLog) {
    return {
      ok: false,
      error: 'Transaction did not emit CommitmentSubmitted from the registry contract',
    }
  }

  if (commitmentLog.user !== walletAddress.toLowerCase()) {
    return { ok: false, error: 'On-chain event submitter does not match walletAddress' }
  }

  if (commitmentLog.commitmentHash !== expectedHash.toLowerCase()) {
    return { ok: false, error: 'On-chain commitment hash does not match expected hash' }
  }

  return { ok: true, blockNumber: receipt.blockNumber }
}
