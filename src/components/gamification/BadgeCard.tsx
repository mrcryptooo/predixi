"use client";

/**
 * BadgeCard — vertical 2:3 collectible card
 *
 * Layout is structured to accept a real /badges/{id}.webp artwork image in the
 * future.  Until those files exist, a rarity-tinted gradient + emoji fills the
 * artwork area gracefully.
 *
 * Image loading strategy:
 *   1. Gradient placeholder (always rendered as background)
 *   2. Emoji icon (centered on top of gradient — fallback text when no image)
 *   3. <img src="/badges/{id}.webp" /> overlays both when the file exists
 *      → onError: state flag → img removed → emoji + gradient shows through
 *
 * To add a real badge image later: drop /public/badges/{badgeId}.webp
 * and it will auto-appear with no code changes.
 */

import { useState }        from "react";
import { motion }          from "framer-motion";
import { Lock, Sparkles }  from "lucide-react";
import { cn }              from "@/lib/utils";
import { rarityConfig }    from "@/data/badges";
import type { Badge }      from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface BadgeCardProps {
  badge:      Badge;
  earned:     boolean;
  /** ISO timestamp — shown as "Unlocked Jan 1, 2026" on earned cards */
  earnedAt?:  string;
  delay?:     number;
  /**
   * @deprecated No longer used — both earned and locked cards share the same
   * vertical layout. Kept in the interface so existing call sites compile.
   */
  compact?:   boolean;
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "2-digit",
    });
  } catch {
    return "";
  }
}

// Gradient backgrounds for the artwork placeholder area, keyed by rarity.
// These show while /badges/{id}.webp is missing or loading.
const RARITY_ARTWORK_GRADIENT: Record<string, string> = {
  common:    "bg-gradient-to-b from-[#1c2242] via-[#0f1530] to-[#080d1e]",
  rare:      "bg-gradient-to-b from-[#062038] via-[#051428] to-[#030c1a]",
  epic:      "bg-gradient-to-b from-[#1a0838] via-[#110626] to-[#080413]",
  legendary: "bg-gradient-to-b from-[#2e1a02] via-[#1c1002] to-[#0c0701]",
}

// Subtle radial spotlight behind the emoji icon, keyed by rarity.
const RARITY_ICON_GLOW: Record<string, string> = {
  common:    "bg-radial-[at_50%_40%] from-white/[0.08] to-transparent",
  rare:      "bg-radial-[at_50%_40%] from-[#00C2FF]/[0.15] to-transparent",
  epic:      "bg-radial-[at_50%_40%] from-[#8B5CF6]/[0.20] to-transparent",
  legendary: "bg-radial-[at_50%_40%] from-[#F59E0B]/[0.22] to-transparent",
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component — unified vertical collectible card
// ─────────────────────────────────────────────────────────────────────────────

export function BadgeCard({
  badge,
  earned,
  earnedAt,
  delay     = 0,
  className,
}: BadgeCardProps) {
  const [imgErr, setImgErr] = useState(false)

  const cfg         = rarityConfig[badge.rarity] ?? rarityConfig.common
  const artGradient = RARITY_ARTWORK_GRADIENT[badge.rarity] ?? RARITY_ARTWORK_GRADIENT.common
  const iconGlow    = RARITY_ICON_GLOW[badge.rarity] ?? RARITY_ICON_GLOW.common
  const dateLabel   = earnedAt ? fmtDate(earnedAt) : null
  const imageSrc    = `/badges/${badge.id}.webp`

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1,  y: 0,  scale: 1    }}
      transition={{ duration: 0.28, ease: "easeOut", delay }}
      whileHover={earned ? { y: -3, scale: 1.015 } : { scale: 1.005 }}
      className={cn(
        // Card shell — 2:3 vertical aspect ratio
        "relative flex flex-col rounded-2xl border overflow-hidden",
        "aspect-[2/3] w-full min-w-0",
        "transition-shadow duration-200 select-none",
        earned
          ? cn(cfg.cardBg, cfg.border, cfg.cardGlow)
          : "bg-[#0a0d1f] border-white/[0.08]",
        className,
      )}
    >
      {/* ── Top edge highlight line ──────────────────────────────────────── */}
      <div className={cn(
        "absolute top-0 inset-x-0 h-px z-20",
        "bg-gradient-to-r from-transparent to-transparent",
        earned ? cfg.edgeHighlight : "via-white/[0.05]",
      )} />

      {/* ── Artwork area (grows to fill top ~62% of card) ────────────────── */}
      <div className="relative flex-1 overflow-hidden">

        {/* Gradient placeholder — always present as base layer */}
        <div className={cn("absolute inset-0", artGradient)} />

        {/* Radial spotlight behind the emoji */}
        <div className={cn("absolute inset-0", iconGlow)} />

        {/* Subtle diagonal grain texture overlay for depth */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)",
            backgroundSize: "8px 8px",
          }}
        />

        {/* Emoji / icon — shown when no artwork image */}
        <div className={cn(
          "absolute inset-0 flex items-center justify-center pb-4",
          !earned && "opacity-30 grayscale",
        )}>
          <span className="text-4xl sm:text-[2.6rem] drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)] leading-none">
            {badge.icon}
          </span>
        </div>

        {/* Badge artwork image — overlays emoji when file exists */}
        {!imgErr && (
          <img
            src={imageSrc}
            alt={badge.name}
            loading="lazy"
            decoding="async"
            className={cn(
              "absolute inset-0 w-full h-full object-cover",
              !earned && "opacity-40 grayscale saturate-50",
            )}
            onError={() => setImgErr(true)}
          />
        )}

        {/* Rarity pill — top-left */}
        <div className="absolute top-2 left-2 z-10">
          <span className={cn(
            "inline-flex items-center px-1.5 py-0.5 rounded-md",
            "text-[8px] font-mono font-bold uppercase leading-none border",
            earned
              ? cn(cfg.pillBg, cfg.pillText, cfg.pillBorder)
              : "bg-black/40 text-white/25 border-white/[0.10]",
          )}>
            {cap(badge.rarity)}
          </span>
        </div>

        {/* Legendary/epic ambient corner glow — earned only */}
        {earned && (badge.rarity === "legendary" || badge.rarity === "epic") && (
          <div className={cn(
            "absolute -top-8 -right-8 w-28 h-28 rounded-full blur-2xl pointer-events-none",
            badge.rarity === "legendary" ? "bg-[#F59E0B]/25" : "bg-[#8B5CF6]/22",
          )} />
        )}

        {/* Locked overlay — darkens + blurs artwork area */}
        {!earned && (
          <div className="absolute inset-0 bg-black/55 backdrop-blur-[1px] flex items-center justify-center z-10">
            <div className="w-8 h-8 rounded-full bg-black/60 border border-white/[0.12] flex items-center justify-center">
              <Lock size={14} className="text-white/35" />
            </div>
          </div>
        )}

        {/* Bottom fade — artwork bleeds into info strip */}
        <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-[#060810] to-transparent z-10" />
      </div>

      {/* ── Info strip (fixed at bottom) ─────────────────────────────────── */}
      <div className={cn(
        "shrink-0 px-2.5 pt-1.5 pb-2 flex flex-col gap-0.5",
        "bg-[#060810]",
      )}>
        {/* Name */}
        <p className={cn(
          "text-[11px] font-bold leading-snug line-clamp-1",
          earned ? "text-white" : "text-white/30",
        )}>
          {badge.name}
        </p>

        {/* XP line */}
        {earned ? (
          <p className={cn("text-[9px] font-mono font-semibold leading-none", cfg.accent)}>
            +{badge.xpReward.toLocaleString()} XP earned
          </p>
        ) : (
          <p className="text-[8px] font-mono text-white/20 leading-snug line-clamp-1 italic">
            {badge.criteria}
          </p>
        )}

        {/* Earned date + mint pill row */}
        {earned && (
          <div className="flex items-center justify-between gap-1 pt-0.5">
            {dateLabel ? (
              <p className="text-[8px] font-mono text-white/25 leading-none truncate">
                {dateLabel}
              </p>
            ) : (
              <span />
            )}
            <span className={cn(
              "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full shrink-0",
              "border border-white/[0.07] bg-white/[0.03]",
              "text-[7px] font-mono text-white/18 leading-none cursor-default",
            )}>
              <Sparkles size={6} className="text-white/18 shrink-0" />
              Soon
            </span>
          </div>
        )}

        {/* Locked XP teaser */}
        {!earned && badge.xpReward > 0 && (
          <p className="text-[8px] font-mono text-white/15 leading-none">
            +{badge.xpReward.toLocaleString()} XP on unlock
          </p>
        )}
      </div>
    </motion.div>
  );
}
