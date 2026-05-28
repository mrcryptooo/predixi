import { ImageResponse } from 'next/og'

export const size        = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt         = 'PrediXI — Web3 Football Prediction Platform'

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width:      '100%',
          height:     '100%',
          display:    'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0e24 0%, #07080F 60%, #0a0e24 100%)',
          position:   'relative',
          overflow:   'hidden',
        }}
      >
        {/* Background glow blobs */}
        <div
          style={{
            position:     'absolute',
            top:          '-80px',
            right:        '-80px',
            width:        '420px',
            height:       '420px',
            borderRadius: '50%',
            background:   'radial-gradient(circle, rgba(22,82,240,0.20) 0%, transparent 70%)',
          }}
        />
        <div
          style={{
            position:     'absolute',
            bottom:       '-80px',
            left:         '-80px',
            width:        '360px',
            height:       '360px',
            borderRadius: '50%',
            background:   'radial-gradient(circle, rgba(22,82,240,0.12) 0%, transparent 70%)',
          }}
        />

        {/* Top line accent */}
        <div
          style={{
            position:   'absolute',
            top:        0,
            left:       '10%',
            right:      '10%',
            height:     '2px',
            background: 'linear-gradient(90deg, transparent, #1652F0, transparent)',
          }}
        />

        {/* Card container */}
        <div
          style={{
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            gap:            '24px',
            padding:        '60px 80px',
            borderRadius:   '24px',
            border:         '1px solid rgba(22,82,240,0.25)',
            background:     'rgba(255,255,255,0.03)',
          }}
        >
          {/* Logo row */}
          <div
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          '20px',
            }}
          >
            {/* Icon badge */}
            <div
              style={{
                width:           '80px',
                height:          '80px',
                borderRadius:    '20px',
                background:      'linear-gradient(135deg, #1652F0 0%, #0a2c9e 100%)',
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                boxShadow:       '0 0 32px rgba(22,82,240,0.45)',
                flexShrink:      0,
              }}
            >
              <span
                style={{
                  fontSize:    '36px',
                  fontWeight:  '900',
                  color:       '#ffffff',
                  fontFamily:  'sans-serif',
                  lineHeight:  '1',
                }}
              >
                ⚽
              </span>
            </div>

            {/* Wordmark */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span
                style={{
                  fontSize:    '72px',
                  fontWeight:  '900',
                  color:       '#ffffff',
                  lineHeight:  '1',
                  letterSpacing: '-2px',
                  fontFamily:  'sans-serif',
                }}
              >
                PrediXI
              </span>
              <span
                style={{
                  fontSize:    '18px',
                  fontWeight:  '600',
                  color:       '#1652F0',
                  letterSpacing: '4px',
                  fontFamily:  'monospace',
                  textTransform: 'uppercase',
                }}
              >
                Built for Base App
              </span>
            </div>
          </div>

          {/* Tagline */}
          <span
            style={{
              fontSize:    '32px',
              fontWeight:  '600',
              color:       'rgba(255,255,255,0.70)',
              textAlign:   'center',
              lineHeight:  '1.3',
              fontFamily:  'sans-serif',
              maxWidth:    '700px',
            }}
          >
            Predict. Earn. Compete On-Chain.
          </span>

          {/* Feature pills */}
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
            {['⚡ XP Rewards', '🏆 Live Leaderboard', '🔒 Wallet Signatures', '⚽ World Cup 2026'].map(
              (label) => (
                <div
                  key={label}
                  style={{
                    padding:      '8px 20px',
                    borderRadius: '99px',
                    background:   'rgba(22,82,240,0.15)',
                    border:       '1px solid rgba(22,82,240,0.30)',
                    fontSize:     '16px',
                    color:        'rgba(255,255,255,0.70)',
                    fontFamily:   'sans-serif',
                    fontWeight:   '600',
                  }}
                >
                  {label}
                </div>
              ),
            )}
          </div>
        </div>

        {/* Bottom URL */}
        <div
          style={{
            position:   'absolute',
            bottom:     '28px',
            fontSize:   '16px',
            color:      'rgba(255,255,255,0.20)',
            fontFamily: 'monospace',
            letterSpacing: '2px',
          }}
        >
          predixi-base.vercel.app
        </div>
      </div>
    ),
    { ...size },
  )
}
