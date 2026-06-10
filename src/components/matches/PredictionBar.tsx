"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { CommunityPredictions } from "@/types";

interface PredictionBarProps {
  community: CommunityPredictions | null;
  homeLabel?: string;
  awayLabel?: string;
  className?: string;
  /** If set, highlights the user's pick */
  userPick?: "home" | "draw" | "away";
}

export function PredictionBar({
  community,
  homeLabel = "Home",
  awayLabel = "Away",
  userPick,
  className,
}: PredictionBarProps) {
  if (!community) {
    return (
      <div className={cn("space-y-1.5", className)}>
        <div className="h-2 rounded-full bg-white/[0.06]" />
        <p className="text-[10px] text-white/20 font-mono text-center">No community picks yet</p>
      </div>
    );
  }

  const { home, draw, away } = community;

  const segments = [
    { key: "home" as const, pct: home, label: homeLabel, color: "bg-primary"  },
    { key: "draw" as const, pct: draw, label: "Draw",    color: "bg-[#4A4D65]"},
    { key: "away" as const, pct: away, label: awayLabel, color: "bg-danger"   },
  ];

  return (
    <div className={cn("space-y-1.5", className)}>
      {/* Bar */}
      <div className="flex h-2 rounded-full overflow-hidden gap-px">
        {segments.map(({ key, pct, color }) => (
          <motion.div
            key={key}
            className={cn(
              "h-full rounded-full",
              color,
              userPick === key && "ring-1 ring-white/40",
              pct > 0 ? "min-w-[4px]" : "min-w-0"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          />
        ))}
      </div>

      {/* Labels */}
      <div className="flex items-center justify-between">
        {segments.map(({ key, pct, label, color }) => (
          <div key={key} className="flex items-center gap-1">
            <span className={cn("w-2 h-2 rounded-full flex-shrink-0", color)} />
            <span className={cn(
              "text-[11px] font-mono",
              userPick === key ? "text-text-primary font-bold" : "text-text-muted"
            )}>
              {label} {pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
