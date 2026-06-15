'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence }      from 'framer-motion'
import { Star, Sparkles, ChevronRight, Clock, Trophy, Zap } from 'lucide-react'
import { Confetti }                     from './Confetti'
import { cn }                           from '@/lib/utils'
import type { SpinResult }              from '@/hooks/useSpin'

// ─── Animated counter ────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1400, delay = 350) {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    setValue(0)
    let start: number | null = null
    const timer = setTimeout(() => {
      const step = (ts: number) => {
        if (!start) start = ts
        const progress = Math.min((ts - start) / duration, 1)
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3)
        setValue(Math.round(eased * target))
        if (progress < 1) rafRef.current = requestAnimationFrame(step)
      }
      rafRef.current = requestAnimationFrame(step)
    }, delay)

    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(rafRef.current)
    }
  }, [target, duration, delay])

  return value
}

// ─── Tier config ─────────────────────────────────────────────────────────────

function tierConfig(xp: number) {
  if (xp >= 250) return { label: 'JACKPOT', color: '#9070e8', glow: 'rgba(140,96,232,0.6)',  border: 'rgba(140,96,232,0.4)' }
  if (xp >= 100) return { label: 'RARE',    color: '#60a5fa', glow: 'rgba(96,165,250,0.5)',  border: 'rgba(96,165,250,0.35)' }
  if (xp >= 50)  return { label: 'GREAT',   color: '#4488f0', glow: 'rgba(68,136,240,0.45)', border: 'rgba(68,136,240,0.30)' }
  if (xp >= 25)  return { label: 'NICE',    color: '#5578c8', glow: 'rgba(85,120,200,0.40)', border: 'rgba(85,120,200,0.25)' }
  return                 { label: 'WIN',     color: '#4a6abf', glow: 'rgba(74,106,191,0.35)', border: 'rgba(74,106,191,0.20)' }
}

// ─── Component ───────────────────────────────────────────────────────────────

interface RewardRevealProps {
  result:      SpinResult | null
  active:      boolean
  onDismiss:   () => void
}

export function RewardReveal({ result, active, onDismiss }: RewardRevealProps) {
  const xpCount = useCountUp(active && result ? result.xpAwarded : 0, 1300, 600)
  const tier    = result ? tierConfig(result.xpAwarded) : null

  return (
    <AnimatePresence>
      {active && result && tier && (
        <>
          {/* ── Screen flash ─────────────────────────────────────────── */}
          <motion.div
            key="flash"
            className="fixed inset-0 pointer-events-none"
            style={{ zIndex: 58, background: tier.glow }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.55, 0] }}
            transition={{ duration: 0.45, times: [0, 0.15, 1], ease: 'easeOut' }}
          />

          {/* ── Glow burst ───────────────────────────────────────────── */}
          <motion.div
            key="burst"
            className="fixed pointer-events-none rounded-full"
            style={{
              zIndex:      59,
              left:        '50%',
              top:         '40%',
              transform:   'translate(-50%, -50%)',
              background:  `radial-gradient(circle, ${tier.glow} 0%, transparent 70%)`,
            }}
            initial={{ width: 0, height: 0, opacity: 0.9 }}
            animate={{ width: 500, height: 500, opacity: 0 }}
            transition={{ duration: 0.7, ease: [0.12, 0.8, 0.32, 1] }}
          />

          {/* ── Confetti ─────────────────────────────────────────────── */}
          <Confetti active={active} count={result.xpAwarded >= 100 ? 90 : 60} />

          {/* ── Backdrop ─────────────────────────────────────────────── */}
          <motion.div
            key="backdrop"
            className="fixed inset-0"
            style={{
              zIndex:          60,
              backdropFilter:  'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              backgroundColor: 'rgba(4,6,14,0.82)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onDismiss}
          />

          {/* ── Reward card ──────────────────────────────────────────── */}
          <motion.div
            key="card"
            className="fixed left-1/2 z-[61] w-full max-w-sm"
            style={{
              top:       '50%',
              transform: 'translate(-50%, -50%)',
              padding:   '0 16px',
            }}
            initial={{ scale: 0.7, y: 60, opacity: 0 }}
            animate={{ scale: 1,   y: 0,  opacity: 1 }}
            exit={{ scale: 0.8, y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26, delay: 0.12 }}
          >
            <div
              className="relative overflow-hidden rounded-3xl"
              style={{
                background:  'rgba(7,10,22,0.90)',
                border:      `1px solid ${tier.border}`,
                boxShadow:   `0 0 60px ${tier.glow}, 0 20px 60px rgba(0,0,0,0.6)`,
                backdropFilter: 'blur(20px)',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Top accent line */}
              <div
                className="absolute top-0 inset-x-0 h-px"
                style={{ background: `linear-gradient(90deg, transparent, ${tier.color}, transparent)` }}
              />

              {/* Background radial glow */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `radial-gradient(ellipse 80% 50% at 50% 0%, ${tier.glow.replace('0.', '0.0')} 0%, transparent 60%)`,
                }}
              />

              <div className="relative z-10 p-7 text-center space-y-5">

                {/* Tier badge */}
                <motion.div
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase"
                  style={{ background: `${tier.color}1a`, border: `1px solid ${tier.border}`, color: tier.color }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25, delay: 0.2 }}
                >
                  <Star size={9} fill="currentColor" />
                  {tier.label}
                </motion.div>

                {/* XP counter */}
                <div className="space-y-0.5">
                  <motion.div
                    className="flex items-baseline justify-center gap-2"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1,   opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22, delay: 0.28 }}
                  >
                    <span
                      className="font-black text-white"
                      style={{
                        fontSize:      'clamp(3.5rem, 16vw, 5rem)',
                        lineHeight:    1,
                        letterSpacing: '-0.04em',
                        textShadow:    `0 0 40px ${tier.glow}`,
                      }}
                    >
                      +{xpCount}
                    </span>
                    <span
                      className="text-2xl font-black"
                      style={{ color: tier.color }}
                    >
                      XP
                    </span>
                  </motion.div>
                  <motion.p
                    className="text-xs text-text-secondary"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    added to your account
                  </motion.p>
                </div>

                {/* Stats row */}
                <motion.div
                  className="flex items-center justify-center gap-3 py-3 px-4 rounded-2xl"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55, duration: 0.35 }}
                >
                  <StatItem icon={<Zap size={11} />} label="Total XP" value={result.newTotalXp.toLocaleString()} />
                  <div className="w-px h-8 bg-white/[0.07]" />
                  <StatItem icon={<Trophy size={11} />} label="Rank" value={result.rank} accent />
                  <div className="w-px h-8 bg-white/[0.07]" />
                  <StatItem icon={<Sparkles size={11} />} label="Left" value={`${result.spinsRemaining}×`} />
                </motion.div>

                {/* CTA */}
                <motion.button
                  onClick={onDismiss}
                  className={cn(
                    'w-full h-12 rounded-2xl font-bold text-sm',
                    'flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.97]',
                  )}
                  style={result.spinsRemaining > 0 ? {
                    background: '#1652F0',
                    boxShadow:  '0 0 24px rgba(22,82,240,0.50)',
                    color:      '#fff',
                  } : {
                    background: 'rgba(255,255,255,0.07)',
                    border:     '1px solid rgba(255,255,255,0.10)',
                    color:      '#8b8fa8',
                  }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {result.spinsRemaining > 0 ? (
                    <><Sparkles size={14} /> Spin Again <ChevronRight size={14} className="opacity-60" /></>
                  ) : (
                    <><Clock size={14} /> Come back in 8h</>
                  )}
                </motion.button>

              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function StatItem({
  icon, label, value, accent,
}: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-center flex-1">
      <p className="flex items-center justify-center gap-1 text-[9px] text-text-muted uppercase tracking-wider font-semibold mb-0.5">
        {icon}{label}
      </p>
      <p className={cn('text-sm font-black', accent ? 'text-primary' : 'text-text-primary')}>
        {value}
      </p>
    </div>
  )
}
