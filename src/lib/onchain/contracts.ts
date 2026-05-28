/**
 * PrediXI — Onchain Contract Definitions
 *
 * Phase 2 placeholder — no addresses, no real ABI deployment.
 * All constants and types defined here will be populated in Phase 3.
 *
 * ── Developer notes ──────────────────────────────────────────────────────────
 *
 *   NEVER store private keys or mnemonic phrases here.
 *   NEVER hardcode mainnet contract addresses — always read from env vars.
 *   NEVER call write functions from server-side API routes (no wallet there).
 *
 *   Contract write calls must originate from the client (browser wallet) via
 *   wagmi's writeContract, after the user explicitly confirms the transaction.
 *
 *   Read calls (getCommitmentTimestamp) may be made from either server or client
 *   using a public RPC endpoint — no wallet required.
 *
 * ── Environment variables (set at Phase 3 deploy time) ───────────────────────
 *
 *   NEXT_PUBLIC_PREDIXI_COMMITMENT_CONTRACT=0x...   (Base mainnet address)
 *   NEXT_PUBLIC_BASE_CHAIN_ID=8453                  (Base mainnet chain ID)
 *
 *   These are intentionally NOT set in .env.local yet.
 *   Reading them returns undefined until Phase 3 deploy.
 *
 * ── See also ─────────────────────────────────────────────────────────────────
 *
 *   docs/SMART_CONTRACT_ARCHITECTURE.md  — full architecture plan
 *   src/lib/onchain/client.ts            — function stubs that use these ABIs
 *   src/lib/onchain/commitment.ts        — commitment hash generation
 */

// ─────────────────────────────────────────────────────────────────────────────
// Environment — read at runtime, never at build time
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the commitment contract address from the environment, or null if not
 * yet configured. Callers must handle null as "contract not yet deployed".
 */
export function getCommitmentContractAddress(): `0x${string}` | null {
  const addr = process.env.NEXT_PUBLIC_PREDIXI_COMMITMENT_CONTRACT
  if (!addr || addr === '0x0000000000000000000000000000000000000000') return null
  return addr as `0x${string}`
}

/**
 * Returns the target chain ID from the environment, defaulting to Base mainnet.
 * Override with NEXT_PUBLIC_BASE_CHAIN_ID=84532 to target Base Sepolia testnet.
 */
export function getTargetChainId(): number {
  const id = process.env.NEXT_PUBLIC_BASE_CHAIN_ID
  return id ? parseInt(id, 10) : 8453 // 8453 = Base mainnet
}

// ─────────────────────────────────────────────────────────────────────────────
// Contract names
// ─────────────────────────────────────────────────────────────────────────────

/** Canonical names for PrediXI contracts — used for logging and UI labels. */
export const CONTRACT_NAMES = {
  /** Main commitment registry — the only contract planned for Phase 3. */
  COMMITMENT_REGISTRY: 'PredixiCommitmentRegistry',
} as const

export type ContractName = typeof CONTRACT_NAMES[keyof typeof CONTRACT_NAMES]

// ─────────────────────────────────────────────────────────────────────────────
// ABI — PredixiCommitmentRegistry
// ─────────────────────────────────────────────────────────────────────────────
//
// Matches contracts/src/PredixiCommitmentRegistry.sol exactly.
// Type-safe for wagmi v2 / viem. No address set until Phase 3 deploy.
//
// At Phase 3:
//   1. Deploy contracts/src/PredixiCommitmentRegistry.sol to Base Sepolia.
//   2. Verify the deployed bytecode matches this ABI.
//   3. Set NEXT_PUBLIC_PREDIXI_COMMITMENT_CONTRACT to the deployed address.
//   4. Set NEXT_PUBLIC_BASE_CHAIN_ID=84532 (Sepolia) or 8453 (mainnet).

export const COMMITMENT_REGISTRY_ABI = [
  // ── Events ────────────────────────────────────────────────────────────────
  {
    type:      'event',
    name:      'CommitmentSubmitted',
    anonymous: false,
    inputs: [
      { name: 'user',           type: 'address', indexed: true  },
      { name: 'commitmentHash', type: 'bytes32', indexed: true  },
      { name: 'context',        type: 'string',  indexed: false },
      { name: 'timestamp',      type: 'uint256', indexed: false },
    ],
  },

  // ── Write functions ────────────────────────────────────────────────────────
  {
    type:            'function',
    name:            'submitCommitment',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'commitmentHash', type: 'bytes32' },
      { name: 'context',        type: 'string'  },
    ],
    outputs: [],
  },

  // ── Read functions ─────────────────────────────────────────────────────────
  {
    type:            'function',
    name:            'getCommitmentTimestamp',
    stateMutability: 'view',
    inputs:  [{ name: 'commitmentHash', type: 'bytes32' }],
    outputs: [{ name: '',               type: 'uint256' }],
  },
  {
    type:            'function',
    name:            'getCommitmentRecord',
    stateMutability: 'view',
    inputs:  [{ name: 'commitmentHash', type: 'bytes32' }],
    outputs: [
      { name: 'submitter',  type: 'address' },
      { name: 'timestamp',  type: 'uint256' },
    ],
  },
  {
    type:            'function',
    name:            'isSubmitted',
    stateMutability: 'view',
    inputs:  [{ name: 'commitmentHash', type: 'bytes32' }],
    outputs: [{ name: '',               type: 'bool'    }],
  },

  // ── Custom errors ──────────────────────────────────────────────────────────
  {
    type:   'error',
    name:   'AlreadySubmitted',
    inputs: [{ name: 'commitmentHash', type: 'bytes32' }],
  },
  {
    type:   'error',
    name:   'ZeroHashNotAllowed',
    inputs: [],
  },
] as const

// ─────────────────────────────────────────────────────────────────────────────
// Type helpers
// ─────────────────────────────────────────────────────────────────────────────

/** A bytes32 commitment hash as a 0x-prefixed hex string (66 chars). */
export type CommitmentHashHex = `0x${string}`

/**
 * Convert a hex commitment_hash string from the DB to a bytes32-compatible
 * value suitable for viem / wagmi contract calls.
 *
 * viem's writeContract accepts `0x${string}` for bytes32 parameters.
 * The keccak256 output from commitment.ts is already in this format.
 *
 * @example
 *   toBytes32(entryMeta.commitmentHash!)
 *   // → "0xabc123...def456" (already correct for viem)
 */
export function toBytes32(hash: string): CommitmentHashHex {
  if (!hash.startsWith('0x')) {
    throw new Error(`[contracts] Expected 0x-prefixed hash, got: ${hash.slice(0, 10)}…`)
  }
  if (hash.length !== 66) {
    throw new Error(`[contracts] Expected 32-byte hash (66 chars), got length ${hash.length}`)
  }
  return hash as CommitmentHashHex
}

// ─────────────────────────────────────────────────────────────────────────────
// Explorer links
// ─────────────────────────────────────────────────────────────────────────────

/** Returns a BaseScan URL for the given transaction hash. */
export function getExplorerUrl(txHash: string): string {
  return getTargetChainId() === 84532
    ? `https://sepolia.basescan.org/tx/${txHash}`
    : `https://basescan.org/tx/${txHash}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Future contract registry (Phase 4+)
// ─────────────────────────────────────────────────────────────────────────────
//
// Additional contracts that may be introduced in later phases.
// Listed here for planning purposes — no ABIs defined yet.
//
//   PrediXIXPToken       — optional ERC-20 or ERC-1155 XP token (Phase 4+)
//   PrediXILeaderboard   — optional on-chain leaderboard snapshot (Phase 5+)
//   PrediXIAchievements  — optional ERC-1155 badge/achievement NFTs (Phase 5+)
//
// None of these contracts exist. They are named here only to reserve the
// variable names and ensure they are considered during Phase 3 architecture review.
