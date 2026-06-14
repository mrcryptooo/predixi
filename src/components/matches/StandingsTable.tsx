"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { LeagueLogo } from "@/components/ui/LeagueLogo";

const COMPETITIONS = [
  { code: "PL",  name: "Premier League" },
  { code: "PD",  name: "La Liga" },
  { code: "BL1", name: "Bundesliga" },
  { code: "SA",  name: "Serie A" },
  { code: "FL1", name: "Ligue 1" },
];

type StandingRow = {
  position:     number;
  teamName:     string;
  teamLogo?:    string | null;
  played:       number;
  won:          number;
  drawn:        number;
  lost:         number;
  goalsFor:     number;
  goalsAgainst: number;
  goalDiff:     number;
  points:       number;
  form?:        string | null;
  description?: string | null;
};

function zoneColor(desc: string | null | undefined): 'blue' | 'amber' | 'red' | null {
  if (!desc) return null;
  const d = desc.toLowerCase();
  if (d.includes('relegation') || d.includes('playoff - relegation')) return 'red';
  if (d.includes('europa') || d.includes('conference'))                return 'amber';
  if (d.includes('champion'))                                          return 'blue';
  return null;
}

export function StandingsTable() {
  const [comp,     setComp]     = useState("PL");
  const [table,    setTable]    = useState<StandingRow[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    // DB-backed endpoint — reads from Supabase standings table, no external API calls.
    fetch(`/api/standings?leagueId=${comp}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((d: { ok: boolean; standings: StandingRow[] }) => {
        if (d.ok) setTable(d.standings);
        else setError("No standings data.");
      })
      .catch(() => setError("Failed to load standings. Try again later."))
      .finally(() => setLoading(false));
  }, [comp]);

  return (
    <div className="space-y-3">
      {/* Competition selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {COMPETITIONS.map(c => (
          <button
            key={c.code}
            type="button"
            onClick={() => setComp(c.code)}
            className={cn(
              "h-8 px-3 rounded-xl border text-xs font-semibold transition-all duration-150 whitespace-nowrap",
              "flex items-center gap-1.5",
              comp === c.code
                ? "bg-primary/15 border-primary/40 text-white"
                : "bg-white/[0.04] border-white/[0.08] text-white/35 hover:border-primary/25 hover:text-white/60"
            )}
          >
            <LeagueLogo leagueId={c.code} size="xs" />
            {c.code}
          </button>
        ))}
        <span className="text-[10px] text-white/20 font-mono ml-1">
          {COMPETITIONS.find(c => c.code === comp)?.name}
        </span>
      </div>

      {/* Table card */}
      <div className={cn(
        "rounded-2xl border overflow-hidden",
        "bg-gradient-to-br from-primary/8 via-[#070b22] to-bg",
        "border-primary/15"
      )}>
        {loading ? (
          <div className="py-12 text-center text-xs text-white/30 font-mono">Loading standings…</div>
        ) : error ? (
          <div className="py-12 text-center text-xs text-danger/70 font-mono">{error}</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-3 py-2.5 text-[10px] font-mono text-white/25 w-8">#</th>
                <th className="text-left px-2 py-2.5 text-[10px] font-mono text-white/25">Team</th>
                <th className="text-center px-1.5 py-2.5 text-[10px] font-mono text-white/25">P</th>
                <th className="text-center px-1.5 py-2.5 text-[10px] font-mono text-white/25">W</th>
                <th className="text-center px-1.5 py-2.5 text-[10px] font-mono text-white/25">D</th>
                <th className="text-center px-1.5 py-2.5 text-[10px] font-mono text-white/25">L</th>
                <th className="hidden sm:table-cell text-center px-1.5 py-2.5 text-[10px] font-mono text-white/25">GF</th>
                <th className="hidden sm:table-cell text-center px-1.5 py-2.5 text-[10px] font-mono text-white/25">GA</th>
                <th className="text-center px-1.5 py-2.5 text-[10px] font-mono text-white/25">GD</th>
                <th className="text-center px-3 py-2.5 text-[10px] font-mono text-white/30 font-bold">Pts</th>
              </tr>
            </thead>
            <tbody>
              {table.map((row) => {
                const zone = zoneColor(row.description);
                return (
                  <tr
                    key={row.position}
                    className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.03]"
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          "w-1 h-4 rounded-full flex-shrink-0",
                          zone === 'blue'  ? "bg-primary/70" :
                          zone === 'amber' ? "bg-amber-400/55" :
                          zone === 'red'   ? "bg-danger/50" :
                          "bg-transparent"
                        )} />
                        <span className={cn(
                          "font-mono font-bold tabular-nums",
                          zone === 'blue'  ? "text-primary" :
                          zone === 'amber' ? "text-amber-400/80" :
                          zone === 'red'   ? "text-danger/70" :
                          "text-white/40"
                        )}>
                          {row.position}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2 max-w-[130px]">
                      <div className="flex items-center gap-2 min-w-0">
                        <TeamLogo src={row.teamLogo} name={row.teamName.slice(0, 3).toUpperCase()} size="sm" />
                        <span className="font-semibold text-white/80 truncate">{row.teamName}</span>
                      </div>
                    </td>
                    <td className="px-1.5 py-2 text-center font-mono text-white/40 tabular-nums">{row.played}</td>
                    <td className="px-1.5 py-2 text-center font-mono text-white/60 tabular-nums">{row.won}</td>
                    <td className="px-1.5 py-2 text-center font-mono text-white/40 tabular-nums">{row.drawn}</td>
                    <td className="px-1.5 py-2 text-center font-mono text-white/40 tabular-nums">{row.lost}</td>
                    <td className="hidden sm:table-cell px-1.5 py-2 text-center font-mono text-white/35 tabular-nums">{row.goalsFor}</td>
                    <td className="hidden sm:table-cell px-1.5 py-2 text-center font-mono text-white/35 tabular-nums">{row.goalsAgainst}</td>
                    <td className={cn(
                      "px-1.5 py-2 text-center font-mono tabular-nums",
                      row.goalDiff > 0 ? "text-emerald-400/70" : row.goalDiff < 0 ? "text-danger/60" : "text-white/30"
                    )}>
                      {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
                    </td>
                    <td className="px-3 py-2 text-center font-mono font-black text-white tabular-nums">{row.points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-[10px] text-white/15 font-mono px-0.5">
        Zones from league data · GF/GA visible on wider screens · Via API-Football
      </p>
    </div>
  );
}
