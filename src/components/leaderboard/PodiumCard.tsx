"use client";

import { motion } from "framer-motion";
import { Flame, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { RankBadge } from "@/components/ui/Badge";
import type { LeaderboardEntry } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Position-specific config — blue/white dominant, no gold/silver/bronze palette
// ─────────────────────────────────────────────────────────────────────────────

const podiumConfig: Record<
  1 | 2 | 3,
  {
    rankBadge:   string;
    avatarRing:  string;
    avatarBg:    string;
    nameClass:   string;
    heightClass: string;
    baseClass:   string;
    orderClass:  string;
    glowClass:   string;
    delay:       number;
  }
> = {
  1: {
    rankBadge:   "bg-primary text-white shadow-[0_0_14px_rgba(22,82,240,0.55)] border border-primary/50",
    avatarRing:  "ring-2 ring-primary/50",
    avatarBg:    "bg-gradient-to-br from-primary/25 to-[#060810] border-primary/30",
    nameClass:   "text-white font-black",
    heightClass: "h-24",
    baseClass:   "bg-gradient-to-t from-primary/22 to-primary/5 border-t border-x border-primary/25 shadow-[0_-4px_20px_rgba(22,82,240,0.12)]",
    orderClass:  "order-2",
    glowClass:   "bg-primary opacity-[0.12] blur-2xl",
    delay:       0.05,
  },
  2: {
    rankBadge:   "bg-white/10 text-white/65 border border-white/18",
    avatarRing:  "ring-1 ring-white/20",
    avatarBg:    "bg-gradient-to-br from-white/10 to-[#060810] border-white/12",
    nameClass:   "text-white/70 font-bold",
    heightClass: "h-16",
    baseClass:   "bg-gradient-to-t from-white/[0.06] to-transparent border-t border-x border-white/[0.07]",
    orderClass:  "order-1",
    glowClass:   "bg-white opacity-[0.04] blur-xl",
    delay:       0.10,
  },
  3: {
    rankBadge:   "bg-white/[0.07] text-white/45 border border-white/12",
    avatarRing:  "ring-1 ring-white/12",
    avatarBg:    "bg-gradient-to-br from-white/[0.07] to-[#060810] border-white/10",
    nameClass:   "text-white/55 font-bold",
    heightClass: "h-12",
    baseClass:   "bg-gradient-to-t from-white/[0.04] to-transparent border-t border-x border-white/[0.05]",
    orderClass:  "order-3",
    glowClass:   "bg-white opacity-[0.03] blur-xl",
    delay:       0.15,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface PodiumCardProps {
  entry:          LeaderboardEntry;
  isCurrentUser?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function PodiumCard({ entry, isCurrentUser = false }: PodiumCardProps) {
  const pos = entry.position as 1 | 2 | 3;
  const cfg = podiumConfig[pos];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut", delay: cfg.delay }}
      className={cn("flex flex-col items-center gap-2 flex-1 min-w-0", cfg.orderClass)}
    >
      {/* Rank number badge */}
      <div className={cn(
        "w-7 h-7 rounded-lg flex items-center justify-center font-mono font-black text-[11px]",
        cfg.rankBadge
      )}>
        #{pos}
      </div>

      {/* Avatar */}
      <div className={cn(
        "relative w-14 h-14 rounded-2xl border flex items-center justify-center text-2xl flex-shrink-0",
        cfg.avatarBg,
        cfg.avatarRing,
        isCurrentUser && "outline outline-2 outline-offset-2 outline-primary/50"
      )}>
        {/* Ambient glow */}
        <div className={cn("absolute inset-0 rounded-2xl", cfg.glowClass)} />
        <span className="relative z-10">{entry.avatar}</span>
        {isCurrentUser && (
          <span className="absolute -top-2 -right-2 text-[9px] font-mono font-bold bg-primary text-white px-1.5 py-0.5 rounded-md leading-none z-20">
            YOU
          </span>
        )}
      </div>

      {/* Name + flag */}
      <div className="text-center max-w-full px-1">
        <p className={cn("text-xs truncate leading-tight", cfg.nameClass)}>
          {entry.displayName}
        </p>
        <span className="text-base leading-none">{entry.countryFlag}</span>
      </div>

      {/* XP */}
      <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-white/80">
        <Zap size={10} className="text-primary" />
        {entry.xp.toLocaleString()}
      </div>

      {/* Accuracy + streak */}
      <div className="flex items-center gap-2 text-[10px] font-mono text-white/35">
        <span>{entry.accuracy}%</span>
        {entry.streak > 0 && (
          <span className="flex items-center gap-0.5 text-warning/80">
            <Flame size={9} />
            {entry.streak}
          </span>
        )}
      </div>

      <RankBadge rank={entry.rank} size="xs" />

      {/* Podium base */}
      <div className={cn("w-full rounded-t-xl", cfg.heightClass, cfg.baseClass)} />
    </motion.div>
  );
}
