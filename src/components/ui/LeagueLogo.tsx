"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Central registry — keyed by both internal IDs and API codes
// src: optional future path (e.g. /brand/leagues/pl.svg) — set to replace emoji
// ─────────────────────────────────────────────────────────────────────────────

type LeagueInfo = {
  name:  string;
  short: string;
  emoji: string;
  color: string; // hex, used as tinted background
  src?:  string; // future local asset
};

const REGISTRY: Record<string, LeagueInfo> = {
  // ── internal IDs ──────────────────────────────────────────────────────────
  "premier-league":   { name: "Premier League",   short: "PL",  emoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", color: "#3d195b", src: "/brand/leagues/pl.svg"  },
  "la-liga":          { name: "La Liga",          short: "PD",  emoji: "🇪🇸",       color: "#c8102e", src: "/brand/leagues/pd.svg"  },
  "bundesliga":       { name: "Bundesliga",       short: "BL1", emoji: "🇩🇪",       color: "#d4001f", src: "/brand/leagues/bl1.svg" },
  "serie-a":          { name: "Serie A",          short: "SA",  emoji: "🇮🇹",       color: "#1c3f94", src: "/brand/leagues/sa.svg"  },
  "ligue-1":          { name: "Ligue 1",          short: "FL1", emoji: "🇫🇷",       color: "#0d1b6e", src: "/brand/leagues/fl1.svg" },
  "champions-league": { name: "Champions League", short: "UCL", emoji: "⭐",         color: "#091a4a", src: "/brand/leagues/ucl.svg" },
  "world-cup-2026":   { name: "World Cup 2026",   short: "WC",  emoji: "🏆",         color: "#8a6000", src: "/brand/leagues/wc.svg"  },
  // ── API codes (mirror internal entries) ───────────────────────────────────
  "PL":  { name: "Premier League",   short: "PL",  emoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", color: "#3d195b", src: "/brand/leagues/pl.svg"  },
  "PD":  { name: "La Liga",          short: "PD",  emoji: "🇪🇸",       color: "#c8102e", src: "/brand/leagues/pd.svg"  },
  "BL1": { name: "Bundesliga",       short: "BL1", emoji: "🇩🇪",       color: "#d4001f", src: "/brand/leagues/bl1.svg" },
  "SA":  { name: "Serie A",          short: "SA",  emoji: "🇮🇹",       color: "#1c3f94", src: "/brand/leagues/sa.svg"  },
  "FL1": { name: "Ligue 1",          short: "FL1", emoji: "🇫🇷",       color: "#0d1b6e", src: "/brand/leagues/fl1.svg" },
  "WC":  { name: "World Cup 2026",   short: "WC",  emoji: "🏆",         color: "#8a6000", src: "/brand/leagues/wc.svg"  },
  "UCL": { name: "Champions League", short: "UCL", emoji: "⭐",         color: "#091a4a", src: "/brand/leagues/ucl.svg" },
  "CL":  { name: "Champions League", short: "UCL", emoji: "⭐",         color: "#091a4a", src: "/brand/leagues/ucl.svg" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Sizes
// ─────────────────────────────────────────────────────────────────────────────

export type LeagueLogoSize = "xs" | "sm" | "md" | "lg";

const SIZES: Record<LeagueLogoSize, { box: string; emoji: string; label: string }> = {
  xs: { box: "w-4 h-4",   emoji: "text-[9px]",  label: "text-[9px]"  },
  sm: { box: "w-5 h-5",   emoji: "text-[10px]", label: "text-[10px]" },
  md: { box: "w-7 h-7",   emoji: "text-xs",     label: "text-[11px]" },
  lg: { box: "w-9 h-9",   emoji: "text-sm",     label: "text-xs"     },
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface LeagueLogoProps {
  leagueId:  string;
  size?:     LeagueLogoSize;
  showName?: boolean;   // show short code label beside the circle
  className?: string;
}

export function LeagueLogo({ leagueId, size = "sm", showName = false, className }: LeagueLogoProps) {
  const [imgError, setImgError] = useState(false);
  const info = REGISTRY[leagueId];
  const s    = SIZES[size];

  const emoji = info?.emoji ?? "⚽";
  const color = info?.color ?? "#1a1f3a";
  const label = info?.short ?? leagueId;
  const src   = info?.src;

  return (
    <span className={cn("inline-flex items-center gap-1 flex-shrink-0", className)}>
      {/* Circle badge */}
      <span
        className={cn(
          s.box,
          "rounded-full border border-white/[0.12] flex items-center justify-center flex-shrink-0 overflow-hidden",
        )}
        style={{ background: `${color}30` }}
      >
        {src && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={label}
            className="w-full h-full object-contain p-[1px]"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className={cn(s.emoji, "leading-none select-none")}>{emoji}</span>
        )}
      </span>

      {/* Optional text label */}
      {showName && (
        <span className={cn("font-mono font-semibold text-white/45 leading-none", s.label)}>
          {label}
        </span>
      )}
    </span>
  );
}
