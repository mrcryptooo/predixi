"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { MatchOutcome, PredictionRecord } from "@/types";
import { submitPredictionToApi } from "@/lib/api/predictions";

// ─────────────────────────────────────────────────────────────────────────────
// State shape
// ─────────────────────────────────────────────────────────────────────────────

/** Signed proof params produced by the wallet before Supabase sync — Phase 4D */
export interface SignedProof {
  /** The canonical message that was signed (buildPredictionMessage output) */
  message: string
  /** EIP-191 hex signature returned by the wallet */
  signature: string
  /** ISO timestamp embedded in the message */
  signedAt: string
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
   * Non-blocking — local state is updated by setPrediction before calling this.
   * If the API fails, persistError is set but the UI is never crashed.
   *
   * Phase 4D: requires a signed proof.  The modal signs the message with the
   * connected wallet before calling this — signing rejection is handled there.
   *
   * @param matchId        The match being predicted
   * @param outcome        The chosen outcome
   * @param walletAddress  The connected wallet address (0x...)
   * @param signed         Wallet signature proof (message + signature + signedAt)
   */
  persistPrediction: (
    matchId: string,
    outcome: MatchOutcome,
    walletAddress: string,
    signed: SignedProof,
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

      persistPrediction: async (matchId, outcome, walletAddress, signed) => {
        set({ persistError: null });

        const result = await submitPredictionToApi({
          walletAddress,
          matchId,
          outcome,
          message:   signed.message,
          signature: signed.signature,
          signedAt:  signed.signedAt,
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
