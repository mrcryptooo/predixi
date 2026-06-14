"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, Info } from "lucide-react";
import { usePredictionStore } from "@/store/usePredictionStore";
import { MatchCard } from "@/components/matches/MatchCard";
import { StandingsTable } from "@/components/matches/StandingsTable";
import { PredictionModal } from "@/components/prediction/PredictionModal";
import { cn } from "@/lib/utils";
import type { Match, MatchStatus, Team } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// API → Match mapper
// ─────────────────────────────────────────────────────────────────────────────

const LEAGUE_MAP: Record<string, string> = {
  WC: "world-cup-2026",
};

function apiTeam(name: string, shortName: string, leagueId: string, crest?: string | null): Team {
  return { id: shortName.toLowerCase(), name, shortName, logo: "⚽", crest: crest ?? null, leagueId, city: "", country: "" };
}


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
    community: (m.community as { home: number; draw: number; away: number } | null) ?? null,
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [activeModal,  setActiveModal]  = useState<Match | null>(null);
  const [pageTab,      setPageTab]      = useState<"fixtures" | "standings">("fixtures");
  const [matches,      setMatches]      = useState<Match[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [dataSource,   setDataSource]   = useState<"live" | "fallback">("fallback");

  const { getPrediction } = usePredictionStore();

  useEffect(() => {
    fetch("/api/matches?source=apf&limit=100")
      .then(r => r.ok ? r.json() : null)
      .then((data: { success: boolean; matches: Record<string, unknown>[] } | null) => {
        if (data?.success && data.matches.length > 0) {
          setMatches(data.matches.map(apiToMatch));
          setDataSource("live");
        }
      })
      .catch(() => { /* leave empty */ })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() =>
    statusFilter === "all" ? matches : matches.filter(m => m.status === statusFilter)
  , [matches, statusFilter]);

  const sorted = useMemo(() => {
    const order: Record<MatchStatus, number> = { live: 0, upcoming: 1, finished: 2, postponed: 3 };
    return [...filtered].sort((a, b) => order[a.status] - order[b.status]);
  }, [filtered]);

  const isFiltered = statusFilter !== "all";

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
                      {loading ? "Loading…" : "Base App · Live Data"}
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

                {/* Info notice */}
                <div className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-xl",
                  "bg-white/[0.04] border border-white/[0.07]"
                )}>
                  <Info size={11} className="text-white/25 flex-shrink-0" />
                  <p className="text-[11px] text-white/30 font-mono leading-relaxed">
                    Predictions are saved to your wallet and scored after each match.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Page tab: Fixtures / Standings ────────────────────────────── */}
          <div className="flex p-1 rounded-2xl bg-white/[0.04] border border-white/[0.07] gap-1 self-start">
            {(["fixtures", "standings"] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setPageTab(tab)}
                className={cn(
                  "h-8 px-4 rounded-xl text-xs font-bold capitalize transition-all duration-200",
                  pageTab === tab
                    ? "bg-primary/20 text-white shadow-[0_0_14px_rgba(22,82,240,0.20)] border border-primary/40"
                    : "text-white/35 hover:text-white/60 border border-transparent"
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
            <div className="flex p-1 rounded-2xl bg-white/[0.04] border border-white/[0.07] gap-1 flex-wrap">
              {statusTabs.map((tab) => {
                const isActive = tab.id === statusFilter;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={cn(
                      "flex items-center gap-1.5 h-8 px-3.5 rounded-xl",
                      "text-xs font-semibold transition-all duration-200 whitespace-nowrap",
                      isActive
                        ? "bg-primary/20 text-white shadow-[0_0_12px_rgba(22,82,240,0.18)] border border-primary/40"
                        : "text-white/35 hover:text-white/60 border border-transparent"
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
              {loading ? "…" : dataSource === "live" ? "Live Data" : "Offline"}
            </span>
          </div>

          {/* ── Match grid ────────────────────────────────────────────────── */}
          {loading && matches.length === 0 ? (
            <div className="space-y-3">
              {[0,1,2,3].map(i => (
                <div key={i} className="rounded-3xl border border-white/[0.07] bg-gradient-to-b from-[#0b0f2a] to-[#060810] p-5 overflow-hidden relative">
                  <div className="absolute inset-0 shimmer pointer-events-none" />
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-3 w-28 bg-white/[0.07] rounded-full" />
                    <div className="h-5 w-14 bg-white/[0.07] rounded-lg" />
                  </div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-white/[0.07] rounded-xl flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-16 bg-white/[0.07] rounded-full" />
                    </div>
                    <div className="w-14 h-9 bg-white/[0.07] rounded-xl flex-shrink-0" />
                    <div className="flex-1 space-y-2 flex flex-col items-end">
                      <div className="h-3.5 w-16 bg-white/[0.07] rounded-full" />
                    </div>
                    <div className="w-12 h-12 bg-white/[0.07] rounded-xl flex-shrink-0" />
                  </div>
                  <div className="h-px bg-white/[0.04] mb-4" />
                  <div className="h-8 bg-white/[0.05] rounded-2xl" />
                </div>
              ))}
            </div>
          ) : (
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
                  onClick={() => setStatusFilter("all")}
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
                      animationDelay={Math.min(i * 0.04, 0.22)}
                    />
                  );
                })}
              </motion.div>

            )}
          </AnimatePresence>
          )} {/* end loading/content ternary */}

          </> /* end fixtures tab */}

          {/* ── Footer ────────────────────────────────────────────────────── */}
          <footer className="text-center pb-6 pt-2">
            <p className="text-[10px] text-white/15 font-mono tracking-[0.14em] uppercase">
              PrediXI · Matches · Base App
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
