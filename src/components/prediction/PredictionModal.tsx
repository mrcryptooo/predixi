"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, CheckCircle2, Clock, MapPin, Zap, CloudOff, Share2, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePredictionStore } from "@/store/usePredictionStore";
import { useAccount, usePublicClient } from "wagmi";
import { base } from "wagmi/chains";
import { OutcomeButton } from "./OutcomeButton";
import { PointsPreview } from "./PointsPreview";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { leagueMap } from "@/data/leagues";
import { useSubmitToBase } from "@/hooks/useSubmitToBase";
import { createPredictionCommitment } from "@/lib/onchain/commitment";
import { buildCommitmentContext } from "@/lib/onchain/commitmentRegistry";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { sharePrediction, isShareSupported } from "@/lib/base-app-actions";
import type { Match, MatchOutcome } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatKickoff(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false,
  });
}

/** Convert app outcome to the DB code used in the signed message */
function toDbOutcome(outcome: MatchOutcome): "H" | "D" | "A" {
  return outcome === "home" ? "H" : outcome === "draw" ? "D" : "A";
}

const outcomeLabels: Record<MatchOutcome, string> = {
  home: "Home Win",
  draw: "Draw",
  away: "Away Win",
};

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface PredictionModalProps {
  match: Match;
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────────────────────────────────────

export function PredictionModal({ match, onClose }: PredictionModalProps) {
  const {
    getPrediction,
    setPrediction,
    hasPredicted,
    persistPrediction,
    setPersistError,
    clearPersistError,
    persistError,
  } = usePredictionStore();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: base.id });
  const { submitAsync, reset: resetTx } = useSubmitToBase();

  const existingPick  = getPrediction(match.id)?.outcome ?? null;
  const alreadyLocked = hasPredicted(match.id);

  const [selected,   setSelected]  = useState<MatchOutcome | null>(existingPick);
  const [confirmed,  setConfirmed] = useState<boolean>(alreadyLocked);
  const [shaking,    setShaking]   = useState<boolean>(false);
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');

  // TX flow step for UI labels
  type TxStep = 'idle' | 'awaiting_wallet' | 'tx_pending' | 'saving';
  const [txStep, setTxStep] = useState<TxStep>('idle');

  // Lock body scroll while modal is open — prevents background scroll in Base App webview
  useBodyScrollLock(true);

  const league = leagueMap[match.leagueId];

  // ── Keyboard: Escape to close ──────────────────────────────────────────────
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const isSubmitting = txStep !== 'idle';

  // ── Confirm prediction ─────────────────────────────────────────────────────
  async function handleConfirm() {
    if (!selected) {
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      return;
    }

    if (isLocked) {
      setPersistError("Predictions are locked after kickoff.");
      return;
    }

    if (isSubmitting) return; // guard double-submit

    clearPersistError();

    // No wallet: save locally and lock immediately — no TX needed.
    if (!isConnected || !address) {
      setPrediction(match.id, selected);
      setConfirmed(true);
      return;
    }

    // Wallet connected: compute hash → submit TX → verify receipt → save to API.
    const clientNonce     = crypto.randomUUID();
    const clientTimestamp = new Date().toISOString();
    const { commitmentHash } = createPredictionCommitment({
      walletAddress:   address,
      matchId:         match.id,
      outcome:         toDbOutcome(selected),
      clientTimestamp,
      clientNonce,
    });
    const context = buildCommitmentContext('match-prediction', match.id);

    resetTx();
    setTxStep('awaiting_wallet');

    try {
      const txHash = await submitAsync({ commitmentHash, context });
      setTxStep('tx_pending');

      // Wait for on-chain confirmation before sending to API
      await publicClient!.waitForTransactionReceipt({ hash: txHash });

      setTxStep('saving');
      const ok = await persistPrediction(match.id, selected, address, {
        txHash,
        clientNonce,
        clientTimestamp,
      });

      if (ok) {
        setPrediction(match.id, selected);
        setConfirmed(true);
      }
      // If !ok, persistError set inside persistPrediction — user can retry.
    } catch (rawErr) {
      const errMsg = rawErr instanceof Error ? rawErr.message : String(rawErr);
      const isRejection = /rejected|denied|cancelled|canceled|user rejected/i.test(errMsg);
      setPersistError(
        isRejection
          ? "Transaction declined — tap Confirm to try again."
          : "Transaction failed — tap Confirm to try again."
      );
    } finally {
      setTxStep('idle');
    }
  }

  // ── Outcome selection (blocked if already confirmed) ──────────────────────
  function handleSelect(outcome: MatchOutcome) {
    if (confirmed) return;
    setSelected(outcome);
  }

  const isFinished      = match.status === "finished";
  const isLive          = match.status === "live";
  const isPastKickoff   = Date.now() >= new Date(match.kickoff).getTime();
  // isLocked: mirrors backend rule — predictions closed once kickoff is reached
  const isLocked        = isFinished || isLive || isPastKickoff;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        aria-modal="true"
        role="dialog"
      >
        <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" />

        {/* Sheet / Modal panel */}
        <motion.div
          key="panel"
          className={cn(
            "relative z-10 w-full sm:max-w-lg bg-surface border border-border",
            "rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden",
            "max-h-[92dvh] overflow-y-auto overscroll-contain"
          )}
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          transition={{ type: "spring", stiffness: 280, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Live stripe */}
          {match.status === "live" && (
            <div className="h-0.5 w-full gradient-brand" />
          )}

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="flex items-start justify-between p-5 pb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {league && (
                  <span className="text-xs font-mono text-text-muted">
                    {league.logo} {league.shortName}
                  </span>
                )}
                {match.status === "live" && (
                  <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-danger">
                    <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
                    LIVE
                  </span>
                )}
              </div>
              {/* Team logos + names row */}
              <div className="flex items-center gap-2">
                <TeamLogo src={match.homeTeam.crest} name={match.homeTeam.shortName} size="md" />
                <div className="flex-1 min-w-0 text-center">
                  <p className="text-[11px] font-black text-text-primary leading-tight">
                    {match.homeTeam.shortName}
                    <span className="text-text-muted font-normal mx-1.5">vs</span>
                    {match.awayTeam.shortName}
                  </p>
                  <p className="text-[10px] text-text-muted font-mono mt-0.5 truncate">
                    {match.homeTeam.name} · {match.awayTeam.name}
                  </p>
                </div>
                <TeamLogo src={match.awayTeam.crest} name={match.awayTeam.shortName} size="md" />
              </div>
            </div>

            {/* Hit area is 44×44px (iOS minimum) — visual size stays compact */}
            <button
              type="button"
              onClick={onClose}
              className="flex-shrink-0 -m-1 p-1 ml-2 rounded-xl text-text-muted hover:text-text-primary transition-colors"
              aria-label="Close modal"
            >
              <span className="flex w-8 h-8 rounded-xl bg-elevated border border-border items-center justify-center hover:border-primary/30 transition-colors">
                <X size={14} />
              </span>
            </button>
          </div>

          {/* ── Match meta ──────────────────────────────────────────────── */}
          <div className="px-5 pb-4 flex flex-wrap gap-3 text-[11px] text-text-muted font-mono">
            {match.status === "live" || match.status === "finished" ? (
              <span className="flex items-center gap-1 text-text-primary font-black text-base font-mono">
                {match.homeScore} – {match.awayScore}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Clock size={11} />
                {formatKickoff(match.kickoff)}
              </span>
            )}
            <span className="flex items-center gap-1 truncate">
              <MapPin size={11} />
              {match.venue.split(",")[0]}
            </span>
          </div>

          {/* ── Divider ─────────────────────────────────────────────────── */}
          <div className="mx-5 border-t border-border" />

          {/* ── Success / locked state ──────────────────────────────────── */}
          {confirmed && selected ? (
            <div className="p-5 space-y-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                className="flex flex-col items-center gap-3 py-4"
              >
                <div className="w-14 h-14 rounded-full bg-success/15 border border-success/30 flex items-center justify-center">
                  <CheckCircle2 size={28} className="text-success" />
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-text-primary">Prediction Locked</p>
                  <p className="text-sm text-text-muted mt-1">
                    You picked{" "}
                    <span className="font-semibold text-primary">
                      {selected === "home"
                        ? match.homeTeam.shortName
                        : selected === "away"
                        ? match.awayTeam.shortName
                        : "Draw"}
                    </span>{" "}
                    ({outcomeLabels[selected]})
                  </p>
                </div>
              </motion.div>

              <PointsPreview
                status={match.status}
                leagueId={match.leagueId}
                locked
              />

              {/* TX / save status notice */}
              {txStep === 'awaiting_wallet' ? (
                <div className="flex items-start gap-2.5 rounded-xl bg-primary/8 border border-primary/20 px-4 py-3">
                  <Zap size={13} className="text-primary mt-0.5 flex-shrink-0 animate-pulse" />
                  <p className="text-[11px] text-text-secondary font-mono leading-relaxed">
                    Confirm the transaction in your wallet…
                  </p>
                </div>
              ) : txStep === 'tx_pending' ? (
                <div className="flex items-start gap-2.5 rounded-xl bg-primary/8 border border-primary/20 px-4 py-3">
                  <Zap size={13} className="text-primary mt-0.5 flex-shrink-0 animate-pulse" />
                  <p className="text-[11px] text-text-secondary font-mono leading-relaxed">
                    Sending to Base… (~5s)
                  </p>
                </div>
              ) : txStep === 'saving' ? (
                <div className="flex items-start gap-2.5 rounded-xl bg-primary/8 border border-primary/20 px-4 py-3">
                  <Zap size={13} className="text-primary mt-0.5 flex-shrink-0 animate-pulse" />
                  <p className="text-[11px] text-text-secondary font-mono leading-relaxed">
                    Saving to your PrediXI profile…
                  </p>
                </div>
              ) : persistError ? (
                <div className="flex items-start gap-2.5 rounded-xl bg-warning/8 border border-warning/20 px-4 py-3">
                  <CloudOff size={13} className="text-warning mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-text-secondary font-mono leading-relaxed">
                    {persistError}
                  </p>
                </div>
              ) : isConnected ? (
                <div className="flex items-start gap-2.5 rounded-xl bg-primary/8 border border-primary/20 px-4 py-3">
                  <Zap size={13} className="text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-text-secondary font-mono leading-relaxed">
                    Prediction recorded on Base and saved to your profile.
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 rounded-xl bg-primary/8 border border-primary/20 px-4 py-3">
                  <Zap size={13} className="text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-text-secondary font-mono leading-relaxed">
                    Saved locally. Connect your wallet to sync to your profile.
                  </p>
                </div>
              )}

              {/* Share prediction */}
              <button
                type="button"
                onClick={async () => {
                  if (!selected) return;
                  const result = await sharePrediction({
                    homeTeam:    match.homeTeam.shortName,
                    awayTeam:    match.awayTeam.shortName,
                    pick:        outcomeLabels[selected],
                    leagueName:  league?.shortName,
                  });
                  if (result === 'copied') {
                    setShareState('copied');
                    setTimeout(() => setShareState('idle'), 2000);
                  }
                }}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border text-xs font-semibold transition-all duration-150",
                  shareState === 'copied'
                    ? "bg-success/10 border-success/30 text-success"
                    : "bg-white/[0.04] border-white/[0.08] text-text-muted hover:text-text-secondary hover:border-primary/25"
                )}
              >
                {shareState === 'copied'
                  ? <><Check size={12} />Link copied</>
                  : isShareSupported()
                    ? <><Share2 size={12} />Share prediction</>
                    : <><Copy  size={12} />Copy link</>
                }
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-2xl bg-elevated border border-border text-sm font-semibold text-text-secondary hover:text-text-primary hover:border-primary/30 transition-colors"
              >
                Close
              </button>
            </div>

          ) : (
            /* ── Prediction flow ──────────────────────────────────────── */
            <div className="p-5 space-y-4">

              {/* Locked notice — finished, live, or past kickoff */}
              {isLocked && (
                <div className="flex items-center gap-2 rounded-xl bg-elevated border border-border px-4 py-3">
                  <Lock size={13} className="text-text-muted flex-shrink-0" />
                  <p className="text-xs text-text-muted font-mono">
                    {isFinished
                      ? "This match has finished. Predictions are closed."
                      : isLive
                      ? "This match is live. Predictions are locked."
                      : "Kickoff has passed. Predictions are locked."}
                  </p>
                </div>
              )}

              {/* TX hint / retry error — wallet connected */}
              {!isLocked && isConnected && (
                persistError ? (
                  <p className="text-[10px] text-warning/80 font-mono text-center">
                    {persistError}
                  </p>
                ) : (
                  <p className="text-[10px] text-primary/70 font-mono text-center">
                    Submitting sends a transaction to Base.
                  </p>
                )
              )}

              {/* Local-only hint when no wallet */}
              {!isLocked && !isConnected && (
                <p className="text-[10px] text-text-muted font-mono text-center">
                  Connect your wallet to save predictions to your profile.
                </p>
              )}

              {/* Outcome buttons */}
              <motion.div
                animate={shaking ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
                transition={{ duration: 0.45 }}
                className="flex gap-2"
              >
                {(["home", "draw", "away"] as MatchOutcome[]).map((outcome) => (
                  <OutcomeButton
                    key={outcome}
                    outcome={outcome}
                    teamLabel={
                      outcome === "home" ? match.homeTeam.shortName :
                      outcome === "away" ? match.awayTeam.shortName :
                      undefined
                    }
                    communityPct={
                      outcome === "home" ? (match.community?.home ?? null) :
                      outcome === "away" ? (match.community?.away ?? null) :
                      (match.community?.draw ?? null)
                    }
                    selected={selected === outcome}
                    disabled={isLocked}
                    onClick={() => handleSelect(outcome)}
                  />
                ))}
              </motion.div>

              {/* Points preview — only when open */}
              {!isLocked && (
                <PointsPreview status={match.status} leagueId={match.leagueId} />
              )}

              {/* Confirm / action button */}
              {!isLocked ? (
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isSubmitting}
                  className={cn(
                    "w-full py-3.5 rounded-2xl text-sm font-bold transition-all duration-150",
                    isSubmitting
                      ? "bg-primary/20 border border-primary/30 text-primary/50 cursor-wait"
                      : selected
                        ? "gradient-brand text-white shadow-lg hover:opacity-90"
                        : "bg-elevated border border-border text-text-muted cursor-default"
                  )}
                >
                  {isSubmitting
                    ? txStep === 'awaiting_wallet' ? "Confirm in wallet…"
                    : txStep === 'tx_pending'      ? "Sending to Base…"
                    : "Saving…"
                    : selected
                      ? `Confirm — ${selected === "home" ? match.homeTeam.shortName : selected === "away" ? match.awayTeam.shortName : "Draw"}`
                      : "Select an outcome above"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3 rounded-2xl bg-elevated border border-border text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
