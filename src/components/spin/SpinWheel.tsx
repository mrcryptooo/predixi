'use client'

import { motion, type MotionValue } from 'framer-motion'

// ─── Geometry ────────────────────────────────────────────────────────────────

const CX = 150, CY = 150
const R_OUTER = 138   // outer rim of segments
const R_TEXT  = 92    // label radial distance
const R_HUB   = 28    // hub radius

function polar(r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180)
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) }
}

function slicePath(i: number): string {
  const s = polar(R_OUTER, i * 36)
  const e = polar(R_OUTER, (i + 1) * 36)
  return `M ${CX} ${CY} L ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${R_OUTER} ${R_OUTER} 0 0 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)} Z`
}

function outerArcPath(i: number): string {
  const r = R_OUTER - 1
  const s = polar(r, i * 36 + 0.8)
  const e = polar(r, (i + 1) * 36 - 0.8)
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 0 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`
}

// ─── Segment definitions ──────────────────────────────────────────────────────

// Visual slots 0-9, clockwise from 12 o'clock.
// Dollar slots (1, 4, 7) are cosmetic — server never returns their segmentIndex (7/8/9).
// These are VISUAL ONLY and must never be selected by the server.

const SLOTS = [
  // 0 — 5 XP
  { label: '5',   unit: 'XP', bg: '#07102a', edge: '#182a55', arcColor: '#2a4a90', text: '#4d6abf', isDollar: false, segIdx: 0 },
  // 1 — $1 (visual-only — never included in reward selection)
  { label: '$1',  unit: '',   bg: '#090909', edge: '#141414', arcColor: null,      text: '#2a2a35', isDollar: true,  segIdx: 7 },
  // 2 — 100 XP
  { label: '100', unit: 'XP', bg: '#071535', edge: '#1a3070', arcColor: '#1e50b8', text: '#4488f0', isDollar: false, segIdx: 5 },
  // 3 — 15 XP
  { label: '15',  unit: 'XP', bg: '#081228', edge: '#182850', arcColor: '#283c80', text: '#5272c0', isDollar: false, segIdx: 2 },
  // 4 — $3 (visual-only — never included in reward selection)
  { label: '$3',  unit: '',   bg: '#090909', edge: '#141414', arcColor: null,      text: '#2a2a35', isDollar: true,  segIdx: 8 },
  // 5 — 250 XP (jackpot)
  { label: '250', unit: 'XP', bg: '#100840', edge: '#2a1068', arcColor: '#5028b8', text: '#8860e8', isDollar: false, segIdx: 6 },
  // 6 — 10 XP
  { label: '10',  unit: 'XP', bg: '#07102a', edge: '#182a55', arcColor: '#2040a0', text: '#587ae0', isDollar: false, segIdx: 1 },
  // 7 — $5 (visual-only — never included in reward selection)
  { label: '$5',  unit: '',   bg: '#090909', edge: '#141414', arcColor: null,      text: '#2a2a35', isDollar: true,  segIdx: 9 },
  // 8 — 50 XP
  { label: '50',  unit: 'XP', bg: '#081430', edge: '#1a2e65', arcColor: '#1a4aa8', text: '#3878e8', isDollar: false, segIdx: 4 },
  // 9 — 25 XP
  { label: '25',  unit: 'XP', bg: '#081228', edge: '#1c2c60', arcColor: '#243870', text: '#5580d0', isDollar: false, segIdx: 3 },
] as const

// ─── Component ────────────────────────────────────────────────────────────────

interface SpinWheelProps {
  rotation:            MotionValue<number>
  landedSegmentIndex?: number | null
  size?:               number
  isSpinning?:         boolean
}

export function SpinWheel({
  rotation,
  landedSegmentIndex = null,
  size = 300,
  isSpinning = false,
}: SpinWheelProps) {
  const scale = size / 300

  return (
    <div
      className="relative flex-shrink-0 select-none"
      style={{ width: size, height: size }}
    >
      {/* ── Outer ambient glow (non-rotating) ──────────────────────────── */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none transition-all duration-700"
        style={{
          boxShadow: isSpinning
            ? '0 0 70px rgba(22,82,240,0.50), 0 0 140px rgba(22,82,240,0.20), 0 0 220px rgba(22,82,240,0.08)'
            : '0 0 40px rgba(22,82,240,0.28), 0 0 80px rgba(22,82,240,0.10)',
        }}
      />

      {/* ── Fixed light sheen (non-rotating, simulates overhead light) ── */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none z-10"
        style={{
          background: 'radial-gradient(ellipse 55% 28% at 50% 4%, rgba(255,255,255,0.07) 0%, transparent 100%)',
        }}
      />

      {/* ── Pointer arrow (non-rotating) ──────────────────────────────── */}
      <div
        className="absolute left-1/2 z-20 pointer-events-none"
        style={{ top: -6 * scale, transform: 'translateX(-50%)' }}
      >
        <svg
          width={Math.round(26 * scale)}
          height={Math.round(26 * scale)}
          viewBox="0 0 26 26"
          overflow="visible"
        >
          {/* Shadow */}
          <polygon
            points="13,21 4,5 22,5"
            fill="rgba(0,0,0,0.5)"
            transform="translate(0,2)"
          />
          {/* Body */}
          <polygon
            points="13,21 4,5 22,5"
            fill="#1652F0"
            stroke="#060810"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Highlight sheen */}
          <polygon
            points="13,21 4,5 22,5"
            fill="none"
            stroke="rgba(100,160,255,0.4)"
            strokeWidth="0.75"
          />
          {/* Tip dot */}
          <circle cx="13" cy="21" r="2" fill="#1652F0" />
          <circle cx="13" cy="21" r="2" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
        </svg>
      </div>

      {/* ── Rotating wheel ────────────────────────────────────────────── */}
      <motion.div
        className="w-full h-full"
        style={{ rotate: rotation }}
      >
        <svg
          viewBox="0 0 300 300"
          width={size}
          height={size}
          style={{ display: 'block', overflow: 'visible' }}
        >
          <defs>
            {/* Hub background */}
            <radialGradient id="hub-bg" cx="50%" cy="35%" r="75%" gradientUnits="objectBoundingBox">
              <stop offset="0%"   stopColor="#1e2d6a" />
              <stop offset="100%" stopColor="#040610" />
            </radialGradient>

            {/* Center-to-edge glow overlay on entire wheel */}
            <radialGradient id="center-glow" cx="50%" cy="50%" r="50%" gradientUnits="objectBoundingBox">
              <stop offset="0%"   stopColor="rgba(22,82,240,0.09)" />
              <stop offset="55%"  stopColor="rgba(22,82,240,0.03)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </radialGradient>

            {/* Jackpot (250XP) segment special glow */}
            <radialGradient id="jackpot-glow" gradientUnits="userSpaceOnUse"
              cx="150" cy="150" r="140">
              <stop offset="0%"   stopColor="rgba(140,96,232,0.15)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </radialGradient>

            {/* Stripe pattern for dollar segments */}
            <pattern id="dollar-stripe" patternUnits="userSpaceOnUse" width="8" height="8"
              patternTransform="rotate(45 0 0)">
              <line x1="0" y1="0" x2="0" y2="8"
                stroke="rgba(255,255,255,0.018)" strokeWidth="3" />
            </pattern>

            {/* Hub glow filter */}
            <filter id="hub-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Rim outer glow filter */}
            <filter id="rim-glow-filter" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Text glow for XP labels */}
            <filter id="xp-text-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Hub logo clip */}
            <clipPath id="hub-logo-clip">
              <circle cx={CX} cy={CY} r={R_HUB - 5} />
            </clipPath>
          </defs>

          {/* ── Dark base circle ──────────────────────────────────────── */}
          <circle cx={CX} cy={CY} r={R_OUTER + 12} fill="#04060f" />

          {/* ── Segment fills ─────────────────────────────────────────── */}
          {SLOTS.map((slot, i) => {
            const isLanded   = landedSegmentIndex !== null && slot.segIdx === landedSegmentIndex
            const isJackpot  = slot.label === '250'

            return (
              <g key={i}>
                {/* Base fill */}
                <path
                  d={slicePath(i)}
                  fill={slot.bg}
                  stroke={isLanded ? (slot.isDollar ? '#3a2800' : '#2a4ab8') : slot.edge}
                  strokeWidth={isLanded ? 1 : 0.5}
                />

                {/* Dollar stripe overlay */}
                {slot.isDollar && (
                  <path d={slicePath(i)} fill="url(#dollar-stripe)" />
                )}

                {/* Jackpot purple glow overlay */}
                {isJackpot && (
                  <path d={slicePath(i)} fill="rgba(80,40,184,0.18)" />
                )}

                {/* Landing highlight */}
                {isLanded && (
                  <path d={slicePath(i)} fill={slot.isDollar ? 'rgba(255,180,0,0.06)' : 'rgba(22,82,240,0.12)'} />
                )}

                {/* Outer arc edge highlight (XP segments only) */}
                {slot.arcColor && (
                  <path
                    d={outerArcPath(i)}
                    fill="none"
                    stroke={isLanded ? '#60a5fa' : slot.arcColor}
                    strokeWidth={isLanded ? 2 : 1.2}
                    opacity={isLanded ? 0.8 : 0.4}
                  />
                )}
              </g>
            )
          })}

          {/* ── Centre glow overlay ───────────────────────────────────── */}
          <circle cx={CX} cy={CY} r={R_OUTER} fill="url(#center-glow)" />

          {/* ── Divider lines ─────────────────────────────────────────── */}
          {SLOTS.map((_, i) => {
            const edge = polar(R_OUTER, i * 36)
            return (
              <line key={i}
                x1={CX} y1={CY}
                x2={edge.x.toFixed(2)} y2={edge.y.toFixed(2)}
                stroke="#060810"
                strokeWidth="1.2"
              />
            )
          })}

          {/* ── Labels ────────────────────────────────────────────────── */}
          {SLOTS.map((slot, i) => {
            const isLanded  = landedSegmentIndex !== null && slot.segIdx === landedSegmentIndex
            const mid       = i * 36 + 18
            const tp        = polar(R_TEXT, mid)
            const isDollar  = slot.isDollar
            const isJackpot = slot.label === '250'
            const labelSize = isDollar ? (slot.label.length >= 3 ? 9 : 10.5)
              : slot.label.length >= 3 ? 11.5
              : 15

            return (
              <g key={i} transform={`rotate(${mid},${tp.x.toFixed(2)},${tp.y.toFixed(2)})`}>
                <text
                  x={tp.x}
                  y={isDollar ? tp.y + 1 : slot.unit ? tp.y - 5 : tp.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={labelSize}
                  fontWeight={isDollar ? '500' : '900'}
                  fill={isLanded ? '#ffffff' : isDollar ? slot.text : '#ffffff'}
                  fontFamily="Inter, system-ui, sans-serif"
                  opacity={isDollar ? 0.32 : isLanded ? 1 : 0.92}
                  letterSpacing={isJackpot ? '-0.03em' : '-0.01em'}
                  filter={!isDollar ? 'url(#xp-text-glow)' : undefined}
                >
                  {slot.label}
                </text>
                {slot.unit && (
                  <text
                    x={tp.x}
                    y={tp.y + 8}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={6.5}
                    fontWeight="800"
                    fill={isLanded ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.65)'}
                    fontFamily="Inter, system-ui, sans-serif"
                    opacity={1}
                    letterSpacing="0.08em"
                    filter="url(#xp-text-glow)"
                  >
                    {slot.unit}
                  </text>
                )}
                {/* Lock icon — visual-only segment indicator */}
                {isDollar && !isLanded && (
                  <g transform={`translate(${tp.x - 4}, ${tp.y + 4})`} opacity="0.25">
                    {/* lock body */}
                    <rect x="0.5" y="3.5" width="7" height="5" rx="1"
                      fill="rgba(255,255,255,0.5)" />
                    {/* lock shackle */}
                    <path d="M2 3.5 V2 a2 2 0 0 1 4 0 V3.5"
                      fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2"
                      strokeLinecap="round" />
                  </g>
                )}
              </g>
            )
          })}

          {/* ── Metallic rim (triple ring) ────────────────────────────── */}
          {/* Inner dark groove */}
          <circle cx={CX} cy={CY} r={R_OUTER + 0.5} fill="none" stroke="#04060f" strokeWidth="2.5" />
          {/* Main rim band */}
          <circle cx={CX} cy={CY} r={R_OUTER + 4}   fill="none" stroke="#0f1840" strokeWidth="7" />
          {/* Inner highlight */}
          <circle cx={CX} cy={CY} r={R_OUTER + 1.5} fill="none" stroke="rgba(60,90,200,0.30)" strokeWidth="1" />
          {/* Mid highlight */}
          <circle cx={CX} cy={CY} r={R_OUTER + 4.5} fill="none" stroke="rgba(80,110,220,0.18)" strokeWidth="0.75" />
          {/* Outer dark edge */}
          <circle cx={CX} cy={CY} r={R_OUTER + 8}   fill="none" stroke="#060810" strokeWidth="2" />
          {/* Outer glow ring */}
          <circle cx={CX} cy={CY} r={R_OUTER + 9}   fill="none"
            stroke="rgba(22,82,240,0.45)"
            strokeWidth="1"
            filter="url(#rim-glow-filter)"
          />

          {/* ── Hub assembly ──────────────────────────────────────────── */}
          {/* Shadow disc */}
          <circle cx={CX} cy={CY} r={R_HUB + 8} fill="#030508" />
          {/* Gradient fill */}
          <circle cx={CX} cy={CY} r={R_HUB + 4} fill="url(#hub-bg)" />
          {/* Outer blue ring */}
          <circle cx={CX} cy={CY} r={R_HUB + 4} fill="none" stroke="#1652F0" strokeWidth="1.5" />
          {/* Outer subtle highlight */}
          <circle cx={CX} cy={CY} r={R_HUB + 5} fill="none" stroke="rgba(100,150,255,0.18)" strokeWidth="0.75" />
          {/* Inner dark ring */}
          <circle cx={CX} cy={CY} r={R_HUB - 2} fill="#050710" />
          {/* Inner accent ring */}
          <circle cx={CX} cy={CY} r={R_HUB - 2} fill="none" stroke="rgba(22,82,240,0.55)" strokeWidth="0.75" />
          {/* PrediXI logo — centered in hub */}
          <image
            href="/brand/predixi-logo.png"
            x={CX - (R_HUB - 5)}
            y={CY - (R_HUB - 5)}
            width={(R_HUB - 5) * 2}
            height={(R_HUB - 5) * 2}
            preserveAspectRatio="xMidYMid meet"
            clipPath="url(#hub-logo-clip)"
            style={{ imageRendering: 'crisp-edges' } as React.CSSProperties}
            filter="url(#hub-glow)"
          />
        </svg>
      </motion.div>
    </div>
  )
}
