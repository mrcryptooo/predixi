'use client'

/**
 * AnchorDailyXIButton — optional "Anchor XI on Base" action for a submitted
 * Daily XI entry.
 *
 * Flow (two wallet interactions, both user-initiated):
 *   1. Click → useAnchorOnBase.anchorCommitment() → wallet prompts to sign TX
 *   2. TX confirms on Base → auto-prompt: signMessage for PATCH auth
 *   3. PATCH /api/daily-xi records submitted_onchain=true, tx_hash
 *   4. Show "Anchored on Base ✓" + BaseScan link
 *
 * Safety:
 *   • No TX is sent until the user explicitly clicks.
 *   • patchSentRef prevents duplicate PATCH calls on re-render.
 *   • cachedTxHash survives reset() so if sign/PATCH fails after the TX
 *     confirms, the retry only re-prompts for the signature (no second TX).
 *   • If submittedOnchain=true from props, shows anchored state immediately.
 *   • Renders null when: commitmentHash absent, or wallet not connected and
 *     entry is not yet anchored.
 *
 * Reuse: shares useAnchorOnBase (same hook as match predictions) and
 * buildCommitmentContext with 'daily-xi' type — no duplicate onchain logic.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAccount, useSignMessage }               from 'wagmi'
import { Anchor, ExternalLink, Loader2, RotateCcw } from 'lucide-react'
import { cn }                                       from '@/lib/utils'
import { useAnchorOnBase }                          from '@/hooks/useAnchorOnBase'
import { buildCommitmentContext }                   from '@/lib/onchain/commitmentRegistry'
import {
  buildDailyXIAnchorMessage,
}                                                   from '@/lib/daily-xi-anchor-message'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AnchorDailyXIButtonProps {
  /** Entry date in YYYY-MM-DD format — identifies the row to anchor. */
  entryDate:        string
  /** bytes32 commitment hash computed at POST time — what gets anchored on-chain. */
  commitmentHash:   string
  /** True when DB already records this entry as anchored (initial server state). */
  submittedOnchain: boolean
  /** Stored tx hash from DB, or null. */
  txHash:           string | null
  className?:       string
  /**
   * Called once after PATCH /api/daily-xi succeeds.
   * Use to update parent state immediately (no full reload needed).
   */
  onAnchorSuccess?: (txHash: string) => void
}

// Internal phase enum — single source of truth for button label/state.
type Phase =
  | 'idle'
  | 'tx-pending'    // writeContract in flight — wallet prompting for TX sign
  | 'tx-confirming' // TX broadcast, waiting for block receipt
  | 'sign-pending'  // signMessage auto-triggered after TX confirms
  | 'patching'      // PATCH /api/daily-xi in flight
  | 'done'          // anchor recorded in DB
  | 'error'         // any step failed

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function AnchorDailyXIButton({
  entryDate,
  commitmentHash,
  submittedOnchain,
  txHash:          propTxHash,
  className,
  onAnchorSuccess,
}: AnchorDailyXIButtonProps) {
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
    submittedOnchain && propTxHash ? 'done' : 'idle',
  )
  const [errorMsg,      setErrorMsg]      = useState<string | null>(null)
  const [signedMessage, setSignedMessage] = useState<string | null>(null)
  // cachedTxHash survives reset() — once TX confirms we cache so retry only re-signs
  const [cachedTxHash,  setCachedTxHash]  = useState<`0x${string}` | null>(
    propTxHash as `0x${string}` | null,
  )
  // txSucceeded: true after TX confirms — drives "Sign again" vs "Try again" label
  const [txSucceeded, setTxSucceeded] = useState(false)

  const patchSentRef     = useRef(false)
  // Prevents double-fire of signMsg between calling it and isSigning becoming true
  const signTriggeredRef = useRef(false)

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
    if (signTriggeredRef.current) return

    signTriggeredRef.current = true
    setTxSucceeded(true)
    setCachedTxHash(hookTxHash)
    setPhase('sign-pending')

    const msg = buildDailyXIAnchorMessage({
      walletAddress: address,
      entryDate,
      txHash:        hookTxHash,
      signedAt:      new Date().toISOString(),
    })
    setSignedMessage(msg)

    // Brief delay before prompting — lets the wallet UI clear the TX confirmation
    // before presenting the sign request (prevents accidental dismissal).
    const t = setTimeout(() => signMsg({ message: msg }), 60)
    return () => clearTimeout(t)
  // isSigning / signature intentionally excluded — they are not decision inputs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTxConfirmed, hookTxHash, address, entryDate])

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
    if (!signature || !signedMessage || !cachedTxHash || !address) return
    if (patchSentRef.current) return
    patchSentRef.current = true

    setPhase('patching')

    fetch('/api/daily-xi', {
      method:  'PATCH',
      headers: {
        'Content-Type':       'application/json',
        'x-wallet-message':   encodeURIComponent(signedMessage),
        'x-wallet-signature': signature,
      },
      body: JSON.stringify({
        walletAddress: address,
        txHash:        cachedTxHash,
        entryDate,
      }),
    })
      .then(async res => {
        const data = await res.json() as { success: boolean; error?: string }
        if (!res.ok || !data.success) {
          throw new Error(data.error ?? `HTTP ${res.status}`)
        }
        setPhase('done')
        onAnchorSuccess?.(cachedTxHash)
      })
      .catch((patchErr: unknown) => {
        const msg = patchErr instanceof Error ? patchErr.message : 'Failed to save anchor'
        console.warn('[AnchorDailyXIButton] PATCH error:', msg)
        setErrorMsg(msg)
        setPhase('error')
        patchSentRef.current = false   // allow retry
      })
  }, [signature, signedMessage, cachedTxHash, address, entryDate, onAnchorSuccess])

  // ── Click handler ─────────────────────────────────────────────────────────
  const handleClick = useCallback(() => {
    if (!isConnected || !address) return

    setErrorMsg(null)
    patchSentRef.current = false
    setSignedMessage(null)

    // TX already confirmed but sign/PATCH failed → retry only the sign step.
    if (cachedTxHash && phase === 'error') {
      resetSign()
      signTriggeredRef.current = false
      setPhase('sign-pending')

      const msg = buildDailyXIAnchorMessage({
        walletAddress: address,
        entryDate,
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
    signTriggeredRef.current = false
    setTxSucceeded(false)
    setPhase('idle')

    anchorCommitment({
      commitmentHash,
      context: buildCommitmentContext('daily-xi', entryDate),
    })
  }, [
    isConnected, address, cachedTxHash, phase,
    entryDate, commitmentHash,
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

  // Wallet not connected — no button
  if (!isConnected) return null

  // ── Active / error states ─────────────────────────────────────────────────
  const isActive = phase !== 'idle' && phase !== 'error'

  const label: Record<Phase, string> = {
    'idle':          'Anchor XI on Base',
    'tx-pending':    'Signing tx…',
    'tx-confirming': 'Confirming…',
    'sign-pending':  'Signing proof…',
    'patching':      'Saving…',
    'done':          'Anchored on Base',
    'error':         txSucceeded ? 'Sign again' : 'Try again',
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
          className="text-[8px] font-mono text-danger/60 max-w-[110px] truncate"
          title={errorMsg}
        >
          {errorMsg}
        </span>
      )}
    </div>
  )
}
