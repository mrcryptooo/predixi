'use client'

/**
 * MintBadgeButton — optional "Mint on Base" action for an earned badge.
 *
 * Flow (three wallet interactions, all user-initiated):
 *   1. Click → useMintBadge.mintBadge(badgeId)
 *      → wallet signs request message
 *      → GET /api/badges/mint-signature → EIP-712 sig, nonce
 *      → wallet signs + broadcasts mintBadge() TX
 *      → wait for Base receipt
 *      → wallet signs confirm message
 *      → PATCH /api/badges records minted_onchain=true
 *   2. Show "Owned on Base ✓" + BaseScan link
 *
 * Safety:
 *   • No TX is sent until the user explicitly clicks.
 *   • If TX confirms but PATCH fails, retry shows "Sign again" — no second TX.
 *   • If mintedOnchain=true from props (loaded from DB), shows owned state immediately.
 *   • Renders null when wallet not connected and badge is not yet minted.
 *   • onMinted is called exactly once via a ref guard.
 *   • disabled prop prevents interaction (e.g. badge not earned by parent's knowledge).
 */

import { useCallback, useEffect, useRef }          from 'react'
import { useAccount }                              from 'wagmi'
import { ExternalLink, Loader2, RotateCcw, Sparkles } from 'lucide-react'
import { cn }                                      from '@/lib/utils'
import { useMintBadge }                            from '@/hooks/useMintBadge'
import { getBadgeTxUrl }                           from '@/lib/onchain/predixiBadges'

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface MintBadgeButtonProps {
  /** Badge string ID — passed directly to useMintBadge.mintBadge(). */
  badgeId:        string
  /** True when the DB already records this badge as minted (initial server state). */
  mintedOnchain?: boolean
  /** Existing DB-stored tx hash, or null. Used for owned state before any hook action. */
  txHash?:        string | null
  /** Disable the button entirely (e.g. badge not yet earned by the parent's knowledge). */
  disabled?:      boolean
  className?:     string
  /**
   * Called exactly once after PATCH /api/badges succeeds and isMinted becomes true.
   * Use to update parent state: switch card to "Owned on Base", store txHash.
   */
  onMinted?:      (badgeId: string, txHash: `0x${string}`) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function MintBadgeButton({
  badgeId,
  mintedOnchain = false,
  txHash:       propTxHash,
  disabled      = false,
  className,
  onMinted,
}: MintBadgeButtonProps) {
  const { isConnected } = useAccount()

  const {
    mintBadge,
    isRequestingSignature,
    isMintPending,
    isMintConfirming,
    isPersisting,
    isMinted,
    txHash: hookTxHash,
    error,
    reset,
  } = useMintBadge()

  // The effective tx hash — from this session (hook) or from DB (prop)
  const effectiveTxHash = hookTxHash ?? (propTxHash as `0x${string}` | null | undefined) ?? undefined

  // ── Fire onMinted exactly once when hook reaches minted state ───────────────
  const mintedCallbackFiredRef = useRef(false)

  useEffect(() => {
    if (!isMinted || !hookTxHash || mintedCallbackFiredRef.current) return
    mintedCallbackFiredRef.current = true
    onMinted?.(badgeId, hookTxHash)
  }, [isMinted, hookTxHash, badgeId, onMinted])

  // ── Click handler ─────────────────────────────────────────────────────────
  const handleClick = useCallback(() => {
    if (disabled || !isConnected) return
    // Error + txHash cached → PATCH-only retry (no new TX, no signing)
    // Error + no txHash     → full fresh attempt
    if (error && !hookTxHash) reset()
    mintBadge(badgeId)
  }, [disabled, isConnected, error, hookTxHash, badgeId, mintBadge, reset])

  // ── Derived state ──────────────────────────────────────────────────────────
  const isOwned = mintedOnchain || isMinted
  const isActive = isRequestingSignature || isMintPending || isMintConfirming || isPersisting

  // TX confirmed but PATCH failed → retry label is "Save again" (no re-sign needed)
  const saveRetry = !!error && !!hookTxHash

  // ── Owned state (from DB or just minted) ──────────────────────────────────
  if (isOwned && effectiveTxHash) {
    return (
      <div className={cn('inline-flex items-center gap-1', className)}>
        <span className="text-[8px] font-mono font-semibold text-emerald-400">
          Owned on Base
        </span>
        <a
          href={getBadgeTxUrl(effectiveTxHash)}
          target="_blank"
          rel="noopener noreferrer"
          title="View on BaseScan"
          className="text-emerald-400/50 hover:text-emerald-400 transition-colors flex-shrink-0"
        >
          <ExternalLink size={8} />
        </a>
      </div>
    )
  }

  // Owned but no tx hash stored yet (edge case — show minimal indicator)
  if (isOwned) {
    return (
      <span className="text-[8px] font-mono font-semibold text-emerald-400">
        Owned on Base
      </span>
    )
  }

  // ── Wallet not connected — nothing to show ────────────────────────────────
  if (!isConnected) return null

  // ── Phase label map ───────────────────────────────────────────────────────
  const label = (() => {
    if (isRequestingSignature) return 'Requesting…'
    if (isMintPending)         return 'Minting…'
    if (isMintConfirming)      return 'Confirming…'
    if (isPersisting)          return 'Saving…'
    if (error)                 return saveRetry ? 'Save again' : 'Try again'
    return 'Mint on Base'
  })()

  // ── Active / idle / error button ──────────────────────────────────────────
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isActive}
        className={cn(
          'inline-flex items-center gap-1 px-2 py-[3px] rounded-md',
          'text-[8px] font-mono font-semibold transition-all duration-150 select-none',
          disabled
            ? 'opacity-30 cursor-not-allowed bg-white/[0.04] border border-white/[0.08] text-white/30'
            : isActive
              ? 'bg-primary/8 border border-primary/15 text-primary/35 cursor-not-allowed'
              : error
                ? 'bg-danger/10 border border-danger/25 text-danger/70 hover:bg-danger/20 hover:text-danger active:scale-[0.97]'
                : 'bg-[#00C2FF]/8 border border-[#00C2FF]/20 text-[#00C2FF]/65 hover:bg-[#00C2FF]/14 hover:text-[#00C2FF]/90 hover:border-[#00C2FF]/35 active:scale-[0.97]',
        )}
      >
        {isActive ? (
          <Loader2 size={7} className="animate-spin flex-shrink-0" />
        ) : error ? (
          <RotateCcw size={7} className="flex-shrink-0" />
        ) : (
          <Sparkles size={7} className="flex-shrink-0" />
        )}
        {label}
      </button>

      {/* Compact error line — truncated, full message in title tooltip */}
      {error && (
        <span
          className="text-[7px] font-mono text-danger/55 max-w-[110px] truncate leading-none"
          title={error}
        >
          {error}
        </span>
      )}
    </div>
  )
}
