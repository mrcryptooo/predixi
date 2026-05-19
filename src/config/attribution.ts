/**
 * Phase 3B — Base Builder Code Attribution
 *
 * Prepares ERC-8021 transaction attribution using the Base Builder Code.
 * NO transactions are sent in this phase. The helpers exported here are
 * intended for use at future transaction call sites (Phase 4+).
 *
 * Usage at a future sendTransaction / writeContract call site:
 *
 *   import { getBuilderDataSuffix } from '@/config/attribution'
 *   const dataSuffix = getBuilderDataSuffix()
 *   // pass dataSuffix to useWriteContract / sendTransaction if defined
 *
 * Reference: https://eips.ethereum.org/EIPS/eip-8021
 */

import { Attribution } from 'ox/erc8021'
import type { Hex } from 'viem'

// ─────────────────────────────────────────────────────────────────────────────
// Environment variable
// Set NEXT_PUBLIC_BASE_BUILDER_CODE in .env.local (local) and in Vercel
// project settings (production). Never hardcode the value here.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the raw Builder Code string from the environment, or undefined if
 * the variable is not set. Safe to call on server and client (NEXT_PUBLIC_*).
 */
export function getBuilderCode(): string | undefined {
  const code = process.env.NEXT_PUBLIC_BASE_BUILDER_CODE
  return code && code.trim().length > 0 ? code.trim() : undefined
}

/**
 * Returns the ERC-8021 data suffix hex string for the Builder Code, or
 * undefined if no Builder Code is configured.
 *
 * This suffix must be appended to transaction calldata at the call site —
 * it is NOT applied automatically. No transaction is sent by calling this.
 *
 * Schema 0 (canonical registry) is used: { codes: [builderCode] }
 */
export function getBuilderDataSuffix(): Hex | undefined {
  const code = getBuilderCode()
  if (!code) return undefined

  try {
    // Schema 0: canonical registry attribution
    return Attribution.toDataSuffix({ codes: [code] }) as Hex
  } catch {
    // Never throw — attribution failure must never block a transaction
    return undefined
  }
}
