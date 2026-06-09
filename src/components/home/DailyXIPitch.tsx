"use client";

import { useState } from "react";
import { Lock, RotateCcw, Star, Clock, CheckCircle2, Share2, Copy, Check, Send, Wallet } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { XI_POSITIONS, type DailyXIPlayer } from "@/lib/daily-xi";
import { shareDailyXI, isShareSupported } from "@/lib/base-app-actions";
import { AnchorDailyXIButton } from "@/components/onchain/AnchorDailyXIButton";

// ─────────────────────────────────────────────────────────────────────────────
// Staggered pitch positions — [top%, left%]
// Realistic football formation, not flat rows
// ─────────────────────────────────────────────────────────────────────────────

const PITCH_POS: Record<number, [number, number]> = {
  0:  [88, 50],   // GK  — deep center
  1:  [67, 82],   // RB  — wide right, slightly higher than CBs
  2:  [70, 61],   // CB  — center-right, deepest of back 4
  3:  [70, 39],   // CB  — center-left
  4:  [67, 18],   // LB  — wide left
  5:  [45, 86],   // RM  — wide right, slightly higher than CMs
  6:  [49, 63],   // CM  — center-right, slightly deeper
  7:  [49, 37],   // CM  — center-left
  8:  [45, 14],   // LM  — wide left
  9:  [13, 63],   // ST  — center-right high
  10: [13, 37],   // ST  — center-left high
};

// ─────────────────────────────────────────────────────────────────────────────
// Pitch player node
// ─────────────────────────────────────────────────────────────────────────────

function PitchPlayer({
  player, pos, delay,
}: {
  player: DailyXIPlayer; pos: string; delay: number;
}) {
  const [err, setErr] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.38, ease: "backOut", delay }}
      className="flex flex-col items-center gap-[3px] select-none"
    >
      {/* Outer glow halo */}
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-primary/25 blur-[8px] scale-[1.4] pointer-events-none" />
        <div className={cn(
          "relative rounded-full overflow-hidden bg-[#060a1e]",
          "w-11 h-11 sm:w-13 sm:h-13",
          "border-2 border-primary/60",
          "shadow-[0_0_18px_rgba(22,82,240,0.65),0_0_6px_rgba(22,82,240,0.4)]",
        )}>
          {!err ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={player.image}
              alt={player.name}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              onError={() => setErr(true)}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/35 to-[#060a1e] flex items-center justify-center">
              <span className="text-white/70 font-black text-sm">
                {player.name.charAt(0)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Position badge */}
      <span className="font-mono font-bold text-[7px] text-primary leading-none bg-primary/20 border border-primary/35 rounded-md px-[5px] py-[2px] backdrop-blur-sm">
        {pos}
      </span>

      {/* Name */}
      <p className="font-bold text-[8px] text-white/85 text-center leading-none max-w-[54px] truncate drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
        {player.name.split(" ").pop()}
      </p>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG field lines
// ─────────────────────────────────────────────────────────────────────────────

function PitchSVG() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 400 580"
      preserveAspectRatio="none"
      fill="none"
    >
      {/* Outer boundary */}
      <rect x="16" y="10" width="368" height="560" rx="4"
        stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" />
      {/* Halfway line */}
      <line x1="16" y1="290" x2="384" y2="290"
        stroke="rgba(255,255,255,0.09)" strokeWidth="1" />
      {/* Center circle */}
      <circle cx="200" cy="290" r="58"
        stroke="rgba(255,255,255,0.09)" strokeWidth="1" />
      {/* Center spot */}
      <circle cx="200" cy="290" r="4" fill="rgba(255,255,255,0.18)" />
      {/* Top penalty area */}
      <rect x="84" y="10" width="232" height="108" rx="2"
        stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      {/* Top 6-yard box */}
      <rect x="142" y="10" width="116" height="46" rx="2"
        stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
      {/* Top penalty spot */}
      <circle cx="200" cy="84" r="3" fill="rgba(255,255,255,0.13)" />
      {/* Top penalty arc */}
      <path d="M 136 118 A 64 64 0 0 1 264 118"
        stroke="rgba(255,255,255,0.07)" strokeWidth="1" fill="none" />
      {/* Bottom penalty area */}
      <rect x="84" y="462" width="232" height="108" rx="2"
        stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      {/* Bottom 6-yard box */}
      <rect x="142" y="524" width="116" height="46" rx="2"
        stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
      {/* Bottom penalty spot */}
      <circle cx="200" cy="496" r="3" fill="rgba(255,255,255,0.13)" />
      {/* Bottom penalty arc */}
      <path d="M 136 462 A 64 64 0 0 0 264 462"
        stroke="rgba(255,255,255,0.07)" strokeWidth="1" fill="none" />
      {/* Corner arcs */}
      <path d="M 16 26 A 12 12 0 0 1 28 14" stroke="rgba(255,255,255,0.07)" strokeWidth="1" fill="none" />
      <path d="M 372 14 A 12 12 0 0 1 384 26" stroke="rgba(255,255,255,0.07)" strokeWidth="1" fill="none" />
      <path d="M 16 554 A 12 12 0 0 0 28 566" stroke="rgba(255,255,255,0.07)" strokeWidth="1" fill="none" />
      <path d="M 372 566 A 12 12 0 0 0 384 554" stroke="rgba(255,255,255,0.07)" strokeWidth="1" fill="none" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main pitch component
// ─────────────────────────────────────────────────────────────────────────────

export function DailyXIPitch({
  slots,
  onReset,
  earnedXp        = 0,
  status          = 'pending',
  onSubmit,
  submitting      = false,
  submitted       = false,
  isConnected     = false,
  submitError,
  // ── Anchor on Base props ──────────────────────────────────────────────────
  commitmentHash,
  submittedOnchain = false,
  txHash,
  entryDate,
  onAnchorSuccess,
}: {
  slots:             (DailyXIPlayer | null)[];
  onReset?:          () => void;
  earnedXp?:         number;
  status?:           string;
  onSubmit?:         () => void;
  submitting?:       boolean;
  submitted?:        boolean;
  isConnected?:      boolean;
  submitError?:      string | null;
  commitmentHash?:   string | null;
  submittedOnchain?: boolean;
  txHash?:           string | null;
  entryDate?:        string;
  onAnchorSuccess?:  (txHash: string) => void;
}) {
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');

  async function handleShare() {
    const filledCount = slots.filter(Boolean).length;
    const result = await shareDailyXI({
      filledCount,
      projectedMaxXp: 20,
      earnedXp: status === 'scored' ? earnedXp : undefined,
    });
    if (result === 'copied') {
      setShareState('copied');
      setTimeout(() => setShareState('idle'), 2000);
    }
  }

  return (
    <div className="space-y-4">

      {/* Status pill */}
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-success/15 border border-success/30 shadow-[0_0_20px_rgba(22,163,74,0.18)]">
          <Lock size={11} className="text-success/70" />
          <span className="text-[11px] font-bold text-success/85 tracking-wide">
            Today's XI Locked
          </span>
        </div>
      </div>

      {/* Pitch */}
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{
          background:
            "linear-gradient(180deg, #0d3b20 0%, #0b3320 15%, #093018 30%, #082c16 50%, #093018 70%, #0b3320 85%, #0d3b20 100%)",
          height: 420,
        }}
      >
        {/* Grass stripes */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(180deg, rgba(255,255,255,0.016) 0px, rgba(255,255,255,0.016) 26px, transparent 26px, transparent 52px)",
          }}
        />

        {/* Blue neon glow — top attacking end */}
        <div className="absolute top-0 inset-x-0 h-28 bg-gradient-to-b from-primary/[0.09] to-transparent pointer-events-none" />
        {/* Subtle blue glow — GK end */}
        <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-primary/[0.05] to-transparent pointer-events-none" />
        {/* Center glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-primary/[0.03] blur-3xl pointer-events-none" />

        {/* Neon top line */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent pointer-events-none" />

        {/* SVG lines */}
        <PitchSVG />

        {/* Players — absolutely positioned */}
        {Object.entries(PITCH_POS).map(([key, [top, left]]) => {
          const slotIdx = Number(key);
          const player  = slots[slotIdx];
          if (!player) return null;
          return (
            <div
              key={slotIdx}
              className="absolute z-10"
              style={{
                top:       `${top}%`,
                left:      `${left}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <PitchPlayer
                player={player}
                pos={XI_POSITIONS[slotIdx]}
                delay={slotIdx * 0.045}
              />
            </div>
          );
        })}
      </div>

      {/* MVP Scoring panel */}
      {(() => {
        const isScored  = status === 'scored';
        const barWidth  = isScored && earnedXp > 0 ? Math.min(100, Math.round((earnedXp / 20) * 100)) : 0;
        return (
          <div className={cn(
            "relative overflow-hidden rounded-xl border p-3.5",
            isScored
              ? "border-emerald-500/25 bg-gradient-to-r from-emerald-500/[0.06] to-transparent"
              : "border-primary/15 bg-gradient-to-r from-primary/[0.06] to-transparent",
          )}>
            <div className={cn(
              "absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent to-transparent",
              isScored ? "via-emerald-500/30" : "via-primary/30",
            )} />
            <div className="flex items-center gap-3">
              {/* Icon */}
              <div className={cn(
                "w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0",
                isScored ? "bg-emerald-500/10 border-emerald-500/25" : "bg-primary/10 border-primary/20",
              )}>
                {isScored
                  ? <CheckCircle2 size={15} className="text-emerald-400/70" />
                  : <Star         size={15} className="text-primary/55" />
                }
              </div>

              {/* Score display */}
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-mono text-white/35 uppercase tracking-wider mb-0.5">
                  Daily XI Score
                </p>
                <div className="flex items-baseline gap-2">
                  <span className={cn(
                    "text-2xl font-black tabular-nums leading-none",
                    isScored ? "text-emerald-300" : "text-white/20",
                  )}>
                    {isScored ? earnedXp : 0}
                  </span>
                  <span className={cn("text-[10px] font-mono", isScored ? "text-emerald-300/60" : "text-white/20")}>
                    XP
                  </span>
                  <span className="text-[9px] font-mono text-white/15">· max 20 XP</span>
                </div>
              </div>

              {/* Status badge */}
              <div className="text-right flex-shrink-0 space-y-1">
                {isScored ? (
                  <div className="flex items-center justify-end gap-1">
                    <CheckCircle2 size={8} className="text-emerald-400/70" />
                    <span className="text-[8px] font-mono font-bold text-emerald-400/70">Scored ✓</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-end gap-1">
                      <Clock size={8} className="text-amber-400/50" />
                      <span className="text-[8px] font-mono font-bold text-amber-400/50">Pending</span>
                    </div>
                    <p className="text-[8px] text-white/20 font-mono leading-snug">
                      Scored after<br />matches play
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Score bar */}
            <div className="mt-3 h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-700", isScored ? "bg-emerald-400" : "bg-primary")}
                style={{ width: `${barWidth}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className={cn("text-[8px] font-mono", isScored ? "text-emerald-400/50" : "text-white/15")}>
                {isScored ? `${earnedXp} XP earned` : "0 XP"}
              </span>
              <span className="text-[8px] font-mono text-white/15">Projected max: 20 XP</span>
            </div>
          </div>
        );
      })()}

      {/* ── Final Submit CTA ─────────────────────────────────────────────── */}
      {submitted ? (
        // Submitted state — green confirmation + optional anchor button
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-success/10 border border-success/25">
            <CheckCircle2 size={13} className="text-success/70 flex-shrink-0" />
            <span className="text-xs font-bold text-success/75">Final XI submitted</span>
          </div>
          {/* Anchor on Base — only renders when commitmentHash is present and wallet connected */}
          {commitmentHash && (
            <div className={cn(
              "flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl",
              "border border-primary/15 bg-gradient-to-r from-primary/[0.05] to-transparent",
            )}>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-white/45 leading-none mb-0.5">
                  Anchor on Base
                </p>
                <p className="text-[9px] font-mono text-white/22 leading-none">
                  Optional · Keeps a permanent onchain proof · Small Base fee
                </p>
              </div>
              <AnchorDailyXIButton
                entryDate={entryDate ?? new Date().toISOString().slice(0, 10)}
                commitmentHash={commitmentHash}
                submittedOnchain={submittedOnchain}
                txHash={txHash ?? null}
                onAnchorSuccess={onAnchorSuccess}
              />
            </div>
          )}
        </div>
      ) : !isConnected ? (
        // Not connected — guidance only, no remote save
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07]">
          <Wallet size={13} className="text-white/25 flex-shrink-0" />
          <span className="text-[11px] text-white/35 font-mono">Connect wallet to submit your Final XI</span>
        </div>
      ) : (
        // Connected + not yet submitted — show submit button
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black tracking-wide",
              "transition-all duration-150 active:scale-[0.97]",
              submitting
                ? "bg-primary/15 border border-primary/25 text-primary/40 cursor-wait"
                : "bg-primary text-white shadow-[0_4px_28px_rgba(22,82,240,0.45)] hover:opacity-90",
            )}
          >
            <Send size={14} className={cn(submitting && "animate-pulse")} />
            {submitting ? "Submitting…" : "Submit Final XI"}
          </button>
          {submitError && (
            <p className="text-[10px] font-mono text-danger/60 text-center">{submitError}</p>
          )}
        </div>
      )}

      {/* Share + Reset row */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[9px] text-white/15 font-mono">
          {submitted
            ? submittedOnchain
              ? "Synced · Anchored on Base ✓"
              : "Synced · Anchor on Base to prove it"
            : "Submit XI to anchor on Base"}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleShare}
            className={cn(
              "flex items-center gap-1 text-[10px] font-mono transition-colors",
              shareState === 'copied'
                ? "text-success/70"
                : "text-white/25 hover:text-primary/60"
            )}
          >
            {shareState === 'copied'
              ? <><Check size={9} />Copied</>
              : isShareSupported()
                ? <><Share2 size={9} />Share XI</>
                : <><Copy  size={9} />Copy link</>
            }
          </button>

          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1 text-[10px] font-mono text-white/20 hover:text-danger/60 transition-colors"
            >
              <RotateCcw size={9} />
              Reset XI
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
