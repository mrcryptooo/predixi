'use client'

import { motion, type MotionValue } from 'framer-motion'

// ─── Geometry helpers ─────────────────────────────────────────────────────────

const CX = 150, CY = 150   // SVG viewport centre
const R_OUTER = 142         // rim of wheel
const R_TEXT  = 97          // label radial position
const R_HUB   = 26          // centre medallion radius

function polar(r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180)
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) }
}

function slicePath(i: number): string {
  const s = polar(R_OUTER, i * 36)
  const e = polar(R_OUTER, (i + 1) * 36)
  return `M ${CX} ${CY} L ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${R_OUTER} ${R_OUTER} 0 0 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)} Z`
}

// ─── Segment definitions ──────────────────────────────────────────────────────
//
// Visual slots 0-9 (clockwise from 12 o'clock).
// Dollar slots (1, 4, 7) are cosmetic — server never returns their segmentIndex.

const SLOTS = [
  // slot 0
  { label: '5',   unit: 'XP', bg: '#0d1535', border: '#1a2450', text: '#7090d0', segIdx: 0 },
  // slot 1
  { label: '$1',  unit: '',   bg: '#1c1305', border: '#3d2800', text: '#d97706', segIdx: 7 },
  // slot 2
  { label: '100', unit: 'XP', bg: '#0f1d55', border: '#1e3488', text: '#60a5fa', segIdx: 5 },
  // slot 3
  { label: '15',  unit: 'XP', bg: '#0e1b44', border: '#182d70', text: '#8aacff', segIdx: 2 },
  // slot 4
  { label: '$5',  unit: '',   bg: '#1c1305', border: '#3d2800', text: '#d97706', segIdx: 8 },
  // slot 5
  { label: '250', unit: 'XP', bg: '#280f5e', border: '#4a1eaa', text: '#c4b5fd', segIdx: 6 },
  // slot 6
  { label: '10',  unit: 'XP', bg: '#0d1535', border: '#1a2450', text: '#7090d0', segIdx: 1 },
  // slot 7
  { label: '$10', unit: '',   bg: '#1c1305', border: '#3d2800', text: '#d97706', segIdx: 9 },
  // slot 8
  { label: '50',  unit: 'XP', bg: '#0f1d55', border: '#1e3488', text: '#60a5fa', segIdx: 4 },
  // slot 9
  { label: '25',  unit: 'XP', bg: '#0e1b44', border: '#182d70', text: '#8aacff', segIdx: 3 },
] as const

// ─── Component ────────────────────────────────────────────────────────────────

interface SpinWheelProps {
  rotation:            MotionValue<number>
  /** Highlight a segment after landing. null = none. */
  landedSegmentIndex?: number | null
  size?:               number
}

export function SpinWheel({ rotation, landedSegmentIndex = null, size = 290 }: SpinWheelProps) {
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>

      {/* Outer glow ring */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          boxShadow: '0 0 40px rgba(22,82,240,0.30), 0 0 80px rgba(22,82,240,0.10), inset 0 0 20px rgba(22,82,240,0.05)',
        }}
      />

      {/* Pointer arrow — fixed, sits above rotating wheel */}
      <div className="absolute left-1/2 -translate-x-1/2 z-20" style={{ top: -4 }}>
        <svg width="22" height="22" viewBox="0 0 22 22">
          <polygon
            points="11,18 3,4 19,4"
            fill="#1652F0"
            stroke="#060810"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <polygon
            points="11,18 3,4 19,4"
            fill="none"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="0.75"
          />
        </svg>
      </div>

      {/* Rotating wheel */}
      <motion.div className="w-full h-full" style={{ rotate: rotation }}>
        <svg
          viewBox="0 0 300 300"
          width={size}
          height={size}
          style={{ display: 'block', overflow: 'visible' }}
        >
          {/* Segment slices */}
          {SLOTS.map((slot, i) => {
            const isLanded  = landedSegmentIndex !== null && slot.segIdx === landedSegmentIndex
            const isDollar  = slot.unit === ''
            const mid       = i * 36 + 18
            const tp        = polar(R_TEXT, mid)

            return (
              <g key={i}>
                <path
                  d={slicePath(i)}
                  fill={isLanded
                    ? (isDollar ? '#2a1c00' : '#1a2f80')
                    : slot.bg}
                  stroke={isLanded ? (isDollar ? '#f59e0b' : '#3b82f6') : slot.border}
                  strokeWidth={isLanded ? 1.5 : 0.75}
                />

                {/* Label group — rotated to align radially outward */}
                <g transform={`rotate(${mid}, ${tp.x.toFixed(2)}, ${tp.y.toFixed(2)})`}>
                  <text
                    x={tp.x}
                    y={isDollar ? tp.y + 1 : tp.y - 4}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={
                      slot.label === '$10' ? 9
                        : slot.label.length >= 3 ? 10
                        : 13
                    }
                    fontWeight="800"
                    fill={isLanded ? '#ffffff' : slot.text}
                    fontFamily="Inter, system-ui, sans-serif"
                    style={{ letterSpacing: '-0.02em' }}
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
                      fontWeight="700"
                      fill={isLanded ? 'rgba(255,255,255,0.65)' : slot.text}
                      fontFamily="Inter, system-ui, sans-serif"
                      style={{ letterSpacing: '0.06em' }}
                    >
                      {slot.unit}
                    </text>
                  )}
                </g>
              </g>
            )
          })}

          {/* Radial divider lines (drawn on top of slices) */}
          {SLOTS.map((_, i) => {
            const edge = polar(R_OUTER, i * 36)
            return (
              <line
                key={i}
                x1={CX} y1={CY}
                x2={edge.x.toFixed(2)} y2={edge.y.toFixed(2)}
                stroke="#060810"
                strokeWidth="1.5"
              />
            )
          })}

          {/* Outer rim circle */}
          <circle cx={CX} cy={CY} r={R_OUTER} fill="none" stroke="#1a2255" strokeWidth="1.5" />

          {/* Hub shadow */}
          <circle cx={CX} cy={CY} r={R_HUB + 6} fill="#060810" />

          {/* Hub ring */}
          <circle cx={CX} cy={CY} r={R_HUB}     fill="#090c1e" stroke="#1652F0" strokeWidth="1.5" />
          <circle cx={CX} cy={CY} r={R_HUB - 7} fill="#060810" stroke="rgba(22,82,240,0.35)" strokeWidth="1" />

          {/* PrediXI P */}
          <text
            x={CX} y={CY + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={12}
            fontWeight="900"
            fill="#1652F0"
            fontFamily="Inter, system-ui, sans-serif"
          >
            P
          </text>
        </svg>
      </motion.div>
    </div>
  )
}
