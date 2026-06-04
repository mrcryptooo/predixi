/**
 * PrediXIBadges — client-side contract config, ABI, and input guards.
 *
 * Single source of truth for the deployed contract address, chain ID, ABI,
 * and validation helpers used by useMintBadge.
 *
 * NEVER import this in server-side API routes that sign transactions —
 * contract writes must originate from the browser wallet only.
 *
 * Contract: 0x87231AA7FAeB23B3E674E905d7af4B1c91E10B2d (Base Mainnet)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Runtime constants — inlined by Next.js at build time (NEXT_PUBLIC_ prefix)
// ─────────────────────────────────────────────────────────────────────────────

/** Deployed PrediXIBadges address on Base Mainnet, or null if not yet set. */
export const PREDIXI_BADGE_CONTRACT: `0x${string}` | null =
  (process.env.NEXT_PUBLIC_PREDIXI_BADGE_CONTRACT ?? null) as `0x${string}` | null

/** Target chain ID. Always 8453 (Base Mainnet) in production. */
export const PREDIXI_BASE_CHAIN_ID: number = process.env.NEXT_PUBLIC_BASE_CHAIN_ID
  ? parseInt(process.env.NEXT_PUBLIC_BASE_CHAIN_ID, 10)
  : 8453

// ─────────────────────────────────────────────────────────────────────────────
// ABI — PrediXIBadges
//
// Matches contracts/src/PrediXIBadges.sol exactly.
// Type-safe for wagmi v2 / viem.
// ─────────────────────────────────────────────────────────────────────────────

export const PREDIXI_BADGES_ABI = [
  // ── Write functions ────────────────────────────────────────────────────────
  {
    type:            'function',
    name:            'mintBadge',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenId',   type: 'uint256' },
      { name: 'nonce',     type: 'bytes32' },
      { name: 'signature', type: 'bytes'   },   // bytes calldata in Solidity → bytes in ABI
    ],
    outputs: [],
  },

  // ── Read functions ─────────────────────────────────────────────────────────
  {
    type:            'function',
    name:            'balanceOf',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'id',      type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type:            'function',
    name:            'uri',
    stateMutability: 'view',
    inputs:  [{ name: 'id', type: 'uint256' }],
    outputs: [{ name: '', type: 'string'  }],
  },
  {
    type:            'function',
    name:            'signer',
    stateMutability: 'view',
    inputs:  [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type:            'function',
    name:            'MIN_TOKEN_ID',
    stateMutability: 'view',
    inputs:  [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type:            'function',
    name:            'MAX_TOKEN_ID',
    stateMutability: 'view',
    inputs:  [],
    outputs: [{ name: '', type: 'uint256' }],
  },

  // ── Events ─────────────────────────────────────────────────────────────────
  {
    type:      'event',
    name:      'BadgeMinted',
    anonymous: false,
    inputs: [
      { name: 'wallet',  type: 'address', indexed: true  },
      { name: 'tokenId', type: 'uint256', indexed: true  },
      { name: 'nonce',   type: 'bytes32', indexed: false },
    ],
  },

  // ── Custom errors — included so viem can decode revert reasons ─────────────
  {
    type:   'error',
    name:   'InvalidTokenId',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
  },
  {
    type:   'error',
    name:   'NonceAlreadyUsed',
    inputs: [{ name: 'nonce', type: 'bytes32' }],
  },
  {
    type:   'error',
    name:   'AlreadyMinted',
    inputs: [
      { name: 'wallet',  type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
  },
  {
    type:   'error',
    name:   'InvalidSignature',
    inputs: [],
  },
  {
    type:   'error',
    name:   'TransferNotAllowed',
    inputs: [],
  },
  {
    type:   'error',
    name:   'ZeroAddress',
    inputs: [],
  },
] as const

// ─────────────────────────────────────────────────────────────────────────────
// Config validation
// ─────────────────────────────────────────────────────────────────────────────

type ConfigCheck = { ok: true } | { ok: false; error: string }

/**
 * Validates that the badge contract config is ready for writes.
 * Call this before constructing a writeContract call in useMintBadge.
 */
export function validateBadgeContractConfig(): ConfigCheck {
  if (!PREDIXI_BADGE_CONTRACT) {
    return { ok: false, error: 'NEXT_PUBLIC_PREDIXI_BADGE_CONTRACT is not set' }
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(PREDIXI_BADGE_CONTRACT)) {
    return { ok: false, error: 'NEXT_PUBLIC_PREDIXI_BADGE_CONTRACT is not a valid EVM address' }
  }
  if (PREDIXI_BASE_CHAIN_ID !== 8453) {
    return {
      ok:    false,
      error: `Expected Base Mainnet (8453), NEXT_PUBLIC_BASE_CHAIN_ID is ${PREDIXI_BASE_CHAIN_ID}`,
    }
  }
  return { ok: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Input validation helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns true if the value is a valid bytes32 nonce: 0x-prefixed + 64 hex chars. */
export function isBytes32Nonce(value: string): value is `0x${string}` {
  return /^0x[0-9a-fA-F]{64}$/.test(value)
}

/** Returns true if the value is a valid tx hash: 0x-prefixed + 64 hex chars. */
export function isTxHash(value: string): value is `0x${string}` {
  return /^0x[0-9a-fA-F]{64}$/.test(value)
}

// ─────────────────────────────────────────────────────────────────────────────
// Explorer link
// ─────────────────────────────────────────────────────────────────────────────

/** Returns a BaseScan URL for a badge mint transaction. */
export function getBadgeTxUrl(txHash: string): string {
  return `https://basescan.org/tx/${txHash}`
}
