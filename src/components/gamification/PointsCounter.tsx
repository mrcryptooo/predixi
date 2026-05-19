"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PointsCounterProps {
  xp: number;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: { number: "text-2xl", label: "text-[10px]" },
  md: { number: "text-4xl", label: "text-xs"     },
  lg: { number: "text-6xl", label: "text-sm"     },
};

export function PointsCounter({
  xp,
  label = "XP",
  size = "md",
  className,
}: PointsCounterProps) {
  const { number, label: labelClass } = sizeClasses[size];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={cn("flex flex-col items-center gap-0.5", className)}
    >
      <span className={cn(
        "font-mono font-black tabular-nums tracking-tight text-gradient-brand leading-none",
        number
      )}>
        {xp.toLocaleString()}
      </span>
      <span className={cn("font-mono font-semibold text-text-muted uppercase tracking-widest", labelClass)}>
        {label}
      </span>
    </motion.div>
  );
}
