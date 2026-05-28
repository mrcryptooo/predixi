/**
 * Onchain Commitment Hashing — Phase 1 foundation
 *
 * Generates deterministic keccak256 commitment hashes for PrediXI user data.
 * Hashes are computed server-side and returned in API responses so clients
 * can reference them when submitting to Base in a future phase.
 *
 * ── Design ───────────────────────────────────────────────────────────────────
 *
 *   commitmentHash = keccak256(deterministicJSON(payload))
 *
 *   deterministicJSON sorts object keys so the same data always produces the
 *   same hash regardless of insertion order.
 *
 * ── Commitment types ─────────────────────────────────────────────────────────
 *
 *   prediction    — match prediction (wallet + matchId + outcome + placedAt + predictionId)
 *   daily-xi      — Daily XI pick (wallet + date + playerIds + projectedMaxXp)
 *   wc-prediction — World Cup pick (wallet + predictionKey + selectedValue + xpReward)
 *
 * ── Hash uniqueness model ─────────────────────────────────────────────────────
 *
 *   All types:     walletAddress is included → cross-user collisions are
 *                  cryptographically impossible.
 *
 *   prediction:    predictionId (Supabase UUID, stable per profile+match row)
 *                  is included since Phase 3 / Base Mainnet readiness.
 *                  This guarantees each hash is provably unique per DB row,
 *                  independent of timestamp precision or retry timing.
 *
 *   daily-xi:      walletAddress + entryDate uniquely identifies each entry
 *                  (enforced by UNIQUE constraint). No UUID needed.
 *
 *   wc-prediction: walletAddress + predictionKey uniquely identifies each entry
 *                  (enforced by UNIQUE constraint). No UUID needed.
 *
 * ── Future phases ────────────────────────────────────────────────────────────
 *
 *   Phase 2: write commitmentHash to DB (after add-onchain-metadata.sql applied)
 *   Phase 3: call submitCommitmentToBase() from client.ts to anchor on Base Mainnet
 */

import { keccak256, toBytes } from 'viem'

// ── Deterministic JSON serialisation ─────────────────────────────────────────
// Recursively sorts object keys so insertion order never affects the output.

function deterministicStringify(value: unknown): string {
  if (value === null || value === undefined) return JSON.stringify(value)
  if (Array.isArray(value)) {
    return '[' + value.map(deterministicStringify).join(',') + ']'
  }
  if (typeof value === 'object') {
    const obj  = value as Record<string, unknown>
    const keys = Object.keys(obj).sort()
    const parts = keys.map(k => JSON.stringify(k) + ':' + deterministicStringify(obj[k]))
    return '{' + parts.join(',') + '}'
  }
  return JSON.stringify(value)
}

// ── Core hash function ────────────────────────────────────────────────────────

export function hashCommitment(payload: Record<string, unknown>): string {
  const canonical = deterministicStringify(payload)
  return keccak256(toBytes(canonical))
}

// ── Commitment result type ────────────────────────────────────────────────────

export type CommitmentResult = {
  payload:         Record<string, unknown>
  commitmentHash:  string
}

// ── Per-type commitment builders ──────────────────────────────────────────────

/**
 * Match prediction commitment.
 *
 * @param input.predictionId  The Supabase-generated UUID for the predictions row.
 *                            Include this whenever the row ID is known (i.e. after
 *                            the DB upsert returns). Including the UUID guarantees
 *                            hash uniqueness per DB row, independently of the
 *                            millisecond timestamp.
 *
 *                            Backward compatibility: the field is optional.
 *                            Hashes generated without predictionId (e.g. legacy
 *                            rows created before Base Mainnet readiness) remain
 *                            valid and are stored in the DB as-is.
 */
export function createPredictionCommitment(input: {
  walletAddress: string
  matchId:       string
  outcome:       string
  placedAt:      string
  predictionId?: string   // Supabase UUID — include after DB upsert to guarantee uniqueness
}): CommitmentResult {
  const payload: Record<string, unknown> = {
    type:          'prediction',
    walletAddress: input.walletAddress.toLowerCase(),
    matchId:       input.matchId,
    outcome:       input.outcome,
    placedAt:      input.placedAt,
  }

  // Include the DB row UUID when provided.
  // This makes each hash provably unique per prediction row.
  // deterministicStringify sorts keys alphabetically, so 'predictionId'
  // always lands between 'placedAt' and 'type' in the canonical JSON.
  if (input.predictionId) {
    payload.predictionId = input.predictionId
  }

  return { payload, commitmentHash: hashCommitment(payload) }
}

/** Daily XI commitment — playerIds sorted for determinism */
export function createDailyXICommitment(input: {
  walletAddress:  string
  entryDate:      string
  playerIds:      string[]
  projectedMaxXp: number
}): CommitmentResult {
  const payload = {
    type:           'daily-xi',
    walletAddress:  input.walletAddress.toLowerCase(),
    entryDate:      input.entryDate,
    playerIds:      [...input.playerIds].sort(),
    projectedMaxXp: input.projectedMaxXp,
  }
  return { payload, commitmentHash: hashCommitment(payload) }
}

/** World Cup prediction commitment */
export function createWCCommitment(input: {
  walletAddress:  string
  predictionKey:  string
  selectedValue:  string[]
  xpReward:       number
}): CommitmentResult {
  const payload = {
    type:          'wc-prediction',
    walletAddress: input.walletAddress.toLowerCase(),
    predictionKey: input.predictionKey,
    selectedValue: input.selectedValue,
    xpReward:      input.xpReward,
  }
  return { payload, commitmentHash: hashCommitment(payload) }
}
