import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "success"
  | "outline-primary"
  | "outline-cyan"
  | "outline-purple"
  | "gradient"    // new: blue→cyan brand gradient CTA
  | "brand";      // new: solid primary with strong glow

type ButtonSize = "xs" | "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:   ButtonVariant;
  size?:      ButtonSize;
  children:   ReactNode;
  iconLeft?:  ReactNode;
  iconRight?: ReactNode;
  loading?:   boolean;
  fullWidth?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Variant styles
// ─────────────────────────────────────────────────────────────────────────────

const variantClasses: Record<ButtonVariant, string> = {
  // ── Updated primary — stronger #1652F0 glow ───────────────────────────
  primary:
    "bg-primary text-white hover:bg-[#1248d8] active:scale-[0.98] " +
    "shadow-[0_2px_16px_rgba(22,82,240,0.35)] hover:shadow-[0_2px_24px_rgba(22,82,240,0.45)]",

  // ── New gradient variant — blue→cyan, flagship CTA ────────────────────
  gradient:
    "bg-gradient-to-r from-primary to-cyan text-white " +
    "hover:from-[#1248d8] hover:to-[#00a8df] active:scale-[0.98] " +
    "shadow-[0_2px_20px_rgba(22,82,240,0.30)] hover:shadow-[0_2px_28px_rgba(22,82,240,0.40)]",

  // ── New brand variant — solid primary with stronger identity glow ──────
  brand:
    "bg-primary text-white hover:bg-[#1248d8] active:scale-[0.98] " +
    "shadow-[0_0_24px_rgba(22,82,240,0.40)] hover:shadow-[0_0_32px_rgba(22,82,240,0.55)] " +
    "ring-1 ring-primary/20",

  // ── Existing variants (kept, minor alignment updates) ─────────────────
  secondary:
    "bg-elevated text-text-primary border border-border " +
    "hover:border-primary/50 hover:bg-surface active:scale-[0.98]",
  ghost:
    "bg-transparent text-text-secondary hover:text-text-primary hover:bg-elevated " +
    "active:bg-border active:scale-[0.98]",
  danger:
    "bg-danger/10 text-danger border border-danger/30 " +
    "hover:bg-danger/20 active:scale-[0.98]",
  success:
    "bg-success/10 text-success border border-success/30 " +
    "hover:bg-success/20 active:scale-[0.98]",
  "outline-primary":
    "bg-transparent text-primary border border-primary/50 " +
    "hover:bg-primary/10 active:scale-[0.98]",
  "outline-cyan":
    "bg-transparent text-cyan border border-cyan/50 " +
    "hover:bg-cyan/10 active:scale-[0.98]",
  "outline-purple":
    "bg-transparent text-purple border border-purple/50 " +
    "hover:bg-purple/10 active:scale-[0.98]",
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: "h-7  px-2.5 text-xs  gap-1.5 rounded-lg",
  sm: "h-8  px-3   text-sm  gap-2   rounded-xl",
  md: "h-10 px-4   text-sm  gap-2   rounded-xl",
  lg: "h-12 px-6   text-base gap-2.5 rounded-2xl",
};

// ─────────────────────────────────────────────────────────────────────────────
// Spinner
// ─────────────────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="animate-spin w-4 h-4 flex-shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function Button({
  variant  = "primary",
  size     = "md",
  children,
  iconLeft,
  iconRight,
  loading  = false,
  fullWidth = false,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...rest}
      disabled={isDisabled}
      className={cn(
        "inline-flex items-center justify-center font-semibold tracking-wide",
        "transition-all duration-150 select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full",
        isDisabled && "opacity-50 cursor-not-allowed pointer-events-none",
        className
      )}
    >
      {loading ? (
        <Spinner />
      ) : (
        iconLeft && <span className="flex-shrink-0">{iconLeft}</span>
      )}
      <span>{children}</span>
      {!loading && iconRight && (
        <span className="flex-shrink-0">{iconRight}</span>
      )}
    </button>
  );
}
