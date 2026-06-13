"use client";

import { motion } from "framer-motion";
import { Flame, Zap, Target, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { RankBadge } from "@/components/ui/Badge";
import type { User } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface ProfileHeaderProps {
  user:       User;
  globalRank: number;
  accuracy:   number;
  address?:   string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Monogram avatar — initials on brand gradient
// ─────────────────────────────────────────────────────────────────────────────

function MonogramAvatar({ initials, rank }: { initials: string; rank: string }) {
  const ringColor =
    rank === "legend"   ? "ring-[#1652F0]" :
    rank === "diamond"  ? "ring-[#B9F2FF]/70" :
    rank === "platinum" ? "ring-white/40" :
    rank === "gold"     ? "ring-[#FFD700]/60" :
    rank === "silver"   ? "ring-white/25" :
                          "ring-primary/40";

  return (
    <div className={cn(
      "relative w-20 h-20 rounded-2xl flex-shrink-0",
      "ring-2 ring-offset-2 ring-offset-[#070b22]",
      ringColor,
    )}>
      {/* Gradient background */}
      <div className={cn(
        "w-full h-full rounded-2xl flex items-center justify-center",
        "bg-gradient-to-br from-primary/60 via-[#1a3a8f] to-[#060a1e]",
        "border border-primary/30 shadow-[0_0_32px_rgba(22,82,240,0.35)]",
      )}>
        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 rounded-2xl opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(100,140,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(100,140,255,1) 1px, transparent 1px)",
            backgroundSize: "14px 14px",
          }}
        />
        <span className="relative z-10 text-xl font-black text-white tracking-tight select-none">
          {initials.slice(0, 2).toUpperCase()}
        </span>
      </div>
      {/* Rank badge overlay */}
      <div className="absolute -bottom-2 -right-2">
        <RankBadge rank={rank as "bronze" | "silver" | "gold" | "platinum" | "diamond" | "legend"} size="xs" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function ProfileHeader({ user, globalRank, accuracy, address }: ProfileHeaderProps) {
  const displayAddress = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : "0x…";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      <div className={cn(
        "relative overflow-hidden rounded-3xl",
        "border border-primary/25",
        "bg-gradient-to-br from-primary/13 via-[#070b22] to-bg",
        "shadow-[0_0_36px_rgba(22,82,240,0.10)]",
        "p-6",
      )}>
        {/* Top edge highlight */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        {/* Ambient glow */}
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-primary opacity-[0.08] blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">

          <div className="flex flex-col sm:flex-row sm:items-start gap-5">

            {/* Monogram avatar */}
            <MonogramAvatar initials={user.initials} rank={user.rank} />

            {/* Identity block */}
            <div className="flex-1 min-w-0 space-y-2">

              {/* Name + rank */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl font-black text-white tracking-tight leading-tight">
                    {user.displayName}
                  </h1>
                  <p className="text-xs text-white/35 font-mono mt-0.5">@{user.username}</p>
                </div>
                <RankBadge rank={user.rank as "bronze" | "silver" | "gold" | "platinum" | "diamond" | "legend"} size="sm" />
              </div>

              {/* Address + network badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <Shield size={11} className="text-white/25 flex-shrink-0" />
                <span className="text-[11px] font-mono text-white/35">{displayAddress}</span>
                <span className={cn(
                  "text-[9px] font-mono px-1.5 py-0.5 rounded-md leading-none",
                  "bg-primary/12 border border-primary/20 text-primary/65",
                )}>
                  Base
                </span>
              </div>

            </div>
          </div>

          {/* Stats separator + row */}
          <div className="border-t border-white/[0.06] pt-3">
            <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
              <div className="flex items-center gap-1">
                <Zap size={10} className="text-primary flex-shrink-0" />
                <span className="text-xs font-mono font-black text-white tabular-nums leading-none">{user.xp.toLocaleString()}</span>
                <span className="text-[10px] font-mono text-white/30 ml-0.5">XP</span>
              </div>
              <span className="text-white/15 text-[10px]">·</span>
              <div className="flex items-center gap-1">
                <Target size={10} className="text-primary/50 flex-shrink-0" />
                <span className="text-xs font-mono text-white/55 tabular-nums leading-none">{accuracy}%</span>
                <span className="text-[10px] font-mono text-white/25 ml-0.5">acc</span>
              </div>
              <span className="text-white/15 text-[10px]">·</span>
              <div className="flex items-center gap-1">
                <Flame size={10} className="text-primary/50 flex-shrink-0" />
                <span className="text-xs font-mono text-white/55 tabular-nums leading-none">{user.streak}</span>
                <span className="text-[10px] font-mono text-white/25 ml-0.5">streak</span>
              </div>
              {globalRank > 0 && (
                <>
                  <span className="text-white/15 text-[10px]">·</span>
                  <div className="flex items-center gap-1">
                    <Shield size={10} className="text-primary/50 flex-shrink-0" />
                    <span className="text-xs font-mono text-white/55 tabular-nums leading-none">#{globalRank}</span>
                    <span className="text-[10px] font-mono text-white/25 ml-0.5">rank</span>
                  </div>
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    </motion.div>
  );
}
