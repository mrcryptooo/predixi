/**
 * GET /api/farcaster-manifest
 *
 * Serves the Farcaster / Base Mini App domain manifest.
 * Rewritten to /.well-known/farcaster.json via next.config.ts.
 *
 * Account Association:
 *   Generate at: warpcast.com/~/developers/mini-apps → Add Domain → predixi-base.vercel.app
 *   Then set these env vars in the Vercel dashboard and redeploy:
 *
 *     FARCASTER_HEADER      → accountAssociation.header
 *     FARCASTER_PAYLOAD     → accountAssociation.payload
 *     FARCASTER_SIGNATURE   → accountAssociation.signature
 */

import { NextResponse } from 'next/server'

const APP_URL = 'https://predixi-base.vercel.app'

export async function GET() {
  const header    = process.env.FARCASTER_HEADER    ?? ''
  const payload   = process.env.FARCASTER_PAYLOAD   ?? ''
  const signature = process.env.FARCASTER_SIGNATURE ?? ''

  const hasAssociation = !!(header && payload && signature)

  return NextResponse.json(
    {
      ...(hasAssociation
        ? { accountAssociation: { header, payload, signature } }
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
