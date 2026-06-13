"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Flame, Zap, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { RankBadge } from "@/components/ui/Badge";
import type { LeaderboardEntry } from "@/types";

function LbMonogram({ initials, rank }: { initials: string; rank: string }) {
  const ring =
    rank === "legend"   ? "ring-[#1652F0]" :
    rank === "diamond"  ? "ring-[#B9F2FF]/70" :
    rank === "platinum" ? "ring-white/40" :
    rank === "gold"     ? "ring-[#FFD700]/60" :
    rank === "silver"   ? "ring-white/25" :
                          "ring-primary/40";
  return (
    <div className={cn("w-9 h-9 rounded-xl flex-shrink-0 ring-1 ring-offset-1 ring-offset-[#070b22]", ring)}>
      <div className="w-full h-full rounded-xl flex items-center justify-center bg-gradient-to-br from-primary/60 via-[#1a3a8f] to-[#060a1e] border border-primary/30">
        <span className="text-[11px] font-black text-white select-none">{(initials || "??").slice(0, 2).toUpperCase()}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Row
// ─────────────────────────────────────────────────────────────────────────────

interface RowProps {
  entry: LeaderboardEntry;
  isCurrentUser?: boolean;
  delay?: number;
}

function LeaderboardRow({ entry, isCurrentUser = false, delay = 0 }: RowProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.32, ease: "easeOut", delay }}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors",
        isCurrentUser
          ? "bg-primary/8 border-primary/25"
          : "bg-elevated border-border hover:border-border/80"
      )}
    >
      {/* Position */}
      <div className="w-7 text-center flex-shrink-0">
        <span className={cn(
          "text-xs font-mono font-bold",
          entry.position === 1 ? "text-primary" : "text-text-muted"
        )}>
          #{entry.position}
        </span>
      </div>

      {/* Avatar */}
      <LbMonogram initials={entry.initials} rank={entry.rank} />

      {/* Name + flag */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "text-sm font-semibold truncate font-mono",
            isCurrentUser ? "text-primary" : "text-text-primary"
          )}>
            {entry.displayName}
          </span>
          <span className="text-sm flex-shrink-0">{entry.countryFlag}</span>
          {isCurrentUser && (
            <span className="text-[9px] font-mono bg-primary/15 text-primary px-1.5 py-0.5 rounded-md flex-shrink-0">
              YOU
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <RankBadge rank={entry.rank} size="xs" />
          {entry.streak > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-mono text-warning">
              <Flame size={10} />
              {entry.streak}
            </span>
          )}
        </div>
      </div>

      {/* XP */}
      <div className="text-right flex-shrink-0">
        <div className="flex items-center gap-1 text-xs font-mono font-bold">
          <Zap size={11} className="text-primary" />
          <span className="text-text-primary">{entry.xp.toLocaleString()}</span>
        </div>
        <div className="text-[10px] text-text-muted font-mono mt-0.5">
          {entry.accuracy}% acc
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mini leaderboard — real data from /api/leaderboard
// ─────────────────────────────────────────────────────────────────────────────

interface MiniLeaderboardProps {
  currentUserId?: string;
  limit?: number;
  className?: string;
}

export function MiniLeaderboard({
  currentUserId = "",
  limit = 5,
  className,
}: MiniLeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/leaderboard?limit=${limit}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: { success: boolean; entries: LeaderboardEntry[] } | null) => {
        if (d?.success) setEntries(d.entries.slice(0, limit));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [limit]);

  return (
    <div className={cn("space-y-2", className)}>
      {loading ? (
        <p className="text-xs text-white/25 font-mono px-1 py-4 animate-pulse">Loading predictors…</p>
      ) : entries.length === 0 ? (
        <div className={cn(
          "flex flex-col items-center gap-3 py-10 rounded-2xl border text-center",
          "border-white/[0.07] bg-white/[0.02]"
        )}>
          <Trophy size={20} className="text-white/20" />
          <p className="text-xs text-white/30 font-mono">No predictors yet. Be the first!</p>
        </div>
      ) : (
        entries.map((entry, i) => (
          <LeaderboardRow
            key={entry.userId}
            entry={entry}
            isCurrentUser={!!currentUserId && entry.userId.toLowerCase() === currentUserId.toLowerCase()}
            delay={i * 0.05}
          />
        ))
      )}

      <Link
        href="/leaderboard"
        className="flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-xs font-semibold text-text-secondary hover:text-primary hover:border-primary/30 transition-colors group"
      >
        View full leaderboard
        <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </div>
  );
}
