"use client";

/*
 * WorldCupCompetitionCard — premium hero-level prize section
 *
 * Placement: Home page · Section 5 · after "World Cup Matches", before "Top Predictors"
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BACKGROUND ART — image-generation prompts for wc-prize-hero.webp
 * (use any of the 3 options; all 1200×600px, dark vignette edges for text)
 *
 * Prompt A — Stadium night:
 *   "Cinematic aerial view of a packed 80,000-seat football stadium at night,
 *    floodlights blazing, 32 national flags illuminated around the rim, golden
 *    World Cup trophy spotlit at centre pitch, deep midnight-blue sky, extreme
 *    dark vignette on all four edges, photorealistic 4K, 16:9, suitable for
 *    white text overlay"
 *
 * Prompt B — Trophy spotlight:
 *   "FIFA World Cup trophy on dark polished surface, single dramatic overhead
 *    spotlight, deep navy-black background, golden gleam, out-of-focus stadium
 *    bokeh glow in far distance, cinematic editorial photography, high contrast,
 *    heavy dark vignette, 16:9, suitable for dark overlay"
 *
 * Prompt C — Energy burst abstraction:
 *   "Abstract dark digital tournament art: football disintegrating into cobalt-
 *    blue and amber gold energy particles, deep midnight-navy background, light
 *    streaks radiating outward, futuristic World Cup championship aesthetic,
 *    darkened edges, 16:9, suitable for text overlay"
 * ─────────────────────────────────────────────────────────────────────────────
 */

import Link from "next/link";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, Zap, Flame, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { RankBadge } from "@/components/ui/Badge";
import type { UserRank } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Countdown / progress
// ─────────────────────────────────────────────────────────────────────────────

const WC_START    = new Date("2026-06-11T18:00:00Z");
const WC_END      = new Date("2026-07-19T23:59:59Z");
const WC_DURATION = WC_END.getTime() - WC_START.getTime();

function getTimeState() {
  const now     = Date.now();
  const diff    = Math.max(0, WC_END.getTime() - now);
  const elapsed = Math.max(0, now - WC_START.getTime());
  return {
    days:     Math.floor(diff / 86_400_000),
    hours:    Math.floor((diff % 86_400_000) / 3_600_000),
    minutes:  Math.floor((diff % 3_600_000) / 60_000),
    started:  now >= WC_START.getTime(),
    ended:    diff === 0,
    progress: Math.min(100, Math.round((elapsed / WC_DURATION) * 100)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CountdownUnit — large individual time block
// ─────────────────────────────────────────────────────────────────────────────

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center gap-1.5 flex-shrink-0",
      "w-[68px] sm:w-[80px] py-3.5 rounded-2xl",
      "bg-gradient-to-b from-[#0c1838] to-[#060a1e]",
      "border border-primary/20",
      "shadow-[0_4px_24px_rgba(22,82,240,0.14),inset_0_1px_0_rgba(100,140,255,0.07)]",
    )}>
      <span className="text-[2.1rem] sm:text-[2.6rem] font-black text-white tabular-nums leading-none tracking-tight">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[8px] font-mono font-bold text-white/30 uppercase tracking-[0.16em]">
        {label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface WorldCupCompetitionCardProps {
  rank?:   string | null;
  xp?:     number | null;
  streak?: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function WorldCupCompetitionCard({
  rank, xp, streak,
}: WorldCupCompetitionCardProps) {
  const [ts, setTs] = useState(getTimeState);

  useEffect(() => {
    const t = setInterval(() => setTs(getTimeState()), 30_000);
    return () => clearInterval(t);
  }, []);

  const hasProfile  = !!(rank && xp != null);
  const progressPct = ts.progress;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.48, ease: "easeOut", delay: 0.14 }}
    >
      <div className={cn(
        "relative overflow-hidden rounded-3xl",
        "border border-primary/30",
        "bg-gradient-to-br from-[#040d2e] via-[#070b22] to-[#050812]",
        "shadow-[0_0_60px_rgba(22,82,240,0.16),0_0_120px_rgba(22,82,240,0.07)]",
      )}>

        {/* ── Cinematic background ────────────────────────────────────────── */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/backgrounds/worldcup-hero.webp"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-top pointer-events-none select-none"
          style={{ opacity: 0.20 }}
          loading="lazy"
          decoding="async"
        />
        {/* Dark scrim over image for contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#040d2e]/60 via-transparent to-[#050812]/80 pointer-events-none" />

        {/* ── Ambient glow orbs ───────────────────────────────────────────── */}
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-primary opacity-[0.16] blur-[90px] pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full bg-[#4d7ef7] opacity-[0.10] blur-[70px] pointer-events-none" />
        <div className="absolute top-1/3 right-1/4 w-48 h-48 rounded-full bg-warning opacity-[0.04] blur-[60px] pointer-events-none" />

        {/* ── Dual-colour top edge glow bar ───────────────────────────────── */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-warning/55 to-transparent" />
        <div className="absolute top-[2px] inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent" />

        {/* ── Decorative corner tick marks ────────────────────────────────── */}
        <div className="absolute top-0 left-0 pointer-events-none">
          <div className="absolute top-4 left-4 w-7 h-px bg-warning/35" />
          <div className="absolute top-4 left-4 w-px h-7 bg-warning/35" />
        </div>
        <div className="absolute top-0 right-0 pointer-events-none">
          <div className="absolute top-4 right-4 w-7 h-px bg-warning/35" />
          <div className="absolute top-4 right-4 w-px h-7 bg-warning/35" />
        </div>
        <div className="absolute bottom-0 left-0 pointer-events-none">
          <div className="absolute bottom-4 left-4 w-7 h-px bg-primary/20" />
          <div className="absolute bottom-4 left-4 w-px h-7 bg-primary/20" />
        </div>
        <div className="absolute bottom-0 right-0 pointer-events-none">
          <div className="absolute bottom-4 right-4 w-7 h-px bg-primary/20" />
          <div className="absolute bottom-4 right-4 w-px h-7 bg-primary/20" />
        </div>

        <div className="relative z-10 p-6 sm:p-8 space-y-6">

          {/* ── 1. Tournament header ──────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center",
                "bg-gradient-to-br from-primary/20 to-primary/5",
                "border border-primary/30",
                "shadow-[0_0_20px_rgba(22,82,240,0.25)]",
              )}>
                <span className="text-2xl leading-none select-none">🌍</span>
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight leading-tight">
                  FIFA World Cup 2026
                </h2>
                <p className="text-[11px] text-white/35 font-mono mt-0.5">
                  USA · Canada · Mexico · 104 matches
                </p>
              </div>
            </div>

            {/* Status badge */}
            {ts.started && !ts.ended ? (
              <div className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl flex-shrink-0",
                "bg-danger/10 border border-danger/25",
                "shadow-[0_0_12px_rgba(239,68,68,0.15)]",
              )}>
                <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse flex-shrink-0" />
                <span className="text-[10px] font-mono font-bold text-danger uppercase tracking-wider">
                  Live
                </span>
              </div>
            ) : ts.ended ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.05] border border-white/[0.10] flex-shrink-0">
                <span className="text-[10px] font-mono text-white/40">Ended</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-primary/10 border border-primary/20 flex-shrink-0">
                <span className="text-[10px] font-mono font-bold text-primary/70 uppercase tracking-wider">
                  Upcoming
                </span>
              </div>
            )}
          </div>

          {/* ── 2. Prize hero callout ─────────────────────────────────────── */}
          <div className={cn(
            "relative overflow-hidden rounded-2xl",
            "border border-warning/30",
            "bg-gradient-to-br from-warning/[0.13] via-[#0e0b04]/60 to-transparent",
            "shadow-[0_0_36px_rgba(255,170,0,0.12),inset_0_1px_0_rgba(255,200,50,0.14)]",
            "p-5 sm:p-6",
          )}>
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-warning/55 to-transparent" />
            <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-warning opacity-[0.07] blur-2xl pointer-events-none" />

            <div className="relative flex items-start gap-4">
              <div className={cn(
                "w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex-shrink-0 flex items-center justify-center",
                "bg-gradient-to-br from-warning/20 to-warning/5",
                "border border-warning/35",
                "shadow-[0_0_24px_rgba(255,170,0,0.25),inset_0_1px_0_rgba(255,210,60,0.15)]",
              )}>
                <Trophy size={26} className="text-warning" />
              </div>

              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] font-mono font-bold text-warning/65 uppercase tracking-[0.18em]">
                    PrediXI World Cup Prize
                  </span>
                  <span className="text-[8px] font-mono text-white/20 border border-white/[0.08] px-1.5 py-0.5 rounded-md">
                    Ends 19 Jul 2026
                  </span>
                </div>
                <p className="text-base sm:text-lg font-black text-white leading-snug">
                  Top 11 predictors win a{" "}
                  <span className="text-warning drop-shadow-[0_0_12px_rgba(255,170,0,0.6)]">
                    jersey of their choice
                  </span>
                </p>
                <p className="text-[11px] text-white/40 font-mono leading-relaxed">
                  Predict every WC match · Climb the board · Collect your jersey
                </p>
              </div>
            </div>
          </div>

          {/* ── 3. Countdown blocks ───────────────────────────────────────── */}
          {!ts.ended && (
            <div className="space-y-2.5">
              <p className="text-[9px] font-mono text-white/25 uppercase tracking-[0.16em]">
                {ts.started ? "Tournament ends in" : "Tournament starts in"}
              </p>
              <div className="flex items-center gap-2 sm:gap-3">
                <CountdownUnit value={ts.days}    label="Days"  />
                <span className="text-[1.8rem] font-black text-white/15 pb-4 flex-shrink-0 select-none">:</span>
                <CountdownUnit value={ts.hours}   label="Hours" />
                <span className="text-[1.8rem] font-black text-white/15 pb-4 flex-shrink-0 select-none">:</span>
                <CountdownUnit value={ts.minutes} label="Min"   />
              </div>
            </div>
          )}

          {/* ── 4. Tournament progress bar ────────────────────────────────── */}
          {ts.started && !ts.ended && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[9px] font-mono text-white/25 uppercase tracking-[0.12em]">
                  Tournament progress
                </p>
                <p className="text-[9px] font-mono text-white/35 tabular-nums">
                  {progressPct}% complete
                </p>
              </div>
              <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden border border-white/[0.04]">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-primary via-primary/80 to-primary/50 shadow-[0_0_8px_rgba(22,82,240,0.6)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 1.4, ease: "easeOut", delay: 0.6 }}
                />
              </div>
            </div>
          )}

          {/* ── 5. Standing row + CTA ─────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-3 flex-wrap pt-1 border-t border-white/[0.07]">
            {hasProfile ? (
              <div className="space-y-1.5">
                <p className="text-[9px] font-mono text-white/25 uppercase tracking-wider">
                  Your Standing
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <RankBadge rank={rank as UserRank} size="xs" />
                  <div className="flex items-center gap-1">
                    <Zap size={9} className="text-primary" />
                    <span className="text-[11px] font-mono font-black text-white tabular-nums">
                      {xp!.toLocaleString()} XP
                    </span>
                  </div>
                  {(streak ?? 0) > 0 && (
                    <div className="flex items-center gap-0.5">
                      <Flame size={9} className="text-warning/80" />
                      <span className="text-[10px] font-mono text-warning/80 font-bold tabular-nums">
                        {streak}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-white/30 font-mono">
                Connect wallet to track your position
              </p>
            )}

            <Link
              href="/leaderboard"
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black tracking-wide flex-shrink-0",
                "bg-primary text-white",
                "shadow-[0_4px_24px_rgba(22,82,240,0.50),0_0_0_1px_rgba(22,82,240,0.18)]",
                "hover:opacity-90 transition-all duration-150 active:scale-[0.97]",
              )}
            >
              <Trophy size={12} />
              Climb Rankings
              <ArrowRight size={12} />
            </Link>
          </div>

        </div>
      </div>
    </motion.div>
  );
}
