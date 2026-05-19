"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Size map — responsive sizing possible via className override
// ─────────────────────────────────────────────────────────────────────────────

const SIZE_CLASS = {
  sm: "w-7 h-7",
  md: "w-10 h-10",
  lg: "w-12 h-12",
} as const;

const ICON_SIZE = {
  sm: 14,
  md: 20,
  lg: 26,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Football placeholder SVG — no text, no initials
// ─────────────────────────────────────────────────────────────────────────────

function FootballPlaceholder({ size }: { size: keyof typeof ICON_SIZE }) {
  const s = ICON_SIZE[size];
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-white/25"
      />
      {/* Pentagon patch pattern */}
      <polygon
        points="12,5 14.5,9 18.5,9 15.8,12.5 17,16.5 12,14 7,16.5 8.2,12.5 5.5,9 9.5,9"
        fill="currentColor"
        className="text-white/12"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TeamLogo
// ─────────────────────────────────────────────────────────────────────────────

interface TeamLogoProps {
  /** Direct URL to team crest/logo (e.g. from football-data.org) */
  src?: string | null;
  /** Team name — used as alt text */
  name: string;
  /** Preset size. Pass className to override dimensions. */
  size?: keyof typeof SIZE_CLASS;
  /** Extra classes — use for responsive sizing override, e.g. "w-12 h-12 sm:w-14 sm:h-14" */
  className?: string;
}

export function TeamLogo({ src, name, size = "md", className }: TeamLogoProps) {
  const [imgError, setImgError] = useState(false);
  const showImg = src && !imgError;

  return (
    <div
      className={cn(
        // Size: className overrides preset
        className ?? SIZE_CLASS[size],
        "rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden",
        "bg-gradient-to-br from-[#0e1740] via-[#0a1030] to-[#060916]",
        "border border-primary/20",
        "shadow-[0_1px_8px_rgba(6,8,16,0.5)]",
      )}
    >
      {showImg ? (
        <img
          src={src}
          alt={name}
          className="w-full h-full object-contain p-[15%]"
          onError={() => setImgError(true)}
        />
      ) : (
        <FootballPlaceholder size={size} />
      )}
    </div>
  );
}
