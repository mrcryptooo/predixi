"use client";

import { motion } from "framer-motion";
import { Lock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { rarityConfig } from "@/data/badges";
import type { Badge } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface BadgeCardProps {
  badge:    Badge;
  earned:   boolean;
  delay?:   number;
  compact?: boolean;
}

// Capitalise first letter
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ─────────────────────────────────────────────────────────────────────────────
// Compact shelf mode
// ─────────────────────────────────────────────────────────────────────────────

function CompactBadge({ badge, earned, delay }: BadgeCardProps) {
  const cfg = rarityConfig[badge.rarity] ?? rarityConfig.common;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.28, ease: "easeOut", delay }}
      title={`${badge.name} — ${badge.description}`}
      className={cn(
        "relative flex flex-col items-center gap-2 rounded-2xl border p-3 w-[84px] flex-shrink-0",
        "transition-all duration-200",
        earned
          ? cn(cfg.cardBg, cfg.border, cfg.cardGlow, "hover:scale-105")
          : "bg-gradient-to-b from-[#0b0e26] to-[#07091a] border-white/[0.07]"
      )}
    >
      {/* Top edge highlight for earned */}
      {earned && (
        <div className={cn("absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent to-transparent", cfg.edgeHighlight)} />
      )}

      {/* Icon */}
      <div className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center text-xl border",
        earned ? cn(cfg.iconBg, cfg.iconBorder) : "bg-white/[0.04] border-white/[0.07]",
        !earned && "opacity-25 grayscale"
      )}>
        {badge.icon}
      </div>

      {/* Name */}
      <span className={cn(
        "text-[9px] font-mono font-bold text-center leading-tight line-clamp-2 w-full",
        earned ? "text-white/75" : "text-white/25"
      )}>
        {badge.name}
      </span>

      {/* Lock overlay */}
      {!earned && (
        <span className="absolute top-2 right-2 text-white/20">
          <Lock size={8} />
        </span>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Full list mode
// ─────────────────────────────────────────────────────────────────────────────

function FullBadge({ badge, earned, delay }: BadgeCardProps) {
  const cfg = rarityConfig[badge.rarity] ?? rarityConfig.common;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.30, ease: "easeOut", delay }}
      whileHover={earned ? { scale: 1.012, y: -2 } : undefined}
      className={cn(
        "relative overflow-hidden flex items-start gap-4 rounded-2xl border p-4",
        "transition-shadow duration-200",
        earned
          ? cn(cfg.cardBg, cfg.border, cfg.cardGlow)
          : "bg-gradient-to-b from-[#0b0e26] to-[#07091a] border-white/[0.07]"
      )}
    >
      {/* Top-edge highlight */}
      <div className={cn(
        "absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent to-transparent",
        earned ? cfg.edgeHighlight : "via-white/[0.04]"
      )} />

      {/* Icon container */}
      <div className="relative flex-shrink-0">
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center text-2xl border",
          earned
            ? cn(cfg.iconBg, cfg.iconBorder)
            : "bg-white/[0.04] border-white/[0.08]",
          !earned && "opacity-20 grayscale"
        )}>
          {badge.icon}
        </div>
        {/* Lock badge on icon */}
        {!earned && (
          <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#0b0e26] border border-white/[0.12] flex items-center justify-center">
            <Lock size={9} className="text-white/30" />
          </div>
        )}
        {/* Earned checkmark */}
        {earned && (
          <div className={cn(
            "absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center",
            "bg-[#0b0e26] border",
            cfg.iconBorder
          )}>
            <CheckCircle2 size={10} className={cfg.accent} />
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0 space-y-1">

        {/* Name row */}
        <div className="flex items-center gap-2 flex-wrap">
          <p className={cn(
            "text-sm font-bold leading-tight",
            earned ? "text-white" : "text-white/35"
          )}>
            {badge.name}
          </p>

          {/* Rarity pill */}
          <span className={cn(
            "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md border capitalize leading-none",
            earned
              ? cn(cfg.pillBg, cfg.pillText, cfg.pillBorder)
              : "text-white/20 border-white/[0.08] bg-transparent"
          )}>
            {cap(badge.rarity)}
          </span>
        </div>

        {/* Description */}
        <p className={cn(
          "text-[11px] leading-relaxed",
          earned ? "text-white/55" : "text-white/22"
        )}>
          {badge.description}
        </p>

        {/* Sub-line */}
        {earned ? (
          <p className={cn("text-[10px] font-mono font-semibold", cfg.accent)}>
            +{badge.xpReward.toLocaleString()} XP
          </p>
        ) : (
          <p className="text-[10px] font-mono text-white/18 italic leading-tight">
            {badge.criteria}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

export function BadgeCard({ badge, earned, delay = 0, compact = false }: BadgeCardProps) {
  if (compact) return <CompactBadge badge={badge} earned={earned} delay={delay} compact />;
  return <FullBadge badge={badge} earned={earned} delay={delay} />;
}
