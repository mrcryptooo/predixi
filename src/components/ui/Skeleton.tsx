import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Base skeleton shimmer block
// ─────────────────────────────────────────────────────────────────────────────

interface SkeletonProps {
  className?: string;
  /** Rounds to a full circle — useful for avatars */
  circle?: boolean;
}

export function Skeleton({ className, circle = false }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-elevated relative overflow-hidden",
        circle ? "rounded-full" : "rounded-lg",
        className
      )}
    >
      {/* Shimmer sweep */}
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-built skeleton layouts
// ─────────────────────────────────────────────────────────────────────────────

/** Skeleton for a single match card row */
export function MatchCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface border border-border p-5 space-y-4">
      {/* League label */}
      <Skeleton className="h-4 w-28" />
      {/* Teams row */}
      <div className="flex items-center gap-3">
        <Skeleton circle className="w-10 h-10" />
        <Skeleton className="h-5 flex-1" />
        <Skeleton className="h-7 w-14" />
        <Skeleton className="h-5 flex-1" />
        <Skeleton circle className="w-10 h-10" />
      </div>
      {/* Community bar */}
      <Skeleton className="h-2 w-full" />
      {/* Buttons */}
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 flex-1" />
      </div>
    </div>
  );
}

/** Skeleton for a leaderboard row */
export function LeaderboardRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-surface border border-border">
      <Skeleton className="h-5 w-6" />
      <Skeleton circle className="w-10 h-10" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-3 w-14" />
      </div>
    </div>
  );
}

/** Skeleton for a user profile card */
export function ProfileCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface border border-border p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton circle className="w-16 h-16" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-20" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
      <div className="flex gap-2 flex-wrap">
        <Skeleton className="h-7 w-20 rounded-lg" />
        <Skeleton className="h-7 w-24 rounded-lg" />
        <Skeleton className="h-7 w-16 rounded-lg" />
      </div>
    </div>
  );
}

/** Skeleton for a badge card */
export function BadgeCardSkeleton() {
  return (
    <div className="rounded-xl bg-surface border border-border p-4 flex flex-col items-center gap-2">
      <Skeleton circle className="w-12 h-12" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

/** Generic text line skeletons — pass an array of widths */
interface TextSkeletonProps {
  lines?: string[];
}

export function TextSkeleton({ lines = ["w-full", "w-4/5", "w-2/3"] }: TextSkeletonProps) {
  return (
    <div className="space-y-2">
      {lines.map((w, i) => (
        <Skeleton key={i} className={cn("h-4", w)} />
      ))}
    </div>
  );
}
