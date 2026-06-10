"use client";

import { motion } from "framer-motion";
import { Flame, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { RankBadge } from "@/components/ui/Badge";
import type { LeaderboardEntry } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Medal config — distinct visual hierarchy per position
// ─────────────────────────────────────────────────────────────────────────────

const MEDALS = {
  1: { emoji: "🥇", label: "#1", badgeBg: "bg-[#FFD700]/15 border-[#FFD700]/35 text-[#FFD700] shadow-[0_0_14px_rgba(255,215,0,0.30)]", ringColor: "ring-[#FFD700]/50", avatarGlow: "from-[#FFD700]/20", baseH: "h-24", order: "order-2", delay: 0.04 },
  2: { emoji: "🥈", label: "#2", badgeBg: "bg-white/10 border-white/22 text-white/65",                                                  ringColor: "ring-white/25",       avatarGlow: "from-white/10",       baseH: "h-16", order: "order-1", delay: 0.10 },
  3: { emoji: "🥉", label: "#3", badgeBg: "bg-[#CD7F32]/12 border-[#CD7F32]/25 text-[#CD7F32]/80",                                      ringColor: "ring-[#CD7F32]/35",   avatarGlow: "from-[#CD7F32]/12",   baseH: "h-12", order: "order-3", delay: 0.15 },
} as const;

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
  const m   = MEDALS[pos];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut", delay: m.delay }}
      className={cn("flex flex-col items-center gap-2 flex-1 min-w-0", m.order)}
    >
      {/* Medal badge */}
      <div className={cn(
        "w-8 h-8 rounded-xl flex items-center justify-center font-mono font-black text-[11px] border",
        m.badgeBg,
      )}>
        {m.emoji}
      </div>

      {/* Avatar */}
      <div className={cn(
        "relative w-14 h-14 rounded-2xl border flex items-center justify-center text-2xl flex-shrink-0",
        `bg-gradient-to-br ${m.avatarGlow} to-[#060810] border-white/10`,
        isCurrentUser && "ring-2 ring-offset-1 ring-offset-[#0b0f28] ring-primary/60",
        !isCurrentUser && `ring-1 ${m.ringColor}`,
      )}>
        {isCurrentUser && (
          <span className="absolute -top-2 -right-2 text-[9px] font-mono font-bold bg-primary text-white px-1.5 py-0.5 rounded-md leading-none z-20">
            YOU
          </span>
        )}
        <span className="relative z-10">{entry.avatar}</span>
      </div>

      {/* Name + flag */}
      <div className="text-center max-w-full px-1">
        <p className={cn(
          "text-xs truncate leading-tight",
          pos === 1 ? "text-white font-black" : pos === 2 ? "text-white/70 font-bold" : "text-white/55 font-bold",
        )}>
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
      <div className={cn(
        "w-full rounded-t-xl border-t border-x",
        m.baseH,
        pos === 1
          ? "bg-gradient-to-t from-[#FFD700]/10 to-[#FFD700]/3 border-[#FFD700]/20 shadow-[0_-4px_20px_rgba(255,215,0,0.08)]"
          : pos === 2
          ? "bg-gradient-to-t from-white/[0.05] to-transparent border-white/[0.07]"
          : "bg-gradient-to-t from-[#CD7F32]/[0.06] to-transparent border-[#CD7F32]/[0.10]",
      )} />
    </motion.div>
  );
}
