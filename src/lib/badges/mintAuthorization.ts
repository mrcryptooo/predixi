/**
 * EIP-712 mint authorization signer for PrediXIBadges.
 *
 * SERVER-ONLY — never import from client components.
 *
 * Signs the MintBadge(address wallet, uint256 tokenId, bytes32 nonce) struct
 * using BADGE_SIGNER_KEY so the user can call mintBadge() on the contract.
 *
 * EIP-712 domain (must match contracts/src/PrediXIBadges.sol exactly):
 *   name:              "PrediXIBadges"
 *   version:           "1"
 *   chainId:           8453
 *   verifyingContract: NEXT_PUBLIC_PREDIXI_BADGE_CONTRACT
 *
 * Type hash (must match MINT_BADGE_TYPEHASH in the contract):
 *   MintBadge(address wallet,uint256 tokenId,bytes32 nonce)
 *
 * NEVER log or expose BADGE_SIGNER_KEY.
 */

import { privateKeyToAccount } from 'viem/accounts'
import { randomBytes }         from 'crypto'

// ─────────────────────────────────────────────────────────────────────────────
// Known contract signer address
//
// Used to detect misconfiguration (wrong private key in BADGE_SIGNER_KEY).
// If BADGE_SIGNER_KEY is rotated, update BADGE_SIGNER_ADDRESS in env to match
// the new on-chain signer set via PrediXIBadges.setSigner().
// ─────────────────────────────────────────────────────────────────────────────

const EXPECTED_SIGNER_ADDRESS =
  (process.env.BADGE_SIGNER_ADDRESS ?? '0x1afB9439693797FA7D5798B4706be7a27a5FD282').toLowerCase()

// ─────────────────────────────────────────────────────────────────────────────
// EIP-712 types (immutable — must match the deployed contract)
// ─────────────────────────────────────────────────────────────────────────────

const MINT_BADGE_TYPES = {
  MintBadge: [
    { name: 'wallet',  type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'nonce',   type: 'bytes32' },
  ],
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Nonce generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a cryptographically random bytes32 nonce (0x-prefixed, 66 chars).
 * Each call returns a fresh value — never reuse or predict.
 */
export function generateMintNonce(): `0x${string}` {
  return `0x${randomBytes(32).toString('hex')}` as `0x${string}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Return type
// ─────────────────────────────────────────────────────────────────────────────

export type MintAuthorizationResult = {
  /** 65-byte ECDSA signature over the EIP-712 MintBadge digest. */
  signature:     `0x${string}`
  /** The bytes32 nonce that was signed (mirrors what was passed in). */
  nonce:         `0x${string}`
  /** Ethereum address derived from BADGE_SIGNER_KEY — for audit logging only. */
  signerAddress: `0x${string}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Signer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Signs a MintBadge EIP-712 struct authorising `walletAddress` to mint
 * `tokenId` with the given `nonce` on the PrediXIBadges contract.
 *
 * @throws if BADGE_SIGNER_KEY or NEXT_PUBLIC_PREDIXI_BADGE_CONTRACT is unset.
 * @throws if the derived signer address does not match EXPECTED_SIGNER_ADDRESS
 *         (catches key-rotation misconfigurations before any sig is issued).
 */
export async function signMintAuthorization(
  walletAddress: `0x${string}`,
  tokenId:       number,
  nonce:         `0x${string}`,
): Promise<MintAuthorizationResult> {
  // ── Env guards ──────────────────────────────────────────────────────────────
  const rawKey = process.env.BADGE_SIGNER_KEY
  if (!rawKey) throw new Error('BADGE_SIGNER_KEY is not set')

  const contractAddress = process.env.NEXT_PUBLIC_PREDIXI_BADGE_CONTRACT
  if (!contractAddress) throw new Error('NEXT_PUBLIC_PREDIXI_BADGE_CONTRACT is not set')

  // ── Load signer account (never logs the key) ────────────────────────────────
  const signerKey = (rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`) as `0x${string}`
  const account   = privateKeyToAccount(signerKey)

  // ── Signer address sanity check ─────────────────────────────────────────────
  // Catches "wrong key in env" before issuing any signature.
  if (account.address.toLowerCase() !== EXPECTED_SIGNER_ADDRESS) {
    throw new Error(
      `BADGE_SIGNER_KEY mismatch: derived ${account.address} ` +
      `but expected ${EXPECTED_SIGNER_ADDRESS}. ` +
      'Update BADGE_SIGNER_ADDRESS if the contract signer was rotated via setSigner().'
    )
  }

  // ── Build EIP-712 domain ─────────────────────────────────────────────────────
  const domain = {
    name:              'PrediXIBadges',
    version:           '1',
    chainId:           8453,
    verifyingContract: contractAddress as `0x${string}`,
  } as const

  // ── Sign ─────────────────────────────────────────────────────────────────────
  const signature = await account.signTypedData({
    domain,
    types:       MINT_BADGE_TYPES,
    primaryType: 'MintBadge',
    message: {
      wallet:  walletAddress,
      tokenId: BigInt(tokenId),
      nonce,
    },
  })

  return { signature, nonce, signerAddress: account.address }
}
