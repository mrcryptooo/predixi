"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, Info } from "lucide-react";
import { matches as mockMatches } from "@/data/matches";
import { leagues } from "@/data/leagues";
import { usePredictionStore } from "@/store/usePredictionStore";
import { MatchCard } from "@/components/matches/MatchCard";
import { LeagueFilter } from "@/components/matches/LeagueFilter";
import { StandingsTable } from "@/components/matches/StandingsTable";
import { PredictionModal } from "@/components/prediction/PredictionModal";
import { cn } from "@/lib/utils";
import type { Match, MatchStatus, Team } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// API → Match mapper
// ─────────────────────────────────────────────────────────────────────────────

const LEAGUE_MAP: Record<string, string> = {
  PL: "premier-league", PD: "la-liga", BL1: "bundesliga",
  SA: "serie-a", FL1: "ligue-1", WC: "world-cup-2026", CL: "champions-league",
};

function apiTeam(name: string, shortName: string, leagueId: string, crest?: string | null): Team {
  return { id: shortName.toLowerCase(), name, shortName, logo: "⚽", crest: crest ?? null, leagueId, city: "", country: "" };
}

// UCL 2026 Final — shown as supplement when no fd-* CL data exists
const UCL_FINAL: Match = {
  id:        "ucl-final-2026",
  leagueId:  "champions-league",
  homeTeam:  { id: "psg", name: "Paris Saint-Germain", shortName: "PSG", logo: "🔵", leagueId: "champions-league", city: "Paris", country: "France" },
  awayTeam:  { id: "arsenal", name: "Arsenal FC", shortName: "ARS", logo: "🔴", leagueId: "champions-league", city: "London", country: "England" },
  kickoff:   "2026-05-30T19:00:00Z",
  status:    "upcoming",
  homeScore: null,
  awayScore: null,
  matchday:  0,
  venue:     "Puskás Aréna, Budapest",
  community: { home: 40, draw: 22, away: 38 },
};

function apiToMatch(m: Record<string, unknown>): Match {
  const leagueId = LEAGUE_MAP[m.leagueId as string] ?? (m.leagueId as string);
  return {
    id:        m.id as string,
    leagueId,
    homeTeam:  apiTeam((m.homeTeam as {name:string}).name, (m.homeTeam as {shortName:string}).shortName, leagueId, (m.homeTeam as {crest?:string|null}).crest),
    awayTeam:  apiTeam((m.awayTeam as {name:string}).name, (m.awayTeam as {shortName:string}).shortName, leagueId, (m.awayTeam as {crest?:string|null}).crest),
    kickoff:   m.kickoffTime as string,
    status:    m.status as Match["status"],
    homeScore: m.homeScore as number | null,
    awayScore: m.awayScore as number | null,
    matchday:  (m.matchday as number) ?? 0,
    venue:     (m.venue as string) ?? "",
    community: { home: 33, draw: 34, away: 33 },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Status filter config — no emoji in labels
// ─────────────────────────────────────────────────────────────────────────────

type StatusFilter = "all" | MatchStatus;

const statusTabs: { id: StatusFilter; label: string; live?: boolean }[] = [
  { id: "all",      label: "All"      },
  { id: "live",     label: "Live",    live: true },
  { id: "upcoming", label: "Upcoming" },
  { id: "finished", label: "Finished" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function MatchesPage() {
  const [leagueFilter, setLeagueFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [activeModal,  setActiveModal]  = useState<Match | null>(null);
  const [pageTab,      setPageTab]      = useState<"fixtures" | "standings">("fixtures");
  const [matches,      setMatches]      = useState<Match[]>(mockMatches);
  const [loading,      setLoading]      = useState(true);
  const [dataSource,   setDataSource]   = useState<"live" | "fallback">("fallback");

  const { getPrediction } = usePredictionStore();

  useEffect(() => {
    fetch("/api/matches?source=fd&limit=100")
      .then(r => r.ok ? r.json() : null)
      .then((data: { success: boolean; matches: Record<string, unknown>[] } | null) => {
        if (data?.success && data.matches.length > 0) {
          const realMatches = data.matches.map(apiToMatch);
          const realLeagues = new Set(realMatches.map(m => m.leagueId));
          // Supplement only the UCL final if no real CL data exists
          const supplement: Match[] = !realLeagues.has("champions-league") ? [UCL_FINAL] : [];
          setMatches([...realMatches, ...supplement]);
          setDataSource("live");
        }
      })
      .catch(() => { /* keep mock */ })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => matches.filter((m) => {
    const leagueOk = leagueFilter === "all" || m.leagueId === leagueFilter;
    const statusOk = statusFilter === "all" || m.status === statusFilter;
    return leagueOk && statusOk;
  }), [matches, leagueFilter, statusFilter]);

  const sorted = useMemo(() => {
    const order: Record<MatchStatus, number> = { live: 0, upcoming: 1, finished: 2, postponed: 3 };
    return [...filtered].sort((a, b) => order[a.status] - order[b.status]);
  }, [filtered]);

  const liveCount = sorted.filter((m) => m.status === "live").length;
  const isFiltered = leagueFilter !== "all" || statusFilter !== "all";

  return (
    <>
      <main className="min-h-screen bg-bg text-text-primary font-sans">
        <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10 space-y-6">

          {/* ── Page hero ─────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, ease: "easeOut" }}
          >
            <div className={cn(
              "relative overflow-hidden rounded-3xl",
              "border border-primary/25",
              "bg-gradient-to-br from-primary/12 via-[#070b22] to-bg",
              "shadow-[0_0_32px_rgba(22,82,240,0.09)]"
            )}>
              {/* Cinematic matches background */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/backgrounds/matches-hero.webp" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover object-top sm:object-center pointer-events-none" style={{ opacity: 0.22 }} loading="lazy" decoding="async" />
              {/* top edge highlight */}
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent" />
              {/* ambient glow blob */}
              <div className="absolute -right-14 -top-14 w-52 h-52 rounded-full bg-primary opacity-[0.07] blur-3xl pointer-events-none" />

              <div className="relative z-10 p-5 sm:p-6 space-y-4">
                {/* Title row */}
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0",
                    "bg-primary/15 border border-primary/25"
                  )}>
                    <CalendarDays size={18} className="text-primary" />
                  </div>
                  <div>
                    <h1 className="text-xl font-black text-white tracking-tight leading-tight">
                      Matches
                    </h1>
                    <p className="text-[11px] text-white/35 font-mono mt-0.5">
                      {loading ? "Loading…" : dataSource === "live" ? "Base App · Live Data" : "Base App · Demo Data"}
                    </p>
                  </div>

                  {/* Live indicator (when matches are live) */}
                  {!loading && matches.some((m) => m.status === "live") && (
                    <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
                      <span className="text-[10px] font-mono text-danger font-semibold">
                        {matches.filter((m) => m.status === "live").length} Live
                      </span>
                    </div>
                  )}
                </div>

                <p className="text-sm text-white/50 font-medium leading-relaxed">
                  Pick your football outcomes and build your PrediXI reputation.
                </p>

                {/* Phase notice */}
                <div className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-xl",
                  "bg-white/[0.04] border border-white/[0.07]"
                )}>
                  <Info size={11} className="text-white/25 flex-shrink-0" />
                  <p className="text-[11px] text-white/30 font-mono leading-relaxed">
                    Predictions are local mock actions in Phase 1 — on-chain proof coming later.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Page tab: Fixtures / Standings ────────────────────────────── */}
          <div className="flex items-center gap-2">
            {(["fixtures", "standings"] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setPageTab(tab)}
                className={cn(
                  "h-9 px-4 rounded-xl border text-xs font-bold capitalize transition-all duration-150",
                  pageTab === tab
                    ? "bg-primary/20 border-primary/50 text-white shadow-[0_0_14px_rgba(22,82,240,0.18)]"
                    : "bg-white/[0.04] border-white/[0.08] text-white/35 hover:border-primary/25 hover:text-white/60"
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* ── Standings tab ─────────────────────────────────────────────── */}
          {pageTab === "standings" && <StandingsTable />}

          {/* ── Fixtures tab content ──────────────────────────────────────── */}
          {pageTab === "fixtures" && <>

          {/* ── League filter ─────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: "easeOut", delay: 0.06 }}
            className="space-y-2"
          >
            <p className="text-[10px] font-mono text-white/25 uppercase tracking-[0.14em] px-0.5">
              League
            </p>
            <LeagueFilter
              leagues={leagues}
              selected={leagueFilter}
              onChange={setLeagueFilter}
            />
          </motion.div>

          {/* ── Status filter ─────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: "easeOut", delay: 0.10 }}
            className="space-y-2"
          >
            <p className="text-[10px] font-mono text-white/25 uppercase tracking-[0.14em] px-0.5">
              Status
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {statusTabs.map((tab) => {
                const isActive = tab.id === statusFilter;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={cn(
                      "flex items-center gap-1.5 h-9 px-3.5 rounded-xl border",
                      "text-xs font-semibold transition-all duration-150 whitespace-nowrap",
                      isActive
                        ? "bg-primary/15 border-primary/40 text-white shadow-[0_0_12px_rgba(22,82,240,0.14)]"
                        : "bg-white/[0.04] border-white/[0.08] text-white/35 hover:border-primary/25 hover:text-white/60"
                    )}
                  >
                    {tab.live && (
                      <span className="w-1.5 h-1.5 rounded-full bg-danger flex-shrink-0 animate-pulse" />
                    )}
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* ── Result count ──────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-0.5">
            <p className="text-[11px] text-white/25 font-mono">
              {sorted.length} match{sorted.length !== 1 ? "es" : ""}
              {isFiltered && " · filtered"}
            </p>
            <span className={cn(
              "text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border",
              dataSource === "live"
                ? "text-emerald-400 border-emerald-400/30 bg-emerald-400/10"
                : "text-white/30 border-white/10 bg-white/[0.03]"
            )}>
              {loading ? "…" : dataSource === "live" ? "Live Data" : "Demo Data"}
            </span>
          </div>

          {/* ── Match grid ────────────────────────────────────────────────── */}
          <AnimatePresence mode="wait">
            {sorted.length === 0 ? (

              /* Empty state */
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28 }}
                className="flex flex-col items-center gap-5 py-20 text-center"
              >
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center",
                  "bg-gradient-to-br from-primary/12 to-bg",
                  "border border-primary/20"
                )}>
                  <CalendarDays size={26} className="text-primary/40" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-bold text-white/50">
                    No matches found
                  </p>
                  <p className="text-xs text-white/25 font-mono">
                    Try a different league or status filter.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setLeagueFilter("all"); setStatusFilter("all"); }}
                  className="text-xs font-semibold text-primary hover:text-white transition-colors duration-150"
                >
                  Clear all filters
                </button>
              </motion.div>

            ) : (

              /* Match list */
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="space-y-3"
              >
                {sorted.map((match, i) => {
                  const pick = getPrediction(match.id)?.outcome;
                  return (
                    <MatchCard
                      key={match.id}
                      match={match}
                      userPick={pick}
                      onPredict={setActiveModal}
                      animationDelay={i * 0.04}
                    />
                  );
                })}
              </motion.div>

            )}
          </AnimatePresence>

          </> /* end fixtures tab */}

          {/* ── Footer ────────────────────────────────────────────────────── */}
          <footer className="text-center pb-6 pt-2">
            <p className="text-[10px] text-white/15 font-mono tracking-[0.14em] uppercase">
              PrediXI · Matches · Demo Data
            </p>
          </footer>

        </div>
      </main>

      {/* ── Prediction modal ──────────────────────────────────────────────── */}
      {activeModal && (
        <PredictionModal
          match={activeModal}
          onClose={() => setActiveModal(null)}
        />
      )}
    </>
  );
}
