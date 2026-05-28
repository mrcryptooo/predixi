/**
 * Base App readiness config — placeholders only.
 *
 * No secrets. No real registration tokens.
 * This config is the single source of truth for app identity metadata
 * used across metadata tags, future manifest generation, and Base App
 * registration when that step is reached.
 */

export const BASE_APP_CONFIG = {
  /** App display name — shown in Base App store / wallet UI */
  appName: 'PrediXI',

  /** Short tagline */
  description: 'Web3 Football Prediction Platform — Built for Base App.',

  /** Absolute path to the primary app icon (192×192 recommended) */
  iconPath: '/brand/predixi-logo.png',

  /** Primary App Store category for Base App discovery */
  primaryCategory: 'gaming',

  /** Supported chains — Base mainnet only for now */
  supportedChains: ['base'] as const,

  /** Placeholder support URL — update before Base App submission */
  supportUrl: 'https://predixi.app/support',

  /** Placeholder privacy policy URL */
  privacyUrl: 'https://predixi.app/privacy',
} as const

export type BaseAppConfig = typeof BASE_APP_CONFIG
