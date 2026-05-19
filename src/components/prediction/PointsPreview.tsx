"use client";

import { motion } from "framer-motion";
import { Zap, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MatchStatus } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// XP multiplier per match status / type
// ─────────────────────────────────────────────────────────────────────────────

const BASE_XP = 10;

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface PointsPreviewProps {
  status:   MatchStatus;
  leagueId: string;
  /** If true, shows confirmed state (prediction already locked) */
  locked?: boolean;
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function PointsPreview({ status, leagueId, locked = false, className }: PointsPreviewProps) {
  void status; void leagueId;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "rounded-2xl border p-4 space-y-3",
        locked ? "bg-success/8 border-success/25" : "bg-elevated border-border",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Star size={13} className={locked ? "text-success" : "text-text-muted"} />
        <span className="text-[11px] font-mono font-semibold text-text-secondary uppercase tracking-wider">
          XP Reward Breakdown
        </span>
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Correct prediction reward */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap size={13} className={locked ? "text-success" : "text-primary"} />
          <span className="text-xs font-semibold text-text-primary">
            {locked ? "XP if Correct" : "Correct pick earns"}
          </span>
        </div>
        <span className={cn(
          "font-mono font-black text-base tabular-nums",
          locked ? "text-success" : "text-primary"
        )}>
          +{BASE_XP}
        </span>
      </div>

      {/* Wrong prediction */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted font-mono">Wrong pick earns</span>
        <span className="text-xs font-mono font-bold text-text-muted">0 XP</span>
      </div>

      {/* Bonus note */}
      <p className="text-[10px] text-text-muted font-mono opacity-60">Bonuses coming later</p>
    </motion.div>
  );
}
