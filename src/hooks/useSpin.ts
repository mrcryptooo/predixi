'use client'

import { useCallback, useRef, useState } from 'react'
import { useAccount, usePublicClient, useSignMessage } from 'wagmi'
import { useMotionValue, animate } from 'framer-motion'
import type { AnimationPlaybackControls } from 'framer-motion'
import { buildPredixiAuthMessage, generateNonce } from '@/lib/auth/wallet-signature'
import { hashCommitment }            from '@/lib/onchain/commitment'
import { normalizeCommitmentContext } from '@/lib/onchain/commitmentRegistry'
import { useSubmitToBase }           from '@/hooks/useSubmitToBase'
import { spinAudio }                 from '@/lib/spin-audio'

// ─── Wheel geometry ───────────────────────────────────────────────────────────
//
// 10 visual slots, 36° each, clockwise from 12 o'clock:
//   Slot 0: 5 XP  | Slot 1: $1   | Slot 2: 100 XP | Slot 3: 15 XP | Slot 4: $5
//   Slot 5: 250 XP | Slot 6: 10 XP | Slot 7: $10  | Slot 8: 50 XP | Slot 9: 25 XP
//
// Dollar slots (1, 4, 7) never appear in SEGMENT_TO_VISUAL_SLOT values — they
// are cosmetic only and the server never returns segmentIndex 7/8/9.

const SEGMENT_TO_VISUAL_SLOT: Record<number, number> = {
  0: 0,  // 5 XP   → slot 0
  1: 6,  // 10 XP  → slot 6
  2: 3,  // 15 XP  → slot 3
  3: 9,  // 25 XP  → slot 9
  4: 8,  // 50 XP  → slot 8
  5: 2,  // 100 XP → slot 2
  6: 5,  // 250 XP → slot 5
}

// The pointer sits at 12 o'clock (0°). targetAngle = centre of that visual slot.
function computeLandingRotation(segmentIndex: number, currentRotation: number): number {
  const visualSlot  = SEGMENT_TO_VISUAL_SLOT[segmentIndex] ?? 0
  const targetAngle = visualSlot * 36 + 18
  const normalised  = ((currentRotation % 360) + 360) % 360
  let delta = targetAngle - normalised
  if (delta <= 5) delta += 360          // always move forward
  return currentRotation + delta + 2 * 360  // 2 extra dramatic spins
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type SpinPhase =
  | 'idle'
  | 'loading-status'
  | 'ready'
  | 'signing'
  | 'preparing'
  | 'awaiting-tx'
  | 'confirming-tx'
  | 'claiming'
  | 'animating'
  | 'complete'
  | 'cooldown'
  | 'daily-limit'
  | 'error'

export type SpinStatusData = {
  spinsToday:     number
  spinsRemaining: number
  cooldownActive: boolean
  nextSpinAt:     string | null
  canSpin:        boolean
  reason?:        string
}

export type SpinResult = {
  xpAwarded:      number
  segmentIndex:   number
  newTotalXp:     number
  rank:           string
  spinsRemaining: number
  nextSpinAt:     string | null
}

export type UseSpinReturn = {
  rotation:    ReturnType<typeof useMotionValue<number>>
  phase:       SpinPhase
  statusData:  SpinStatusData | null
  result:      SpinResult | null
  error:       string | null
  fetchStatus: () => Promise<void>
  triggerSpin: () => Promise<void>
  resetResult: () => void
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSpin(): UseSpinReturn {
  const { address }          = useAccount()
  const publicClient         = usePublicClient({ chainId: 8453 })
  const { signMessageAsync } = useSignMessage()
  const { submitAsync }      = useSubmitToBase()

  const rotation    = useMotionValue(0)
  const fastSpinRef = useRef<AnimationPlaybackControls | null>(null)

  const [phase,      setPhase]      = useState<SpinPhase>('idle')
  const [statusData, setStatusData] = useState<SpinStatusData | null>(null)
  const [result,     setResult]     = useState<SpinResult | null>(null)
  const [error,      setError]      = useState<string | null>(null)

  // ── Status fetch ─────────────────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    if (!address) return
    setPhase('loading-status')
    try {
      const res  = await fetch(`/api/spin/status?wallet=${address}`)
      const data = await res.json() as SpinStatusData & { success: boolean }
      if (data.success) {
        setStatusData(data)
        setPhase(!data.canSpin
          ? (data.reason === 'daily_limit_reached' ? 'daily-limit' : 'cooldown')
          : 'ready')
      } else {
        setPhase('error')
        setError('Could not load spin status')
      }
    } catch {
      setPhase('error')
      setError('Network error — check your connection')
    }
  }, [address])

  // ── Main spin trigger ────────────────────────────────────────────────────

  const triggerSpin = useCallback(async () => {
    if (!address || !publicClient) return
    setError(null)
    spinAudio.resume()

    try {
      // ── Phase: signing ─────────────────────────────────────────────────
      setPhase('signing')
      const nonce   = generateNonce()
      const message = buildPredixiAuthMessage(address, 'spin_prepare', nonce)
      let signature: string
      try {
        signature = await signMessageAsync({ message })
      } catch {
        setPhase('ready')
        return
      }

      // ── Phase: preparing ───────────────────────────────────────────────
      setPhase('preparing')
      const prepRes = await fetch('/api/spin/prepare', {
        method:  'POST',
        headers: {
          'Content-Type':       'application/json',
          'x-wallet-message':   encodeURIComponent(message),
          'x-wallet-signature': signature,
        },
        body: JSON.stringify({ walletAddress: address }),
      })
      const prepData = await prepRes.json() as {
        success: boolean; spinId: string; error?: string
      }
      if (!prepData.success) throw new Error(prepData.error ?? 'Failed to prepare spin')
      const { spinId } = prepData

      // ── Phase 1-2: fast spin (awaiting tx) ─────────────────────────────
      // Linear 100s animation — will be stopped when claim returns.
      setPhase('awaiting-tx')
      fastSpinRef.current = animate(rotation, rotation.get() + 72_000, {
        duration: 100,
        ease:     'linear',
      })

      // ── Submit on-chain commitment ──────────────────────────────────────
      const commitmentHash = hashCommitment({
        type:          'spin',
        walletAddress: address.toLowerCase(),
        spinId,
      })
      const context = normalizeCommitmentContext(`predixi:spin:${spinId}`)
      let txHash: `0x${string}`
      try {
        txHash = await submitAsync({ commitmentHash, context })
      } catch (txErr) {
        fastSpinRef.current?.stop()
        rotation.set(0)
        setPhase('ready')
        const msg = txErr instanceof Error ? txErr.message : ''
        if (!msg.toLowerCase().includes('rejected') && !msg.toLowerCase().includes('denied')) {
          setError('Transaction failed — please try again')
        }
        return
      }

      // ── Phase: confirming ──────────────────────────────────────────────
      setPhase('confirming-tx')
      await publicClient.waitForTransactionReceipt({ hash: txHash })

      // ── Phase: claiming ────────────────────────────────────────────────
      setPhase('claiming')
      const claimRes = await fetch('/api/spin/claim', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ spinId, txHash }),
      })
      const claimData = await claimRes.json() as {
        success:        boolean
        xpAwarded:      number
        segmentIndex:   number
        newTotalXp:     number
        rank:           string
        spinsRemaining: number
        nextSpinAt:     string | null
        error?:         string
      }
      if (!claimData.success) throw new Error(claimData.error ?? 'Failed to claim spin')

      // ── Phases 3-6: premium landing animation ──────────────────────────
      fastSpinRef.current?.stop()

      const cur     = rotation.get()
      const landing = computeLandingRotation(claimData.segmentIndex, cur)

      setPhase('animating')

      // Phase 3 — Deceleration (with tick sounds at each segment crossing)
      let prevSeg = -1
      let elapsed = 0
      const decelDuration = 2.8
      await animate(rotation, landing - 20, {
        duration: decelDuration,
        ease:     [0.14, 0.82, 0.38, 1],
        onUpdate: (v) => {
          elapsed += 1 / 60
          const seg = Math.floor(((v % 360) + 360) % 360 / 36)
          if (seg !== prevSeg) {
            prevSeg = seg
            const speed = Math.max(0, 1 - elapsed / decelDuration)
            spinAudio.tick(speed)
          }
        },
      })

      // Phase 4 — Overshoot (5° past target)
      await animate(rotation, landing + 5, {
        duration: 0.26,
        ease:     [0.4, 0, 0.8, 1],
      })

      // Phases 5-6 — Bounce-back spring to exact landing
      await animate(rotation, landing, {
        duration: 0.55,
        ease:     [0.34, 1.56, 0.64, 1],
      })

      // Landing thud + reward chord
      spinAudio.land()
      setTimeout(() => spinAudio.reward(claimData.xpAwarded), 180)

      // ── Complete ───────────────────────────────────────────────────────
      setResult({
        xpAwarded:      claimData.xpAwarded,
        segmentIndex:   claimData.segmentIndex,
        newTotalXp:     claimData.newTotalXp,
        rank:           claimData.rank,
        spinsRemaining: claimData.spinsRemaining,
        nextSpinAt:     claimData.nextSpinAt,
      })
      setStatusData(prev => prev ? {
        ...prev,
        spinsToday:     (prev.spinsToday ?? 0) + 1,
        spinsRemaining: claimData.spinsRemaining,
        cooldownActive: claimData.spinsRemaining === 0 || !!claimData.nextSpinAt,
        nextSpinAt:     claimData.nextSpinAt,
        canSpin:        false,
      } : null)
      setPhase('complete')

    } catch (err) {
      fastSpinRef.current?.stop()
      setPhase('error')
      setError(err instanceof Error ? err.message : 'Something went wrong — please try again')
    }
  }, [address, publicClient, signMessageAsync, submitAsync, rotation])

  // ── Reset ────────────────────────────────────────────────────────────────

  const resetResult = useCallback(() => {
    setResult(null)
    if (statusData && statusData.spinsRemaining > 0 && !statusData.cooldownActive) {
      setPhase('ready')
    } else {
      setPhase(statusData?.reason === 'daily_limit_reached' ? 'daily-limit' : 'cooldown')
    }
  }, [statusData])

  return { rotation, phase, statusData, result, error, fetchStatus, triggerSpin, resetResult }
}
