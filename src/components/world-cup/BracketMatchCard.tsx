"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { TeamLogo } from "@/components/ui/TeamLogo";
import type { BracketMatch, KnockoutRoundKey } from "@/types";
import { ROUND_XP } from "@/lib/football/knockoutUtils";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TBD placeholder
// ─────────────────────────────────────────────────────────────────────────────

export function BracketTBDCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "w-full rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02]",
        "flex items-center justify-center",
        className,
      )}
      style={{ height: 60 }}
    >
      <span className="text-[10px] font-mono text-white/20 uppercase tracking-widest">TBD</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface BracketMatchCardProps {
  match: BracketMatch;
  roundKey: KnockoutRoundKey;
  /** Animation entrance delay (seconds) */
  delay?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// BracketMatchCard
// ─────────────────────────────────────────────────────────────────────────────

export function BracketMatchCard({ match, roundKey, delay = 0 }: BracketMatchCardProps) {
  const isLive      = match.status === "live";
  const isFinished  = match.status === "finished";
  const isProjected = match.projected;
  const hasScore    = isFinished || isLive;

  const homeWon = isFinished && match.actualOutcome === "H";
  const awayWon = isFinished && match.actualOutcome === "A";

  const xp = ROUND_XP[roundKey];

  // ── Inner content (shared between link and static renders) ──────────────────
  const content = (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, ease: "easeOut", delay }}
      className={cn(
        "relative w-full rounded-xl border overflow-hidden select-none",
        "transition-colors duration-150",
        isProjected
          ? "bg-white/[0.015] border-dashed border-white/[0.10]"
          : isLive
            ? "bg-primary/[0.08] border-primary/30 shadow-[0_0_16px_rgba(22,82,240,0.18)]"
            : isFinished
              ? "bg-white/[0.04] border-white/[0.10] hover:border-white/20"
              : "bg-white/[0.03] border-white/[0.07] hover:border-white/[0.14]",
      )}
      style={{ height: 60 }}
    >
      {/* Live pulse line at top */}
      {isLive && (
        <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse" />
      )}

      {/* XP badge — top right corner (hidden for projected slots — nothing to predict yet) */}
      {!isProjected && (
        <div className="absolute top-1 right-1.5 flex items-center gap-0.5 opacity-50">
          <span className="text-[8px] font-mono font-bold text-primary">+{xp}</span>
        </div>
      )}

      {/* Home row */}
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 pt-1.5 pb-0.5",
          isFinished && awayWon && "opacity-35",
        )}
      >
        <TeamLogo
          src={match.homeTeam?.crest}
          name={match.homeTeam?.shortName ?? ""}
          size="sm"
          className="w-5 h-5"
        />
        <span
          className={cn(
            "flex-1 text-[10px] font-mono leading-none truncate",
            homeWon
              ? "font-black text-white"
              : isProjected
                ? "font-medium text-white/45"
                : "font-medium text-white/70",
          )}
        >
          {match.homeTeam?.shortName ?? "TBD"}
        </span>
        {hasScore && (
          <span
            className={cn(
              "text-[11px] font-black font-mono tabular-nums flex-shrink-0",
              homeWon ? "text-white" : isLive ? "text-white/90" : "text-white/50",
            )}
          >
            {match.homeScore ?? 0}
          </span>
        )}
        {homeWon && (
          <span className="w-1 h-1 rounded-full bg-primary flex-shrink-0" />
        )}
      </div>

      {/* Divider */}
      <div className="mx-2 h-px bg-white/[0.06]" />

      {/* Away row */}
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 pt-0.5 pb-1.5",
          isFinished && homeWon && "opacity-35",
        )}
      >
        <TeamLogo
          src={match.awayTeam?.crest}
          name={match.awayTeam?.shortName ?? ""}
          size="sm"
          className="w-5 h-5"
        />
        <span
          className={cn(
            "flex-1 text-[10px] font-mono leading-none truncate",
            awayWon
              ? "font-black text-white"
              : isProjected
                ? "font-medium text-white/45"
                : "font-medium text-white/70",
          )}
        >
          {match.awayTeam?.shortName ?? "TBD"}
        </span>
        {hasScore && (
          <span
            className={cn(
              "text-[11px] font-black font-mono tabular-nums flex-shrink-0",
              awayWon ? "text-white" : isLive ? "text-white/90" : "text-white/50",
            )}
          >
            {match.awayScore ?? 0}
          </span>
        )}
        {awayWon && (
          <span className="w-1 h-1 rounded-full bg-primary flex-shrink-0" />
        )}
      </div>

      {/* Winner glow overlay */}
      {isFinished && (
        <div className="absolute inset-0 pointer-events-none rounded-xl bg-gradient-to-br from-primary/[0.04] to-transparent" />
      )}

      {/* Live indicator */}
      {isLive && (
        <div className="absolute bottom-1 left-2 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
          <span className="text-[7px] font-black text-red-400 uppercase tracking-wider">Live</span>
        </div>
      )}

      {/* Date — shown for upcoming only */}
      {!hasScore && !isProjected && match.kickoffTime && (
        <div className="absolute bottom-1 right-2">
          <span className="text-[8px] font-mono text-white/25">
            {formatDate(match.kickoffTime)}
          </span>
        </div>
      )}

      {/* Projected badge — no real fixture yet, teams derived from prior round */}
      {isProjected && (
        <div className="absolute bottom-1 right-2">
          <span className="text-[8px] font-mono text-white/25 uppercase tracking-wider">Projected</span>
        </div>
      )}
    </motion.div>
  );

  // Projected slots have no real match — render as a static (non-clickable) card.
  if (isProjected) return content;

  // Wrap in Link so the whole card navigates to match detail
  return (
    <Link href={`/matches/${match.id}`} className="block w-full" prefetch={false}>
      {content}
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile list card — slightly taller, shows more info
// ─────────────────────────────────────────────────────────────────────────────

interface MobileMatchCardProps {
  match: BracketMatch;
  roundKey: KnockoutRoundKey;
  delay?: number;
}

export function MobileBracketMatchCard({ match, roundKey, delay = 0 }: MobileMatchCardProps) {
  const isLive      = match.status === "live";
  const isFinished  = match.status === "finished";
  const isProjected = match.projected;
  const hasScore    = isFinished || isLive;
  const homeWon     = isFinished && match.actualOutcome === "H";
  const awayWon     = isFinished && match.actualOutcome === "A";
  const xp          = ROUND_XP[roundKey];

  const body = (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut", delay }}
      className={cn(
        "relative rounded-xl border px-4 py-3 overflow-hidden",
        "transition-colors duration-150",
        isProjected
          ? "bg-white/[0.015] border-dashed border-white/[0.10]"
          : isLive
            ? "bg-primary/[0.07] border-primary/25 shadow-[0_0_20px_rgba(22,82,240,0.12)]"
            : isFinished
              ? "bg-white/[0.04] border-white/10"
              : "bg-white/[0.03] border-white/[0.07] hover:border-white/[0.14]",
      )}
    >
      {isLive && (
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse" />
      )}

      <div className="flex items-center gap-3">
        {/* Home */}
        <div className={cn("flex items-center gap-2 flex-1 min-w-0", isFinished && awayWon && "opacity-35")}>
          <TeamLogo src={match.homeTeam?.crest} name={match.homeTeam?.shortName ?? ""} size="sm" />
          <span className={cn(
            "text-xs font-mono truncate",
            homeWon ? "font-black text-white" : isProjected ? "text-white/45" : "text-white/70",
          )}>
            {match.homeTeam?.name ?? "TBD"}
          </span>
        </div>

        {/* Score / vs */}
        <div className="flex-shrink-0 flex items-center gap-1.5">
          {hasScore ? (
            <span className="text-sm font-black font-mono text-white tabular-nums px-2 py-0.5 rounded bg-white/[0.06]">
              {match.homeScore ?? 0}–{match.awayScore ?? 0}
            </span>
          ) : (
            <span className="text-[10px] font-mono text-white/25">vs</span>
          )}
          {isLive && (
            <span className="text-[8px] font-black text-red-400 uppercase tracking-wider animate-pulse">LIVE</span>
          )}
        </div>

        {/* Away */}
        <div className={cn("flex items-center gap-2 flex-1 min-w-0 justify-end", isFinished && homeWon && "opacity-35")}>
          <span className={cn(
            "text-xs font-mono truncate text-right",
            awayWon ? "font-black text-white" : isProjected ? "text-white/45" : "text-white/70",
          )}>
            {match.awayTeam?.name ?? "TBD"}
          </span>
          <TeamLogo src={match.awayTeam?.crest} name={match.awayTeam?.shortName ?? ""} size="sm" />
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider">
          {isProjected ? "Projected — fixture not yet published" : match.kickoffTime ? formatDate(match.kickoffTime) : "Date TBC"}
        </span>
        {!isProjected && (
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-mono text-primary/50">+{xp} XP</span>
          </div>
        )}
      </div>
    </motion.div>
  );

  // Projected slots have no real match — render as a static (non-clickable) card.
  if (isProjected) return body;

  return (
    <Link href={`/matches/${match.id}`} prefetch={false}>
      {body}
    </Link>
  );
}
