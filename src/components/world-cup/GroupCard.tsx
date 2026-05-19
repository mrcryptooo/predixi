"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { WorldCupGroup, WorldCupTeam } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Team row
// ─────────────────────────────────────────────────────────────────────────────

interface TeamRowProps {
  team:        WorldCupTeam;
  position:    number;
  qualifying:  boolean;  // top 2 advance
}

function TeamRow({ team, position, qualifying }: TeamRowProps) {
  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
      qualifying
        ? "bg-success/8 border border-success/15"
        : "bg-transparent border border-transparent"
    )}>
      {/* Position */}
      <span className={cn(
        "w-4 text-[10px] font-mono font-bold flex-shrink-0 text-center",
        qualifying ? "text-success" : "text-text-muted"
      )}>
        {position}
      </span>

      {/* Flag */}
      <span className="text-base leading-none flex-shrink-0">{team.flag}</span>

      {/* Name */}
      <span className={cn(
        "flex-1 text-xs font-semibold truncate",
        qualifying ? "text-text-primary" : "text-text-secondary"
      )}>
        {team.shortCode}
      </span>

      {/* Stats: Pld W D L GD Pts — only shown when tournament data exists */}
      {team.played !== undefined && (
        <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono text-text-muted flex-shrink-0">
          <span className="w-4 text-center">{team.played}</span>
          <span className="w-4 text-center">{team.won}</span>
          <span className="w-4 text-center">{team.drawn}</span>
          <span className="w-4 text-center">{team.lost}</span>
          <span className={cn(
            "w-5 text-center font-bold",
            (team.goalDiff ?? 0) > 0 ? "text-success" : (team.goalDiff ?? 0) < 0 ? "text-danger" : "text-text-muted"
          )}>
            {(team.goalDiff ?? 0) > 0 ? `+${team.goalDiff}` : team.goalDiff}
          </span>
        </div>
      )}

      {/* Points */}
      {team.points !== undefined && (
        <span className={cn(
          "w-6 text-right text-xs font-mono font-black flex-shrink-0",
          qualifying ? "text-success" : "text-text-primary"
        )}>
          {team.points}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface GroupCardProps {
  group: WorldCupGroup;
  delay?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function GroupCard({ group, delay = 0 }: GroupCardProps) {
  // Sort by points DESC then goalDiff DESC (both optional pre-tournament)
  const sorted = [...group.teams].sort((a, b) => {
    const pa = a.points ?? 0, pb = b.points ?? 0;
    const ga = a.goalDiff ?? 0, gb = b.goalDiff ?? 0;
    return pb !== pa ? pb - pa : gb - ga;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: "easeOut", delay }}
      className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-[#0b0f28] to-[#060810] overflow-hidden"
    >
      {/* Group header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07] bg-[#0d1032]/80">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-black text-text-primary uppercase tracking-widest">
            {group.name}
          </span>
        </div>
        {/* Column labels — desktop only */}
        <div className="hidden sm:flex items-center gap-2 text-[9px] font-mono text-text-muted uppercase tracking-wider">
          <span className="w-4 text-center">P</span>
          <span className="w-4 text-center">W</span>
          <span className="w-4 text-center">D</span>
          <span className="w-4 text-center">L</span>
          <span className="w-5 text-center">GD</span>
          <span className="w-6 text-right">Pts</span>
        </div>
      </div>

      {/* Team rows */}
      <div className="p-2 space-y-1">
        {sorted.map((team, i) => (
          <TeamRow
            key={team.shortCode}
            team={team}
            position={i + 1}
            qualifying={i < 2}
          />
        ))}
      </div>

      {/* Advance indicator */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-success opacity-70" />
          <span className="text-[9px] font-mono text-text-muted">Top 2 advance to Round of 32</span>
        </div>
      </div>
    </motion.div>
  );
}
