"use client";

import { motion } from "framer-motion";
import { Flame, Zap, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { RankBadge } from "@/components/ui/Badge";
import type { LeaderboardEntry } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface LeaderboardTableProps {
  entries:        LeaderboardEntry[];
  currentUserId?: string;
  startIndex?:    number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Row
// ─────────────────────────────────────────────────────────────────────────────

interface RowProps {
  entry:         LeaderboardEntry;
  isCurrentUser: boolean;
  delay:         number;
}

function TableRow({ entry, isCurrentUser, delay }: RowProps) {
  const isTop5 = entry.position <= 8; // top 8 overall (positions 4-8 shown here, after podium)

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, ease: "easeOut", delay }}
      className={cn(
        "relative flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all duration-150",
        isCurrentUser
          ? "bg-primary/10 border-primary/30 shadow-[0_0_16px_rgba(22,82,240,0.10)]"
          : isTop5
          ? "bg-gradient-to-r from-[#0d1030] to-[#07091a] border-white/[0.10] hover:border-primary/22"
          : "bg-gradient-to-r from-[#0b0f28] to-[#07091a] border-white/[0.07] hover:border-primary/20",
      )}
    >
      {/* Top-5 left accent bar */}
      {isTop5 && !isCurrentUser && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-primary/40" />
      )}
      {isCurrentUser && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-primary" />
      )}

      {/* Position number */}
      <div className="w-7 flex-shrink-0 text-center">
        <span className={cn(
          "text-xs font-mono font-black tabular-nums",
          isCurrentUser ? "text-primary" : isTop5 ? "text-white/55" : "text-white/25",
        )}>
          #{entry.position}
        </span>
      </div>

      {/* Avatar */}
      <div className={cn(
        "w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 border",
        isCurrentUser
          ? "border-primary/35 bg-primary/12"
          : "border-white/[0.08] bg-white/[0.04]",
      )}>
        {entry.avatar}
      </div>

      {/* Name + rank + streak */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cn(
            "text-sm font-semibold truncate",
            isCurrentUser ? "text-white font-bold" : isTop5 ? "text-white/85" : "text-white/70",
          )}>
            {entry.displayName}
          </span>
          <span className="flex-shrink-0 text-sm">{entry.countryFlag}</span>
          {isCurrentUser && (
            <span className="text-[9px] font-mono font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded-md flex-shrink-0">
              YOU
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <RankBadge rank={entry.rank} size="xs" />
          {entry.streak > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-mono text-warning/75">
              <Flame size={9} />
              {entry.streak}
            </span>
          )}
        </div>
      </div>

      {/* Acc + weekly — desktop only */}
      <div className="hidden sm:flex items-center gap-4 flex-shrink-0 text-right">
        <div className="w-14">
          <p className="text-[10px] text-white/25 font-mono">Acc</p>
          <p className="text-xs font-mono font-bold text-white/60">{entry.accuracy}%</p>
        </div>
        <div className="w-16">
          <p className="text-[10px] text-white/25 font-mono">Weekly</p>
          <div className="flex items-center gap-0.5 justify-end">
            <TrendingUp size={9} className="text-success/70" />
            <p className="text-xs font-mono font-bold text-success/80">{entry.weeklyXp}</p>
          </div>
        </div>
      </div>

      {/* XP — always visible */}
      <div className="text-right flex-shrink-0">
        <div className="flex items-center gap-1 text-xs font-mono font-bold justify-end">
          <Zap size={11} className="text-primary" />
          <span className={isCurrentUser ? "text-white" : isTop5 ? "text-white/80" : "text-white/65"}>
            {entry.xp.toLocaleString()}
          </span>
        </div>
        <p className="text-[10px] text-white/25 font-mono mt-0.5 sm:hidden">
          {entry.accuracy}% acc
        </p>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Table
// ─────────────────────────────────────────────────────────────────────────────

export function LeaderboardTable({
  entries,
  currentUserId,
  startIndex = 0,
}: LeaderboardTableProps) {
  return (
    <div className="space-y-2">
      {entries.map((entry, i) => (
        <TableRow
          key={entry.userId}
          entry={entry}
          isCurrentUser={entry.userId.toLowerCase() === (currentUserId ?? "").toLowerCase()}
          delay={(startIndex + i) * 0.035}
        />
      ))}
    </div>
  );
}
