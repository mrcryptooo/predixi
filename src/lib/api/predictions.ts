/**
 * Client-safe API helpers for prediction persistence.
 *
 * These functions call /api/predictions (a server-side route) via fetch.
 * They never touch Supabase directly and never access the service role key.
 *
 * All functions handle errors gracefully — they never throw and always
 * return a typed result so callers can decide how to surface failures.
 *
 * Phase 4D: submitPredictionToApi now requires a wallet signature and the
 * signed message.  The backend will reject requests without a valid signature.
 */

import type { MatchOutcome } from '@/types'
import type { DbOutcome } from '@/lib/supabase/types'

// ─────────────────────────────────────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────────────────────────────────────

export type ApiPrediction = {
  id: string
  matchId: string
  outcome: DbOutcome
  placedAt: string
  pointsAwarded: number | null
  isCorrect: boolean | null
}

export type ApiProfile = {
  id: string
  walletAddress: string
  xp: number
  rank: string
  streak: number
  totalPredictions: number
  correctPredictions: number
}

export type SubmitPredictionResult =
  | { success: true;  prediction: ApiPrediction; profile: ApiProfile }
  | { success: false; error: string }

export type GetPredictionsResult =
  | { success: true;  predictions: ApiPrediction[] }
  | { success: false; error: string; predictions: ApiPrediction[] }

// ─────────────────────────────────────────────────────────────────────────────
// Outcome conversion (app → DB)
// ─────────────────────────────────────────────────────────────────────────────

function toDbOutcome(outcome: MatchOutcome): DbOutcome {
  return outcome === 'home' ? 'H' : outcome === 'draw' ? 'D' : 'A'
}

// ─────────────────────────────────────────────────────────────────────────────
// submitPredictionToApi — Phase 4D: requires message + signature
// ─────────────────────────────────────────────────────────────────────────────

export async function submitPredictionToApi(params: {
  walletAddress: string
  matchId: string
  outcome: MatchOutcome
  /** The canonical message that was signed by the wallet */
  message: string
  /** EIP-191 signature hex string returned by the wallet */
  signature: string
  /** ISO timestamp embedded in the message — sent separately so the backend
   *  can verify it without re-parsing the message text */
  signedAt: string
  pointsAwarded?: number
}): Promise<SubmitPredictionResult> {
  try {
    const res = await fetch('/api/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress:    params.walletAddress,
        matchId:          params.matchId,
        predictedOutcome: toDbOutcome(params.outcome),
        message:          params.message,
        signature:        params.signature,
        signedAt:         params.signedAt,
        pointsAwarded:    params.pointsAwarded ?? 10,
      }),
    })

    const data = await res.json()

    if (!res.ok || !data.success) {
      return { success: false, error: data.error ?? 'Server error' }
    }

    return { success: true, prediction: data.prediction, profile: data.profile }
  } catch {
    // Network error — prediction is already saved locally, this is non-fatal
    return { success: false, error: 'Network error — prediction saved locally only' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getPredictionsForWallet
// ─────────────────────────────────────────────────────────────────────────────

export async function getPredictionsForWallet(
  walletAddress: string,
): Promise<GetPredictionsResult> {
  try {
    const res = await fetch(
      `/api/predictions?walletAddress=${encodeURIComponent(walletAddress)}`,
    )
    const data = await res.json()

    if (!res.ok || !data.success) {
      return { success: false, error: data.error ?? 'Server error', predictions: [] }
    }

    return { success: true, predictions: data.predictions ?? [] }
  } catch {
    return { success: false, error: 'Network error', predictions: [] }
  }
}
