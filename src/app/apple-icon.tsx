import { ImageResponse } from 'next/og'

export const size        = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
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
          borderRadius:    '40px',
          border:          '3px solid #1652F0',
          position:        'relative',
        }}
      >
        {/* Glow ring */}
        <div
          style={{
            position:     'absolute',
            width:        '130px',
            height:       '130px',
            borderRadius: '50%',
            background:   'radial-gradient(circle, rgba(22,82,240,0.18) 0%, transparent 70%)',
          }}
        />
        {/* P·XI wordmark */}
        <div
          style={{
            display:       'flex',
            flexDirection: 'column',
            alignItems:    'center',
          }}
        >
          <span
            style={{
              fontSize:    '74px',
              fontWeight:  '900',
              color:       '#ffffff',
              lineHeight:  '1',
              letterSpacing: '-3px',
              fontFamily:  'sans-serif',
            }}
          >
            P
          </span>
          <span
            style={{
              fontSize:    '26px',
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
