'use client'

import { useCallback, useMemo, useState } from 'react'
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
import { getBuilderDataSuffix } from '@/config/attribution'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SubmitParams {
  /** bytes32 commitment hash: 0x-prefixed, exactly 64 hex chars. */
  commitmentHash: string
  /** Short label stored in the on-chain event log. */
  context: string
}

export interface UseSubmitToBaseResult {
  /**
   * Submit a commitment to Base. Resolves with the transaction hash once the
   * wallet broadcasts the TX (user approved). The TX may not be confirmed yet —
   * use publicClient.waitForTransactionReceipt(hash) or watch isConfirmed.
   * Throws on wallet rejection, config error, or contract revert.
   */
  submitAsync:  (params: SubmitParams) => Promise<`0x${string}`>
  /** Wallet approval dialog is open — waiting for user to confirm. */
  isPending:    boolean
  /** Transaction broadcast; waiting for on-chain inclusion. */
  isConfirming: boolean
  /** Transaction confirmed on Base Mainnet. */
  isConfirmed:  boolean
  /** The transaction hash being tracked (set after broadcast). */
  txHash:       `0x${string}` | undefined
  /** Human-readable error from wallet rejection or contract revert, or null. */
  error:        string | null
  /** Reset all state back to idle — call before re-submitting after error. */
  reset:        () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook for submitting a commitment to PredixiCommitmentRegistry on Base Mainnet.
 *
 * Usage (async inline pattern):
 *   const { submitAsync } = useSubmitToBase()
 *   const publicClient = usePublicClient({ chainId: 8453 })
 *
 *   try {
 *     const txHash = await submitAsync({ commitmentHash, context })
 *     // wallet approved — TX is broadcasting
 *     await publicClient!.waitForTransactionReceipt({ hash: txHash })
 *     // TX confirmed — safe to call the API
 *   } catch (err) {
 *     // wallet rejected or TX failed
 *   }
 *
 * Reactive state (isPending, isConfirming, isConfirmed) is also available for
 * button labels and spinners. The async pattern is used for sequential flow control.
 */
export function useSubmitToBase(): UseSubmitToBaseResult {
  const chainId         = useChainId()
  const { isConnected } = useAccount()

  // Track the tx hash so useWaitForTransactionReceipt can watch it
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | undefined>()

  const {
    writeContractAsync,
    isPending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract()

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error:     receiptError,
  } = useWaitForTransactionReceipt({ hash: pendingTxHash })

  const error = useMemo((): string | null => {
    const raw = writeError ?? receiptError
    if (!raw) return null
    const asViem = raw as { shortMessage?: string; message?: string }
    return asViem.shortMessage ?? asViem.message ?? String(raw)
  }, [writeError, receiptError])

  const reset = useCallback(() => {
    resetWrite()
    setPendingTxHash(undefined)
  }, [resetWrite])

  const submitAsync = useCallback(
    async ({ commitmentHash, context }: SubmitParams): Promise<`0x${string}`> => {
      const check = validateCommitmentConfig()
      if (!check.ok) {
        throw new Error(`[useSubmitToBase] Contract not configured: ${check.error}`)
      }
      if (!isConnected) {
        throw new Error('[useSubmitToBase] No wallet connected')
      }
      if (chainId !== PREDIXI_BASE_CHAIN_ID) {
        throw new Error(`[useSubmitToBase] Wrong chain ${chainId} — Base Mainnet (8453) required`)
      }
      if (!isBytes32Hash(commitmentHash)) {
        throw new Error('[useSubmitToBase] Invalid bytes32 commitmentHash')
      }

      const safeContext = normalizeCommitmentContext(context)
      if (!safeContext) {
        throw new Error('[useSubmitToBase] Context string is empty after sanitization')
      }

      // writeContractAsync resolves with the tx hash after the wallet broadcasts
      // (user has approved), before the TX is confirmed on-chain.
      const txHash = await writeContractAsync({
        address:      PREDIXI_COMMITMENT_CONTRACT!,
        abi:          COMMITMENT_REGISTRY_ABI,
        functionName: 'submitCommitment',
        args:         [commitmentHash as `0x${string}`, safeContext],
        chainId:      PREDIXI_BASE_CHAIN_ID,
        dataSuffix:   getBuilderDataSuffix(),
      })

      // Store for reactive watchers (isPending, isConfirming, isConfirmed)
      setPendingTxHash(txHash)
      return txHash
    },
    [writeContractAsync, isConnected, chainId],
  )

  return {
    submitAsync,
    isPending,
    isConfirming,
    isConfirmed,
    txHash: pendingTxHash,
    error,
    reset,
  }
}
