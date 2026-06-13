"use client";

import { motion } from "framer-motion";
import {
  Zap, Target, Flame, Trophy, TrendingUp,
  CalendarDays, BarChart3, Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Stat tile — unified blue/white glass, no rainbow accents
// ─────────────────────────────────────────────────────────────────────────────

interface StatTileProps {
  icon:  React.ReactNode;
  label: string;
  value: string;
  sub?:  string;
  delay: number;
}

function StatTile({ icon, label, value, sub, delay }: StatTileProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.30, ease: "easeOut", delay }}
      className={cn(
        "flex flex-col gap-1 p-1.5 rounded-lg",
        "bg-gradient-to-b from-[#0d1030] to-[#07091a]",
        "border border-primary/15"
      )}
    >
      <div className="w-4 h-4 rounded bg-primary/15 border border-primary/20 flex items-center justify-center flex-shrink-0">
        <span className="text-primary">{icon}</span>
      </div>
      <p className="font-mono font-black text-[11px] tabular-nums text-white leading-none">{value}</p>
      <p className="text-[9px] text-white/40 font-medium leading-tight">{label}</p>
      {sub && <p className="hidden sm:block text-[8px] font-mono text-white/25 leading-tight">{sub}</p>}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface StatsBarProps {
  totalPredictions:   number;
  correctPredictions: number;
  accuracy:           number;
  xp:                 number;
  weeklyXp:           number;
  streak:             number;
  globalRank:         number;
  joinedAt:           string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function StatsBar({
  totalPredictions,
  correctPredictions,
  accuracy,
  xp,
  weeklyXp,
  streak,
  globalRank,
  joinedAt,
}: StatsBarProps) {
  const season      = new Date(joinedAt).getFullYear().toString();
  const streakLabel = streak >= 10 ? "Legendary run" : streak >= 5 ? "Hot streak" : "Keep going";

  const tiles: (StatTileProps)[] = [
    {
      icon:  <CalendarDays size={11} />,
      label: "Total Predictions",
      value: totalPredictions.toLocaleString(),
      sub:   `${correctPredictions} correct`,
      delay: 0.04,
    },
    {
      icon:  <Target size={11} />,
      label: "Accuracy",
      value: `${accuracy}%`,
      sub:   "Correct rate",
      delay: 0.08,
    },
    {
      icon:  <Zap size={11} />,
      label: "Total XP",
      value: xp.toLocaleString(),
      sub:   "All-time",
      delay: 0.12,
    },
    {
      icon:  <TrendingUp size={11} />,
      label: "Weekly XP",
      value: weeklyXp.toLocaleString(),
      sub:   "This week",
      delay: 0.16,
    },
    {
      icon:  <Flame size={11} />,
      label: "Win Streak",
      value: streak.toString(),
      sub:   streakLabel,
      delay: 0.20,
    },
    {
      icon:  <BarChart3 size={11} />,
      label: "Best Streak",
      value: streak >= 11 ? `${streak}` : "11",
      sub:   "Personal best",
      delay: 0.24,
    },
    {
      icon:  <Trophy size={11} />,
      label: "Global Rank",
      value: globalRank > 0 ? `#${globalRank}` : '—',
      sub:   "PrediXI board",
      delay: 0.28,
    },
    {
      icon:  <Globe size={11} />,
      label: "Member Since",
      value: season,
      sub:   "Season 1",
      delay: 0.32,
    },
  ];

  return (
    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
      {tiles.map((tile) => (
        <StatTile key={tile.label} {...tile} />
      ))}
    </div>
  );
}
