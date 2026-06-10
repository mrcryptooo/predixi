"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Globe, Trophy, ArrowRight, Zap, Gift, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { RankBadge } from "@/components/ui/Badge";
import type { UserRank } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Countdown
// ─────────────────────────────────────────────────────────────────────────────

const WC_END   = new Date("2026-07-19T23:59:59Z");
const WC_START = new Date("2026-06-11T18:00:00Z");

function getCountdown() {
  const now  = Date.now();
  const diff = Math.max(0, WC_END.getTime() - now);
  return {
    days:    Math.floor(diff / 86_400_000),
    hours:   Math.floor((diff % 86_400_000) / 3_600_000),
    started: now >= WC_START.getTime(),
    ended:   diff === 0,
  };
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
  const [cd, setCd] = useState(getCountdown);

  useEffect(() => {
    const t = setInterval(() => setCd(getCountdown()), 60_000);
    return () => clearInterval(t);
  }, []);

  const hasProfile = !!(rank && xp != null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: "easeOut", delay: 0.18 }}
    >
      <div className={cn(
        "relative overflow-hidden rounded-2xl",
        "border border-primary/30",
        "bg-gradient-to-br from-primary/14 via-[#080d28] to-bg",
      )}>
        {/* Decorative top glow */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        {/* Ambient orb */}
        <div className="absolute -left-12 top-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-primary opacity-[0.08] blur-2xl pointer-events-none" />
        <div className="absolute right-0 bottom-0 w-32 h-32 rounded-full bg-primary opacity-[0.04] blur-3xl pointer-events-none" />

        <div className="relative z-10 p-4 sm:p-5 space-y-4">

          {/* ── Header ──────────────────────────────────────────────────────── */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
              <Globe size={18} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-white leading-tight">FIFA World Cup 2026</p>
              <p className="text-[11px] text-white/40 font-mono mt-0.5">USA · Canada · Mexico · 104 matches</p>
            </div>
            {/* Countdown badge */}
            <div className="text-right flex-shrink-0">
              <p className="text-[1.6rem] font-mono font-black text-white tabular-nums leading-none">
                {cd.ended ? "—" : cd.days}
              </p>
              <p className="text-[9px] text-primary font-mono font-semibold uppercase tracking-wider mt-0.5">
                {cd.ended ? "Ended" : cd.started ? "days left" : "days to go"}
              </p>
            </div>
          </div>

          <div className="h-px bg-white/[0.06]" />

          {/* ── Prize ───────────────────────────────────────────────────────── */}
          <div className="flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-warning/10 border border-warning/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Gift size={12} className="text-warning/70" />
            </div>
            <div>
              <p className="text-[9px] font-bold text-warning/70 uppercase tracking-wider mb-1">Prize Pool</p>
              <p className="text-xs text-white/60 leading-relaxed">
                Top 11 leaderboard users at the end of World Cup 2026 receive the{" "}
                <span className="text-white font-semibold">football jersey of their choice</span>.
              </p>
            </div>
          </div>

          <div className="h-px bg-white/[0.06]" />

          {/* ── User standing / CTA ─────────────────────────────────────────── */}
          {hasProfile ? (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-[9px] font-mono text-white/25 uppercase tracking-wider mb-1.5">
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
                      <span className="text-[10px] font-mono text-warning/80 font-bold">{streak}</span>
                    </div>
                  )}
                </div>
              </div>
              <Link
                href="/leaderboard"
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold flex-shrink-0",
                  "bg-primary text-white shadow-[0_4px_16px_rgba(22,82,240,0.35)]",
                  "hover:opacity-90 transition-all duration-150 active:scale-[0.97]",
                )}
              >
                <Trophy size={10} /> Climb Leaderboard
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-white/30 font-mono">
                Connect wallet to track your position
              </p>
              <Link
                href="/world-cup"
                className="flex items-center gap-1 text-[11px] font-semibold text-primary/70 hover:text-primary transition-colors"
              >
                Explore <ArrowRight size={11} />
              </Link>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
