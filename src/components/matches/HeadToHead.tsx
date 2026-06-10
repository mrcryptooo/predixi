"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { TeamLogo } from "@/components/ui/TeamLogo";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type H2HMatch = {
  matchId:   string;
  date:      string | null;
  homeTeam:  string | null;
  homeShort: string | null;
  awayTeam:  string | null;
  awayShort: string | null;
  homeCrest: string | null;
  awayCrest: string | null;
  homeScore: number | null;
  awayScore: number | null;
  outcome:   "H" | "D" | "A" | null;
};

export type H2HData = {
  total:        number;
  homeWins:     number;
  draws:        number;
  awayWins:     number;
  homeTeamName: string;
  awayTeamName: string;
  recent:       H2HMatch[];
};

interface HeadToHeadProps {
  data: H2HData;
  homeTeamName: string;
  awayTeamName: string;
  homeCrest:    string | null;
  awayCrest:    string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function HeadToHead({ data, homeTeamName, awayTeamName, homeCrest, awayCrest }: HeadToHeadProps) {
  const { total, homeWins, draws, awayWins, recent } = data;

  // ── Empty state ───────────────────────────────────────────────────────────
  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <span className="text-2xl">🆚</span>
        <p className="text-sm font-semibold text-white/40">No previous meetings</p>
        <p className="text-[11px] text-white/20 font-mono">This could be their first encounter in our records</p>
      </div>
    );
  }

  const homePct  = total > 0 ? Math.round((homeWins / total) * 100) : 0;
  const drawPct  = total > 0 ? Math.round((draws    / total) * 100) : 0;
  const awayPct  = 100 - homePct - drawPct;

  return (
    <div className="space-y-4">

      {/* ── Stats bar ────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-2">
            <TeamLogo src={homeCrest} name={homeTeamName} size="sm" />
            <span className="text-white/80">{homeWins}W</span>
          </div>
          <span className="text-white/35 font-mono text-[11px]">{draws} Draw{draws !== 1 ? "s" : ""}</span>
          <div className="flex items-center gap-2">
            <span className="text-white/80">{awayWins}W</span>
            <TeamLogo src={awayCrest} name={awayTeamName} size="sm" />
          </div>
        </div>

        {/* Bar */}
        <div className="h-2 rounded-full overflow-hidden flex gap-px bg-white/[0.04]">
          {homePct > 0 && (
            <motion.div
              className="h-full bg-primary rounded-l-full"
              initial={{ width: 0 }}
              animate={{ width: `${homePct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          )}
          {drawPct > 0 && (
            <motion.div
              className="h-full bg-white/25"
              initial={{ width: 0 }}
              animate={{ width: `${drawPct}%` }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
            />
          )}
          {awayPct > 0 && (
            <motion.div
              className="h-full bg-danger rounded-r-full"
              initial={{ width: 0 }}
              animate={{ width: `${awayPct}%` }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
            />
          )}
        </div>

        <div className="flex items-center justify-between text-[9px] font-mono text-white/25">
          <span>{homePct}%</span>
          <span>{drawPct}%</span>
          <span>{awayPct}%</span>
        </div>
      </div>

      {/* ── Recent meetings ───────────────────────────────────────────────── */}
      {recent.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[9px] font-mono text-white/20 uppercase tracking-[0.14em]">Recent Meetings</p>
          {recent.slice(0, 5).map((m, i) => {
            const isFirstTeamHome = m.homeTeam === homeTeamName || m.homeShort === data.homeTeamName;
            const outcome = m.outcome;
            let outcomeLabel = "D";
            let outcomeColor = "text-white/40";
            if (outcome === "H") {
              if (isFirstTeamHome) { outcomeLabel = "W"; outcomeColor = "text-success"; }
              else                 { outcomeLabel = "L"; outcomeColor = "text-danger"; }
            } else if (outcome === "A") {
              if (!isFirstTeamHome) { outcomeLabel = "W"; outcomeColor = "text-success"; }
              else                   { outcomeLabel = "L"; outcomeColor = "text-danger"; }
            }

            return (
              <motion.div
                key={m.matchId ?? i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.22, delay: i * 0.04 }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]"
              >
                {/* Outcome */}
                <span className={cn("text-[10px] font-black w-4 flex-shrink-0", outcomeColor)}>
                  {outcomeLabel}
                </span>

                {/* Home team */}
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <TeamLogo src={m.homeCrest} name={m.homeShort ?? m.homeTeam ?? "?"} size="sm" />
                  <span className="text-[11px] font-semibold text-white/70 truncate">
                    {m.homeShort ?? m.homeTeam}
                  </span>
                </div>

                {/* Score */}
                <span className="text-[11px] font-mono font-black text-white/60 flex-shrink-0 tabular-nums">
                  {m.homeScore != null ? `${m.homeScore}–${m.awayScore}` : "vs"}
                </span>

                {/* Away team */}
                <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                  <span className="text-[11px] font-semibold text-white/70 truncate text-right">
                    {m.awayShort ?? m.awayTeam}
                  </span>
                  <TeamLogo src={m.awayCrest} name={m.awayShort ?? m.awayTeam ?? "?"} size="sm" />
                </div>

                {/* Date */}
                {m.date && (
                  <span className="text-[9px] font-mono text-white/20 flex-shrink-0 w-12 text-right">
                    {m.date.slice(2)}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
