import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             'PrediXI — Web3 Football Prediction Platform',
    short_name:       'PrediXI',
    description:      'Predict football match outcomes, earn XP, and compete on-chain. Built for Base App.',
    start_url:        '/',
    display:          'standalone',
    background_color: '#07080F',
    theme_color:      '#07080F',
    orientation:      'portrait',
    scope:            '/',
    lang:             'en',
    categories:       ['sports', 'games'],
    icons: [
      {
        src:     '/brand/predixi-logo.png',
        sizes:   '192x192',
        type:    'image/png',
        purpose: 'any',
      },
      {
        src:     '/brand/predixi-logo.png',
        sizes:   '192x192',
        type:    'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
