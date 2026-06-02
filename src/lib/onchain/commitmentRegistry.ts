/**
 * PredixiCommitmentRegistry — client-side config and input guards.
 *
 * This file is the single source of truth for the deployed contract address,
 * chain ID, ABI, and input validation helpers used by useAnchorOnBase.
 *
 * NEVER import this in server-side API routes that sign transactions —
 * contract writes must originate from the browser wallet only.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Re-export ABI — canonical definition lives in contracts.ts
// ─────────────────────────────────────────────────────────────────────────────

export { COMMITMENT_REGISTRY_ABI } from './contracts'

// ─────────────────────────────────────────────────────────────────────────────
// Runtime constants — inlined by Next.js at build time (NEXT_PUBLIC_ prefix)
// ─────────────────────────────────────────────────────────────────────────────

/** Deployed PredixiCommitmentRegistry address on Base Mainnet, or null if not yet set. */
export const PREDIXI_COMMITMENT_CONTRACT: `0x${string}` | null =
  (process.env.NEXT_PUBLIC_PREDIXI_COMMITMENT_CONTRACT ?? null) as `0x${string}` | null

/** Target chain ID. Always 8453 (Base Mainnet) in production. */
export const PREDIXI_BASE_CHAIN_ID: number = process.env.NEXT_PUBLIC_BASE_CHAIN_ID
  ? parseInt(process.env.NEXT_PUBLIC_BASE_CHAIN_ID, 10)
  : 8453

// ─────────────────────────────────────────────────────────────────────────────
// Config validation
// ─────────────────────────────────────────────────────────────────────────────

type ConfigCheck = { ok: true } | { ok: false; error: string }

/**
 * Validates that the contract config is ready for writes.
 * Call this before constructing a writeContract call.
 */
export function validateCommitmentConfig(): ConfigCheck {
  if (!PREDIXI_COMMITMENT_CONTRACT) {
    return { ok: false, error: 'NEXT_PUBLIC_PREDIXI_COMMITMENT_CONTRACT is not set' }
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(PREDIXI_COMMITMENT_CONTRACT)) {
    return { ok: false, error: 'NEXT_PUBLIC_PREDIXI_COMMITMENT_CONTRACT is not a valid EVM address' }
  }
  if (PREDIXI_BASE_CHAIN_ID !== 8453) {
    return {
      ok: false,
      error: `Expected Base Mainnet (8453), NEXT_PUBLIC_BASE_CHAIN_ID is ${PREDIXI_BASE_CHAIN_ID}`,
    }
  }
  return { ok: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hash validation
// ─────────────────────────────────────────────────────────────────────────────

/** Returns true if the value is a valid bytes32: 0x-prefixed + exactly 64 hex chars. */
export function isBytes32Hash(hash: string): hash is `0x${string}` {
  return /^0x[0-9a-fA-F]{64}$/.test(hash)
}

// ─────────────────────────────────────────────────────────────────────────────
// Context helpers
// ─────────────────────────────────────────────────────────────────────────────

const CONTEXT_MAX_LENGTH = 128

/**
 * Trims, strips ASCII control characters, and caps the context string at 128
 * chars — safe to pass as the `context` argument to submitCommitment.
 */
export function normalizeCommitmentContext(ctx: string): string {
  return ctx
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, '') // eslint-disable-line no-control-regex
    .slice(0, CONTEXT_MAX_LENGTH)
}

/** Canonical commitment types that map to on-chain event context labels. */
export type CommitmentType = 'match-prediction' | 'daily-xi' | 'wc-prediction'

/**
 * Builds a canonical context string for submitCommitment's `context` argument.
 *
 * Format: `predixi:<type>:<id>`
 * Examples:
 *   buildCommitmentContext('match-prediction', predictionId)
 *   buildCommitmentContext('daily-xi', '2026-06-02')
 *   buildCommitmentContext('wc-prediction', 'champion')
 */
export function buildCommitmentContext(type: CommitmentType, id: string): string {
  return normalizeCommitmentContext(`predixi:${type}:${id}`)
}
