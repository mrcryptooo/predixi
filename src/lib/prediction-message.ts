/**
 * Canonical prediction message builder — Phase 4D
 *
 * This module is the single source of truth for the message that wallets sign
 * when submitting a prediction.  Both the frontend (before signing) and the
 * backend (before verifying) import this function so the format can never
 * diverge between the two sides.
 *
 * The format is plain UTF-8 text (EIP-191 personal_sign compatible).
 * Each field occupies one line for easy human readability in wallet UIs.
 *
 * IMPORTANT — changing this format is a breaking change.
 * Any change invalidates all previously signed messages.
 */

/** H | D | A — the three possible prediction outcomes stored in the DB */
export type SignableOutcome = 'H' | 'D' | 'A'

export interface PredictionMessageParams {
  /** Ethereum wallet address — will be normalised to lowercase */
  walletAddress: string
  /** Match identifier, e.g. "pl-001" */
  matchId: string
  /** DB outcome code */
  outcome: SignableOutcome
  /** ISO 8601 timestamp of when the prediction was submitted */
  signedAt: string
}

/**
 * Returns the canonical message string that the wallet signs.
 *
 * Example output:
 *   PrediXI Prediction
 *   Action: Submit prediction
 *   Wallet: 0x1234...abcd
 *   Match ID: pl-001
 *   Outcome: H
 *   Timestamp: 2026-05-12T09:20:32.696Z
 */
export function buildPredictionMessage(params: PredictionMessageParams): string {
  return [
    'PrediXI Prediction',
    'Action: Submit prediction',
    `Wallet: ${params.walletAddress.toLowerCase()}`,
    `Match ID: ${params.matchId}`,
    `Outcome: ${params.outcome}`,
    `Timestamp: ${params.signedAt}`,
  ].join('\n')
}

/**
 * Maximum age of a signed message before the backend rejects it.
 * Prevents replay attacks where a captured valid signature is re-submitted.
 * 10 minutes is generous enough for slow signers / slow connections.
 */
export const SIGNATURE_MAX_AGE_MS = 10 * 60 * 1000 // 10 minutes
