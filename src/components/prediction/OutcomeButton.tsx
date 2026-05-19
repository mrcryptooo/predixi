"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { MatchOutcome } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Config per outcome
// ─────────────────────────────────────────────────────────────────────────────

const outcomeConfig: Record<
  MatchOutcome,
  { sublabel: string; activeClass: string; ringClass: string; barClass: string }
> = {
  home: {
    sublabel:    "Home team wins 90 min",
    activeClass: "bg-primary/15 border-primary/50 text-primary",
    ringClass:   "ring-primary/30",
    barClass:    "bg-primary",
  },
  draw: {
    sublabel:    "Match ends level",
    activeClass: "bg-[#4A4D65]/30 border-[#6B6F8A]/60 text-text-primary",
    ringClass:   "ring-[#6B6F8A]/30",
    barClass:    "bg-[#4A4D65]",
  },
  away: {
    sublabel:    "Away team wins 90 min",
    activeClass: "bg-danger/12 border-danger/40 text-danger",
    ringClass:   "ring-danger/25",
    barClass:    "bg-danger",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface OutcomeButtonProps {
  outcome:      MatchOutcome;
  /** Override label — pass team short name for home/away */
  teamLabel?:   string;
  communityPct: number;
  selected:     boolean;
  disabled?:    boolean;
  onClick:      () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function OutcomeButton({
  outcome,
  teamLabel,
  communityPct,
  selected,
  disabled = false,
  onClick,
}: OutcomeButtonProps) {
  const cfg = outcomeConfig[outcome];
  const displayLabel = outcome === "draw" ? "Draw" : (teamLabel ?? "—");

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative flex-1 flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-4",
        "transition-all duration-150 focus:outline-none",
        selected
          ? [cfg.activeClass, "ring-2", cfg.ringClass, "shadow-lg"]
          : "bg-elevated border-border text-text-muted hover:border-border/80 hover:text-text-secondary",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {/* Selected tick */}
      {selected && (
        <span className="absolute top-2 right-2 text-[10px] font-mono font-bold opacity-70">
          ✓
        </span>
      )}

      {/* Main label */}
      <span className={cn(
        "text-sm font-bold leading-tight text-center w-full truncate",
        selected ? "opacity-100" : "opacity-80"
      )}>
        {displayLabel}
      </span>

      {/* Sub-label */}
      <span className="text-[10px] font-mono text-text-muted text-center leading-tight">
        {cfg.sublabel}
      </span>

      {/* Community percentage bar — framer-motion, no inline style */}
      <div className="w-full mt-1 space-y-1">
        <div className="h-1 w-full rounded-full bg-surface overflow-hidden">
          <motion.div
            className={cn("h-full rounded-full", cfg.barClass)}
            initial={{ width: 0 }}
            animate={{ width: `${communityPct}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
        <span className="text-[10px] font-mono text-text-muted block text-center">
          {communityPct}% community
        </span>
      </div>
    </button>
  );
}
