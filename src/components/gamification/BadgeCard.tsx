"use client";

import { motion }          from "framer-motion";
import { Lock, CheckCircle2, Sparkles } from "lucide-react";
import { cn }              from "@/lib/utils";
import { rarityConfig }    from "@/data/badges";
import type { Badge }      from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface BadgeCardProps {
  badge:      Badge;
  earned:     boolean;
  /** ISO timestamp — shown as "Unlocked Mon D, YYYY" on earned cards */
  earnedAt?:  string;
  delay?:     number;
  compact?:   boolean;
  /** Tailwind classes forwarded to the outermost element */
  className?: string;
}

// Capitalise first letter
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

// Format earnedAt ISO string → "Mar 15, 2026"
function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch {
    return "";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Compact card — used in 2-column locked grid
// ─────────────────────────────────────────────────────────────────────────────

function CompactBadge({ badge, earned, delay, className }: BadgeCardProps) {
  const cfg = rarityConfig[badge.rarity] ?? rarityConfig.common;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: "easeOut", delay }}
      title={`${badge.name} — ${badge.description}\n${earned ? "Earned" : `Unlock: ${badge.criteria}`}`}
      className={cn(
        "relative flex flex-col items-center gap-2 rounded-2xl border p-3 min-w-0",
        "transition-all duration-200",
        earned
          ? cn(cfg.cardBg, cfg.border, cfg.cardGlow, "hover:scale-[1.03]")
          : "bg-gradient-to-b from-[#0c0f27] to-[#07091a] border-white/[0.07]",
        className,
      )}
    >
      {/* Top edge highlight */}
      <div className={cn(
        "absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent to-transparent",
        earned ? cfg.edgeHighlight : "via-white/[0.04]",
      )} />

      {/* Icon */}
      <div className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center text-xl border",
        earned ? cn(cfg.iconBg, cfg.iconBorder) : "bg-white/[0.03] border-white/[0.07]",
        !earned && "opacity-20 grayscale",
      )}>
        {badge.icon}
      </div>

      {/* Name */}
      <span className={cn(
        "text-[9px] font-mono font-bold text-center leading-tight line-clamp-2 w-full",
        earned ? "text-white/80" : "text-white/20",
      )}>
        {badge.name}
      </span>

      {/* XP incentive on locked */}
      {!earned && badge.xpReward > 0 && (
        <span className="text-[8px] font-mono text-white/15 leading-none">
          +{badge.xpReward.toLocaleString()} XP
        </span>
      )}

      {/* Lock / earned indicator */}
      {!earned ? (
        <span className="absolute top-2 right-2 text-white/15">
          <Lock size={8} />
        </span>
      ) : (
        <span className={cn("absolute top-2 right-2", cfg.accent)}>
          <CheckCircle2 size={9} />
        </span>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Full collectible card — used in earned badges list
// ─────────────────────────────────────────────────────────────────────────────

function FullBadge({ badge, earned, earnedAt, delay, className }: BadgeCardProps) {
  const cfg        = rarityConfig[badge.rarity] ?? rarityConfig.common;
  const dateLabel  = earnedAt ? fmtDate(earnedAt) : null;
  const isLegendary = badge.rarity === "legendary";
  const isEpic      = badge.rarity === "epic";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut", delay }}
      whileHover={earned ? { scale: 1.008, y: -1 } : undefined}
      className={cn(
        "relative overflow-hidden flex items-start gap-4 rounded-2xl border p-4",
        "transition-shadow duration-200",
        earned
          ? cn(cfg.cardBg, cfg.border, cfg.cardGlow)
          : "bg-gradient-to-b from-[#0c0f27] to-[#07091a] border-white/[0.07]",
        className,
      )}
    >
      {/* Top-edge highlight */}
      <div className={cn(
        "absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent to-transparent",
        earned ? cfg.edgeHighlight : "via-white/[0.04]",
      )} />

      {/* Legendary / epic ambient glow blob — earned only */}
      {earned && (isLegendary || isEpic) && (
        <div
          className={cn(
            "absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl pointer-events-none opacity-20",
            isLegendary ? "bg-[#F59E0B]" : "bg-[#8B5CF6]",
          )}
        />
      )}

      {/* Icon container */}
      <div className="relative flex-shrink-0">
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center text-2xl border",
          earned
            ? cn(cfg.iconBg, cfg.iconBorder)
            : "bg-white/[0.03] border-white/[0.07]",
          !earned && "opacity-15 grayscale",
        )}>
          {badge.icon}
        </div>

        {/* Lock badge */}
        {!earned && (
          <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#0c0f27] border border-white/[0.12] flex items-center justify-center">
            <Lock size={9} className="text-white/30" />
          </div>
        )}

        {/* Earned checkmark */}
        {earned && (
          <div className={cn(
            "absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center",
            "bg-[#060810] border",
            cfg.iconBorder,
          )}>
            <CheckCircle2 size={10} className={cfg.accent} />
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0 space-y-1">

        {/* Name + rarity row */}
        <div className="flex items-center gap-2 flex-wrap">
          <p className={cn(
            "text-sm font-bold leading-tight",
            earned ? "text-white" : "text-white/30",
          )}>
            {badge.name}
          </p>

          <span className={cn(
            "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md border capitalize leading-none",
            earned
              ? cn(cfg.pillBg, cfg.pillText, cfg.pillBorder)
              : "text-white/18 border-white/[0.07] bg-transparent",
          )}>
            {cap(badge.rarity)}
          </span>
        </div>

        {/* Description */}
        <p className={cn(
          "text-[11px] leading-relaxed",
          earned ? "text-white/55" : "text-white/20",
        )}>
          {badge.description}
        </p>

        {/* Sub-line */}
        {earned ? (
          <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
            <p className={cn("text-[10px] font-mono font-semibold", cfg.accent)}>
              +{badge.xpReward.toLocaleString()} XP earned
            </p>
            {dateLabel && (
              <p className="text-[9px] font-mono text-white/25">
                {dateLabel}
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
            <p className="text-[10px] font-mono text-white/18 italic leading-tight truncate">
              {badge.criteria}
            </p>
            {badge.xpReward > 0 && (
              <p className="text-[9px] font-mono text-white/15 flex-shrink-0">
                +{badge.xpReward.toLocaleString()} XP
              </p>
            )}
          </div>
        )}

        {/* "Mint on Base · Soon" — passive pill, earned cards only, no click logic */}
        {earned && (
          <div className="pt-2">
            <span className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full",
              "border border-white/[0.08] bg-white/[0.03]",
              "text-[8px] font-mono text-white/20 leading-none select-none cursor-default",
            )}>
              <Sparkles size={7} className="text-white/20 flex-shrink-0" />
              Mint on Base · Soon
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

export function BadgeCard({
  badge,
  earned,
  earnedAt,
  delay     = 0,
  compact   = false,
  className,
}: BadgeCardProps) {
  if (compact) {
    return <CompactBadge badge={badge} earned={earned} earnedAt={earnedAt} delay={delay} compact className={className} />;
  }
  return <FullBadge badge={badge} earned={earned} earnedAt={earnedAt} delay={delay} className={className} />;
}
