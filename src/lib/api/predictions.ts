/**
 * Client-safe API helpers for prediction persistence.
 *
 * These functions call /api/predictions (a server-side route) via fetch.
 * They never touch Supabase directly and never access the service role key.
 *
 * Transaction-first: submitPredictionToApi requires a confirmed Base txHash.
 * The backend verifies the on-chain CommitmentSubmitted event before saving.
 */

import type { MatchOutcome } from '@/types'
import type { DbOutcome } from '@/lib/supabase/types'

// ─────────────────────────────────────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────────────────────────────────────

export type ApiPrediction = {
  id:               string
  matchId:          string
  outcome:          DbOutcome
  placedAt:         string
  pointsAwarded:    number | null
  isCorrect:        boolean | null
  commitmentHash:   string | null
  submittedOnchain: boolean
  txHash:           string | null
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
  | { success: false; error: string; locked?: boolean; kickoffTime?: string }

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
// submitPredictionToApi — transaction-first: requires confirmed Base txHash
// ─────────────────────────────────────────────────────────────────────────────

export async function submitPredictionToApi(params: {
  walletAddress:   string
  matchId:         string
  outcome:         MatchOutcome
  /** Confirmed Base transaction hash from submitCommitment() */
  txHash:          string
  /** crypto.randomUUID() generated client-side before the TX */
  clientNonce:     string
  /** ISO timestamp generated client-side before the TX */
  clientTimestamp: string
  pointsAwarded?:  number
}): Promise<SubmitPredictionResult> {
  try {
    const res = await fetch('/api/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress:    params.walletAddress,
        matchId:          params.matchId,
        predictedOutcome: toDbOutcome(params.outcome),
        txHash:           params.txHash,
        clientNonce:      params.clientNonce,
        clientTimestamp:  params.clientTimestamp,
        pointsAwarded:    params.pointsAwarded ?? 10,
      }),
    })

    const data = await res.json()

    if (!res.ok || !data.success) {
      return {
        success:     false,
        error:       data.error ?? 'Server error',
        locked:      data.locked === true,
        kickoffTime: typeof data.kickoffTime === 'string' ? data.kickoffTime : undefined,
      }
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
