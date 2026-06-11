"use client";

import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Clock, Zap, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { LeagueLogo } from "@/components/ui/LeagueLogo";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type HistoryResult = "correct" | "incorrect" | "pending";

export interface PredictionHistoryEntry {
  id:               string;
  matchLabel:       string;
  leagueLabel:      string;
  pickLabel:        string;
  result:           HistoryResult;
  xpDelta:          number;
  date:             string;
  leagueLogo?:      string;
  homeCrest?:       string | null;
  awayCrest?:       string | null;
  homeShort?:       string;
  awayShort?:       string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Row
// ─────────────────────────────────────────────────────────────────────────────

interface HistoryRowProps {
  entry: PredictionHistoryEntry;
  delay: number;
}

function HistoryRow({ entry, delay }: HistoryRowProps) {
  const isCorrect   = entry.result === "correct";
  const isIncorrect = entry.result === "incorrect";
  const isPending   = !isCorrect && !isIncorrect;

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, ease: "easeOut", delay }}
      className="flex flex-col border-b border-white/[0.05] last:border-0"
    >
      {/* ── Main prediction row ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 py-3.5">
        {/* Result icon */}
        <div className="flex-shrink-0 w-6 flex justify-center">
          {isCorrect   && <CheckCircle2 size={15} className="text-success/80" />}
          {isIncorrect && <XCircle      size={15} className="text-danger/70"  />}
          {isPending   && <Clock        size={15} className="text-white/25"   />}
        </div>

        {/* Team logos */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <TeamLogo src={entry.homeCrest} name={entry.homeShort ?? "Home"} size="sm" />
          <TeamLogo src={entry.awayCrest} name={entry.awayShort ?? "Away"} size="sm" />
        </div>

        {/* Match + league */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white/80 truncate leading-tight">
            {entry.matchLabel}
          </p>
          <span className="flex items-center gap-1 mt-0.5">
            <LeagueLogo leagueId={entry.leagueLabel} size="xs" />
            <span className="text-[10px] text-white/30 font-mono">{entry.leagueLabel}</span>
          </span>
        </div>

        {/* Pick + XP */}
        <div className="text-right flex-shrink-0">
          <p className={cn(
            "text-xs font-semibold leading-tight",
            isCorrect   ? "text-success/80" :
            isIncorrect ? "text-danger/60"  : "text-white/30"
          )}>
            {entry.pickLabel}
          </p>
          {isCorrect && (
            <div className="flex items-center gap-0.5 justify-end mt-0.5">
              <Zap size={9} className="text-primary" />
              <span className="text-[10px] font-mono text-success/75">+{entry.xpDelta}</span>
            </div>
          )}
          {isIncorrect && (
            <p className="text-[10px] font-mono text-white/20 mt-0.5">+0 XP</p>
          )}
          {isPending && (
            <p className="text-[10px] font-mono text-white/20 mt-0.5">Pending</p>
          )}
        </div>

        {/* Date — desktop only */}
        <div className="text-[10px] text-white/20 font-mono flex-shrink-0 hidden sm:block w-16 text-right">
          {entry.date}
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface PredictionHistoryProps {
  entries: PredictionHistoryEntry[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function PredictionHistory({ entries }: PredictionHistoryProps) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <div className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center",
          "bg-gradient-to-br from-primary/12 to-bg",
          "border border-primary/18"
        )}>
          <CalendarDays size={24} className="text-primary/40" />
        </div>
        <p className="text-sm text-white/30 font-mono">No predictions yet.</p>
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-2xl border border-white/[0.07]",
      "bg-gradient-to-b from-[#0b0f28] to-[#060810]",
      "px-4"
    )}>
      {/* Column headers — desktop only */}
      <div className="hidden sm:flex items-center gap-3 py-2.5 text-[10px] font-mono text-white/20 uppercase tracking-[0.12em] border-b border-white/[0.05]">
        <div className="w-6" />
        <div className="w-5" />
        <div className="flex-1">Match</div>
        <div className="w-24 text-right">Pick</div>
        <div className="w-16 text-right">Date</div>
      </div>

      {entries.map((entry, i) => (
        <HistoryRow
          key={entry.id}
          entry={entry}
          delay={Math.min(i * 0.05, 0.25)}
        />
      ))}
    </div>
  );
}
