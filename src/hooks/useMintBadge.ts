'use client'

/**
 * useMintBadge — orchestrates the full badge NFT mint flow.
 *
 * Six async steps, three wallet interactions:
 *
 *   Step 1  sign-request    wallet signs request message (EIP-191)
 *   Step 2  request-sig     GET /api/badges/mint-signature → tokenId, nonce, EIP-712 sig
 *   Step 3  mint-pending    wallet signs + broadcasts mintBadge() TX
 *   Step 4  mint-confirming waits for Base Mainnet receipt
 *   Step 5  sign-confirm    wallet signs confirm message (EIP-191)
 *   Step 6  persisting      PATCH /api/badges → minted_onchain=true in DB
 *
 * Duplicate-TX protection
 * ────────────────────────
 *   Once mintTxHash is set it is cached in `cachedTxHashRef` and `pendingRef`
 *   is populated with the badge/token/nonce data.  On any subsequent call to
 *   mintBadge() for the same badgeId, the hook detects cachedTxHashRef and
 *   jumps directly to step 5 (sign-confirm + PATCH) — writeContract is never
 *   called a second time.
 *
 *   `confirmSignTriggeredRef` prevents the auto-sign useEffect from firing
 *   more than once per TX confirmation (mirrors AnchorPredictionButton's
 *   signTriggeredRef pattern).
 *
 *   `patchSentRef` prevents duplicate PATCH calls if the signature effect
 *   re-fires during a re-render.
 *
 * No UI is rendered here — consume this hook in MintBadgeButton (Phase 6B).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  useAccount,
  useChainId,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSignMessage,
}                                         from 'wagmi'
import {
  PREDIXI_BADGE_CONTRACT,
  PREDIXI_BASE_CHAIN_ID,
  PREDIXI_BADGES_ABI,
  validateBadgeContractConfig,
  isBytes32Nonce,
}                                         from '@/lib/onchain/predixiBadges'
import {
  buildBadgeMintRequestMessage,
  buildBadgeMintConfirmMessage,
}                                         from '@/lib/badge-mint-message'
import {
  getTokenIdForBadge,
  isActiveBadgeTokenId,
}                                         from '@/lib/badges/tokenIds'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type MintPhase =
  | 'idle'
  | 'signing-request'      // wallet prompted for request message signature (step 1)
  | 'requesting-signature' // GET /api/badges/mint-signature in flight (step 2)
  | 'mint-pending'         // writeContract in flight — wallet TX prompt (step 3)
  | 'mint-confirming'      // TX broadcast, waiting for Base receipt (step 4)
  | 'signing-confirm'      // wallet prompted for confirm message signature (step 5)
  | 'persisting'           // PATCH /api/badges in flight (step 6)
  | 'minted'               // success — badge is Owned on Base

/** Data cached between the six async steps. Survives re-renders. */
type PendingMintData = {
  badgeId:     string
  tokenId:     number
  nonce:       `0x${string}`
  contractSig: `0x${string}`  // EIP-712 sig from GET /api/badges/mint-signature
}

export interface UseMintBadgeResult {
  /** Initiate a mint. Idempotent on retry: re-uses cached TX hash if already confirmed. */
  mintBadge:             (badgeId: string) => void
  isSigningRequest:      boolean  // step 1
  isRequestingSignature: boolean  // step 2
  isMintPending:         boolean  // step 3
  isMintConfirming:      boolean  // step 4
  isSigningConfirm:      boolean  // step 5
  isPersisting:          boolean  // step 6
  isMinted:              boolean  // success
  /** Confirmed TX hash — set once step 4 completes; survives reset() for retry. */
  txHash:                `0x${string}` | undefined
  /** Human-readable error, or null if no error. */
  error:                 string | null
  /** Reset all state. Clears cached data including txHash. */
  reset:                 () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useMintBadge(): UseMintBadgeResult {
  const chainId               = useChainId()
  const { address, isConnected } = useAccount()

  // ── Phase — dual ref+state prevents stale closures in async callbacks ───────
  const phaseRef = useRef<MintPhase>('idle')
  const [phase, setPhaseState] = useState<MintPhase>('idle')

  function setPhase(p: MintPhase) {
    phaseRef.current = p
    setPhaseState(p)
  }

  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // ── Refs — survive re-renders; safe to read inside async callbacks ──────────

  /** Cached step data — populated after GET mint-signature succeeds. */
  const pendingRef = useRef<PendingMintData | null>(null)

  /**
   * TX hash cached once the chain confirms.
   * Survives reset() so retry skips writeContract and goes straight to PATCH.
   */
  const cachedTxHashRef = useRef<`0x${string}` | undefined>(undefined)

  /**
   * Prevents the confirm-sign useEffect from firing more than once per TX
   * confirmation (mirrors AnchorPredictionButton's signTriggeredRef pattern).
   */
  const confirmSignTriggeredRef = useRef(false)

  /** Prevents duplicate PATCH calls when the signature effect re-fires. */
  const patchSentRef = useRef(false)

  /**
   * Set to true inside reset() and cleared at the start of each fresh attempt.
   * Guards async callbacks against acting on stale results after the user
   * resets mid-flow — avoids comparing phaseRef.current against 'idle' inside
   * closures where TypeScript narrows the ref type based on prior assignments.
   */
  const abortedRef = useRef(false)

  // ── Wagmi hooks ─────────────────────────────────────────────────────────────

  const { mutate: signMsg, reset: resetSign } = useSignMessage()

  const {
    mutate:    writeContract,
    data:      mintTxHash,
    error:     writeError,
    reset:     resetWrite,
  } = useWriteContract()

  const {
    isSuccess: isTxConfirmed,
    error:     receiptError,
  } = useWaitForTransactionReceipt({ hash: mintTxHash })

  // ── Sync: mintTxHash → mint-confirming ─────────────────────────────────────
  useEffect(() => {
    if (mintTxHash && phaseRef.current === 'mint-pending') {
      cachedTxHashRef.current = mintTxHash
      setPhase('mint-confirming')
    }
  }, [mintTxHash])

  // ── Surface write / receipt errors ─────────────────────────────────────────
  useEffect(() => {
    if (!writeError) return
    const raw = writeError as { shortMessage?: string; message?: string }
    setErrorMsg(raw.shortMessage ?? raw.message ?? 'Transaction failed')
    setPhase('idle')
  }, [writeError])

  useEffect(() => {
    if (!receiptError) return
    const raw = receiptError as { shortMessage?: string; message?: string }
    setErrorMsg(raw.shortMessage ?? raw.message ?? 'Failed to confirm transaction')
    setPhase('idle')
  }, [receiptError])

  // ── PATCH helper — extracted so both auto-trigger and retry can call it ─────
  const callPatchBadge = useCallback(async (opts: {
    badgeId:    string
    tokenId:    number
    nonce:      `0x${string}`
    txHash:     `0x${string}`
    confirmMsg: string
    confirmSig: `0x${string}`
  }) => {
    if (patchSentRef.current) return
    patchSentRef.current = true
    setPhase('persisting')

    const { badgeId, tokenId, nonce, txHash, confirmMsg, confirmSig } = opts

    try {
      const res = await fetch('/api/badges', {
        method:  'PATCH',
        headers: {
          'Content-Type':       'application/json',
          'x-wallet-message':   encodeURIComponent(confirmMsg),
          'x-wallet-signature': confirmSig,
        },
        body: JSON.stringify({ badgeId, tokenId, nonce, txHash }),
      })

      const data = await res.json() as { ok: boolean; error?: string }

      // 409 = already minted with same tx (idempotent retry) — treat as success
      if (!res.ok && res.status !== 409) {
        throw new Error(data.error ?? `PATCH ${res.status}`)
      }

      setPhase('minted')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to persist mint'
      console.warn('[useMintBadge] PATCH error:', msg)
      setErrorMsg(msg)
      setPhase('idle')
      patchSentRef.current = false  // allow PATCH retry without a new TX
    }
  }, [])

  // ── Auto-trigger sign-confirm once TX confirms ──────────────────────────────
  // Deps: only the values needed to decide whether to sign.
  // confirmSignTriggeredRef prevents double-fire during the render gap between
  // calling signMsg() and wagmi flushing state updates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isTxConfirmed || !mintTxHash || !address) return
    if (!pendingRef.current) return
    if (confirmSignTriggeredRef.current) return
    if (patchSentRef.current) return

    confirmSignTriggeredRef.current = true
    setPhase('signing-confirm')

    const { badgeId, tokenId, nonce } = pendingRef.current
    const txHash = mintTxHash

    const confirmMsg = buildBadgeMintConfirmMessage({
      walletAddress: address,
      badgeId,
      tokenId,
      txHash,
      nonce,
      signedAt: new Date().toISOString(),
    })

    // Brief delay before reprompting — lets wallet clear the TX confirmation
    // screen before presenting the sign request (prevents accidental dismissal).
    const t = setTimeout(() => {
      signMsg(
        { message: confirmMsg },
        {
          onSuccess: (confirmSig) => {
            callPatchBadge({ badgeId, tokenId, nonce, txHash, confirmMsg, confirmSig })
          },
          onError: (err) => {
            const raw = err as { shortMessage?: string; message?: string }
            setErrorMsg(raw.shortMessage ?? raw.message ?? 'Signature rejected')
            setPhase('idle')
            confirmSignTriggeredRef.current = false  // allow sign-confirm retry
          },
        },
      )
    }, 60)

    return () => clearTimeout(t)
  }, [isTxConfirmed, mintTxHash, address])  // callPatchBadge and signMsg are stable

  // ── Main action ─────────────────────────────────────────────────────────────
  const mintBadge = useCallback((badgeId: string) => {

    // ── Retry path: TX confirmed but PATCH failed ────────────────────────────
    // Skip steps 1–4. Re-sign the confirm message and call PATCH again.
    // writeContract is NEVER called a second time once cachedTxHashRef is set.
    const cachedTxHash = cachedTxHashRef.current
    if (cachedTxHash && pendingRef.current?.badgeId === badgeId) {
      if (!address) { setErrorMsg('Wallet disconnected'); return }

      const { tokenId, nonce } = pendingRef.current
      setErrorMsg(null)
      patchSentRef.current            = false
      confirmSignTriggeredRef.current = false
      setPhase('signing-confirm')

      const confirmMsg = buildBadgeMintConfirmMessage({
        walletAddress: address,
        badgeId,
        tokenId,
        txHash:   cachedTxHash,
        nonce,
        signedAt: new Date().toISOString(),
      })

      signMsg(
        { message: confirmMsg },
        {
          onSuccess: (confirmSig) => {
            callPatchBadge({ badgeId, tokenId, nonce, txHash: cachedTxHash, confirmMsg, confirmSig })
          },
          onError: (err) => {
            const raw = err as { shortMessage?: string; message?: string }
            setErrorMsg(raw.shortMessage ?? raw.message ?? 'Signature rejected')
            setPhase('idle')
          },
        },
      )
      return
    }

    // ── Fresh flow — steps 1–6 ───────────────────────────────────────────────
    const configCheck = validateBadgeContractConfig()
    if (!configCheck.ok) { setErrorMsg(configCheck.error); return }
    if (!isConnected || !address) { setErrorMsg('Wallet not connected'); return }
    if (chainId !== PREDIXI_BASE_CHAIN_ID) {
      setErrorMsg('Please switch to Base Mainnet to mint')
      return
    }

    const tokenId = getTokenIdForBadge(badgeId)
    if (tokenId === undefined || !isActiveBadgeTokenId(tokenId)) {
      setErrorMsg(`Unknown or reserved badge: ${badgeId}`)
      return
    }

    // Clear all state for a fresh attempt
    abortedRef.current              = false
    pendingRef.current              = null
    cachedTxHashRef.current         = undefined
    confirmSignTriggeredRef.current = false
    patchSentRef.current            = false
    setErrorMsg(null)
    resetWrite()
    resetSign()
    setPhase('signing-request')

    const requestMsg = buildBadgeMintRequestMessage({
      walletAddress: address,
      badgeId,
      tokenId,
      signedAt: new Date().toISOString(),
    })

    signMsg(
      { message: requestMsg },
      {
        onSuccess: async (requestSig) => {
          // Guard: abort if reset() was called while this was in-flight
          if (abortedRef.current) return

          setPhase('requesting-signature')

          try {
            const res = await fetch(
              `/api/badges/mint-signature?badgeId=${encodeURIComponent(badgeId)}`,
              {
                headers: {
                  'x-wallet-message':   encodeURIComponent(requestMsg),
                  'x-wallet-signature': requestSig,
                },
              },
            )

            const apiData = await res.json() as {
              ok:         boolean
              tokenId?:   number
              nonce?:     string
              signature?: string
              error?:     string
            }

            if (!res.ok || !apiData.ok) {
              throw new Error(apiData.error ?? `API error ${res.status}`)
            }
            if (!apiData.tokenId || !apiData.nonce || !apiData.signature) {
              throw new Error('Incomplete response from mint-signature endpoint')
            }
            if (!isBytes32Nonce(apiData.nonce)) {
              throw new Error('Invalid nonce format in server response')
            }

            if (abortedRef.current) return  // reset() called

            // Cache — survives re-renders; protects writeContract from being
            // called a second time if mintBadge() is invoked after TX confirms.
            pendingRef.current = {
              badgeId,
              tokenId:     apiData.tokenId,
              nonce:       apiData.nonce      as `0x${string}`,
              contractSig: apiData.signature  as `0x${string}`,
            }

            setPhase('mint-pending')

            writeContract({
              address:      PREDIXI_BADGE_CONTRACT!,
              abi:          PREDIXI_BADGES_ABI,
              functionName: 'mintBadge',
              args: [
                BigInt(apiData.tokenId),
                apiData.nonce     as `0x${string}`,
                apiData.signature as `0x${string}`,
              ],
              chainId: PREDIXI_BASE_CHAIN_ID as 8453,
            })
          } catch (err) {
            if (abortedRef.current) return
            const msg = err instanceof Error ? err.message : 'Failed to get mint signature'
            setErrorMsg(msg)
            setPhase('idle')
          }
        },
        onError: (err) => {
          if (abortedRef.current) return
          const raw = err as { shortMessage?: string; message?: string }
          setErrorMsg(raw.shortMessage ?? raw.message ?? 'Signature rejected')
          setPhase('idle')
        },
      },
    )
  }, [address, isConnected, chainId, signMsg, writeContract, resetWrite, resetSign, callPatchBadge])

  // ── Reset ────────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    abortedRef.current              = true   // cancels any in-flight async callbacks
    setPhase('idle')
    setErrorMsg(null)
    pendingRef.current              = null
    cachedTxHashRef.current         = undefined
    confirmSignTriggeredRef.current = false
    patchSentRef.current            = false
    resetWrite()
    resetSign()
  }, [resetWrite, resetSign])

  return {
    mintBadge,
    isSigningRequest:      phase === 'signing-request',
    isRequestingSignature: phase === 'requesting-signature',
    isMintPending:         phase === 'mint-pending',
    isMintConfirming:      phase === 'mint-confirming',
    isSigningConfirm:      phase === 'signing-confirm',
    isPersisting:          phase === 'persisting',
    isMinted:              phase === 'minted',
    txHash:                mintTxHash ?? cachedTxHashRef.current,
    error:                 errorMsg,
    reset,
  }
}
