"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { MatchOutcome, PredictionRecord } from "@/types";
import { submitPredictionToApi } from "@/lib/api/predictions";

// ─────────────────────────────────────────────────────────────────────────────
// State shape
// ─────────────────────────────────────────────────────────────────────────────

/** On-chain TX proof produced by submitting to Base before Supabase sync */
export interface TxProof {
  /** Confirmed Base transaction hash from submitCommitment() */
  txHash: string
  /** crypto.randomUUID() generated client-side before the TX */
  clientNonce: string
  /** ISO timestamp generated client-side before the TX */
  clientTimestamp: string
}

interface PredictionState {
  /** Map of matchId → PredictionRecord for every prediction placed this session */
  predictions: Record<string, PredictionRecord>;

  /**
   * Last non-fatal API error from a persist attempt.
   * null = no error / cleared. Never blocks the UI — local state is always
   * updated optimistically regardless of API outcome.
   */
  persistError: string | null;

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * Place or update a prediction for a match (local state only).
   * Duplicate guard: same matchId + same outcome → no-op.
   * Change of mind: same matchId + different outcome → update.
   */
  setPrediction: (matchId: string, outcome: MatchOutcome) => void;

  /** Remove a single prediction (undo). */
  clearPrediction: (matchId: string) => void;

  /** Wipe all predictions (e.g. on sign-out). */
  clearAll: () => void;

  /** Clear the last persist error. */
  clearPersistError: () => void;

  /**
   * Set a persist error directly (used by the modal when signing is rejected
   * before persistPrediction is even called).
   */
  setPersistError: (error: string) => void;

  /**
   * Persist a prediction to Supabase via /api/predictions.
   * Requires a confirmed Base txHash — the API verifies the on-chain event.
   * Non-blocking — local state is updated by setPrediction before calling this.
   * If the API fails, persistError is set but the UI is never crashed.
   *
   * @param matchId        The match being predicted
   * @param outcome        The chosen outcome
   * @param walletAddress  The connected wallet address (0x...)
   * @param txProof        On-chain TX proof (txHash + clientNonce + clientTimestamp)
   */
  persistPrediction: (
    matchId: string,
    outcome: MatchOutcome,
    walletAddress: string,
    txProof: TxProof,
  ) => Promise<boolean>;

  // ── Selectors (plain functions on state) ───────────────────────────────────

  /** Return the prediction for a given match, or undefined. */
  getPrediction: (matchId: string) => PredictionRecord | undefined;

  /** Whether the user has already predicted for this match. */
  hasPredicted: (matchId: string) => boolean;

  /** Total number of predictions placed this session. */
  totalCount: () => number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const usePredictionStore = create<PredictionState>()(
  persist(
    (set, get) => ({
      predictions: {},
      persistError: null,

      // ── Actions ─────────────────────────────────────────────────────────────

      setPrediction: (matchId, outcome) => {
        const existing = get().predictions[matchId];
        if (existing && existing.outcome === outcome) return;
        set((state) => ({
          predictions: {
            ...state.predictions,
            [matchId]: {
              matchId,
              outcome,
              placedAt: new Date().toISOString(),
            },
          },
        }));
      },

      clearPrediction: (matchId) => {
        set((state) => {
          const next = { ...state.predictions };
          delete next[matchId];
          return { predictions: next };
        });
      },

      clearAll: () => set({ predictions: {}, persistError: null }),

      clearPersistError: () => set({ persistError: null }),

      setPersistError: (error) => set({ persistError: error }),

      persistPrediction: async (matchId, outcome, walletAddress, txProof) => {
        set({ persistError: null });

        const result = await submitPredictionToApi({
          walletAddress,
          matchId,
          outcome,
          txHash:          txProof.txHash,
          clientNonce:     txProof.clientNonce,
          clientTimestamp: txProof.clientTimestamp,
        });

        if (!result.success) {
          set({ persistError: result.error });
        }

        return result.success;
      },

      // ── Selectors ───────────────────────────────────────────────────────────

      getPrediction: (matchId) => get().predictions[matchId],
      hasPredicted: (matchId) => matchId in get().predictions,
      totalCount: () => Object.keys(get().predictions).length,
    }),
    {
      name: "predixi-predictions",
      storage: createJSONStorage(() => localStorage),
      // Only persist local prediction records — not transient API state
      partialize: (state) => ({ predictions: state.predictions }),
    }
  )
);
