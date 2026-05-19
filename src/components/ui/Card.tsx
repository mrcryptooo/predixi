import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type CardVariant =
  | "default"
  | "elevated"
  | "ghost"
  | "glow-primary"
  | "glow-cyan"
  | "glow-purple"
  | "glass"
  | "glassGlow"
  | "brand"
  | "premium";

interface CardProps {
  children:   ReactNode;
  variant?:   CardVariant;
  className?: string;
  /** Removes all padding — useful when you want full-bleed content inside */
  noPadding?: boolean;
  /** Make the card a clickable element */
  onClick?:   () => void;
}

interface CardHeaderProps  { children: ReactNode; className?: string }
interface CardBodyProps    { children: ReactNode; className?: string }
interface CardFooterProps  { children: ReactNode; className?: string }

// ─────────────────────────────────────────────────────────────────────────────
// Variant classes
// ─────────────────────────────────────────────────────────────────────────────

const variantClasses: Record<CardVariant, string> = {
  // ── Existing variants (preserved, values updated to blue-tinted palette) ──
  default:
    "bg-surface border border-border",
  elevated:
    "bg-elevated border border-border",
  ghost:
    "bg-transparent border border-border/50",
  "glow-primary":
    "bg-surface border border-primary/30 shadow-[0_0_24px_rgba(22,82,240,0.10)]",
  "glow-cyan":
    "bg-surface border border-cyan/30 shadow-[0_0_20px_rgba(0,194,255,0.08)]",
  "glow-purple":
    "bg-surface border border-purple/30 shadow-[0_0_20px_rgba(124,58,237,0.08)]",

  // ── New variants ──────────────────────────────────────────────────────────

  // Blue-tinted dark glass surface — no blur, good for content cards
  glass:
    "glass-card",

  // Glass with primary glow — for featured/active cards
  glassGlow:
    "glass-card-glow",

  // Strong PrediXI brand identity card — blue gradient left edge + subtle glow
  brand:
    "bg-gradient-to-br from-primary/12 via-surface to-bg border border-primary/30 shadow-[0_0_32px_rgba(22,82,240,0.12)] ring-1 ring-primary/10",

  // Premium surface — deepest glass with white highlight on top edge
  premium:
    "bg-gradient-to-b from-elevated to-surface border border-border-bright shadow-[0_0_24px_rgba(22,82,240,0.08),inset_0_1px_0_rgba(255,255,255,0.05)]",
};

// ─────────────────────────────────────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────────────────────────────────────

export function Card({
  children,
  variant = "default",
  className,
  noPadding = false,
  onClick,
}: CardProps) {
  const base = cn(
    "rounded-2xl transition-colors",
    variantClasses[variant],
    !noPadding && "p-5",
    onClick && "cursor-pointer hover:border-primary/50",
    className
  );

  if (onClick) {
    return (
      <button type="button" className={base} onClick={onClick}>
        {children}
      </button>
    );
  }

  return <div className={base}>{children}</div>;
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div className={cn("flex items-center gap-3 mb-4", className)}>
      {children}
    </div>
  );
}

export function CardBody({ children, className }: CardBodyProps) {
  return <div className={cn("", className)}>{children}</div>;
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div className={cn("mt-4 pt-4 border-t border-border flex items-center gap-3", className)}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section accent bar
// ─────────────────────────────────────────────────────────────────────────────

interface AccentBarProps {
  color?: "primary" | "cyan" | "purple" | "success" | "warning" | "danger";
}

const accentBarColors: Record<NonNullable<AccentBarProps["color"]>, string> = {
  primary: "bg-primary",
  cyan:    "bg-cyan",
  purple:  "bg-purple",
  success: "bg-success",
  warning: "bg-warning",
  danger:  "bg-danger",
};

export function AccentBar({ color = "primary" }: AccentBarProps) {
  return (
    <span className={cn(
      "w-1 h-5 rounded-full flex-shrink-0",
      accentBarColors[color]
    )} />
  );
}
