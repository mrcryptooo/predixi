'use client'

/**
 * AnchorPredictionButton — optional "Anchor on Base" action for a single
 * match prediction.
 *
 * Flow (two wallet interactions, both user-initiated):
 *   1. Click → useAnchorOnBase.anchorCommitment() → wallet prompts to sign TX
 *   2. TX confirms on Base → auto-prompt: signMessage for PATCH auth
 *   3. PATCH /api/predictions records submitted_onchain=true, tx_hash
 *   4. Show "Anchored on Base ✓" + BaseScan link
 *
 * Safety:
 *   • No TX is sent until the user clicks.
 *   • patchSentRef prevents duplicate PATCH calls on re-render.
 *   • cachedTxHash survives reset() so if sign/PATCH fails after the TX
 *     confirms, the retry only re-prompts for the signature (no second TX).
 *   • If submittedOnchain=true from props, shows anchored state immediately.
 *   • Renders null when: commitmentHash absent, or wallet not connected and
 *     prediction is not yet anchored.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAccount, useSignMessage }               from 'wagmi'
import { Anchor, ExternalLink, Loader2, RotateCcw } from 'lucide-react'
import { cn }                                       from '@/lib/utils'
import { useAnchorOnBase }                          from '@/hooks/useAnchorOnBase'
import { buildCommitmentContext }                   from '@/lib/onchain/commitmentRegistry'
import { buildAnchorMessage }                       from '@/lib/anchor-message'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AnchorPredictionButtonProps {
  predictionId:     string
  commitmentHash:   string
  submittedOnchain: boolean
  txHash:           string | null
  className?:       string
  /** Called once after PATCH succeeds — use to update parent list state. */
  onAnchorSuccess?: (predictionId: string, txHash: string) => void
}

// Internal phase enum — single source of truth for button label/state.
type Phase =
  | 'idle'
  | 'tx-pending'    // writeContract in flight — wallet prompting for TX sign
  | 'tx-confirming' // TX broadcast, waiting for block receipt
  | 'sign-pending'  // signMessage auto-triggered after TX confirms
  | 'patching'      // PATCH /api/predictions in flight
  | 'done'          // anchor recorded in DB
  | 'error'         // any step failed

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function AnchorPredictionButton({
  predictionId,
  commitmentHash,
  submittedOnchain,
  txHash:          propTxHash,
  className,
  onAnchorSuccess,
}: AnchorPredictionButtonProps) {
  const { address, isConnected } = useAccount()

  // ── TX flow (via useAnchorOnBase) ─────────────────────────────────────────
  const {
    anchorCommitment,
    isPending:    isTxPending,
    isConfirming: isTxConfirming,
    isConfirmed:  isTxConfirmed,
    txHash:       hookTxHash,
    error:        anchorError,
    reset:        resetAnchor,
  } = useAnchorOnBase()

  // ── Message signing flow (for PATCH auth) ─────────────────────────────────
  const {
    mutate:    signMsg,
    data:      signature,
    isPending: isSigning,
    error:     signError,
    reset:     resetSign,
  } = useSignMessage()

  // ── Local state ───────────────────────────────────────────────────────────
  const [phase,         setPhase]         = useState<Phase>(
    // Start in 'done' immediately if already anchored from DB
    submittedOnchain && propTxHash ? 'done' : 'idle',
  )
  const [errorMsg,      setErrorMsg]      = useState<string | null>(null)
  const [signedMessage, setSignedMessage] = useState<string | null>(null)
  // Survives reset() — once TX confirms we cache the hash so retry only re-signs
  const [cachedTxHash,  setCachedTxHash]  = useState<`0x${string}` | null>(
    propTxHash as `0x${string}` | null,
  )

  const patchSentRef = useRef(false)

  // ── Sync TX hook states → phase ───────────────────────────────────────────

  useEffect(() => {
    if (isTxPending && phase === 'idle') setPhase('tx-pending')
  }, [isTxPending, phase])

  useEffect(() => {
    if (isTxConfirming && phase !== 'tx-confirming') setPhase('tx-confirming')
  }, [isTxConfirming, phase])

  // ── Auto-trigger signMessage when TX confirms ─────────────────────────────
  useEffect(() => {
    if (!isTxConfirmed || !hookTxHash || !address) return
    if (patchSentRef.current) return
    if (isSigning || signature) return

    // Cache the hash — survives resetAnchor() for sign/PATCH retries
    setCachedTxHash(hookTxHash)
    setPhase('sign-pending')

    const msg = buildAnchorMessage({
      walletAddress: address,
      predictionId,
      txHash:        hookTxHash,
      signedAt:      new Date().toISOString(),
    })
    setSignedMessage(msg)
    signMsg({ message: msg })
  }, [isTxConfirmed, hookTxHash, address, isSigning, signature, predictionId, signMsg])

  // ── Surface sign errors ───────────────────────────────────────────────────
  useEffect(() => {
    if (!signError) return
    const raw = signError as { shortMessage?: string; message?: string }
    setErrorMsg(raw.shortMessage ?? raw.message ?? 'Signature rejected')
    setPhase('error')
  }, [signError])

  // ── Surface TX errors ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!anchorError) return
    setErrorMsg(anchorError)
    setPhase('error')
  }, [anchorError])

  // ── Auto-call PATCH once signature is ready ───────────────────────────────
  useEffect(() => {
    if (!signature || !signedMessage || !cachedTxHash) return
    if (patchSentRef.current) return
    patchSentRef.current = true

    setPhase('patching')

    fetch('/api/predictions', {
      method:  'PATCH',
      headers: {
        'Content-Type':      'application/json',
        'x-wallet-message':  encodeURIComponent(signedMessage),
        'x-wallet-signature': signature,
      },
      body: JSON.stringify({ predictionId, txHash: cachedTxHash, commitmentHash }),
    })
      .then(async res => {
        const data = await res.json()
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? `HTTP ${res.status}`)
        }
        setPhase('done')
        onAnchorSuccess?.(predictionId, cachedTxHash)
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to save anchor'
        setErrorMsg(msg)
        setPhase('error')
        patchSentRef.current = false   // allow retry
      })
  }, [signature, signedMessage, cachedTxHash, predictionId, commitmentHash, onAnchorSuccess])

  // ── Click handler ─────────────────────────────────────────────────────────
  const handleClick = useCallback(() => {
    if (!isConnected || !address) return

    setErrorMsg(null)
    patchSentRef.current = false
    setSignedMessage(null)

    // If TX already confirmed but sign/PATCH failed → retry only the sign step
    if (cachedTxHash && phase === 'error') {
      resetSign()
      setPhase('sign-pending')

      const msg = buildAnchorMessage({
        walletAddress: address,
        predictionId,
        txHash:        cachedTxHash,
        signedAt:      new Date().toISOString(),
      })
      setSignedMessage(msg)
      signMsg({ message: msg })
      return
    }

    // Fresh TX flow
    resetAnchor()
    resetSign()
    setPhase('idle')

    anchorCommitment({
      commitmentHash,
      context: buildCommitmentContext('match-prediction', predictionId),
    })
  }, [
    isConnected, address, cachedTxHash, phase,
    predictionId, commitmentHash,
    anchorCommitment, resetAnchor, resetSign, signMsg,
  ])

  // ── Early returns ─────────────────────────────────────────────────────────

  // No hash = nothing to anchor
  if (!commitmentHash) return null

  // ── Anchored state ────────────────────────────────────────────────────────
  const effectiveTxHash = cachedTxHash ?? propTxHash
  if (phase === 'done' || (submittedOnchain && effectiveTxHash)) {
    return (
      <div className={cn('inline-flex items-center gap-1.5', className)}>
        <span className="text-[9px] font-mono font-bold text-emerald-400">
          Anchored on Base
        </span>
        {effectiveTxHash && (
          <a
            href={`https://basescan.org/tx/${effectiveTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            title="View on BaseScan"
            className="text-emerald-400/50 hover:text-emerald-400 transition-colors flex-shrink-0"
          >
            <ExternalLink size={9} />
          </a>
        )}
      </div>
    )
  }

  // Wallet not connected — no button (user can't anchor without a wallet)
  if (!isConnected) return null

  // ── Active / error states ─────────────────────────────────────────────────
  const isActive = phase !== 'idle' && phase !== 'error'

  const label: Record<Phase, string> = {
    'idle':          'Anchor on Base',
    'tx-pending':    'Signing tx…',
    'tx-confirming': 'Confirming…',
    'sign-pending':  'Signing proof…',
    'patching':      'Saving…',
    'done':          'Anchored on Base',
    'error':         'Retry',
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <button
        type="button"
        onClick={handleClick}
        disabled={isActive}
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-md',
          'text-[9px] font-mono font-semibold transition-all duration-150 select-none',
          isActive
            ? 'bg-primary/8 border border-primary/15 text-primary/35 cursor-not-allowed'
            : phase === 'error'
              ? 'bg-danger/10 border border-danger/25 text-danger/70 hover:bg-danger/20 hover:text-danger active:scale-[0.97]'
              : 'bg-primary/10 border border-primary/25 text-primary/70 hover:bg-primary/18 hover:text-primary hover:border-primary/40 active:scale-[0.97]',
        )}
      >
        {isActive ? (
          <Loader2 size={8} className="animate-spin flex-shrink-0" />
        ) : phase === 'error' ? (
          <RotateCcw size={8} className="flex-shrink-0" />
        ) : (
          <Anchor size={8} className="flex-shrink-0" />
        )}
        {label[phase]}
      </button>

      {phase === 'error' && errorMsg && (
        <span
          className="text-[8px] font-mono text-danger/60 max-w-[100px] truncate"
          title={errorMsg}
        >
          {errorMsg}
        </span>
      )}
    </div>
  )
}
