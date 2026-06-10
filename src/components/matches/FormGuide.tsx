"use client";

import { cn } from "@/lib/utils";
import { TeamLogo } from "@/components/ui/TeamLogo";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type FormResult = {
  matchId:       string;
  result:        "W" | "D" | "L" | null;
  score:         string | null;
  opponent:      string | null;
  opponentShort: string | null;
  opponentCrest: string | null;
  isHome:        boolean;
  date:          string | null;
};

export type TeamFormData = {
  teamName: string;
  crest:    string | null;
  results:  FormResult[];
};

interface FormGuideProps {
  home: TeamFormData;
  away: TeamFormData;
}

// ─────────────────────────────────────────────────────────────────────────────
// Result badge
// ─────────────────────────────────────────────────────────────────────────────

function ResultBadge({ result }: { result: "W" | "D" | "L" | null }) {
  if (!result) {
    return (
      <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold bg-white/[0.06] text-white/20 flex-shrink-0">
        ?
      </span>
    );
  }
  return (
    <span className={cn(
      "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0",
      result === "W" ? "bg-success/20 text-success border border-success/30" :
      result === "D" ? "bg-white/[0.08] text-white/55 border border-white/[0.12]" :
                       "bg-danger/15 text-danger border border-danger/25"
    )}>
      {result}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// One team's form column
// ─────────────────────────────────────────────────────────────────────────────

function TeamForm({ data, align }: { data: TeamFormData; align: "left" | "right" }) {
  const isRight = align === "right";

  if (data.results.length === 0) {
    return (
      <div className={cn("flex-1 min-w-0", isRight && "text-right")}>
        <p className="text-[10px] text-white/20 font-mono">No recent data</p>
      </div>
    );
  }

  return (
    <div className={cn("flex-1 min-w-0 space-y-1.5", isRight && "items-end")}>
      {data.results.map((r, i) => (
        <div
          key={r.matchId ?? i}
          className={cn(
            "flex items-center gap-2",
            isRight && "flex-row-reverse"
          )}
        >
          <ResultBadge result={r.result} />
          <div className={cn("flex items-center gap-1.5 min-w-0", isRight && "flex-row-reverse")}>
            <TeamLogo src={r.opponentCrest} name={r.opponentShort ?? r.opponent ?? "?"} size="sm" />
            <div className={cn("min-w-0", isRight && "text-right")}>
              <p className="text-[11px] font-semibold text-white/70 truncate leading-tight">
                {r.opponentShort ?? r.opponent}
              </p>
              <p className="text-[9px] font-mono text-white/25 leading-tight">
                {r.isHome ? "H" : "A"}{r.score ? ` · ${r.score}` : ""}
                {r.date ? ` · ${r.date.slice(5)}` : ""}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public component
// ─────────────────────────────────────────────────────────────────────────────

export function FormGuide({ home, away }: FormGuideProps) {
  return (
    <div className="space-y-3">
      {/* Column headers */}
      <div className="flex items-center gap-4">
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <TeamLogo src={home.crest} name={home.teamName} size="sm" />
          <span className="text-xs font-bold text-white/70 truncate">{home.teamName}</span>
        </div>
        <span className="text-[9px] font-mono text-white/20 uppercase tracking-widest flex-shrink-0">
          Last 5
        </span>
        <div className="flex-1 flex items-center gap-2 justify-end min-w-0">
          <span className="text-xs font-bold text-white/70 truncate text-right">{away.teamName}</span>
          <TeamLogo src={away.crest} name={away.teamName} size="sm" />
        </div>
      </div>

      {/* Form rows */}
      <div className="flex items-start gap-4">
        <TeamForm data={home} align="left" />
        <div className="w-px self-stretch bg-white/[0.06] flex-shrink-0" />
        <TeamForm data={away} align="right" />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 pt-1">
        {[
          { label: "Win",  color: "bg-success", text: "text-success" },
          { label: "Draw", color: "bg-white/20", text: "text-white/40" },
          { label: "Loss", color: "bg-danger",   text: "text-danger"  },
        ].map(({ label, color, text }) => (
          <div key={label} className="flex items-center gap-1">
            <span className={cn("w-2 h-2 rounded-full flex-shrink-0", color)} />
            <span className={cn("text-[9px] font-mono", text)}>{label}</span>
          </div>
        ))}
        <span className="text-[9px] font-mono text-white/15 ml-auto">H = home · A = away</span>
      </div>
    </div>
  );
}
