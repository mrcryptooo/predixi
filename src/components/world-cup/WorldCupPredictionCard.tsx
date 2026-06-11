"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Zap, Clock, X, ChevronRight, Lock } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useAccount, usePublicClient } from "wagmi";
import { base } from "wagmi/chains";
import { cn } from "@/lib/utils";
import { useSubmitToBase } from "@/hooks/useSubmitToBase";
import { createWCCommitment } from "@/lib/onchain/commitment";
import { buildCommitmentContext } from "@/lib/onchain/commitmentRegistry";
import {
  saveWCPrediction,
  loadAllWCPredictions,
  fetchWCPredictions,
  saveWCPredictionRemote,
} from "@/lib/worldcup-predictions";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SelectionOption {
  label: string;
  flag?:  string;   // emoji flag (fallback)
  sub?:   string;   // group / team / position label
  src?:   string;   // direct image URL — flagcdn for nations, avatar for players
}

export interface SpecialPrediction {
  id:          string;
  icon:        string;
  title:       string;
  description: string;
  xpReward:    number;
  deadline:    string;
  difficulty:  "easy" | "medium" | "hard" | "legendary";
  maxSelect?:  number;
  pool:        SelectionOption[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Difficulty config
// ─────────────────────────────────────────────────────────────────────────────

const DIFF: Record<SpecialPrediction["difficulty"], { label: string; cls: string }> = {
  easy:      { label: "Easy",      cls: "text-success  border-success/30  bg-success/8"  },
  medium:    { label: "Medium",    cls: "text-warning  border-warning/30  bg-warning/8"  },
  hard:      { label: "Hard",      cls: "text-danger   border-danger/30   bg-danger/8"   },
  legendary: { label: "Legendary", cls: "text-purple   border-purple/30   bg-purple/8"   },
};

// ─────────────────────────────────────────────────────────────────────────────
// OptionAvatar — circular image for any option type
// Chain: src → flag emoji → neutral circle (never text initials)
// ─────────────────────────────────────────────────────────────────────────────

function OptionAvatar({
  opt, size = "md",
}: {
  opt: SelectionOption; size?: "sm" | "md" | "lg";
}) {
  const [err, setErr] = useState(false);
  const dim = size === "sm" ? "w-6 h-6" : size === "lg" ? "w-10 h-10" : "w-8 h-8";
  const fontSize = size === "sm" ? "text-sm" : size === "lg" ? "text-xl" : "text-base";

  return (
    <div className={cn(
      dim,
      "rounded-full overflow-hidden flex-shrink-0",
      "border border-white/[0.12] bg-[#0a1428]",
      "flex items-center justify-center",
    )}>
      {opt.src && !err ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={opt.src}
          alt={opt.label}
          className="w-full h-full object-contain p-[8%]"
          onError={() => setErr(true)}
        />
      ) : opt.flag ? (
        <span className={cn(fontSize, "leading-none")} style={{ lineHeight: 1 }}>
          {opt.flag}
        </span>
      ) : (
        // Neutral placeholder — football icon, never initials
        <div className="w-full h-full bg-gradient-to-br from-primary/15 to-[#060a1e] flex items-center justify-center">
          <svg width="55%" height="55%" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5"/>
            <polygon points="12,5 14.5,9 18.5,9 15.8,12.5 17,16.5 12,14 7,16.5 8.2,12.5 5.5,9 9.5,9"
              fill="rgba(255,255,255,0.1)" />
          </svg>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Option button inside the modal
// ─────────────────────────────────────────────────────────────────────────────

function OptionBtn({
  opt, picked, onToggle,
}: {
  opt: SelectionOption; picked: boolean; onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl border text-left transition-all duration-120",
        picked
          ? "bg-primary/20 border-primary/50 shadow-[0_0_10px_rgba(22,82,240,0.3)]"
          : "bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.06] hover:border-white/[0.14]",
      )}
    >
      {/* Circular visual */}
      <OptionAvatar opt={opt} size="md" />

      {/* Label + sub */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-xs font-semibold truncate leading-tight",
          picked ? "text-white" : "text-white/75",
        )}>
          {opt.label}
        </p>
        {opt.sub && (
          <p className="text-[9px] font-mono text-white/30 leading-none mt-0.5 truncate">{opt.sub}</p>
        )}
      </div>

      {/* Check indicator */}
      {picked && (
        <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
          <Check size={9} className="text-white" />
        </div>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Saved picks inline display (used in full card body)
// ─────────────────────────────────────────────────────────────────────────────

function SavedDisplay({ pool, saved }: { pool: SelectionOption[]; saved: string[] }) {
  const picks = pool.filter(o => saved.includes(o.label));
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Check size={10} className="text-success flex-shrink-0" />
      {picks.map(o => (
        <div key={o.label} className="flex items-center gap-1.5">
          <OptionAvatar opt={o} size="sm" />
          <span className="text-[10px] font-bold text-success/85">{o.label}</span>
        </div>
      ))}
      <span className="text-[9px] font-mono text-white/25">· Scored after tournament</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  prediction: SpecialPrediction;
  delay?:     number;
  compact?:   boolean;
}

// Derive a short category string from prediction id — used as predictionType in DB
function derivePredictionType(id: string): string {
  if (id.startsWith("wc-group-")) return "group";
  const tournamentIds = new Set([
    "wc-champion", "wc-finalist", "wc-golden-boot", "wc-golden-glove", "wc-dark-horse",
  ]);
  if (tournamentIds.has(id)) return "tournament";
  return "fun";
}

export function WorldCupPredictionCard({ prediction, delay = 0, compact = false }: Props) {
  const { address, isConnected } = useAccount();
  const publicClient             = usePublicClient({ chainId: base.id });
  const { submitAsync }          = useSubmitToBase();

  const [isOpen,   setIsOpen]   = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [saved,    setSaved]    = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const maxSelect = prediction.maxSelect ?? 1;

  // Step 1 — load localStorage immediately (synchronous-ish)
  useEffect(() => {
    const prev = loadAllWCPredictions()[prediction.id];
    if (prev) { setSaved(prev.selection); setSelected(prev.selection); }
    setHydrated(true);
  }, [prediction.id]);

  // Step 2 — if wallet connected, hydrate from API and merge (API wins)
  useEffect(() => {
    if (!isConnected || !address) return;
    fetchWCPredictions(address).then(remoteStore => {
      const remote = remoteStore[prediction.id];
      if (!remote) return;
      // Write remote data back into localStorage as source-of-truth
      saveWCPrediction({ predictionId: prediction.id, selection: remote.selection, savedAt: remote.savedAt });
      setSaved(remote.selection);
      setSelected(remote.selection);
    }).catch(() => {/* silent */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address, prediction.id]);

  const hasSaved   = hydrated && saved.length > 0;
  const diff       = DIFF[prediction.difficulty];
  const canConfirm = selected.length > 0 && selected.length <= maxSelect;

  const toggleSelect = (label: string) => {
    setSelected(prev => {
      if (prev.includes(label)) return prev.filter(l => l !== label);
      if (maxSelect === 1) return [label];
      if (prev.length >= maxSelect) return [...prev.slice(1), label];
      return [...prev, label];
    });
  };

  const handleConfirm = () => {
    if (!canConfirm) return;
    // 1. Save to localStorage immediately — always the source of truth
    saveWCPrediction({ predictionId: prediction.id, selection: selected, savedAt: new Date().toISOString() });
    setSaved(selected);
    setIsOpen(false);
    // 2. If wallet connected, submit TX + persist to Supabase in background.
    //    Runs after modal closes — user sees their pick immediately.
    //    Silently ignored on failure; localStorage is always authoritative.
    if (isConnected && address) {
      const selectionSnapshot = [...selected];
      const predId            = prediction.id;
      const predXp            = prediction.xpReward;
      const predDeadline      = prediction.deadline ?? null;
      const predType          = derivePredictionType(prediction.id);
      ;(async () => {
        try {
          const { commitmentHash } = createWCCommitment({
            walletAddress: address,
            predictionKey: predId,
            selectedValue: selectionSnapshot,
            xpReward:      predXp,
          });
          const context = buildCommitmentContext('wc-prediction', predId);
          const txHash  = await submitAsync({ commitmentHash, context });
          await publicClient!.waitForTransactionReceipt({ hash: txHash });
          await saveWCPredictionRemote({
            walletAddress:  address,
            predictionKey:  predId,
            predictionType: predType,
            selectedValue:  selectionSnapshot,
            xpReward:       predXp,
            deadline:       predDeadline,
            txHash,
          });
        } catch {
          // Silent — localStorage pick is already saved and shown to the user
        }
      })();
    }
  };

  const handleOpenModal = () => {
    setSelected(saved.length > 0 ? [...saved] : []);
    setIsOpen(true);
  };

  // ── Compact layout (group winners grid) ──────────────────────────────────

  if (compact) {
    const savedOpts = prediction.pool.filter(o => saved.includes(o.label));
    return (
      <>
        <motion.button
          type="button"
          onClick={handleOpenModal}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: "easeOut", delay }}
          className={cn(
            "w-full text-left rounded-xl border p-3 space-y-2 transition-all duration-150",
            hasSaved
              ? "bg-primary/10 border-primary/35 shadow-[0_0_14px_rgba(22,82,240,0.15)]"
              : "bg-white/[0.03] border-white/[0.07] hover:border-primary/25 hover:bg-primary/[0.04]",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-black text-primary/70 uppercase tracking-wider font-mono">
              {prediction.title}
            </p>
            {hasSaved
              ? <Check size={10} className="text-success flex-shrink-0" />
              : <ChevronRight size={10} className="text-white/25 flex-shrink-0" />}
          </div>

          {/* Saved pick OR team list */}
          {hasSaved ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              {savedOpts.map(o => (
                <div key={o.label} className="flex items-center gap-1.5">
                  <OptionAvatar opt={o} size="sm" />
                  <span className="text-[10px] font-semibold text-white/80">{o.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-x-1.5 gap-y-0.5">
              {prediction.pool.map(t => (
                <span key={t.label} className="flex items-center gap-0.5 text-[9px] text-white/35 font-mono">
                  {t.flag && <span>{t.flag}</span>}
                  {t.label}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1">
            <Zap size={8} className="text-primary/50" />
            <span className="text-[9px] font-mono text-white/30">+{prediction.xpReward} XP</span>
          </div>
        </motion.button>

        <PredictionModal
          prediction={prediction} isOpen={isOpen} onClose={() => setIsOpen(false)}
          selected={selected} saved={saved} maxSelect={maxSelect}
          onToggle={toggleSelect} onConfirm={handleConfirm} canConfirm={canConfirm}
        />
      </>
    );
  }

  // ── Full card layout ──────────────────────────────────────────────────────

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: "easeOut", delay }}
        className={cn(
          "flex items-start gap-4 rounded-2xl border p-4 transition-all duration-150",
          hasSaved
            ? "bg-gradient-to-br from-primary/12 via-[#060b1c] to-[#040810] border-primary/35 shadow-[0_0_24px_rgba(22,82,240,0.12)]"
            : "bg-gradient-to-b from-[#0b0f28] to-[#060810] border-white/[0.07] hover:border-white/[0.14]",
        )}
      >
        {/* Prediction icon */}
        <div className={cn(
          "w-12 h-12 rounded-2xl border flex items-center justify-center text-2xl flex-shrink-0",
          hasSaved ? "bg-primary/15 border-primary/30" : "bg-gradient-to-b from-[#0d1030] to-[#07091a] border-primary/15",
        )}>
          {prediction.icon}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-white/90">{prediction.title}</p>
            <span className={cn("text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md border capitalize", diff.cls)}>
              {diff.label}
            </span>
          </div>

          <p className="text-[11px] text-white/45 leading-relaxed">{prediction.description}</p>

          {/* Saved pick with visual */}
          {hasSaved && <SavedDisplay pool={prediction.pool} saved={saved} />}

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <Zap size={11} className="text-primary flex-shrink-0" />
              <span className="text-[11px] font-mono font-bold text-white/80">
                +{prediction.xpReward.toLocaleString()} XP
              </span>
              <span className="text-[10px] text-white/30 font-mono">if correct</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-mono text-white/30">
              <Clock size={9} />
              <span>Deadline: {prediction.deadline}</span>
            </div>
          </div>
        </div>

        {/* Action */}
        <div className="flex-shrink-0 self-center">
          {hasSaved ? (
            <button type="button" onClick={handleOpenModal}
              className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-primary/35 bg-primary/15 text-[11px] font-semibold text-primary/80 hover:bg-primary/25 transition-colors">
              <Check size={11} />
              <span className="hidden sm:inline">Edit</span>
            </button>
          ) : (
            <button type="button" onClick={handleOpenModal}
              className="flex items-center gap-1.5 h-9 px-4 rounded-xl border border-primary/40 bg-primary/15 text-[11px] font-semibold text-primary hover:bg-primary/25 transition-colors shadow-[0_0_10px_rgba(22,82,240,0.2)]">
              <ChevronRight size={11} />
              <span>Predict</span>
            </button>
          )}
        </div>
      </motion.div>

      <PredictionModal
        prediction={prediction} isOpen={isOpen} onClose={() => setIsOpen(false)}
        selected={selected} saved={saved} maxSelect={maxSelect}
        onToggle={toggleSelect} onConfirm={handleConfirm} canConfirm={canConfirm}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bottom-sheet prediction modal
// ─────────────────────────────────────────────────────────────────────────────

function PredictionModal({
  prediction, isOpen, onClose,
  selected, saved, maxSelect,
  onToggle, onConfirm, canConfirm,
}: {
  prediction: SpecialPrediction;
  isOpen:     boolean;
  onClose:    () => void;
  selected:   string[];
  saved:      string[];
  maxSelect:  number;
  onToggle:   (label: string) => void;
  onConfirm:  () => void;
  canConfirm: boolean;
}) {
  // Lock body scroll while sheet is open — prevents background scroll in Base App webview
  useBodyScrollLock(isOpen);

  const savedOpts    = prediction.pool.filter(o => saved.includes(o.label));
  const selectedOpts = prediction.pool.filter(o => selected.includes(o.label));

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-end modal-inset-bottom" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-lg mx-auto bg-gradient-to-b from-[#0a1428] to-[#07101f] border border-primary/20 border-b-0 rounded-t-2xl flex flex-col max-h-[82vh]"
            style={{ maxHeight: 'min(82vh, 82dvh)' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-8 h-1 rounded-full bg-white/15" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">{prediction.icon}</span>
                <div>
                  <p className="text-sm font-bold text-white/90">{prediction.title}</p>
                  <p className="text-[10px] font-mono text-white/35">
                    {maxSelect === 1 ? "Select one · saves locally" : `Select up to ${maxSelect} · saves locally`}
                  </p>
                </div>
              </div>
              <button type="button" onClick={onClose}
                className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/40 hover:text-white/70 transition-colors">
                <X size={13} />
              </button>
            </div>

            {/* Scoring hint */}
            <div className="px-5 py-2 flex-shrink-0 flex items-center gap-2 bg-primary/[0.04] border-b border-primary/10">
              <Lock size={9} className="text-white/25" />
              <span className="text-[9px] font-mono text-white/30">
                0 XP now · +{prediction.xpReward} XP projected · Scored after tournament stages
              </span>
            </div>

            {/* Options — touch-action:pan-y + overscroll-contain stop pull-to-refresh */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
              <div className={cn("grid gap-1.5", prediction.pool.length > 8 ? "grid-cols-2" : "grid-cols-1")}>
                {prediction.pool.map(opt => (
                  <OptionBtn
                    key={opt.label}
                    opt={opt}
                    picked={selected.includes(opt.label)}
                    onToggle={() => onToggle(opt.label)}
                  />
                ))}
              </div>
            </div>

            {/* Confirm footer — sheet position (modal-inset-bottom) already clears the BottomNav */}
            <div className="px-4 py-4 flex-shrink-0 border-t border-white/[0.06] space-y-2.5">
              {/* Current saved pick with visuals */}
              {savedOpts.length > 0 && (
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <span className="text-[9px] font-mono text-white/25">Current:</span>
                  {savedOpts.map(o => (
                    <div key={o.label} className="flex items-center gap-1">
                      <OptionAvatar opt={o} size="sm" />
                      <span className="text-[10px] font-mono text-primary/70 font-bold">{o.label}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Selected (pending confirm) */}
              {selectedOpts.length > 0 && (
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {selectedOpts.map(o => (
                    <div key={o.label} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/15 border border-primary/25">
                      <OptionAvatar opt={o} size="sm" />
                      <span className="text-[10px] font-semibold text-white/80">{o.label}</span>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button" onClick={onConfirm} disabled={!canConfirm}
                className={cn(
                  "w-full py-3 rounded-xl text-sm font-black transition-all duration-150",
                  canConfirm
                    ? "bg-primary text-white shadow-[0_4px_20px_rgba(22,82,240,0.45)] hover:opacity-90 active:scale-[0.98]"
                    : "bg-white/[0.05] border border-white/[0.07] text-white/25 cursor-not-allowed",
                )}
              >
                {canConfirm
                  ? `Lock In ${selected.length === 2 ? "Both Picks" : selected[0] ?? "Pick"}`
                  : "Select an option above"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
