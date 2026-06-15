'use client'

import { useEffect, useRef } from 'react'

const COLORS = ['#1652F0', '#00C2FF', '#7C3AED', '#22C55E', '#F59E0B', '#ffffff', '#60a5fa', '#c4b5fd']

interface Particle {
  x: number; y: number; vx: number; vy: number
  color: string; rot: number; rotV: number; w: number; h: number
  alpha: number; decay: number
}

function makeParticle(cw: number, ch: number): Particle {
  return {
    x:     cw / 2 + (Math.random() - 0.5) * 160,
    y:     ch * 0.38,
    vx:    (Math.random() - 0.5) * 14,
    vy:    -9 - Math.random() * 11,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rot:   Math.random() * 360,
    rotV:  (Math.random() - 0.5) * 12,
    w:     5 + Math.random() * 5,
    h:     3 + Math.random() * 3,
    alpha: 1,
    decay: 0.007 + Math.random() * 0.006,
  }
}

interface Props {
  active: boolean
  count?: number
}

export function Confetti({ active, count = 70 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)

  useEffect(() => {
    if (!active) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Respect reduce-motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight

    const particles: Particle[] = Array.from({ length: count }, () =>
      makeParticle(canvas.width, canvas.height)
    )

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      let anyAlive = false

      for (const p of particles) {
        if (p.alpha <= 0) continue
        anyAlive = true
        p.x  += p.vx
        p.y  += p.vy
        p.vy += 0.28          // gravity
        p.vx *= 0.985         // drag
        p.rot += p.rotV
        p.alpha -= p.decay

        ctx.save()
        ctx.globalAlpha = Math.max(0, p.alpha)
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rot * Math.PI) / 180)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }

      if (anyAlive) rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(rafRef.current)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [active, count])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 65 }}
    />
  )
}
