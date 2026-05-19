"use client";

import { motion } from "framer-motion";
import { Flame, Zap, Shield, Target } from "lucide-react";
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
// Inline stat pill
// ─────────────────────────────────────────────────────────────────────────────

function StatPill({
  icon,
  value,
  label,
}: {
  icon:  React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/[0.08]">
      <span className="text-primary flex-shrink-0">{icon}</span>
      <span className="text-xs font-mono font-black text-white tabular-nums">{value}</span>
      <span className="text-[10px] font-mono text-white/35 uppercase tracking-wide">{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function ProfileHeader({ user, globalRank, accuracy, address }: ProfileHeaderProps) {
  const displayAddress = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : "0x71C7…3fA9";

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
        "p-6"
      )}>
        {/* Top edge highlight */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        {/* Ambient glow */}
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-primary opacity-[0.08] blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-start gap-5">

          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className={cn(
              "w-20 h-20 rounded-2xl flex items-center justify-center text-4xl shadow-lg",
              "bg-gradient-to-br from-primary to-[#4d7ef7]",
              "border border-primary/30"
            )}>
              {user.avatar}
            </div>
            <div className="absolute -bottom-2 -right-2">
              <RankBadge rank={user.rank} size="xs" />
            </div>
          </div>

          {/* Identity block */}
          <div className="flex-1 min-w-0 space-y-3">

            {/* Name + flag */}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black text-white tracking-tight">{user.displayName}</h1>
                <span className="text-xl">{user.countryFlag}</span>
              </div>
              <p className="text-xs text-white/35 font-mono mt-0.5">@{user.username}</p>
            </div>

            {/* Mock address badge */}
            <div className="flex items-center gap-2">
              <Shield size={11} className="text-white/25 flex-shrink-0" />
              <span className="text-[11px] font-mono text-white/30">{displayAddress}</span>
              <span className={cn(
                "text-[9px] font-mono px-1.5 py-0.5 rounded-md leading-none",
                "bg-primary/12 border border-primary/20 text-primary/70"
              )}>
                Base Account · Coming Later
              </span>
            </div>

            {/* Stat pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <StatPill icon={<Zap size={11} />}    value={user.xp.toLocaleString()} label="XP"       />
              <StatPill icon={<Flame size={11} />}  value={`${user.streak}`}         label="Streak"   />
              <StatPill icon={<Target size={11} />} value={`${accuracy}%`}           label="Acc"      />
              <StatPill icon={<Shield size={11} />} value={`#${globalRank}`}         label="Rank"     />
            </div>

          </div>
        </div>
      </div>
    </motion.div>
  );
}
