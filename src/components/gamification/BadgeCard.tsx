"use client";

/**
 * BadgeCard — vertical 2:3 collectible card
 *
 * Layout: image card (aspect-[2/3]) stacked above a text block.
 * All badge text lives BELOW the artwork card, keeping the image clean.
 *
 * Image loading:
 *   /badges/{badge.id}.webp   — auto-loaded; drop file in public/badges/ to activate
 *   onError → imgErr flag → emoji + gradient placeholder shows through
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
  /** ISO timestamp — shown as "Jan 1, 2026" below the card when earned */
  earnedAt?:  string;
  delay?:     number;
  /** @deprecated No-op; kept for backward-compat with existing call sites */
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
  } catch { return ""; }
}

// Gradient for the placeholder area (shown while/if image is missing)
const ARTWORK_GRADIENT: Record<string, string> = {
  common:    "bg-gradient-to-b from-[#1c2242] via-[#0f1530] to-[#080d1e]",
  rare:      "bg-gradient-to-b from-[#062038] via-[#051428] to-[#030c1a]",
  epic:      "bg-gradient-to-b from-[#1a0838] via-[#110626] to-[#080413]",
  legendary: "bg-gradient-to-b from-[#2e1a02] via-[#1c1002] to-[#0c0701]",
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function BadgeCard({
  badge,
  earned,
  earnedAt,
  delay     = 0,
  className,
}: BadgeCardProps) {
  const [imgErr, setImgErr] = useState(false)

  const cfg        = rarityConfig[badge.rarity] ?? rarityConfig.common
  const artBg      = ARTWORK_GRADIENT[badge.rarity] ?? ARTWORK_GRADIENT.common
  const dateLabel  = earnedAt ? fmtDate(earnedAt) : null
  const imageSrc   = `/badges/${badge.id}.webp`

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1,  y: 0,  scale: 1   }}
      transition={{ duration: 0.28, ease: "easeOut", delay }}
      whileHover={earned ? { y: -3 } : { y: -1 }}
      className={cn("flex flex-col gap-2 min-w-0 cursor-default", className)}
    >
      {/* ── Image card — artwork only, no text inside ──────────────────────── */}
      <div className={cn(
        "relative aspect-[2/3] w-full rounded-xl overflow-hidden border",
        "transition-shadow duration-200",
        earned
          ? cn(cfg.border, cfg.cardGlow)
          : "border-white/[0.09]",
      )}>
        {/* Gradient placeholder — base layer, always present */}
        <div className={cn("absolute inset-0", artBg)} />

        {/* Emoji fallback — only when image fails to load */}
        {imgErr && (
          <div className={cn(
            "absolute inset-0 flex items-center justify-center",
            !earned && "opacity-50 grayscale",
          )}>
            <span className="text-5xl leading-none drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
              {badge.icon}
            </span>
          </div>
        )}

        {/* Badge artwork image */}
        {!imgErr && (
          <img
            src={imageSrc}
            alt={badge.name}
            loading="lazy"
            decoding="async"
            className={cn(
              "absolute inset-0 w-full h-full object-cover",
              // Locked: reduced but still visible — desirable, not destroyed
              !earned && "opacity-65 grayscale",
            )}
            onError={() => setImgErr(true)}
          />
        )}

        {/* Epic/legendary ambient glow — earned only, corner decoration */}
        {earned && (badge.rarity === "legendary" || badge.rarity === "epic") && (
          <div className={cn(
            "absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl pointer-events-none opacity-25",
            badge.rarity === "legendary" ? "bg-[#F59E0B]" : "bg-[#8B5CF6]",
          )} />
        )}

        {/* Top edge highlight — earned rarity colour */}
        <div className={cn(
          "absolute top-0 inset-x-0 h-px z-20",
          "bg-gradient-to-r from-transparent to-transparent",
          earned ? cfg.edgeHighlight : "via-white/[0.04]",
        )} />

        {/* Rarity pill — minimal, top-left corner */}
        <div className="absolute top-1.5 left-1.5 z-20">
          <span className={cn(
            "inline-flex px-1.5 py-[3px] rounded-md",
            "text-[7px] font-mono font-bold uppercase leading-none border backdrop-blur-sm",
            earned
              ? cn(cfg.pillBg, cfg.pillText, cfg.pillBorder)
              : "bg-black/45 text-white/22 border-white/[0.08]",
          )}>
            {cap(badge.rarity)}
          </span>
        </div>

        {/* Locked overlay — lighter so artwork remains attractive */}
        {!earned && (
          <div className="absolute inset-0 bg-black/35 flex items-center justify-center z-10">
            <div className="w-7 h-7 rounded-full bg-black/50 border border-white/[0.12] flex items-center justify-center">
              <Lock size={12} className="text-white/35" />
            </div>
          </div>
        )}
      </div>

      {/* ── Text below the card ────────────────────────────────────────────── */}
      <div className="px-0.5 space-y-[3px]">
        {/* Badge name */}
        <p className={cn(
          "text-[11px] font-bold leading-snug line-clamp-1",
          earned ? "text-white/90" : "text-white/38",
        )}>
          {badge.name}
        </p>

        {/* XP line */}
        {earned ? (
          <p className={cn("text-[9px] font-mono font-semibold leading-none", cfg.accent)}>
            +{badge.xpReward.toLocaleString()} XP
          </p>
        ) : (
          <p className="text-[8px] font-mono text-white/22 leading-none">
            +{badge.xpReward.toLocaleString()} XP on unlock
          </p>
        )}

        {/* Earned date */}
        {earned && dateLabel && (
          <p className="text-[8px] font-mono text-white/22 leading-none">
            {dateLabel}
          </p>
        )}

        {/* "Mint on Base · Soon" — earned cards only, passive, non-clickable */}
        {earned && (
          <span className={cn(
            "inline-flex items-center gap-0.5 px-1.5 py-[3px] rounded-full mt-0.5",
            "border border-white/[0.06] bg-white/[0.03]",
            "text-[7px] font-mono text-white/18 leading-none select-none",
          )}>
            <Sparkles size={6} className="text-white/18 shrink-0" />
            Mint on Base · Soon
          </span>
        )}
      </div>
    </motion.div>
  );
}
