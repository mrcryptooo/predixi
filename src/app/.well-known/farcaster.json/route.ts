/**
 * GET /.well-known/farcaster.json
 *
 * Serves the Farcaster / Base Mini App domain manifest.
 * Required for:
 *   - Base App Mini App discovery and verification
 *   - Farcaster frame client domain association
 *
 * Account Association:
 *   Set these three env vars in Vercel after generating them via
 *   Warpcast developer tools (warpcast.com/~/developers/mini-apps):
 *
 *     FARCASTER_HEADER      → accountAssociation.header
 *     FARCASTER_PAYLOAD     → accountAssociation.payload
 *     FARCASTER_SIGNATURE   → accountAssociation.signature
 *
 *   Until these are set, the manifest is served without a valid
 *   Account Association — the app will load but domain verification
 *   will not pass. Set the env vars, then redeploy.
 */

import { NextResponse } from 'next/server'

const APP_URL = 'https://predixi-base.vercel.app'

export async function GET() {
  const header    = process.env.FARCASTER_HEADER    ?? ''
  const payload   = process.env.FARCASTER_PAYLOAD   ?? ''
  const signature = process.env.FARCASTER_SIGNATURE ?? ''

  const hasAssociation = header && payload && signature

  return NextResponse.json(
    {
      ...(hasAssociation
        ? {
            accountAssociation: { header, payload, signature },
          }
        : {}),

      frame: {
        version:               'next',
        name:                  'PrediXI',
        iconUrl:               `${APP_URL}/icon.png`,
        homeUrl:               APP_URL,
        imageUrl:              `${APP_URL}/opengraph-image`,
        buttonTitle:           'Play PrediXI',
        splashImageUrl:        `${APP_URL}/splash`,
        splashBackgroundColor: '#07080F',
      },
    },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control':               'public, max-age=3600',
      },
    },
  )
}
