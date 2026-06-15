'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence }           from 'framer-motion'
import { useAccount }                        from 'wagmi'
import { Sparkles, Clock, AlertCircle, RefreshCw, Volume2, VolumeX, Zap, Wallet } from 'lucide-react'
import { SpinWheel }    from '@/components/spin/SpinWheel'
import { RewardReveal } from '@/components/spin/RewardReveal'
import { useSpin }      from '@/hooks/useSpin'
import { spinAudio }    from '@/lib/spin-audio'
import { cn }           from '@/lib/utils'

// ─── Cooldown countdown ───────────────────────────────────────────────────────

function CooldownTimer({ nextSpinAt }: { nextSpinAt: string | null }) {
  const [label, setLabel] = useState('–')
  useEffect(() => {
    if (!nextSpinAt) { setLabel('–'); return }
    const tick = () => {
      const ms = new Date(nextSpinAt).getTime() - Date.now()
      if (ms <= 0) { setLabel('Ready!'); return }
      const h = Math.floor(ms / 3_600_000)
      const m = Math.floor((ms % 3_600_000) / 60_000)
      const s = Math.floor((ms % 60_000) / 1_000)
      setLabel(`${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`)
    }
    tick()
    const id = setInterval(tick, 1_000)
    return () => clearInterval(id)
  }, [nextSpinAt])
  return <span className="tabular-nums">{label}</span>
}

// ─── Spin dot pips ────────────────────────────────────────────────────────────

function SpinPips({ total = 3, remaining }: { total?: number; remaining: number }) {
  return (
    <div className="flex gap-1.5 items-center">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          className="rounded-full"
          animate={i < remaining
            ? { width: 8, height: 8, backgroundColor: '#1652F0',
                boxShadow: '0 0 8px rgba(22,82,240,0.9)' }
            : { width: 7, height: 7, backgroundColor: 'rgba(255,255,255,0.18)',
                boxShadow: 'none' }
          }
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        />
      ))}
    </div>
  )
}

// ─── Inline spinner ───────────────────────────────────────────────────────────

function Spinner({ text }: { text: string }) {
  return (
    <span className="flex items-center justify-center gap-2">
      <span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin inline-block"
        style={{ animationDuration: '0.65s' }} />
      {text}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SpinPage() {
  const { address, isConnected } = useAccount()
  const [soundOn, setSoundOn]    = useState(false)

  const {
    rotation, phase, statusData, result, error,
    fetchStatus, triggerSpin, resetResult,
  } = useSpin()

  // Sync sound toggle with audio singleton
  useEffect(() => {
    spinAudio.setEnabled(soundOn)
  }, [soundOn])

  // Fetch status on wallet connect
  useEffect(() => {
    if (isConnected && address && phase === 'idle') fetchStatus()
  }, [isConnected, address, phase, fetchStatus])

  const isSpinning = ['awaiting-tx','confirming-tx','claiming','animating'].includes(phase)
  const isBusy     = isSpinning || ['preparing','loading-status'].includes(phase)
  const showReveal = phase === 'complete' && !!result

  // Landed segment to highlight on wheel
  const landedSeg = (phase === 'complete' || phase === 'animating')
    ? (result?.segmentIndex ?? null) : null

  // ── Button config ────────────────────────────────────────────────────────

  type BtnCfg = { node: React.ReactNode; enabled: boolean; glow: boolean; pulse?: boolean }

  const btnCfg = useCallback((): BtnCfg => {
    switch (phase) {
      case 'idle':
      case 'loading-status':   return { node: 'Loading…',                           enabled: false, glow: false }
      case 'ready':            return { node: 'SPIN',                                enabled: true,  glow: true,  pulse: true }
      case 'preparing':        return { node: <Spinner text="Preparing…" />,         enabled: false, glow: false }
      case 'awaiting-tx':      return { node: <Spinner text="Confirm in wallet…" />, enabled: false, glow: false }
      case 'confirming-tx':    return { node: <Spinner text="Confirming on Base…" />,enabled: false, glow: false }
      case 'claiming':         return { node: <Spinner text="Almost there…" />,      enabled: false, glow: false }
      case 'animating':        return { node: '✦ Revealing…',                        enabled: false, glow: false }
      case 'complete':
        return statusData && statusData.spinsRemaining > 0 && !statusData.cooldownActive
          ? { node: 'Spin Again', enabled: true, glow: true }
          : { node: 'Come back later', enabled: false, glow: false }
      case 'cooldown':
      case 'daily-limit':
        return { node: <><Clock size={14} className="inline mr-1.5 mb-px" /><CooldownTimer nextSpinAt={statusData?.nextSpinAt ?? null} /></>, enabled: false, glow: false }
      case 'error':
        return { node: <><RefreshCw size={14} className="inline mr-1.5 mb-px" />Try Again</>, enabled: true, glow: true }
      default:
        return { node: 'SPIN', enabled: false, glow: false }
    }
  }, [phase, statusData])

  const cfg = btnCfg()

  const handleButtonClick = useCallback(() => {
    spinAudio.resume()
    if (phase === 'ready')    { triggerSpin(); return }
    if (phase === 'complete') { resetResult(); return }
    if (phase === 'error')    { fetchStatus(); return }
  }, [phase, triggerSpin, resetResult, fetchStatus])

  const phaseLabel =
    phase === 'awaiting-tx'   ? 'Confirm transaction in your wallet' :
    phase === 'confirming-tx' ? 'Waiting for Base confirmation…' :
    phase === 'claiming'      ? 'Claiming reward…' : null

  // Suppress unused var warning
  void isBusy

  return (
    <main className="min-h-screen bg-bg text-text-primary font-sans overflow-x-hidden">
      <div className="max-w-xl mx-auto px-4 py-3 sm:py-8 pb-safe-nav">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="relative overflow-hidden rounded-3xl mb-4 glass-card-glow"
        >
          <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-primary/[0.06] blur-3xl pointer-events-none" />
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

          <div className="relative z-10 p-4 sm:p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
                <Sparkles size={20} className="text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-black text-text-primary tracking-tight leading-tight">
                  Daily <span className="text-gradient-brand">SPIN</span>
                </h1>
                <p className="text-[11px] text-text-secondary mt-0.5 leading-tight">
                  3 spins · 8h cooldown · Earn XP on Base
                </p>
              </div>
            </div>

            {/* Sound toggle */}
            <button
              onClick={() => setSoundOn(v => !v)}
              className={cn(
                'flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center',
                'transition-all duration-200 glass-inner active:scale-95',
                soundOn
                  ? 'text-primary border border-primary/30'
                  : 'text-text-muted border border-white/[0.07]'
              )}
              aria-label={soundOn ? 'Mute sounds' : 'Enable sounds'}
            >
              {soundOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>
          </div>
        </motion.div>

        {/* ── Wallet gate ─────────────────────────────────────────────── */}
        {!isConnected && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center py-20 gap-4"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Wallet size={26} className="text-primary/50" />
            </div>
            <p className="text-text-secondary text-sm">Connect your wallet to spin</p>
          </motion.div>
        )}

        {/* ── Main spin UI ─────────────────────────────────────────────── */}
        {isConnected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col items-center gap-4"
          >
            {/* Wheel ─────────────────────────────────────────────────────── */}
            <div className="relative flex items-center justify-center">
              <AnimatePresence>
                {isSpinning && (
                  <>
                    <motion.div
                      key="ring1"
                      className="absolute inset-[-16px] rounded-full border border-primary/25 pointer-events-none"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0.5,0,0.5], scale: [1,1.08,1] }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <motion.div
                      key="ring2"
                      className="absolute inset-[-28px] rounded-full border border-primary/15 pointer-events-none"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0.3,0,0.3], scale: [1,1.06,1] }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                    />
                  </>
                )}
              </AnimatePresence>

              <SpinWheel
                rotation={rotation}
                landedSegmentIndex={landedSeg}
                size={268}
                isSpinning={isSpinning}
              />
            </div>

            {/* Status chips ───────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-full glass-inner">
                <SpinPips remaining={statusData?.spinsRemaining ?? 3} />
                <span className="text-xs text-text-secondary font-medium">
                  {statusData?.spinsRemaining ?? 3} spin{(statusData?.spinsRemaining ?? 3) !== 1 ? 's' : ''} left
                </span>
              </div>

              <AnimatePresence mode="wait">
                {(phase === 'cooldown' || phase === 'daily-limit') && (
                  <motion.div key="cooldown"
                    initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold glass-inner border border-warning/25 text-warning/80"
                  >
                    <Clock size={11} />
                    <CooldownTimer nextSpinAt={statusData?.nextSpinAt ?? null} />
                  </motion.div>
                )}
                {phase === 'ready' && (
                  <motion.div key="ready"
                    initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold glass-inner border border-success/25 text-success/80"
                  >
                    <Zap size={11} /> Ready
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Phase status ───────────────────────────────────────────────── */}
            <AnimatePresence mode="wait">
              {phaseLabel && (
                <motion.p
                  key={phaseLabel}
                  initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-4 }}
                  className="text-sm text-text-secondary text-center"
                >
                  {phaseLabel}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Error ───────────────────────────────────────────────────────── */}
            <AnimatePresence>
              {error && phase === 'error' && (
                <motion.div
                  initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                  className="flex items-start gap-2 px-4 py-3 rounded-2xl bg-danger/10 border border-danger/25 text-sm text-danger/90 max-w-sm w-full"
                >
                  <AlertCircle size={15} className="flex-shrink-0 mt-px" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* SPIN button ─────────────────────────────────────────────────── */}
            <motion.button
              onClick={handleButtonClick}
              disabled={!cfg.enabled}
              whileTap={cfg.enabled ? { scale: 0.96 } : {}}
              whileHover={cfg.enabled ? { scale: 1.02 } : {}}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              className={cn(
                'relative w-full max-w-[280px] h-14 rounded-2xl font-black text-lg tracking-wide',
                'transition-shadow duration-300 select-none overflow-hidden',
                cfg.enabled
                  ? 'bg-primary text-white cursor-pointer'
                  : 'bg-white/[0.06] text-text-muted cursor-not-allowed border border-white/[0.07]'
              )}
              style={cfg.enabled && cfg.glow ? {
                boxShadow: '0 0 32px rgba(22,82,240,0.55), 0 4px 16px rgba(22,82,240,0.30)',
              } : undefined}
            >
              {/* Shimmer effect */}
              {cfg.enabled && (
                <span className="absolute inset-0 pointer-events-none shimmer opacity-50"
                  style={{ borderRadius: 'inherit' }} />
              )}
              {/* Pulse ring on ready */}
              {cfg.pulse && (
                <motion.span
                  className="absolute inset-0 rounded-2xl border border-primary/50 pointer-events-none"
                  animate={{ scale:[1,1.06,1], opacity:[0.6,0,0.6] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
              <span className="relative z-10">{cfg.node}</span>
            </motion.button>

          </motion.div>
        )}
      </div>

      {/* ── Reward reveal overlay ────────────────────────────────────────── */}
      <RewardReveal
        result={result}
        active={showReveal}
        onDismiss={resetResult}
      />
    </main>
  )
}
