"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { TeamLogo } from "@/components/ui/TeamLogo";

// ─────────────────────────────────────────────────────────────────────────────
// League → APF standings code
// ─────────────────────────────────────────────────────────────────────────────

const LEAGUE_TO_APF: Record<string, string> = {
  "premier-league":    "PL",
  "la-liga":           "PD",
  "bundesliga":        "BL1",
  "serie-a":           "SA",
  "ligue-1":           "FL1",
  "champions-league":  "CL",
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type StandingEntry = {
  position:    number;
  teamId:      string;
  teamName:    string;
  teamLogo:    string | null;
  played:      number;
  won:         number;
  drawn:       number;
  lost:        number;
  goalsFor:    number;
  goalsAgainst: number;
  goalDiff:    number;
  points:      number;
  form:        string | null;
  description: string | null;
};

interface StandingsContextProps {
  leagueId:     string;
  homeTeamName: string;
  awayTeamName: string;
  homeCrest:    string | null;
  awayCrest:    string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Form string display
// ─────────────────────────────────────────────────────────────────────────────

function FormString({ form }: { form: string | null }) {
  if (!form) return null;
  const chars = form.slice(-5).split("");
  return (
    <div className="flex items-center gap-0.5">
      {chars.map((c, i) => (
        <span
          key={i}
          className={cn(
            "w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[7px] font-black",
            c === "W" ? "bg-success/20 text-success" :
            c === "D" ? "bg-white/[0.08] text-white/40" :
                        "bg-danger/15 text-danger"
          )}
        >
          {c}
        </span>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Row
// ─────────────────────────────────────────────────────────────────────────────

function StandingRow({
  entry,
  highlight,
  delay,
}: {
  entry: StandingEntry;
  highlight: boolean;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22, delay }}
      className={cn(
        "grid items-center gap-2 px-3 py-2 rounded-xl text-[11px]",
        "border transition-colors duration-150",
        highlight
          ? "bg-primary/10 border-primary/25 shadow-[0_0_12px_rgba(22,82,240,0.08)]"
          : "bg-white/[0.02] border-white/[0.05]"
      )}
      style={{ gridTemplateColumns: "1.2rem 1fr 2rem 2rem 2rem 2rem 2rem" }}
    >
      <span className={cn("font-mono font-bold text-center text-[10px]", highlight ? "text-primary" : "text-white/40")}>
        {entry.position}
      </span>
      <div className="flex items-center gap-1.5 min-w-0">
        <TeamLogo src={entry.teamLogo} name={entry.teamName} size="sm" />
        <span className={cn("font-semibold truncate", highlight ? "text-white" : "text-white/65")}>
          {entry.teamName}
        </span>
      </div>
      <span className="text-center font-mono text-white/40">{entry.played}</span>
      <span className="text-center font-mono text-white/40">{entry.won}</span>
      <span className="text-center font-mono text-white/40">{entry.drawn}</span>
      <span className="text-center font-mono text-white/40">{entry.lost}</span>
      <span className={cn("text-center font-mono font-bold", highlight ? "text-primary" : "text-white/65")}>
        {entry.points}
      </span>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public component
// ─────────────────────────────────────────────────────────────────────────────

export function StandingsContext({
  leagueId,
  homeTeamName,
  awayTeamName,
}: StandingsContextProps) {
  const [standings, setStandings] = useState<StandingEntry[] | null>(null);
  const [loading, setLoading] = useState(true);

  const apfCode = LEAGUE_TO_APF[leagueId];

  useEffect(() => {
    if (!apfCode) { setLoading(false); return; }
    fetch(`/api/standings?leagueId=${apfCode}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: { ok: boolean; standings: StandingEntry[] } | null) => {
        if (d?.ok && d.standings) setStandings(d.standings);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apfCode]);

  if (!apfCode) return null;

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[0,1,2,3,4].map(i => (
          <div key={i} className="h-9 rounded-xl bg-white/[0.04]" />
        ))}
      </div>
    );
  }

  if (!standings || standings.length === 0) return null;

  // Find both teams and nearby rows for context
  const homeIdx = standings.findIndex(s => s.teamName.toLowerCase().includes(homeTeamName.toLowerCase().split(" ")[0]));
  const awayIdx = standings.findIndex(s => s.teamName.toLowerCase().includes(awayTeamName.toLowerCase().split(" ")[0]));

  // Determine which rows to show: 2 rows around each team, plus separator if far apart
  const highlights = new Set<number>();
  if (homeIdx >= 0) highlights.add(homeIdx);
  if (awayIdx >= 0) highlights.add(awayIdx);

  const rowsToShow = new Set<number>();
  highlights.forEach(idx => {
    for (let i = Math.max(0, idx - 1); i <= Math.min(standings.length - 1, idx + 1); i++) {
      rowsToShow.add(i);
    }
  });

  const sorted = [...rowsToShow].sort((a, b) => a - b);

  return (
    <div className="space-y-2">
      {/* Column header */}
      <div
        className="grid px-3 text-[9px] font-mono text-white/20 uppercase tracking-[0.12em]"
        style={{ gridTemplateColumns: "1.2rem 1fr 2rem 2rem 2rem 2rem 2rem" }}
      >
        <span className="text-center">#</span>
        <span>Team</span>
        <span className="text-center">P</span>
        <span className="text-center">W</span>
        <span className="text-center">D</span>
        <span className="text-center">L</span>
        <span className="text-center">Pts</span>
      </div>

      {sorted.map((idx, i) => {
        const prev = i > 0 ? sorted[i - 1] : -1;
        const gap = idx - prev > 1 && i > 0;
        return (
          <div key={idx}>
            {gap && (
              <div className="flex items-center justify-center py-0.5">
                <span className="text-[8px] font-mono text-white/15">···</span>
              </div>
            )}
            <StandingRow
              entry={standings[idx]}
              highlight={highlights.has(idx)}
              delay={i * 0.05}
            />
          </div>
        );
      })}
    </div>
  );
}
