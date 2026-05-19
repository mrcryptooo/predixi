import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import type { BadgeRarity, MatchStatus, UserRank } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Generic pill badge
// ─────────────────────────────────────────────────────────────────────────────

type BadgeVariant =
  | "default"
  | "primary"
  | "cyan"
  | "purple"
  | "success"
  | "danger"
  | "warning"
  | "muted";

type BadgeSize = "xs" | "sm" | "md";

interface BadgeProps {
  children:   ReactNode;
  variant?:   BadgeVariant;
  size?:      BadgeSize;
  icon?:      ReactNode;
  className?: string;
  pulse?:     boolean;
}

const badgeVariantClasses: Record<BadgeVariant, string> = {
  default:  "bg-elevated border border-border text-text-secondary",
  primary:  "bg-primary/10 border border-primary/30 text-primary",
  cyan:     "bg-cyan/10 border border-cyan/30 text-cyan",
  purple:   "bg-purple/10 border border-purple/30 text-purple",
  success:  "bg-success/10 border border-success/30 text-success",
  danger:   "bg-danger/10 border border-danger/30 text-danger",
  warning:  "bg-warning/10 border border-warning/30 text-warning",
  muted:    "bg-transparent border border-border/50 text-text-muted",
};

const badgeSizeClasses: Record<BadgeSize, string> = {
  xs: "h-5 px-1.5 text-[10px] gap-1   rounded-md",
  sm: "h-6 px-2   text-xs    gap-1.5  rounded-lg",
  md: "h-7 px-2.5 text-xs    gap-1.5  rounded-lg",
};

const pulseColors: Record<BadgeVariant, string> = {
  default:  "bg-text-secondary",
  primary:  "bg-primary",
  cyan:     "bg-cyan",
  purple:   "bg-purple",
  success:  "bg-success",
  danger:   "bg-danger",
  warning:  "bg-warning",
  muted:    "bg-text-muted",
};

export function Badge({
  children,
  variant   = "default",
  size      = "sm",
  icon,
  className,
  pulse     = false,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center font-mono font-semibold tracking-wide",
        badgeVariantClasses[variant],
        badgeSizeClasses[size],
        className
      )}
    >
      {pulse && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0",
            pulseColors[variant]
          )}
        />
      )}
      {icon && <span className="flex-shrink-0 leading-none">{icon}</span>}
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Match status badge
// ─────────────────────────────────────────────────────────────────────────────

const statusConfig: Record<
  MatchStatus,
  { variant: BadgeVariant; label: string; pulse: boolean }
> = {
  live:      { variant: "danger",  label: "LIVE",      pulse: true  },
  upcoming:  { variant: "primary", label: "UPCOMING",  pulse: false },
  finished:  { variant: "muted",   label: "FT",        pulse: false },
  postponed: { variant: "warning", label: "POSTPONED", pulse: false },
};

interface MatchStatusBadgeProps {
  status:     MatchStatus;
  size?:      BadgeSize;
  className?: string;
}

export function MatchStatusBadge({ status, size = "sm", className }: MatchStatusBadgeProps) {
  const cfg = statusConfig[status];
  return (
    <Badge variant={cfg.variant} size={size} pulse={cfg.pulse} className={className}>
      {cfg.label}
    </Badge>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// User rank badge  — emoji-free, uses a small coloured dot instead
// ─────────────────────────────────────────────────────────────────────────────

// Dot colours keyed to rank — replaces emoji with a clean geometric shape
const rankDotColors: Record<UserRank, string> = {
  bronze:   "bg-[#CD7F32]",
  silver:   "bg-[#A8A9AD]",
  gold:     "bg-[#FFD700]",
  platinum: "bg-[#E5E4E2]",
  diamond:  "bg-cyan",
  legend:   "bg-primary",
};

const rankVariants: Record<UserRank, BadgeVariant> = {
  bronze:   "warning",
  silver:   "default",
  gold:     "warning",
  platinum: "cyan",
  diamond:  "cyan",
  legend:   "purple",
};

interface RankBadgeProps {
  rank:       UserRank;
  size?:      BadgeSize;
  showIcon?:  boolean;
  className?: string;
}

export function RankBadge({ rank, size = "sm", showIcon = true, className }: RankBadgeProps) {
  const dotClass = rankDotColors[rank];
  const variant  = rankVariants[rank];

  const dot = showIcon ? (
    <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", dotClass)} />
  ) : undefined;

  return (
    <Badge
      variant={variant}
      size={size}
      icon={dot}
      className={cn("capitalize", className)}
    >
      {rank}
    </Badge>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Rarity badge — coloured dot replaces emoji circle icons
// ─────────────────────────────────────────────────────────────────────────────

const rarityDotColors: Record<BadgeRarity, string> = {
  common:    "bg-text-secondary",
  rare:      "bg-cyan",
  epic:      "bg-purple",
  legendary: "bg-warning",
};

const rarityVariants: Record<BadgeRarity, BadgeVariant> = {
  common:    "default",
  rare:      "cyan",
  epic:      "purple",
  legendary: "warning",
};

interface RarityBadgeProps {
  rarity:     BadgeRarity;
  size?:      BadgeSize;
  className?: string;
}

export function RarityBadge({ rarity, size = "sm", className }: RarityBadgeProps) {
  const dotClass = rarityDotColors[rarity];
  const variant  = rarityVariants[rarity];

  const dot = (
    <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", dotClass)} />
  );

  return (
    <Badge
      variant={variant}
      size={size}
      icon={dot}
      className={cn("capitalize", className)}
    >
      {rarity}
    </Badge>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// XP badge
// ─────────────────────────────────────────────────────────────────────────────

interface XpBadgeProps {
  xp:         number;
  size?:      BadgeSize;
  className?: string;
}

// ⚡ kept intentionally — it's a universally understood energy/XP metaphor
export function XpBadge({ xp, size = "sm", className }: XpBadgeProps) {
  return (
    <Badge variant="purple" size={size} icon="⚡" className={className}>
      {xp.toLocaleString()} XP
    </Badge>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Streak badge — flame kept intentionally as a sports-standard metaphor
// ─────────────────────────────────────────────────────────────────────────────

interface StreakBadgeProps {
  streak:     number;
  size?:      BadgeSize;
  className?: string;
}

export function StreakBadge({ streak, size = "sm", className }: StreakBadgeProps) {
  const variant: BadgeVariant =
    streak >= 10 ? "danger" : streak >= 5 ? "warning" : "default";

  return (
    <Badge variant={variant} size={size} icon="🔥" className={className}>
      {streak} streak
    </Badge>
  );
}
