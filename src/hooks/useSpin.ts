'use client'

import { useCallback, useRef, useState } from 'react'
import { useAccount, usePublicClient, useSignMessage } from 'wagmi'
import { useMotionValue, animate } from 'framer-motion'
import type { AnimationPlaybackControls } from 'framer-motion'
import { buildPredixiAuthMessage, generateNonce } from '@/lib/auth/wallet-signature'
import { hashCommitment }           from '@/lib/onchain/commitment'
import { normalizeCommitmentContext } from '@/lib/onchain/commitmentRegistry'
import { useSubmitToBase }          from '@/hooks/useSubmitToBase'

// ─── Wheel geometry ───────────────────────────────────────────────────────────
//
// 10 visual slots, each 36°, clockwise from 12 o'clock:
//   Slot 0: 5 XP  | Slot 1: $1   | Slot 2: 100 XP | Slot 3: 15 XP | Slot 4: $5
//   Slot 5: 250 XP | Slot 6: 10 XP | Slot 7: $10   | Slot 8: 50 XP | Slot 9: 25 XP
//
// Dollar slots (1, 4, 7) never appear in SEGMENT_TO_VISUAL_SLOT values.

const SEGMENT_TO_VISUAL_SLOT: Record<number, number> = {
  0: 0,  // 5 XP
  1: 6,  // 10 XP
  2: 3,  // 15 XP
  3: 9,  // 25 XP
  4: 8,  // 50 XP
  5: 2,  // 100 XP
  6: 5,  // 250 XP
}

function computeLandingRotation(segmentIndex: number, currentRotation: number): number {
  const visualSlot  = SEGMENT_TO_VISUAL_SLOT[segmentIndex] ?? 0
  const targetAngle = visualSlot * 36 + 18   // centre of that slot, degrees CW from top
  const normalised  = ((currentRotation % 360) + 360) % 360
  let delta = targetAngle - normalised
  if (delta <= 5) delta += 360               // always move forward
  return currentRotation + delta + 2 * 360  // 2 extra full spins for drama
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

  const triggerSpin = useCallback(async () => {
    if (!address || !publicClient) return
    setError(null)

    try {
      // 1. Wallet auth signature
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

      // 2. Server pre-determines outcome and locks spinId
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
      const prepData = await prepRes.json() as { success: boolean; spinId: string; error?: string }
      if (!prepData.success) throw new Error(prepData.error ?? 'Failed to prepare spin')
      const { spinId } = prepData

      // 3. Start fast-spin animation (wheel spinning while tx is in-flight)
      setPhase('awaiting-tx')
      fastSpinRef.current = animate(rotation, rotation.get() + 72000, {
        duration: 100,
        ease: 'linear',
      })

      // 4. Submit Base transaction
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

      // 5. Wait for on-chain confirmation
      setPhase('confirming-tx')
      await publicClient.waitForTransactionReceipt({ hash: txHash })

      // 6. Claim reward (server reads xp_amount from DB, not client)
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

      // 7. Land wheel on correct segment
      fastSpinRef.current?.stop()
      const landing = computeLandingRotation(claimData.segmentIndex, rotation.get())
      setPhase('animating')
      await animate(rotation, landing, {
        duration: 3.5,
        ease: [0.17, 0.67, 0.12, 0.99],
      })

      // 8. Show result
      setResult({
        xpAwarded:      claimData.xpAwarded,
        segmentIndex:   claimData.segmentIndex,
        newTotalXp:     claimData.newTotalXp,
        rank:           claimData.rank,
        spinsRemaining: claimData.spinsRemaining,
        nextSpinAt:     claimData.nextSpinAt,
      })
      setStatusData(prev => prev
        ? {
            ...prev,
            spinsToday:     (prev.spinsToday ?? 0) + 1,
            spinsRemaining: claimData.spinsRemaining,
            cooldownActive: claimData.spinsRemaining === 0 || !!claimData.nextSpinAt,
            nextSpinAt:     claimData.nextSpinAt,
            canSpin:        false,
          }
        : null)
      setPhase('complete')

    } catch (err) {
      fastSpinRef.current?.stop()
      setPhase('error')
      setError(err instanceof Error ? err.message : 'Something went wrong — please try again')
    }
  }, [address, publicClient, signMessageAsync, submitAsync, rotation])

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
