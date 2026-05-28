"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Clock, MapPin, Lock, Zap, CheckCircle2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { MatchStatusBadge } from "@/components/ui/Badge";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { LeagueLogo } from "@/components/ui/LeagueLogo";
import { PredictionBar } from "./PredictionBar";
import { leagueMap } from "@/data/leagues";
import type { Match, MatchOutcome } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatKickoff(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    weekday: "short",
    day:     "numeric",
    month:   "short",
    hour:    "2-digit",
    minute:  "2-digit",
    timeZone: "UTC",
    hour12:  false,
  });
}

function kickoffTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour:     "2-digit",
    minute:   "2-digit",
    timeZone: "UTC",
    hour12:   false,
  });
}

function xpLabel(status: string, leagueId: string): string {
  if (leagueId === "champions-league") return "×2.5 UCL";
  if (leagueId === "world-cup-2026")   return "×3.0 WC";
  if (status === "live")               return "×2.0 LIVE";
  return "10 XP";
}


// ─────────────────────────────────────────────────────────────────────────────
// Main card
// ─────────────────────────────────────────────────────────────────────────────

interface MatchCardProps {
  match:           Match;
  userPick?:       MatchOutcome;
  onPredict?:      (match: Match) => void;
  className?:      string;
  animationDelay?: number;
}

export function MatchCard({
  match,
  userPick,
  onPredict,
  className,
  animationDelay = 0,
}: MatchCardProps) {
  const league          = leagueMap[match.leagueId];
  const isFinished      = match.status === "finished";
  const isLive          = match.status === "live";
  const isUpcoming      = match.status === "upcoming";
  const isPastKickoff   = Date.now() >= new Date(match.kickoff).getTime();
  // isLocked: backend enforces kickoff lock; client check is UX-only
  const isLocked        = isFinished || isLive || isPastKickoff;
  const hasPick         = userPick !== undefined;
  const canPredict      = !isLocked && !!onPredict;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut", delay: animationDelay }}
      className={className}
    >
      <div className={cn(
        "relative overflow-hidden rounded-3xl",
        "bg-gradient-to-b from-[#0b0f2a] to-[#060810]",
        "border transition-all duration-200",
        isLive
          ? "border-primary/45 shadow-[0_0_32px_rgba(22,82,240,0.16),0_0_0_1px_rgba(22,82,240,0.08)]"
          : isFinished
          ? "border-white/[0.07]"
          : "border-primary/20 hover:border-primary/40 hover:shadow-[0_0_24px_rgba(22,82,240,0.10)]"
      )}>

        {/* Match card background — live at full strength, upcoming at reduced opacity */}
        {(isLive || isUpcoming) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/assets/backgrounds/live-match-card-bg.webp" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none" style={{ opacity: isLive ? 0.22 : 0.13 }} loading="lazy" decoding="async" />
        )}
        {/* Top highlight line (live only) */}
        {isLive && (
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
        )}

        {/* Live animated brand stripe */}
        {isLive && (
          <div className="h-[3px] w-full gradient-brand opacity-90" />
        )}

        <div className="p-4 sm:p-5 space-y-4">

          {/* ── Header: league + XP reward + status ──────────────────────── */}
          <div className="flex items-center justify-between gap-2">

            {/* League info */}
            <div className="flex items-center gap-2 min-w-0">
              <LeagueLogo leagueId={match.leagueId} size="sm" />
              <span className="text-[11px] text-white/40 font-mono font-medium truncate">
                {league?.shortName ?? match.leagueId}
                {match.matchday > 0 && ` · MD${match.matchday}`}
              </span>
            </div>

            {/* XP reward + status */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={cn(
                "inline-flex items-center gap-1 text-[10px] font-mono font-bold",
                "px-2 py-0.5 rounded-lg border",
                isLive
                  ? "text-primary bg-primary/12 border-primary/25"
                  : "text-white/35 bg-white/[0.04] border-white/[0.07]"
              )}>
                <Zap size={8} />
                {xpLabel(match.status, match.leagueId)}
              </span>
              <MatchStatusBadge status={match.status} />
            </div>
          </div>

          {/* ── Teams + score / VS ───────────────────────────────────────── */}
          <div className="flex items-center gap-2 sm:gap-3">

            {/* Home */}
            <div className="flex items-center gap-2 sm:gap-2.5 flex-1 min-w-0">
              <TeamLogo src={match.homeTeam.crest} name={match.homeTeam.shortName} className="w-12 h-12 sm:w-14 sm:h-14" />
              <div className="min-w-0">
                <p className="text-sm font-black text-white leading-tight truncate">
                  {match.homeTeam.shortName}
                </p>
                <p className="text-[10px] text-white/30 font-mono leading-tight hidden sm:block truncate">
                  {match.homeTeam.name}
                </p>
              </div>
            </div>

            {/* Center: VS pill (upcoming) or score (live/finished) */}
            <div className="flex-shrink-0 flex flex-col items-center gap-1">
              {isUpcoming ? (
                <>
                  <div className={cn(
                    "w-14 h-9 rounded-xl flex items-center justify-center",
                    "bg-gradient-to-b from-primary/18 to-primary/6",
                    "border border-primary/30"
                  )}>
                    <span className="font-black text-sm text-primary tracking-widest">VS</span>
                  </div>
                  <span className="text-[9px] font-mono text-white/25 tabular-nums">
                    {kickoffTime(match.kickoff)}
                  </span>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "font-mono font-black tabular-nums leading-none",
                    isLive ? "text-[2rem] text-white" : "text-2xl text-white/65"
                  )}>
                    {match.homeScore ?? 0}
                  </span>
                  <span className={cn(
                    "font-black leading-none",
                    isLive ? "text-xl text-primary" : "text-xl text-white/20"
                  )}>
                    –
                  </span>
                  <span className={cn(
                    "font-mono font-black tabular-nums leading-none",
                    isLive ? "text-[2rem] text-white" : "text-2xl text-white/65"
                  )}>
                    {match.awayScore ?? 0}
                  </span>
                </div>
              )}
            </div>

            {/* Away */}
            <div className="flex items-center gap-2 sm:gap-2.5 flex-1 min-w-0 flex-row-reverse">
              <TeamLogo src={match.awayTeam.crest} name={match.awayTeam.shortName} className="w-12 h-12 sm:w-14 sm:h-14" />
              <div className="min-w-0 text-right">
                <p className="text-sm font-black text-white leading-tight truncate">
                  {match.awayTeam.shortName}
                </p>
                <p className="text-[10px] text-white/30 font-mono leading-tight hidden sm:block truncate">
                  {match.awayTeam.name}
                </p>
              </div>
            </div>

          </div>

          {/* ── Venue / time (upcoming or live) ──────────────────────────── */}
          {(isUpcoming || isLive) && (
            <div className="flex items-center gap-3 text-[10px] text-white/22 font-mono">
              {isUpcoming && (
                <span className="flex items-center gap-1">
                  <Clock size={10} className="flex-shrink-0" />
                  {formatKickoff(match.kickoff)}
                </span>
              )}
              <span className="flex items-center gap-1 truncate">
                <MapPin size={10} className="flex-shrink-0" />
                <span className="truncate">{match.venue.split(",")[0]}</span>
              </span>
            </div>
          )}

          {/* ── Divider ──────────────────────────────────────────────────── */}
          <div className="h-px bg-white/[0.05]" />

          {/* ── Community prediction bar ─────────────────────────────────── */}
          <PredictionBar
            community={match.community}
            homeLabel={match.homeTeam.shortName}
            awayLabel={match.awayTeam.shortName}
            userPick={userPick}
          />

          {/* ── CTA ──────────────────────────────────────────────────────── */}
          {isFinished ? (

            /* Finished — full time */
            <div className={cn(
              "flex items-center justify-center gap-2 py-3 rounded-2xl",
              "bg-white/[0.03] border border-white/[0.07]"
            )}>
              <Lock size={11} className="text-white/20" />
              <span className="text-[11px] text-white/25 font-mono font-semibold tracking-wide">
                Full Time · Predictions Closed
              </span>
            </div>

          ) : isLocked ? (

            /* Locked after kickoff (live or past-kickoff upcoming) */
            <div className={cn(
              "flex items-center justify-center gap-2 py-3 rounded-2xl",
              "bg-white/[0.03] border border-white/[0.07]"
            )}>
              <Lock size={11} className="text-white/20" />
              <span className="text-[11px] text-white/25 font-mono font-semibold tracking-wide">
                Locked after kickoff
              </span>
            </div>

          ) : hasPick ? (

            /* Already predicted */
            <div className={cn(
              "flex items-center justify-center gap-2 py-3 rounded-2xl",
              "bg-success/8 border border-success/20"
            )}>
              <CheckCircle2 size={14} className="text-success" />
              <span className="text-xs font-bold text-success tracking-wide">
                Locked —{" "}
                {userPick === "home"
                  ? match.homeTeam.shortName
                  : userPick === "away"
                  ? match.awayTeam.shortName
                  : "Draw"}
              </span>
            </div>

          ) : canPredict ? (

            /* Open — predict button */
            <button
              type="button"
              onClick={() => onPredict(match)}
              className={cn(
                "w-full py-3 rounded-2xl text-xs font-black tracking-wide",
                "transition-all duration-150 active:scale-[0.98]",
                isLive
                  ? "gradient-brand text-white shadow-[0_4px_24px_rgba(22,82,240,0.35)] hover:opacity-90"
                  : "bg-primary text-white hover:bg-[#1248d8] shadow-[0_2px_16px_rgba(22,82,240,0.22)]"
              )}
            >
              {isLive ? "⚡ Predict Now — 2× XP" : "Predict Match"}
            </button>

          ) : (

            /* Home page embed — no onPredict provided */
            <Link
              href="/matches"
              className={cn(
                "flex items-center justify-center gap-1.5 py-3 rounded-2xl",
                "bg-primary/8 border border-primary/18",
                "text-xs font-semibold text-primary/70 hover:text-primary hover:bg-primary/12",
                "transition-all duration-150"
              )}
            >
              Predict on Matches page
              <ArrowRight size={11} />
            </Link>

          )}

        </div>
      </div>
    </motion.div>
  );
}
