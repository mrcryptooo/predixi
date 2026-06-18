'use client'

/**
 * useMintBadge — orchestrates the simplified one-transaction badge NFT mint.
 *
 * Flow (one wallet interaction only):
 *   1. GET /api/badges/mint-signature?badgeId=...&walletAddress=... → EIP-712 sig
 *   2. mintBadge(tokenId, nonce, signature) → wallet prompts for TX fee only
 *   3. Wait for Base receipt
 *   4. PATCH /api/badges { badgeId, tokenId, nonce, txHash, walletAddress }
 *      → server verifies on-chain BadgeMinted event → persists minted_onchain=true
 *
 * Duplicate-TX protection:
 *   Once cachedTxHashRef is set (TX confirmed), mintBadge() retries skip
 *   writeContract and go straight to the PATCH call with cached data.
 *
 * No wallet message signatures required — the contract's EIP-712 binding
 * ensures only the intended wallet can send the TX; the server verifies the
 * on-chain event as the security gate.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  useAccount,
  useChainId,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import {
  PREDIXI_BADGE_CONTRACT,
  PREDIXI_BASE_CHAIN_ID,
  PREDIXI_BADGES_ABI,
  validateBadgeContractConfig,
  isBytes32Nonce,
} from '@/lib/onchain/predixiBadges'
import { getTokenIdForBadge, isActiveBadgeTokenId } from '@/lib/badges/tokenIds'
import { getBuilderDataSuffix } from '@/config/attribution'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type MintPhase =
  | 'idle'
  | 'requesting-signature'  // GET /api/badges/mint-signature in flight
  | 'mint-pending'          // writeContract in flight — wallet TX prompt
  | 'mint-confirming'       // TX broadcast, waiting for receipt
  | 'persisting'            // PATCH /api/badges in flight
  | 'minted'                // success — badge is Owned on Base

type PendingMintData = {
  badgeId:     string
  tokenId:     number
  nonce:       `0x${string}`
  contractSig: `0x${string}`   // EIP-712 sig from GET mint-signature
}

export interface UseMintBadgeResult {
  mintBadge:              (badgeId: string) => void
  isRequestingSignature:  boolean
  isMintPending:          boolean
  isMintConfirming:       boolean
  isPersisting:           boolean
  isMinted:               boolean
  txHash:                 `0x${string}` | undefined
  error:                  string | null
  reset:                  () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useMintBadge(): UseMintBadgeResult {
  const chainId                  = useChainId()
  const { address, isConnected } = useAccount()

  // ── Phase state — phaseRef prevents stale closures in async callbacks ───────
  const phaseRef = useRef<MintPhase>('idle')
  const [phase, setPhaseState] = useState<MintPhase>('idle')

  const setPhase = (p: MintPhase) => {
    phaseRef.current = p
    setPhaseState(p)
  }

  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // ── Refs — survive re-renders, safe in async/effect callbacks ───────────────
  const pendingRef         = useRef<PendingMintData | null>(null)
  const cachedTxHashRef    = useRef<`0x${string}` | undefined>(undefined)
  const patchCalledRef     = useRef(false)   // prevents duplicate PATCH calls
  const abortedRef         = useRef(false)   // signals reset() was called mid-flight

  // ── Wagmi hooks ──────────────────────────────────────────────────────────────
  const {
    mutate: writeContract,
    data:   mintTxHash,
    error:  writeError,
    reset:  resetWrite,
  } = useWriteContract()

  const {
    isSuccess: isTxConfirmed,
    error:     receiptError,
  } = useWaitForTransactionReceipt({ hash: mintTxHash })

  // ── Sync TX broadcast → confirming phase ─────────────────────────────────────
  useEffect(() => {
    if (mintTxHash && phaseRef.current === 'mint-pending') {
      setPhase('mint-confirming')
      cachedTxHashRef.current = mintTxHash
    }
  }, [mintTxHash])

  // ── Surface write / receipt errors ───────────────────────────────────────────
  useEffect(() => {
    if (!writeError || abortedRef.current) return
    const raw = writeError as { shortMessage?: string; message?: string }
    setErrorMsg(raw.shortMessage ?? raw.message ?? 'Transaction failed')
    setPhase('idle')
  }, [writeError])

  useEffect(() => {
    if (!receiptError || abortedRef.current) return
    const raw = receiptError as { shortMessage?: string; message?: string }
    setErrorMsg(raw.shortMessage ?? raw.message ?? 'Failed to confirm transaction')
    setPhase('idle')
  }, [receiptError])

  // ── PATCH helper ──────────────────────────────────────────────────────────────
  const callPatch = useCallback(async (
    badgeId:       string,
    tokenId:       number,
    nonce:         `0x${string}`,
    txHash:        `0x${string}`,
    walletAddress: string,
  ) => {
    if (abortedRef.current) return
    setPhase('persisting')

    try {
      const res = await fetch('/api/badges', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ badgeId, tokenId, nonce, txHash, walletAddress }),
      })
      const data = await res.json() as { ok: boolean; error?: string }

      if (!res.ok && res.status !== 409) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      if (!abortedRef.current) setPhase('minted')
    } catch (err) {
      if (abortedRef.current) return
      const msg = err instanceof Error ? err.message : 'Failed to persist mint'
      console.warn('[useMintBadge] PATCH error:', msg)
      setErrorMsg(msg)
      setPhase('idle')
      patchCalledRef.current = false  // allow retry
    }
  }, [])

  // ── Auto-call PATCH once TX confirms ──────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isTxConfirmed || !mintTxHash)                return
    if (phaseRef.current !== 'mint-confirming')       return
    if (patchCalledRef.current || abortedRef.current) return
    if (!pendingRef.current || !address)              return

    patchCalledRef.current = true
    const { badgeId, tokenId, nonce } = pendingRef.current
    callPatch(badgeId, tokenId, nonce, mintTxHash, address)
  }, [isTxConfirmed, mintTxHash, address]) // callPatch is stable

  // ── Main mint action ──────────────────────────────────────────────────────────
  const mintBadge = useCallback((badgeId: string) => {
    if (!address) { setErrorMsg('Wallet not connected'); return }

    // ── Retry path: TX confirmed but PATCH failed ─────────────────────────────
    const cachedTxHash = cachedTxHashRef.current
    if (cachedTxHash && pendingRef.current?.badgeId === badgeId) {
      const { tokenId, nonce } = pendingRef.current
      setErrorMsg(null)
      patchCalledRef.current = false
      abortedRef.current     = false
      callPatch(badgeId, tokenId, nonce, cachedTxHash, address)
      return
    }

    // ── Fresh flow ────────────────────────────────────────────────────────────
    const configCheck = validateBadgeContractConfig()
    if (!configCheck.ok) { setErrorMsg(configCheck.error); return }
    if (!isConnected)    { setErrorMsg('Wallet not connected'); return }
    if (chainId !== PREDIXI_BASE_CHAIN_ID) {
      setErrorMsg('Please switch to Base Mainnet')
      return
    }
    const tokenId = getTokenIdForBadge(badgeId)
    if (tokenId === undefined || !isActiveBadgeTokenId(tokenId)) {
      setErrorMsg(`Unknown badge: ${badgeId}`)
      return
    }

    // Reset all state for a fresh attempt
    pendingRef.current      = null
    cachedTxHashRef.current = undefined
    patchCalledRef.current  = false
    abortedRef.current      = false
    setErrorMsg(null)
    resetWrite()
    setPhase('requesting-signature')

    // ── Step 1: GET /api/badges/mint-signature ────────────────────────────────
    fetch(
      `/api/badges/mint-signature?badgeId=${encodeURIComponent(badgeId)}&walletAddress=${encodeURIComponent(address)}`,
    )
      .then(async (res) => {
        if (abortedRef.current) return

        const apiData = await res.json() as {
          ok:         boolean
          tokenId?:   number
          nonce?:     string
          signature?: string
          error?:     string
        }

        if (!res.ok || !apiData.ok) throw new Error(apiData.error ?? `API error ${res.status}`)
        if (!apiData.tokenId || !apiData.nonce || !apiData.signature)
          throw new Error('Incomplete response from mint-signature endpoint')
        if (!isBytes32Nonce(apiData.nonce))
          throw new Error('Invalid nonce in server response')
        if (abortedRef.current) return

        // Cache data — survives re-renders; guards against duplicate writeContract
        pendingRef.current = {
          badgeId,
          tokenId:     apiData.tokenId,
          nonce:       apiData.nonce     as `0x${string}`,
          contractSig: apiData.signature as `0x${string}`,
        }

        setPhase('mint-pending')

        // ── Step 2: mintBadge() TX (the only wallet interaction) ──────────────
        writeContract({
          address:      PREDIXI_BADGE_CONTRACT!,
          abi:          PREDIXI_BADGES_ABI,
          functionName: 'mintBadge',
          args: [
            BigInt(apiData.tokenId),
            apiData.nonce     as `0x${string}`,
            apiData.signature as `0x${string}`,
          ],
          chainId:    PREDIXI_BASE_CHAIN_ID as 8453,
          dataSuffix: getBuilderDataSuffix(),
        })
      })
      .catch((err: unknown) => {
        if (abortedRef.current) return
        const msg = err instanceof Error ? err.message : 'Failed to get mint signature'
        setErrorMsg(msg)
        setPhase('idle')
      })
  }, [address, isConnected, chainId, writeContract, resetWrite, callPatch])

  // ── Reset ─────────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    abortedRef.current      = true   // signal any in-flight async to abort
    setPhase('idle')
    setErrorMsg(null)
    pendingRef.current      = null
    cachedTxHashRef.current = undefined
    patchCalledRef.current  = false
    resetWrite()
    // Re-arm after a tick so subsequent calls are not treated as aborted
    setTimeout(() => { abortedRef.current = false }, 0)
  }, [resetWrite])

  return {
    mintBadge,
    isRequestingSignature: phase === 'requesting-signature',
    isMintPending:         phase === 'mint-pending',
    isMintConfirming:      phase === 'mint-confirming',
    isPersisting:          phase === 'persisting',
    isMinted:              phase === 'minted',
    txHash:                mintTxHash ?? cachedTxHashRef.current,
    error:                 errorMsg,
    reset,
  }
}
