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
 *   prediction   — match prediction (wallet + matchId + outcome + placedAt)
 *   daily-xi     — Daily XI pick (wallet + date + playerIds + projectedMaxXp)
 *   wc-prediction — World Cup pick (wallet + predictionKey + selectedValue + xpReward)
 *
 * ── Future phases ────────────────────────────────────────────────────────────
 *
 *   Phase 2: write commitmentHash to DB (after add-onchain-metadata.sql applied)
 *   Phase 3: call submitCommitmentToBase() from client.ts to anchor on-chain
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

/** Match prediction commitment */
export function createPredictionCommitment(input: {
  walletAddress: string
  matchId:       string
  outcome:       string
  placedAt:      string
}): CommitmentResult {
  const payload = {
    type:          'prediction',
    walletAddress: input.walletAddress.toLowerCase(),
    matchId:       input.matchId,
    outcome:       input.outcome,
    placedAt:      input.placedAt,
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
