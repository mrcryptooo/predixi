import { ImageResponse } from 'next/og'

export const size        = { width: 192, height: 192 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width:           '100%',
          height:          '100%',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          background:      'linear-gradient(135deg, #0a0e24 0%, #07080F 100%)',
          borderRadius:    '28px',
          border:          '3px solid #1652F0',
          boxShadow:       '0 0 40px rgba(22,82,240,0.35)',
          position:        'relative',
        }}
      >
        {/* Glow ring */}
        <div
          style={{
            position:     'absolute',
            width:        '140px',
            height:       '140px',
            borderRadius: '50%',
            background:   'radial-gradient(circle, rgba(22,82,240,0.18) 0%, transparent 70%)',
          }}
        />
        {/* P·XI wordmark */}
        <div
          style={{
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            gap:            '0px',
          }}
        >
          <span
            style={{
              fontSize:    '80px',
              fontWeight:  '900',
              color:       '#ffffff',
              lineHeight:  '1',
              letterSpacing: '-4px',
              fontFamily:  'sans-serif',
            }}
          >
            P
          </span>
          <span
            style={{
              fontSize:    '28px',
              fontWeight:  '700',
              color:       '#1652F0',
              lineHeight:  '1',
              letterSpacing: '4px',
              fontFamily:  'monospace',
            }}
          >
            XI
          </span>
        </div>
      </div>
    ),
    { ...size },
  )
}
