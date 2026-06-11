"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useRef, memo } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import {
  Zap, Flame, Target, ArrowRight, Shield,
  MapPin, Clock, Anchor,
} from "lucide-react";
import { useAccount }      from "wagmi";
import { DailyHeroes }                from "@/components/home/DailyHeroes";
import { CinematicIntro }            from "@/components/home/CinematicIntro";
import { WorldCupCompetitionCard }   from "@/components/home/WorldCupCompetitionCard";

// Lazy-load leaderboard — below fold, not critical for LCP
const MiniLeaderboard = dynamic(
  () => import("@/components/leaderboard/MiniLeaderboard").then(m => ({ default: m.MiniLeaderboard })),
  { ssr: false, loading: () => <p className="text-xs text-white/25 font-mono px-1 py-4">Loading…</p> },
);
import { RankBadge }       from "@/components/ui/Badge";
import { TeamLogo }        from "@/components/ui/TeamLogo";
import { LeagueLogo }      from "@/components/ui/LeagueLogo";
import { cn }              from "@/lib/utils";
import { leagueMap }       from "@/data/leagues";
import type { Match, Team } from "@/types";

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
function apiToMatch(m: Record<string, unknown>): Match {
  const leagueId = LEAGUE_MAP[m.leagueId as string] ?? (m.leagueId as string);
  return {
    id:        m.id as string, leagueId,
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
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ApiProfile = {
  xp: number;
  rank: string;
  streak: number;
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// HeroLogo
// ─────────────────────────────────────────────────────────────────────────────

function HeroLogo() {
  const [failed, setFailed] = useState(false);
  return (
    <div className={cn(
      "w-11 h-11 rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0 brand-glow",
      failed && "bg-gradient-to-br from-primary to-[#0e3fb5]"
    )}>
      {failed ? (
        <span className="text-white font-black text-lg select-none">P</span>
      ) : (
        <Image src="/brand/predixi-logo.png" alt="PrediXI" width={44} height={44}
          className="w-full h-full object-cover" onError={() => setFailed(true)} priority />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatPill
// ─────────────────────────────────────────────────────────────────────────────

const StatPill = memo(function StatPill({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl glass-inner backdrop-blur-sm">
      <span className="text-primary flex-shrink-0">{icon}</span>
      <div>
        <p className="text-xs font-mono font-black text-white tabular-nums leading-none">{value}</p>
        <p className="text-[9px] font-mono text-white/40 leading-none mt-0.5 uppercase tracking-wide">{label}</p>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SectionHeader
// ─────────────────────────────────────────────────────────────────────────────

const SectionHeader = memo(function SectionHeader({ title, href, linkLabel = "View all" }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="w-[3px] h-[18px] rounded-full flex-shrink-0 glow-accent-bar" />
      <h2 className="text-[11px] font-bold text-white/60 uppercase tracking-[0.14em] flex-1">{title}</h2>
      {href && (
        <Link href={href} className={cn(
          "flex items-center gap-1 text-[11px] font-semibold",
          "text-primary/75 hover:text-primary transition-colors duration-200"
        )}>
          {linkLabel}<ArrowRight size={11} />
        </Link>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Compact home match row — live score / upcoming / finished
// ─────────────────────────────────────────────────────────────────────────────

function HomeMatchRow({ match, delay }: { match: Match; delay: number }) {
  const league     = leagueMap[match.leagueId];
  const isLive     = match.status === "live";
  const isFinished = match.status === "finished";
  const isUpcoming = match.status === "upcoming";

  const kickoffStr = new Date(match.kickoff).toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false,
  });
  const dateStr = new Date(match.kickoff).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut", delay }}
    >
      <Link href="/matches" className="block">
        <div className={cn(
          "relative overflow-hidden rounded-2xl border transition-all duration-200",
          "bg-gradient-to-b from-[#0b0f2a] to-[#060810]",
          isLive
            ? "border-primary/40 shadow-[0_0_24px_rgba(22,82,240,0.14)]"
            : "border-white/[0.07] hover:border-primary/30 hover:bg-primary/[0.03]",
        )}>
          {isLive && <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />}

          <div className="px-4 py-3 flex items-center gap-3">

            {/* League badge */}
            <div className="hidden sm:flex flex-col items-center gap-0.5 flex-shrink-0 w-10 text-center">
              <LeagueLogo leagueId={match.leagueId} size="sm" />
              <span className="text-[9px] font-mono text-white/30 uppercase tracking-wide">
                {league?.shortName ?? "—"}
              </span>
            </div>

            {/* Home team */}
            <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
              <span className="text-xs font-bold text-white/80 truncate text-right hidden xs:block">
                {match.homeTeam.shortName}
              </span>
              <TeamLogo src={match.homeTeam.crest} name={match.homeTeam.shortName} size="sm" />
            </div>

            {/* Score / VS / Time */}
            <div className="flex-shrink-0 w-20 text-center">
              {isLive || isFinished ? (
                <div className="flex items-center justify-center gap-1.5">
                  <span className={cn(
                    "font-mono font-black tabular-nums text-lg leading-none",
                    isLive ? "text-white" : "text-white/60"
                  )}>
                    {match.homeScore ?? 0}
                  </span>
                  <span className={cn("font-black text-sm", isLive ? "text-primary" : "text-white/20")}>–</span>
                  <span className={cn(
                    "font-mono font-black tabular-nums text-lg leading-none",
                    isLive ? "text-white" : "text-white/60"
                  )}>
                    {match.awayScore ?? 0}
                  </span>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-black text-primary/70 font-mono">{kickoffStr}</p>
                  <p className="text-[9px] text-white/25 font-mono">{dateStr}</p>
                </div>
              )}
              {isLive && (
                <div className="flex items-center justify-center gap-1 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
                  <span className="text-[9px] font-mono font-bold text-danger">LIVE</span>
                </div>
              )}
              {isFinished && (
                <p className="text-[9px] font-mono text-white/20 mt-0.5">FT</p>
              )}
            </div>

            {/* Away team */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <TeamLogo src={match.awayTeam.crest} name={match.awayTeam.shortName} size="sm" />
              <span className="text-xs font-bold text-white/80 truncate hidden xs:block">
                {match.awayTeam.shortName}
              </span>
            </div>

            {/* Venue — desktop */}
            {isUpcoming && match.venue && (
              <div className="hidden md:flex items-center gap-1 flex-shrink-0 max-w-[100px]">
                <MapPin size={9} className="text-white/20 flex-shrink-0" />
                <span className="text-[9px] text-white/20 font-mono truncate">{match.venue.split(",")[0]}</span>
              </div>
            )}

            <ArrowRight size={13} className="text-white/15 flex-shrink-0" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const { address, isConnected } = useAccount();
  const [profile,  setProfile]  = useState<ApiProfile | null>(null);
  const [matches,  setMatches]  = useState<Match[]>([]);
  const [loading,  setLoading]  = useState(true);
  const dailyRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!address) { setProfile(null); return; }
    fetch(`/api/profiles?walletAddress=${address}`)
      .then(r => r.json())
      .then(d => { if (d.success) setProfile(d.profile); })
      .catch(() => {});
  }, [address]);

  useEffect(() => {
    fetch("/api/matches?source=fd&limit=10")
      .then(r => r.ok ? r.json() : null)
      .then((d: { matches: Record<string, unknown>[] } | null) => {
        if (!d?.matches?.length) return;
        const all      = d.matches.map(apiToMatch);
        const live     = all.filter(m => m.status === "live");
        const upcoming = all.filter(m => m.status === "upcoming");
        const finished = all.filter(m => m.status === "finished").slice(-3).reverse();
        // Priority: live → upcoming → recent finished, max 5
        const picks = [...live, ...upcoming, ...finished].slice(0, 5);
        setMatches(picks);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const xp        = profile?.xp       ?? 0;
  const streak    = profile?.streak   ?? 0;
  const accuracy  = profile?.accuracy ?? 0;
  const truncAddr = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : null;
  const liveCount = matches.filter(m => m.status === "live").length;

  const matchSectionTitle = liveCount > 0
    ? `Live Now · ${liveCount} match${liveCount > 1 ? "es" : ""}`
    : "Upcoming Matches";

  return (
    <main className="min-h-screen bg-bg text-text-primary font-sans">
      <CinematicIntro />
      <div id="home-main" className="max-w-3xl mx-auto px-4 py-6 sm:py-10 space-y-8">

        {/* ── 1. HERO ──────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.48, ease: "easeOut" }}
        >
          <div className={cn(
            "relative overflow-hidden rounded-3xl",
            "border border-primary/35",
            "bg-gradient-to-br from-primary/18 via-[#060c24] to-[#040710]",
            "shadow-[0_0_80px_rgba(22,82,240,0.18),0_0_0_1px_rgba(22,82,240,0.08)]"
          )}>
            {/* Cinematic hero background */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/backgrounds/home-main-hero.webp" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none" style={{ opacity: 0.22 }} loading="lazy" decoding="async" />
            {/* Ambient orbs */}
            <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-primary opacity-[0.12] blur-3xl pointer-events-none" />
            <div className="absolute -left-12 bottom-0 w-64 h-48 rounded-full bg-[#4d7ef7] opacity-[0.07] blur-3xl pointer-events-none" />
            <div className="absolute right-1/3 bottom-0 w-40 h-40 rounded-full bg-[#7b9ff7] opacity-[0.05] blur-2xl pointer-events-none" />
            {/* Top edge glow */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
            {/* Subtle grid texture */}
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.04]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(100,140,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(100,140,255,1) 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
            />

            <div className="relative z-10 p-6 sm:p-8">

              {/* Brand bar */}
              <div className="flex items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                  <HeroLogo />
                  <div>
                    <span className="font-black text-xl text-white tracking-tight leading-none block">
                      Predi<span className="text-gradient-brand">XI</span>
                    </span>
                    <span className="text-[9px] font-mono text-white/30 tracking-[0.15em] uppercase leading-none">
                      Football Prediction
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {liveCount > 0 && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-danger/10 border border-danger/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
                      <span className="text-[10px] font-mono font-bold text-danger">{liveCount} Live</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse flex-shrink-0" />
                    <span className="text-[10px] font-mono text-white/30 hidden sm:block">Base Mainnet</span>
                  </div>
                </div>
              </div>

              {/* Headline */}
              <div className="mb-6">
                <h1 className="text-[2.6rem] sm:text-5xl font-black tracking-tight leading-[1.02] text-gradient-blue-white">
                  Predict.<br />Earn.<br className="sm:hidden" /> Dominate.
                </h1>
                <p className="text-sm text-white/40 mt-3 font-medium leading-relaxed max-w-sm">
                  On-chain football predictions built on Base.
                  Earn XP, climb ranks, build your Daily XI.
                </p>
              </div>

              <div className="h-px bg-white/[0.06] mb-5" />

              {/* User identity / connect prompt */}
              {isConnected && truncAddr ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-[#4d7ef7] flex items-center justify-center text-xl flex-shrink-0 shadow-lg">
                    ⚡
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white leading-none font-mono">{truncAddr}</span>
                      <RankBadge rank={profile?.rank as "bronze" | "silver" | "gold" | "platinum" | "diamond" ?? "bronze"} size="xs" />
                    </div>
                    <p className="text-[10px] text-white/30 font-mono mt-1">
                      {profile ? `${profile.totalPredictions} predictions · ${profile.correctPredictions} correct` : "Loading…"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                    <StatPill icon={<Zap size={11} />}    value={xp.toLocaleString()} label="XP"     />
                    <StatPill icon={<Flame size={11} />}  value={`${streak}`}          label="Streak" />
                    <StatPill icon={<Target size={11} />} value={`${accuracy}%`}       label="Acc"    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.10] flex items-center justify-center flex-shrink-0">
                    <Shield size={18} className="text-white/20" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white/50">Connect wallet</p>
                    <p className="text-[10px] text-white/25 font-mono mt-0.5">Track your predictions &amp; earn XP</p>
                  </div>
                </div>
              )}

              {/* CTAs */}
              <div className="flex gap-2.5 mt-5 flex-wrap">
                <Link
                  href="/matches"
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black tracking-wide",
                    "bg-primary text-white shadow-[0_4px_20px_rgba(22,82,240,0.45)]",
                    "hover:opacity-90 transition-all duration-150 active:scale-[0.97]",
                  )}
                >
                  <Zap size={12} /> Predict Matches
                </Link>
                <button
                  type="button"
                  onClick={() => dailyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide",
                    "border border-primary/40 text-primary",
                    "hover:border-primary hover:bg-primary/10 transition-all duration-150 active:scale-[0.97]",
                  )}
                >
                  <span>🃏</span> Pick Today's XI
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── 2. DAILY XI HEROES ───────────────────────────────────────────── */}
        <section ref={dailyRef} aria-label="Daily XI Heroes">
          <SectionHeader title="Daily XI Heroes" />
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, ease: "easeOut", delay: 0.1 }}
          >
            <DailyHeroes isConnected={isConnected} />
          </motion.div>
        </section>

        {/* ── 3. ONCHAIN PROOF ─────────────────────────────────────────────── */}
        <section aria-label="Predictions recorded on Base">
          <SectionHeader title="On Base" href="/profile" linkLabel="View record" />
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, ease: "easeOut", delay: 0.15 }}
            className={cn(
              "relative overflow-hidden rounded-2xl border border-primary/25",
              "bg-gradient-to-br from-primary/10 via-[#060c24] to-[#040710]",
            )}
          >
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent" />
            <div className="absolute -right-10 -top-10 w-36 h-36 rounded-full bg-primary opacity-[0.07] blur-2xl pointer-events-none" />

            <div className="relative z-10 px-5 py-5">
              <div className="flex items-start gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5",
                  "bg-primary/15 border border-primary/25",
                  "shadow-[0_0_16px_rgba(22,82,240,0.20)]",
                )}>
                  <Anchor size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white leading-tight">
                    Every Prediction Recorded on Base
                  </p>
                  <p className="text-[11px] text-white/35 mt-1.5 leading-relaxed">
                    When you submit a prediction with a connected wallet, it is written to Base as a permanent onchain record — verifiable by anyone, forever.
                  </p>
                  <p className="text-[9px] font-mono text-white/20 mt-1.5">
                    Requires wallet · Small Base network fee
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 mt-4 pt-4 border-t border-white/[0.06] flex-wrap">
                <Link
                  href="/matches"
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold",
                    "bg-primary text-white shadow-[0_4px_16px_rgba(22,82,240,0.35)]",
                    "hover:opacity-90 transition-all duration-150 active:scale-[0.97]",
                  )}
                >
                  <Zap size={11} /> Make a Prediction
                </Link>
                <Link
                  href="/profile"
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-semibold",
                    "border border-primary/35 text-primary/80",
                    "hover:border-primary hover:bg-primary/10 transition-all duration-150 active:scale-[0.97]",
                  )}
                >
                  <Anchor size={11} /> View Record
                </Link>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ── 4. LIVE / UPCOMING MATCHES ──────────────────────────────────── */}
        <section aria-label="Live and upcoming matches">
          <SectionHeader title={matchSectionTitle} href="/matches" linkLabel="All matches" />
          <div className="space-y-2">
            {loading ? (
              <p className="text-xs text-white/25 font-mono px-1 py-4">Loading fixtures…</p>
            ) : matches.length > 0 ? (
              matches.map((match, i) => (
                <HomeMatchRow key={match.id} match={match} delay={i * 0.06} />
              ))
            ) : (
              <div className={cn(
                "flex items-center gap-3 px-4 py-5 rounded-2xl border",
                "border-white/[0.07] bg-white/[0.02]"
              )}>
                <Clock size={14} className="text-white/20 flex-shrink-0" />
                <p className="text-xs text-white/30 font-mono">No upcoming fixtures this week.</p>
                <Link href="/matches" className="ml-auto text-xs text-primary hover:text-white font-semibold transition-colors">
                  Browse →
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* ── 5. WORLD CUP COMPETITION ─────────────────────────────────────── */}
        <section aria-label="World Cup 2026">
          <SectionHeader title="World Cup 2026" href="/world-cup" linkLabel="Explore" />
          <WorldCupCompetitionCard
            rank={profile?.rank ?? null}
            xp={profile?.xp ?? null}
            streak={profile?.streak ?? null}
          />
        </section>

        {/* ── 6. TOP PREDICTORS ────────────────────────────────────────────── */}
        <section aria-label="Top predictors">
          <SectionHeader title="Top Predictors" href="/leaderboard" linkLabel="Full board" />
          <MiniLeaderboard currentUserId={address ?? ""} limit={5} />
        </section>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <footer className="text-center pb-6">
          <p className="text-[10px] text-white/15 font-mono tracking-[0.15em] uppercase">
            PrediXI · Base App Standard · {isConnected ? "Live Data" : "Connect Wallet"}
          </p>
        </footer>

      </div>
    </main>
  );
}
