"use client";

import { useEffect, useState } from "react";
import { useParams }           from "next/navigation";
import Link                    from "next/link";
import { motion }              from "framer-motion";
import { ArrowLeft, MapPin, CalendarDays, Zap, Trophy, Users } from "lucide-react";
import { cn }                  from "@/lib/utils";
import { TeamLogo }            from "@/components/ui/TeamLogo";
import { MatchStatusBadge }    from "@/components/ui/Badge";
import { PredictionBar }       from "@/components/matches/PredictionBar";
import { FormGuide }           from "@/components/matches/FormGuide";
import { HeadToHead }          from "@/components/matches/HeadToHead";
import { StandingsContext }    from "@/components/matches/StandingsContext";
import { PredictionModal }     from "@/components/prediction/PredictionModal";
import { usePredictionStore }  from "@/store/usePredictionStore";
import { leagueMap }           from "@/data/leagues";
import type { Match }          from "@/types";
import type { TeamFormData }   from "@/components/matches/FormGuide";
import type { H2HData }        from "@/components/matches/HeadToHead";

// ─────────────────────────────────────────────────────────────────────────────
// API response types
// ─────────────────────────────────────────────────────────────────────────────

type MatchDetailTeam = {
  id:        string;
  name:      string;
  shortName: string;
  crest:     string | null;
};

type MatchDetail = {
  id:            string;
  leagueId:      string;
  homeTeam:      MatchDetailTeam;
  awayTeam:      MatchDetailTeam;
  kickoff:       string;
  status:        Match["status"];
  homeScore:     number | null;
  awayScore:     number | null;
  actualOutcome: "H" | "D" | "A" | null;
  matchday:      number | null;
  venue:         string | null;
  leagueLogo:    string | null;
  countryFlag:   string | null;
  community:     { home: number; draw: number; away: number } | null;
};

type DetailResponse = {
  ok:   boolean;
  match: MatchDetail;
  form:  { home: TeamFormData; away: TeamFormData };
  h2h:   H2HData;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatKickoff(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false,
  });
}

function xpLabel(status: string, leagueId: string): string {
  if (leagueId === "champions-league") return "2.5× XP · UCL";
  if (leagueId === "world-cup-2026")   return "3.0× XP · WC";
  if (status === "live")               return "2.0× XP · LIVE";
  return "10 XP";
}

// ─────────────────────────────────────────────────────────────────────────────
// Section wrapper
// ─────────────────────────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children }: {
  title:    string;
  icon?:    React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: "easeOut" }}
      className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden"
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
        {Icon && <Icon size={13} className="text-primary flex-shrink-0" />}
        <span className="text-[11px] font-mono font-semibold text-white/45 uppercase tracking-[0.12em]">
          {title}
        </span>
      </div>
      <div className="p-4">{children}</div>
    </motion.section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-48 rounded-3xl bg-white/[0.05]" />
      <div className="h-24 rounded-2xl bg-white/[0.04]" />
      <div className="h-40 rounded-2xl bg-white/[0.03]" />
      <div className="h-32 rounded-2xl bg-white/[0.03]" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function MatchDetailPage() {
  const params = useParams();
  const id     = params?.id as string;

  const [data,    setData]    = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);

  const { getPrediction } = usePredictionStore();

  useEffect(() => {
    if (!id) return;
    fetch(`/api/matches/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: DetailResponse | null) => { if (d?.ok) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  // ── Build Match object for PredictionModal ────────────────────────────────
  const matchForModal: Match | null = data?.match
    ? {
        id:        data.match.id,
        leagueId:  data.match.leagueId,
        homeTeam:  {
          id: data.match.homeTeam.id, name: data.match.homeTeam.name,
          shortName: data.match.homeTeam.shortName, logo: "⚽",
          crest: data.match.homeTeam.crest, leagueId: data.match.leagueId,
          city: "", country: "",
        },
        awayTeam:  {
          id: data.match.awayTeam.id, name: data.match.awayTeam.name,
          shortName: data.match.awayTeam.shortName, logo: "⚽",
          crest: data.match.awayTeam.crest, leagueId: data.match.leagueId,
          city: "", country: "",
        },
        kickoff:   data.match.kickoff,
        status:    data.match.status,
        homeScore: data.match.homeScore,
        awayScore: data.match.awayScore,
        community: data.match.community,
        matchday:  data.match.matchday ?? 0,
        venue:     data.match.venue ?? "",
      }
    : null;

  const m           = data?.match;
  const league      = m ? leagueMap[m.leagueId] : null;
  const userPick    = m ? getPrediction(m.id)?.outcome : undefined;
  const isPastKO    = m ? Date.now() >= new Date(m.kickoff).getTime() : false;
  const isLocked    = m ? m.status === "finished" || m.status === "live" || isPastKO : false;
  const canPredict  = !isLocked && !!m;

  return (
    <main className="min-h-screen bg-bg text-text-primary font-sans">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10 space-y-4">

        {/* ── Back nav ─────────────────────────────────────────────────────── */}
        <Link
          href="/matches"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/35 hover:text-white/65 transition-colors duration-150"
        >
          <ArrowLeft size={13} />
          Back to Matches
        </Link>

        {/* ── Loading ──────────────────────────────────────────────────────── */}
        {loading && <PageSkeleton />}

        {/* ── Not found ────────────────────────────────────────────────────── */}
        {!loading && !data && (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <span className="text-4xl">⚽</span>
            <p className="text-sm font-bold text-white/50">Match not found</p>
            <p className="text-xs text-white/25 font-mono">This match may not be in our system yet</p>
            <Link href="/matches" className="text-xs font-semibold text-primary hover:text-white transition-colors">
              Browse all matches →
            </Link>
          </div>
        )}

        {/* ── Main content ─────────────────────────────────────────────────── */}
        {!loading && m && (
          <>
            {/* ── Hero card ──────────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className={cn(
                "relative overflow-hidden rounded-3xl border",
                "bg-gradient-to-br from-[#0b0f2a] via-[#070b22] to-[#060810]",
                m.status === "live"
                  ? "border-primary/45 shadow-[0_0_40px_rgba(22,82,240,0.15)]"
                  : "border-primary/20"
              )}
            >
              {/* Top highlight line */}
              {m.status === "live" && (
                <div className="h-[3px] w-full gradient-brand" />
              )}

              <div className="p-5 sm:p-6 space-y-5">

                {/* League + matchday */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {m.leagueLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.leagueLogo} alt="" className="w-5 h-5 object-contain rounded" />
                    ) : (
                      <span className="text-base">{league?.logo ?? "⚽"}</span>
                    )}
                    <span className="text-xs font-semibold text-white/50">
                      {league?.name ?? m.leagueId}
                      {m.matchday ? ` · MD${m.matchday}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border",
                      m.status === "live"
                        ? "text-primary bg-primary/12 border-primary/25"
                        : "text-white/35 bg-white/[0.04] border-white/[0.07]"
                    )}>
                      <Zap size={8} />
                      {xpLabel(m.status, m.leagueId)}
                    </span>
                    <MatchStatusBadge status={m.status} />
                  </div>
                </div>

                {/* Teams + score */}
                <div className="flex items-center gap-3 sm:gap-4">
                  {/* Home */}
                  <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
                    <TeamLogo src={m.homeTeam.crest} name={m.homeTeam.shortName} className="w-16 h-16 sm:w-20 sm:h-20" />
                    <div className="text-center min-w-0 w-full">
                      <p className="text-sm font-black text-white leading-tight truncate">{m.homeTeam.shortName}</p>
                      <p className="text-[10px] text-white/30 font-mono hidden sm:block truncate">{m.homeTeam.name}</p>
                    </div>
                  </div>

                  {/* Center */}
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    {m.status === "upcoming" ? (
                      <>
                        <div className="w-16 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                          <span className="font-black text-base text-primary tracking-wider">VS</span>
                        </div>
                        <span className="text-[10px] font-mono text-white/30 tabular-nums">
                          {new Date(m.kickoff).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",timeZone:"UTC",hour12:false})}
                        </span>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className={cn("font-mono font-black tabular-nums text-3xl sm:text-4xl", m.status === "live" ? "text-white" : "text-white/70")}>
                          {m.homeScore ?? 0}
                        </span>
                        <span className={cn("font-black text-2xl", m.status === "live" ? "text-primary" : "text-white/25")}>–</span>
                        <span className={cn("font-mono font-black tabular-nums text-3xl sm:text-4xl", m.status === "live" ? "text-white" : "text-white/70")}>
                          {m.awayScore ?? 0}
                        </span>
                      </div>
                    )}
                    {m.status === "live" && (
                      <span className="text-[9px] font-mono font-bold text-danger animate-pulse">● LIVE</span>
                    )}
                  </div>

                  {/* Away */}
                  <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
                    <TeamLogo src={m.awayTeam.crest} name={m.awayTeam.shortName} className="w-16 h-16 sm:w-20 sm:h-20" />
                    <div className="text-center min-w-0 w-full">
                      <p className="text-sm font-black text-white leading-tight truncate">{m.awayTeam.shortName}</p>
                      <p className="text-[10px] text-white/30 font-mono hidden sm:block truncate">{m.awayTeam.name}</p>
                    </div>
                  </div>
                </div>

                {/* Venue + date */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 text-[10px] text-white/30 font-mono">
                  {m.venue && (
                    <span className="flex items-center gap-1 truncate">
                      <MapPin size={10} className="flex-shrink-0 text-white/20" />
                      {m.venue}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <CalendarDays size={10} className="flex-shrink-0 text-white/20" />
                    {formatKickoff(m.kickoff)} UTC
                  </span>
                </div>

              </div>
            </motion.div>

            {/* ── Prediction section ─────────────────────────────────────── */}
            <Section title="Community Picks" icon={Users}>
              <div className="space-y-4">
                <PredictionBar
                  community={m.community}
                  homeLabel={m.homeTeam.shortName}
                  awayLabel={m.awayTeam.shortName}
                  userPick={userPick}
                />

                {/* Predict CTA */}
                {m.status === "finished" ? (
                  <div className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
                    <span className="text-[11px] text-white/25 font-mono font-semibold tracking-wide">
                      Full Time · Predictions Closed
                    </span>
                  </div>
                ) : isLocked ? (
                  <div className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
                    <span className="text-[11px] text-white/25 font-mono font-semibold tracking-wide">
                      Locked after kick-off
                    </span>
                  </div>
                ) : userPick ? (
                  <div className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-success/8 border border-success/20">
                    <span className="text-xs font-bold text-success tracking-wide">
                      ✓ Locked —{" "}
                      {userPick === "home" ? m.homeTeam.shortName : userPick === "away" ? m.awayTeam.shortName : "Draw"}
                    </span>
                  </div>
                ) : canPredict ? (
                  <button
                    type="button"
                    onClick={() => setModal(true)}
                    className={cn(
                      "w-full py-3 rounded-2xl text-xs font-black tracking-wide",
                      "transition-all duration-150 active:scale-[0.98]",
                      m.status === "live"
                        ? "gradient-brand text-white shadow-[0_4px_24px_rgba(22,82,240,0.35)]"
                        : "bg-primary text-white hover:bg-[#1248d8] shadow-[0_2px_16px_rgba(22,82,240,0.22)]"
                    )}
                  >
                    {m.status === "live" ? "⚡ Predict Now — 2× XP" : "Predict Match"}
                  </button>
                ) : null}
              </div>
            </Section>

            {/* ── Form Guide ────────────────────────────────────────────── */}
            <Section title="Form Guide" icon={Trophy}>
              {data.form.home.results.length === 0 && data.form.away.results.length === 0 ? (
                <p className="text-xs text-white/25 font-mono text-center py-4">
                  Form data available once matches are recorded
                </p>
              ) : (
                <FormGuide home={data.form.home} away={data.form.away} />
              )}
            </Section>

            {/* ── Head-to-Head ──────────────────────────────────────────── */}
            <Section title="Head-to-Head" icon={Zap}>
              <HeadToHead
                data={data.h2h}
                homeTeamName={m.homeTeam.name}
                awayTeamName={m.awayTeam.name}
                homeCrest={m.homeTeam.crest}
                awayCrest={m.awayTeam.crest}
              />
            </Section>

            {/* ── Standings Context ─────────────────────────────────────── */}
            {["premier-league","la-liga","bundesliga","serie-a","ligue-1","champions-league"].includes(m.leagueId) && (
              <Section title="League Standings" icon={CalendarDays}>
                <StandingsContext
                  leagueId={m.leagueId}
                  homeTeamName={m.homeTeam.name}
                  awayTeamName={m.awayTeam.name}
                  homeCrest={m.homeTeam.crest}
                  awayCrest={m.awayTeam.crest}
                />
              </Section>
            )}

            {/* ── Match Insights ────────────────────────────────────────── */}
            <Section title="Match Insights">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "XP Reward",    value: xpLabel(m.status, m.leagueId) },
                    { label: "Competition",  value: league?.name ?? m.leagueId },
                    { label: "Matchday",     value: m.matchday ? `MD ${m.matchday}` : "—" },
                    { label: "Status",       value: m.status.charAt(0).toUpperCase() + m.status.slice(1) },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
                      <p className="text-[9px] font-mono text-white/25 uppercase tracking-wider">{label}</p>
                      <p className="text-xs font-bold text-white/75 mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-white/20 font-mono text-center pt-1">
                  PrediXI · Match {m.id}
                </p>
              </div>
            </Section>

          </>
        )}
      </div>

      {/* ── Prediction modal ─────────────────────────────────────────────────── */}
      {modal && matchForModal && (
        <PredictionModal
          match={matchForModal}
          onClose={() => setModal(false)}
        />
      )}
    </main>
  );
}
