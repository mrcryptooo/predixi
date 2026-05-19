"use client";

import { motion } from "framer-motion";
import { MapPin, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorldCupFixture } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const stageLabels: Record<WorldCupFixture["stage"], string> = {
  group: "Group Stage",
  r16:   "Round of 32",
  qf:    "Quarter-Final",
  sf:    "Semi-Final",
  final: "Final",
};

const stageXp: Record<WorldCupFixture["stage"], number> = {
  group: 200,
  r16:   400,
  qf:    800,
  sf:    1500,
  final: 3000,
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day:     "numeric",
    month:   "short",
    hour:    "2-digit",
    minute:  "2-digit",
    timeZone:"UTC",
    hour12:  false,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface WorldCupFixtureCardProps {
  fixture: WorldCupFixture;
  delay?:  number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function WorldCupFixtureCard({ fixture, delay = 0 }: WorldCupFixtureCardProps) {
  const xp    = stageXp[fixture.stage];
  const label = stageLabels[fixture.stage];
  const groupTag = fixture.group ? ` · Grp ${fixture.group}` : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut", delay }}
      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.07] bg-gradient-to-b from-[#0b0f2a] to-[#060810] hover:border-white/[0.14] transition-colors"
    >
      {/* Stage XP badge */}
      <div className="hidden sm:flex flex-col items-center gap-0.5 flex-shrink-0 w-14">
        <span className="text-[8px] font-mono text-text-muted uppercase tracking-wide">
          {label}{groupTag}
        </span>
        <div className="flex items-center gap-0.5">
          <Zap size={9} className="text-primary" />
          <span className="text-[10px] font-mono font-bold text-primary">+{xp}</span>
        </div>
      </div>

      {/* Home team */}
      <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
        <p className="text-xs font-bold text-text-primary truncate">{fixture.homeTeam}</p>
        <span className="text-base leading-none flex-shrink-0">{fixture.homeFlag}</span>
      </div>

      {/* VS separator + community */}
      <div className="flex flex-col items-center gap-1 flex-shrink-0 w-20">
        <span className="text-[9px] font-mono font-bold text-text-muted">VS</span>
        {/* Mini prediction bar — widths driven by Framer Motion animate, no inline style */}
        <div className="flex h-1.5 w-full rounded-full overflow-hidden gap-px">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${fixture.community.home}%` }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
          />
          <motion.div
            className="h-full bg-[#4A4D65] rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${fixture.community.draw}%` }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.15 }}
          />
          <motion.div
            className="h-full bg-danger rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${fixture.community.away}%` }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
          />
        </div>
        <div className="flex justify-between w-full text-[8px] font-mono text-text-muted">
          <span>{fixture.community.home}%</span>
          <span>{fixture.community.away}%</span>
        </div>
      </div>

      {/* Away team */}
      <div className="flex items-center gap-1.5 flex-1 justify-start min-w-0">
        <span className="text-base leading-none flex-shrink-0">{fixture.awayFlag}</span>
        <p className="text-xs font-bold text-text-primary truncate">{fixture.awayTeam}</p>
      </div>

      {/* Date + venue */}
      <div className="text-right flex-shrink-0 hidden sm:block min-w-0 max-w-[120px]">
        <p className="text-[10px] font-mono text-text-muted truncate">{formatDate(fixture.date)}</p>
        <div className="flex items-center gap-0.5 justify-end mt-0.5">
          <MapPin size={8} className="text-text-muted flex-shrink-0" />
          <p className="text-[9px] font-mono text-text-muted truncate">{fixture.city}</p>
        </div>
      </div>
    </motion.div>
  );
}
