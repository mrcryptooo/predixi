"use client";

import { motion } from "framer-motion";
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

export function ProfileHeader({ user }: ProfileHeaderProps) {
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
        "py-6 px-6",
      )}>
        {/* Top edge highlight */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        {/* Ambient glow */}
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-primary opacity-[0.08] blur-3xl pointer-events-none" />

        <div className="relative z-10 flex justify-center">
          <MonogramAvatar initials={user.initials} rank={user.rank} />
        </div>
      </div>
    </motion.div>
  );
}
