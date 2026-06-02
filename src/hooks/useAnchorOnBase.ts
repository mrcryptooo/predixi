'use client'

import { useCallback, useMemo } from 'react'
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
  useAccount,
} from 'wagmi'
import {
  PREDIXI_COMMITMENT_CONTRACT,
  PREDIXI_BASE_CHAIN_ID,
  COMMITMENT_REGISTRY_ABI,
  isBytes32Hash,
  normalizeCommitmentContext,
  validateCommitmentConfig,
} from '@/lib/onchain/commitmentRegistry'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AnchorParams {
  /** bytes32 commitment hash: 0x-prefixed, exactly 64 hex chars. */
  commitmentHash: string
  /** Short label stored in the on-chain event log (not in contract storage). */
  context: string
}

export interface UseAnchorOnBaseResult {
  /** Call this to prompt the user's wallet and submit the commitment. */
  anchorCommitment: (params: AnchorParams) => void
  /** Wallet is prompting / user is signing. */
  isPending: boolean
  /** Transaction broadcast; waiting for on-chain confirmation. */
  isConfirming: boolean
  /** Transaction confirmed on Base Mainnet. */
  isConfirmed: boolean
  /** Confirmed transaction hash, or undefined if not yet submitted. */
  txHash: `0x${string}` | undefined
  /**
   * Human-readable error message, or null if no error.
   * Covers both wallet rejection and contract revert (AlreadySubmitted, ZeroHashNotAllowed).
   */
  error: string | null
  /** Reset all state back to idle — call before re-anchoring after an error. */
  reset: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Foundation hook for the optional "Anchor on Base" flow.
 *
 * Usage:
 *   const { anchorCommitment, isPending, isConfirming, isConfirmed, txHash, error } =
 *     useAnchorOnBase()
 *
 *   // Later, when the user explicitly clicks "Anchor on Base":
 *   anchorCommitment({
 *     commitmentHash: prediction.commitment_hash,
 *     context: buildCommitmentContext('match-prediction', prediction.id),
 *   })
 *
 * Nothing is called automatically. The hook is dormant until anchorCommitment is invoked.
 * No real transaction is sent until the user confirms in their wallet.
 */
export function useAnchorOnBase(): UseAnchorOnBaseResult {
  const chainId    = useChainId()
  const { isConnected } = useAccount()

  // ── Write mutation ──────────────────────────────────────────────────────────
  const {
    mutate,
    data:    txHash,
    isPending,
    error:   writeError,
    reset:   resetWrite,
  } = useWriteContract()

  // ── Receipt watcher ─────────────────────────────────────────────────────────
  // Disabled (no fetch) when txHash is undefined.
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error:     receiptError,
  } = useWaitForTransactionReceipt({ hash: txHash })

  // ── Unified error message ───────────────────────────────────────────────────
  const error = useMemo((): string | null => {
    const raw = writeError ?? receiptError
    if (!raw) return null
    // viem errors expose shortMessage (concise) alongside the verbose message
    const asViem = raw as { shortMessage?: string; message?: string }
    return asViem.shortMessage ?? asViem.message ?? String(raw)
  }, [writeError, receiptError])

  // ── Main action ─────────────────────────────────────────────────────────────
  const anchorCommitment = useCallback(
    ({ commitmentHash, context }: AnchorParams): void => {
      // 1. Contract config must be set (env vars present, chain correct)
      const check = validateCommitmentConfig()
      if (!check.ok) {
        console.error('[useAnchorOnBase] Config not ready:', check.error)
        return
      }

      // 2. Wallet must be connected
      if (!isConnected) {
        console.error('[useAnchorOnBase] No wallet connected')
        return
      }

      // 3. Must be on Base Mainnet — wagmi config only includes base, but check defensively
      if (chainId !== PREDIXI_BASE_CHAIN_ID) {
        console.error(
          `[useAnchorOnBase] Wrong chain ${chainId}, expected Base Mainnet ${PREDIXI_BASE_CHAIN_ID}`,
        )
        return
      }

      // 4. commitmentHash must be bytes32: 0x + 64 hex chars
      if (!isBytes32Hash(commitmentHash)) {
        console.error('[useAnchorOnBase] Invalid bytes32 hash:', commitmentHash?.slice(0, 12))
        return
      }

      // 5. Sanitize context — strip control chars, cap at 128 chars
      const safeContext = normalizeCommitmentContext(context)
      if (!safeContext) {
        console.error('[useAnchorOnBase] Context is empty after normalization')
        return
      }

      // All checks passed — prompt wallet
      mutate({
        address:      PREDIXI_COMMITMENT_CONTRACT!,
        abi:          COMMITMENT_REGISTRY_ABI,
        functionName: 'submitCommitment',
        args:         [commitmentHash as `0x${string}`, safeContext],
        chainId:      PREDIXI_BASE_CHAIN_ID,
      })
    },
    [mutate, isConnected, chainId],
  )

  return {
    anchorCommitment,
    isPending,
    isConfirming,
    isConfirmed,
    txHash,
    error,
    reset: resetWrite,
  }
}
