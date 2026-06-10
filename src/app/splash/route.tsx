/**
 * GET /splash
 *
 * Generates the 200×200 splash image required by the Farcaster / Base Mini App
 * frame manifest (splashImageUrl). Shown while the app is loading inside the
 * Base App / Warpcast frame shell.
 *
 * Spec: 200×200 PNG, max 1 MB, publicly cacheable.
 */

import { ImageResponse } from 'next/og'

export const runtime     = 'edge'
export const contentType = 'image/png'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width:           '200px',
          height:          '200px',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          background:      '#07080F',
          position:        'relative',
          overflow:        'hidden',
        }}
      >
        {/* Outer glow ring */}
        <div
          style={{
            position:     'absolute',
            width:        '180px',
            height:       '180px',
            borderRadius: '50%',
            background:   'radial-gradient(circle, rgba(22,82,240,0.22) 0%, transparent 68%)',
          }}
        />

        {/* Blue accent ring */}
        <div
          style={{
            position:     'absolute',
            width:        '150px',
            height:       '150px',
            borderRadius: '50%',
            border:       '1.5px solid rgba(22,82,240,0.35)',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
          }}
        />

        {/* Wordmark stack */}
        <div
          style={{
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            '0px',
            position:       'relative',
          }}
        >
          <span
            style={{
              fontSize:      '68px',
              fontWeight:    '900',
              color:         '#ffffff',
              lineHeight:    '1',
              letterSpacing: '-3px',
              fontFamily:    'sans-serif',
            }}
          >
            P
          </span>
          <span
            style={{
              fontSize:      '22px',
              fontWeight:    '700',
              color:         '#1652F0',
              lineHeight:    '1',
              letterSpacing: '5px',
              fontFamily:    'monospace',
              marginLeft:    '5px',
            }}
          >
            XI
          </span>
        </div>
      </div>
    ),
    {
      width:  200,
      height: 200,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'Content-Type':  'image/png',
      },
    },
  )
}
