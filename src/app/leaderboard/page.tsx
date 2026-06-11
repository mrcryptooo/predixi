"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, Zap, Flame, Target, Gift } from "lucide-react";
import { useAccount } from "wagmi";
import { PodiumCard }           from "@/components/leaderboard/PodiumCard";
import { LeaderboardTable }    from "@/components/leaderboard/LeaderboardTable";
import { RankBadge }           from "@/components/ui/Badge";
import { LeaderboardRowSkeleton } from "@/components/ui/Skeleton";
import { cn }                from "@/lib/utils";
import type { LeaderboardEntry } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Period = "global" | "weekly";

const periodTabs: { id: Period; label: string }[] = [
  { id: "global", label: "All-Time" },
  { id: "weekly", label: "This Week" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const { address, isConnected } = useAccount();
  const [entries, setEntries]   = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [period,  setPeriod]    = useState<Period>("global");

  useEffect(() => {
    // Set loading but keep stale entries visible — avoids a blank flash
    // while the new period's data loads.
    setLoading(true);
    const apiPeriod = period === "global" ? "all_time" : "weekly";
    fetch(`/api/leaderboard?period=${apiPeriod}`)
      .then(r => r.json())
      .then(d => { if (d.success) setEntries(d.entries ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period]);

  const ranked: LeaderboardEntry[] = useMemo(() => entries, [entries]);

  const top3    = ranked.slice(0, 3);
  const rest    = ranked.slice(3);
  const myEntry = isConnected && address
    ? ranked.find(e => e.userId.toLowerCase() === address.toLowerCase())
    : undefined;

  return (
    <main className="min-h-screen bg-bg text-text-primary font-sans">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10 space-y-8">

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
            {/* Cinematic leaderboard background */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/backgrounds/leaderboard-bg.webp" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover object-top sm:object-center pointer-events-none" style={{ opacity: 0.26 }} loading="eager" decoding="async" />
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent" />
            <div className="absolute -right-14 -top-14 w-52 h-52 rounded-full bg-primary opacity-[0.07] blur-3xl pointer-events-none" />

            <div className="relative z-10 p-5 sm:p-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
                  <Trophy size={18} className="text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-black text-white tracking-tight leading-tight">
                    Leaderboard
                  </h1>
                  <p className="text-[11px] text-white/35 font-mono mt-0.5">
                    Base App · Live Rankings
                  </p>
                </div>
              </div>

              <p className="text-sm text-white/50 font-medium leading-relaxed">
                Track the sharpest football predictors and climb the PrediXI rankings.
              </p>

              {entries.length === 0 && !loading && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                  <span className="w-1 h-1 rounded-full bg-white/20 flex-shrink-0" />
                  <p className="text-[11px] text-white/30 font-mono">
                    No predictors yet — be the first to place a prediction and claim the top spot.
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── WC 2026 prize banner ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: "easeOut", delay: 0.06 }}
          className={cn(
            "relative overflow-hidden rounded-2xl border",
            "border-warning/25 bg-gradient-to-r from-warning/[0.07] via-[#0c0f22] to-bg",
          )}
        >
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-warning/35 to-transparent" />
          <div className="flex items-start gap-3.5 px-4 py-3.5">
            <div className="w-8 h-8 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center flex-shrink-0">
              <Gift size={14} className="text-warning/75" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold text-warning/75 uppercase tracking-wider">
                  World Cup 2026 Prize
                </span>
                <span className="text-[9px] font-mono text-white/20 border border-white/[0.08] px-1.5 py-0.5 rounded-md">
                  Ends 19 Jul 2026
                </span>
              </div>
              <p className="text-xs text-white/55 mt-1 leading-relaxed">
                Top <span className="text-white font-semibold">11 users</span> on this leaderboard receive the{" "}
                <span className="text-white font-semibold">football jersey of their choice</span>.
                Keep predicting to climb.
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Period filter ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.30, ease: "easeOut", delay: 0.06 }}
          className="flex p-1 rounded-2xl bg-white/[0.04] border border-white/[0.07] gap-1 self-start"
        >
          {periodTabs.map((tab) => {
            const isActive = tab.id === period;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPeriod(tab.id)}
                className={cn(
                  "h-8 px-4 rounded-xl text-xs font-semibold transition-all duration-200",
                  isActive
                    ? "bg-primary/20 text-white shadow-[0_0_14px_rgba(22,82,240,0.20)] border border-primary/40"
                    : "text-white/35 hover:text-white/60 border border-transparent"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </motion.div>

        {/* ── Loading skeleton ──────────────────────────────────────────── */}
        {loading && entries.length === 0 && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <LeaderboardRowSkeleton key={i} />
            ))}
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────────────────── */}
        {!loading && entries.length === 0 && (
          <div className={cn(
            "flex flex-col items-center gap-4 py-16 rounded-3xl text-center",
            "border border-white/[0.07] bg-gradient-to-b from-[#0b0f28] to-[#060810]"
          )}>
            <Trophy size={32} className="text-primary/30" />
            <div>
              <p className="text-sm font-bold text-white/40">
                {period === "weekly" ? "No weekly rankings yet" : "No ranked predictors yet"}
              </p>
              <p className="text-xs text-white/20 font-mono mt-1">
                {period === "weekly"
                  ? "Weekly XP resets each week. Check back after matches are settled."
                  : "Start predicting to appear on the leaderboard."}
              </p>
            </div>
          </div>
        )}

        {!loading && entries.length > 0 && (
          <>
            {/* ── Podium (top 3) ──────────────────────────────────────────── */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.40, ease: "easeOut", delay: 0.09 }}
            >
              <div className={cn(
                "relative overflow-hidden rounded-3xl",
                "border border-white/[0.07]",
                "bg-gradient-to-b from-[#0b0f28] to-[#060810]",
                "p-6"
              )}>
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-primary opacity-[0.06] blur-3xl pointer-events-none" />

                <p className="text-[10px] font-mono text-white/25 uppercase tracking-[0.14em] mb-6 text-center relative z-10">
                  {period === "global" ? "All-Time Champions" : "This Week's Leaders"}
                </p>

                <div className="flex items-end justify-center gap-4 relative z-10">
                  {top3.map((entry) => (
                    <PodiumCard
                      key={entry.userId}
                      entry={entry}
                      isCurrentUser={
                        isConnected && !!address &&
                        entry.userId.toLowerCase() === address.toLowerCase()
                      }
                    />
                  ))}
                </div>
              </div>
            </motion.section>

            {/* ── My rank card ────────────────────────────────────────────── */}
            {myEntry && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, ease: "easeOut", delay: 0.13 }}
                className={cn(
                  "relative overflow-hidden rounded-3xl",
                  "border border-primary/30",
                  "bg-gradient-to-br from-primary/14 via-[#080d28] to-bg",
                  "shadow-[0_0_28px_rgba(22,82,240,0.12)]",
                  "p-5"
                )}
              >
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent" />
                <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-primary opacity-[0.08] blur-2xl pointer-events-none" />

                <div className="relative z-10">
                  <p className="text-[10px] font-mono text-white/30 uppercase tracking-[0.14em] mb-4">
                    Your Standing
                  </p>

                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-[#4d7ef7] flex items-center justify-center text-xl flex-shrink-0 shadow-lg">
                        {myEntry.avatar}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white font-mono">{myEntry.displayName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <RankBadge rank={myEntry.rank} size="xs" />
                          <span className="text-[10px] font-mono text-white/30">
                            #{myEntry.position} globally
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 ml-auto flex-wrap">
                      <div className="text-center">
                        <div className="flex items-center gap-0.5 justify-center">
                          <Zap size={10} className="text-primary" />
                          <span className="text-sm font-mono font-black text-white">
                            {myEntry.xp.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[10px] text-white/30 font-mono">Total XP</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center gap-0.5 justify-center">
                          <Target size={10} className="text-primary" />
                          <span className="text-sm font-mono font-black text-white">
                            {myEntry.accuracy}%
                          </span>
                        </div>
                        <p className="text-[10px] text-white/30 font-mono">Accuracy</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center gap-0.5 justify-center">
                          <Flame size={10} className="text-warning" />
                          <span className="text-sm font-mono font-black text-warning">
                            {myEntry.streak}
                          </span>
                        </div>
                        <p className="text-[10px] text-white/30 font-mono">Streak</p>
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-white/20 font-mono mt-4 border-t border-white/[0.06] pt-3">
                    Base Account identity coming in a future phase.
                  </p>
                </div>
              </motion.div>
            )}

            {/* ── Full rankings (pos 4+) ─────────────────────────────────── */}
            {rest.length > 0 && (
              <section className="space-y-3">
                <p className="text-[10px] font-mono text-white/25 uppercase tracking-[0.14em]">
                  Full Rankings
                </p>
                <LeaderboardTable
                  entries={rest}
                  currentUserId={address ?? ""}
                  startIndex={3}
                />
              </section>
            )}
          </>
        )}

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <footer className="text-center pb-6 pt-2">
          <p className="text-[10px] text-white/15 font-mono tracking-[0.14em] uppercase">
            PrediXI · Leaderboard · {loading ? "Loading…" : entries.length > 0 ? "Live Data" : "No Data Yet"}
          </p>
        </footer>

      </div>
    </main>
  );
}
