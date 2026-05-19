"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StreakBannerProps {
  streak: number;
  className?: string;
}

export function StreakBanner({ streak, className }: StreakBannerProps) {
  if (streak === 0) return null;

  const isHot   = streak >= 10;
  const isWarm  = streak >= 5;

  const label  = isHot  ? "Legendary Run 👑" : isWarm ? "Hot Streak 🔥🔥" : "On Fire 🔥";
  const sublbl = isHot
    ? "You're on an elite prediction run"
    : isWarm
    ? "Your predictions are on point"
    : "Keep the streak alive!";

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn(
        "relative overflow-hidden rounded-2xl border px-5 py-4 flex items-center gap-4",
        isHot
          ? "bg-purple/10 border-purple/30"
          : isWarm
          ? "bg-warning/10 border-warning/30"
          : "bg-primary/10 border-primary/20",
        className
      )}
    >
      {/* Glow blob */}
      <div
        className={cn(
          "absolute -right-6 -top-6 w-28 h-28 rounded-full opacity-20 blur-2xl",
          isHot ? "bg-purple" : isWarm ? "bg-warning" : "bg-primary"
        )}
      />

      {/* Streak number */}
      <div className={cn(
        "flex-shrink-0 w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-mono font-black",
        isHot
          ? "bg-purple/20 text-purple"
          : isWarm
          ? "bg-warning/20 text-warning"
          : "bg-primary/20 text-primary"
      )}>
        <span className="text-2xl leading-none">{streak}</span>
        <span className="text-[9px] tracking-widest mt-0.5 opacity-70">STREAK</span>
      </div>

      {/* Text */}
      <div className="relative z-10 min-w-0">
        <p className={cn(
          "font-bold text-sm",
          isHot ? "text-purple" : isWarm ? "text-warning" : "text-primary"
        )}>
          {label}
        </p>
        <p className="text-xs text-text-secondary mt-0.5">{sublbl}</p>
      </div>
    </motion.div>
  );
}
