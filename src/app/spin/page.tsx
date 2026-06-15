'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence }           from 'framer-motion'
import { useAccount }                        from 'wagmi'
import { Sparkles, Zap, Clock, AlertCircle, RefreshCw, ChevronRight, Star } from 'lucide-react'
import { SpinWheel }   from '@/components/spin/SpinWheel'
import { useSpin }     from '@/hooks/useSpin'
import { cn }          from '@/lib/utils'

// ─── Cooldown countdown ───────────────────────────────────────────────────────

function CooldownTimer({ nextSpinAt }: { nextSpinAt: string | null }) {
  const [label, setLabel] = useState('–')

  useEffect(() => {
    if (!nextSpinAt) { setLabel('–'); return }

    const tick = () => {
      const ms = new Date(nextSpinAt).getTime() - Date.now()
      if (ms <= 0) { setLabel('Ready!'); return }
      const h  = Math.floor(ms / 3_600_000)
      const m  = Math.floor((ms % 3_600_000) / 60_000)
      const s  = Math.floor((ms % 60_000) / 1_000)
      setLabel(`${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`)
    }
    tick()
    const id = setInterval(tick, 1_000)
    return () => clearInterval(id)
  }, [nextSpinAt])

  return <span className="tabular-nums">{label}</span>
}

// ─── XP tier label helper ─────────────────────────────────────────────────────

function xpTierLabel(xp: number): string {
  if (xp >= 250) return 'Jackpot!'
  if (xp >= 100) return 'Rare!'
  if (xp >= 50)  return 'Great!'
  if (xp >= 25)  return 'Nice!'
  return 'Win!'
}

// ─── Phase-specific button config ─────────────────────────────────────────────

type ButtonCfg = {
  label:    React.ReactNode
  enabled:  boolean
  glow?:    boolean
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SpinPage() {
  const { address, isConnected } = useAccount()

  const {
    rotation,
    phase,
    statusData,
    result,
    error,
    fetchStatus,
    triggerSpin,
    resetResult,
  } = useSpin()

  // Fetch status once wallet is connected
  useEffect(() => {
    if (isConnected && address && phase === 'idle') {
      fetchStatus()
    }
  }, [isConnected, address, phase, fetchStatus])

  // Track the landed segment to highlight it on the wheel
  const landedSeg = (phase === 'complete' || phase === 'animating') ? (result?.segmentIndex ?? null) : null

  // ── Button config by phase ───────────────────────────────────────────────
  const buttonCfg = useCallback((): ButtonCfg => {
    switch (phase) {
      case 'idle':
      case 'loading-status':
        return { label: 'Loading…',                   enabled: false }

      case 'ready':
        return { label: 'SPIN',                        enabled: true, glow: true }

      case 'signing':
        return { label: <Spinner text="Sign in wallet…" />,    enabled: false }

      case 'preparing':
        return { label: <Spinner text="Preparing…" />,         enabled: false }

      case 'awaiting-tx':
        return { label: <Spinner text="Send transaction…" />,  enabled: false }

      case 'confirming-tx':
        return { label: <Spinner text="Confirming on Base…" />, enabled: false }

      case 'claiming':
        return { label: <Spinner text="Almost there…" />,      enabled: false }

      case 'animating':
        return { label: '✨ Revealing…',               enabled: false }

      case 'complete':
        return statusData && statusData.spinsRemaining > 0 && !statusData.cooldownActive
          ? { label: 'Spin Again', enabled: true, glow: true }
          : { label: 'Come back later', enabled: false }

      case 'cooldown':
      case 'daily-limit':
        return { label: <><Clock size={14} className="inline mr-1.5 mb-px" /><CooldownTimer nextSpinAt={statusData?.nextSpinAt ?? null} /></>, enabled: false }

      case 'error':
        return { label: <><RefreshCw size={14} className="inline mr-1.5 mb-px" />Try Again</>, enabled: true }

      default:
        return { label: 'SPIN', enabled: false }
    }
  }, [phase, statusData])

  const cfg = buttonCfg()

  const handleButtonClick = useCallback(() => {
    if (phase === 'ready')    { triggerSpin();  return }
    if (phase === 'complete') { resetResult();  return }
    if (phase === 'error')    { fetchStatus();  return }
  }, [phase, triggerSpin, resetResult, fetchStatus])

  const isSpinning = ['awaiting-tx', 'confirming-tx', 'claiming', 'animating'].includes(phase)

  return (
    <main className="min-h-screen bg-bg text-text-primary font-sans">
      <div className="max-w-xl mx-auto px-4 py-6 sm:py-10 pb-safe-nav">

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className={cn(
            'relative overflow-hidden rounded-3xl mb-8',
            'border border-primary/25',
            'bg-gradient-to-br from-primary/12 via-[#070b22] to-bg',
            'shadow-[0_0_32px_rgba(22,82,240,0.08)]'
          )}
        >
          <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-primary opacity-[0.06] blur-3xl pointer-events-none" />
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent" />

          <div className="relative z-10 p-5 sm:p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
              <Sparkles size={22} className="text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-black text-text-primary tracking-tight">
                Daily <span className="text-gradient-brand">SPIN</span>
              </h1>
              <p className="text-xs text-text-secondary mt-0.5">
                3 spins per day · 8h cooldown · Earn XP on Base
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Wallet gate ───────────────────────────────────────────────── */}
        {!isConnected && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 space-y-3"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
              <Sparkles size={28} className="text-primary/60" />
            </div>
            <p className="text-text-secondary text-sm">Connect your wallet to spin</p>
          </motion.div>
        )}

        {/* ── Main spin UI ───────────────────────────────────────────────── */}
        {isConnected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col items-center gap-8"
          >
            {/* Wheel ────────────────────────────────────────────────────── */}
            <div className="relative flex items-center justify-center">
              {/* Pulse ring behind wheel during spin */}
              {isSpinning && (
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-primary/30"
                  animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
              <SpinWheel
                rotation={rotation}
                landedSegmentIndex={landedSeg}
                size={290}
              />
            </div>

            {/* Status chips ─────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 flex-wrap justify-center">
              {/* Spins remaining */}
              <div className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold',
                'glass-inner border border-white/[0.08]'
              )}>
                <div className="flex gap-0.5">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className={cn(
                        'w-2 h-2 rounded-full transition-colors',
                        i < (statusData?.spinsRemaining ?? 3)
                          ? 'bg-primary shadow-[0_0_6px_rgba(22,82,240,0.9)]'
                          : 'bg-white/20'
                      )}
                    />
                  ))}
                </div>
                <span className="text-text-secondary">
                  {statusData?.spinsRemaining ?? 3} spin{(statusData?.spinsRemaining ?? 3) !== 1 ? 's' : ''} left
                </span>
              </div>

              {/* Cooldown / ready badge */}
              {phase === 'cooldown' || phase === 'daily-limit' ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold glass-inner border border-warning/25 text-warning/80">
                  <Clock size={11} />
                  <CooldownTimer nextSpinAt={statusData?.nextSpinAt ?? null} />
                </div>
              ) : (
                phase === 'ready' && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold glass-inner border border-success/25 text-success/80">
                    <Zap size={11} />
                    Ready to spin
                  </div>
                )
              )}
            </div>

            {/* Phase status message ─────────────────────────────────────── */}
            <AnimatePresence mode="wait">
              {isSpinning && (
                <motion.div
                  key="spinning-msg"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="text-center space-y-1"
                >
                  <p className="text-sm text-text-secondary">
                    {phase === 'awaiting-tx'   && 'Approve the transaction in your wallet'}
                    {phase === 'confirming-tx' && 'Waiting for Base confirmation…'}
                    {phase === 'claiming'      && 'Claiming reward…'}
                    {phase === 'animating'     && ''}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error message ────────────────────────────────────────────── */}
            <AnimatePresence>
              {error && phase === 'error' && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-start gap-2 px-4 py-3 rounded-2xl bg-danger/10 border border-danger/25 text-sm text-danger/90 max-w-sm w-full"
                >
                  <AlertCircle size={15} className="flex-shrink-0 mt-px" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main action button ───────────────────────────────────────── */}
            <button
              onClick={handleButtonClick}
              disabled={!cfg.enabled}
              className={cn(
                'relative w-full max-w-[280px] h-14 rounded-2xl font-black text-lg tracking-wide',
                'transition-all duration-200 select-none',
                cfg.enabled
                  ? cn(
                      'bg-primary text-white active:scale-[0.97]',
                      cfg.glow && 'shadow-[0_0_28px_rgba(22,82,240,0.55),0_4px_12px_rgba(22,82,240,0.30)]',
                      'hover:bg-[#1e5fff] hover:shadow-[0_0_36px_rgba(22,82,240,0.65)]'
                    )
                  : 'bg-white/[0.06] text-text-muted cursor-not-allowed border border-white/[0.07]'
              )}
            >
              {cfg.label}
            </button>

            {/* Dollar segments disclaimer ────────────────────────────────── */}
            <p className="text-center text-[10px] text-text-muted/60 max-w-[260px] leading-relaxed">
              $1 · $5 · $10 are display-only segments.
              All rewards are XP only.
            </p>
          </motion.div>
        )}
      </div>

      {/* ── Result popup ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {result && phase === 'complete' && (
          <motion.div
            key="result-overlay"
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ backdropFilter: 'blur(12px)', backgroundColor: 'rgba(6,8,16,0.75)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <motion.div
              className={cn(
                'relative w-full max-w-sm overflow-hidden',
                'glass-elevated rounded-3xl border border-primary/30',
                'shadow-[0_0_60px_rgba(22,82,240,0.25)]'
              )}
              initial={{ scale: 0.85, y: 30, opacity: 0 }}
              animate={{ scale: 1,    y: 0,  opacity: 1 }}
              exit={{ scale: 0.85, y: 20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            >
              {/* Top gradient strip */}
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full bg-primary/15 blur-3xl pointer-events-none" />

              <div className="relative z-10 p-7 text-center space-y-5">
                {/* Tier label */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/25 text-primary text-xs font-bold tracking-wider uppercase">
                  <Star size={10} fill="currentColor" />
                  {xpTierLabel(result.xpAwarded)}
                </div>

                {/* XP amount */}
                <div className="space-y-1">
                  <div className="flex items-baseline justify-center gap-2">
                    <span
                      className="font-black text-text-primary"
                      style={{ fontSize: 'clamp(3rem, 14vw, 4.5rem)', lineHeight: 1, letterSpacing: '-0.04em' }}
                    >
                      +{result.xpAwarded}
                    </span>
                    <span className="text-2xl font-black text-primary/80">XP</span>
                  </div>
                  <p className="text-xs text-text-secondary">added to your account</p>
                </div>

                {/* Stats row */}
                <div className="flex items-center justify-center gap-4 py-3 px-4 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
                  <div className="text-center">
                    <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">Total XP</p>
                    <p className="text-sm font-black text-text-primary tabular-nums">{result.newTotalXp.toLocaleString()}</p>
                  </div>
                  <div className="w-px h-8 bg-white/[0.08]" />
                  <div className="text-center">
                    <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">Rank</p>
                    <p className="text-sm font-black text-primary">{result.rank}</p>
                  </div>
                  <div className="w-px h-8 bg-white/[0.08]" />
                  <div className="text-center">
                    <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">Spins left</p>
                    <p className="text-sm font-black text-text-primary">{result.spinsRemaining}</p>
                  </div>
                </div>

                {/* CTA */}
                <button
                  onClick={resetResult}
                  className={cn(
                    'w-full h-12 rounded-2xl font-bold text-sm',
                    'flex items-center justify-center gap-2',
                    result.spinsRemaining > 0
                      ? 'bg-primary text-white shadow-[0_0_20px_rgba(22,82,240,0.40)] hover:bg-[#1e5fff] transition-colors'
                      : 'bg-white/[0.07] text-text-secondary border border-white/[0.08]'
                  )}
                >
                  {result.spinsRemaining > 0 ? (
                    <><Sparkles size={14} />Spin Again</>
                  ) : (
                    <><Clock size={14} />Come back in 8h</>
                  )}
                  <ChevronRight size={14} className="opacity-60" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}

// ─── Inline spinner label ──────────────────────────────────────────────────

function Spinner({ text }: { text: string }) {
  return (
    <span className="flex items-center justify-center gap-2">
      <span
        className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin inline-block"
        style={{ animationDuration: '0.7s' }}
      />
      {text}
    </span>
  )
}
