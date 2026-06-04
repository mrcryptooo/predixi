"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import {
  Zap, Shield, Link2, FileText, ChevronDown, ChevronUp, Wallet, Anchor,
} from "lucide-react";
import { badges } from "@/data/badges";
import { getMatchById } from "@/data/matches";
import { leagueMap } from "@/data/leagues";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { StatsBar } from "@/components/profile/StatsBar";
import { PredictionHistory } from "@/components/profile/PredictionHistory";
import { BadgeCard } from "@/components/gamification/BadgeCard";
import { AccentBar } from "@/components/ui/Card";
import { DailyXIProfileCard } from "@/components/profile/DailyXIProfileCard";
import { ActivityFeed }       from "@/components/profile/ActivityFeed";
import { ReferralCard }       from "@/components/profile/ReferralCard";
import { DailyStreak }        from "@/components/home/DailyStreak";
import { loadAllWCPredictions, fetchWCPredictions } from "@/lib/worldcup-predictions";
import { fetchXPEvents, XP_SOURCE_LABELS, type XPLedgerSummary } from "@/lib/xp-ledger";
import {
  createNotification,
  addNotification,
  formatNotificationMessage,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";
import type { PredictionHistoryEntry } from "@/components/profile/PredictionHistory";
import type { User, UserRank } from "@/types";

// Competition code → display short name
const COMP_LABEL: Record<string, string> = {
  PL: "PL", PD: "PD", BL1: "BL1", SA: "SA", FL1: "FL1", WC: "WC", CL: "UCL",
  "premier-league": "PL", "la-liga": "PD", "bundesliga": "BL1",
  "serie-a": "SA", "ligue-1": "FL1", "world-cup-2026": "WC", "champions-league": "UCL",
};

type MatchMeta = {
  homeShort: string; awayShort: string; leagueCode: string; logo: string;
  homeCrest?: string | null; awayCrest?: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Onchain mint state for one earned badge — populated from GET /api/badges */
type BadgeMintInfo = {
  mintedOnchain: boolean;
  onchainTxHash: string | null;
  tokenId:       number | null;
  chainId:       number;
};

type ApiProfile = {
  walletAddress: string;
  xp: number;
  rank: string;
  streak: number;
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  createdAt: string | null;
};

type ApiPrediction = {
  id: string;
  matchId: string;
  outcome: "H" | "D" | "A";
  placedAt: string;
  pointsAwarded: number | null;
  isCorrect: boolean | null;
  // Onchain commitment fields — returned by GET /api/predictions
  commitmentHash:   string | null;
  submittedOnchain: boolean;
  txHash:           string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toHistoryEntry(p: ApiPrediction, metaMap: Record<string, MatchMeta>): PredictionHistoryEntry {
  // Try real API match first, then mock fallback
  const meta   = metaMap[p.matchId];
  const mock   = getMatchById(p.matchId);
  const league = mock ? leagueMap[mock.leagueId] : null;

  const homeShort  = meta?.homeShort ?? mock?.homeTeam.shortName ?? "?";
  const awayShort  = meta?.awayShort ?? mock?.awayTeam.shortName ?? "?";
  const leagueCode = meta ? (COMP_LABEL[meta.leagueCode] ?? meta.leagueCode) : (league?.shortName ?? "?");
  const logo       = meta?.logo ?? league?.logo ?? "⚽";

  const pickLabel =
    p.outcome === "H" ? homeShort
    : p.outcome === "A" ? awayShort
    : "Draw";

  return {
    id:               p.id,
    matchLabel:       `${homeShort} vs ${awayShort}`,
    leagueLabel:      leagueCode,
    pickLabel,
    result:           p.isCorrect === true ? "correct" : p.isCorrect === false ? "incorrect" : "pending",
    xpDelta:          p.pointsAwarded ?? 0,
    date:             new Date(p.placedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    leagueLogo:       logo,
    homeCrest:        meta?.homeCrest ?? null,
    awayCrest:        meta?.awayCrest ?? null,
    homeShort,
    awayShort,
    // Onchain commitment fields — passed through from API response
    commitmentHash:   p.commitmentHash   ?? null,
    submittedOnchain: p.submittedOnchain ?? false,
    txHash:           p.txHash           ?? null,
  };
}

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Section header
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <AccentBar color="primary" />
      <h2 className="text-[11px] font-bold text-white/50 uppercase tracking-[0.14em]">
        {title}
      </h2>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// World Cup Picks summary
// ─────────────────────────────────────────────────────────────────────────────

const WC_TOTAL = 21; // 5 tournament + 12 group + 4 fun

function WCPicksSummary({ walletAddress }: { walletAddress?: string }) {
  const [count,      setCount]      = useState<number | null>(null);
  const [proofCount, setProofCount] = useState(0);

  useEffect(() => {
    // Load localStorage immediately as baseline
    const localStore = loadAllWCPredictions();
    const localCount = Object.keys(localStore).length;
    setCount(localCount);

    // If wallet connected, fetch from API and use that count (more accurate)
    if (!walletAddress) return;
    fetchWCPredictions(walletAddress)
      .then(remoteStore => {
        const remoteCount = Object.keys(remoteStore).length;
        // Use whichever is higher (local may have unsaved remote picks briefly)
        setCount(Math.max(localCount, remoteCount));
        // Count entries with a commitment hash
        const proofs = Object.values(remoteStore).filter(p => p.commitmentHash).length;
        if (proofs > 0) setProofCount(proofs);
      })
      .catch(() => {/* fallback: localStorage count already set */});
  }, [walletAddress]);

  const pct = count !== null ? Math.round((count / WC_TOTAL) * 100) : 0;

  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl border px-4 py-3.5",
      "border-primary/15 bg-gradient-to-r from-primary/[0.06] to-transparent",
    )}>
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">⚽</span>
          <div>
            <p className="text-xs font-bold text-white/70">World Cup Picks</p>
            <p className="text-[10px] font-mono text-white/30 mt-0.5">
              {count !== null ? `${count}/${WC_TOTAL} locked in` : "Loading…"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {proofCount > 0 && (
            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/10 border border-primary/20">
              <Shield size={8} className="text-primary/60 flex-shrink-0" />
              <span className="text-[8px] font-mono text-primary/60 font-bold">{proofCount} proof{proofCount !== 1 ? "s" : ""}</span>
            </div>
          )}
          {count !== null && count > 0 && (
            <div className="w-20 h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
          <a
            href="/world-cup"
            className="text-[10px] font-mono font-bold text-primary/70 hover:text-primary transition-colors whitespace-nowrap"
          >
            {count === 0 ? "Make Picks →" : "View →"}
          </a>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// XP Ledger preview
// ─────────────────────────────────────────────────────────────────────────────

function XPLedgerPreview({ walletAddress }: { walletAddress?: string }) {
  const [ledger, setLedger] = useState<XPLedgerSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!walletAddress) return;
    setLoading(true);
    fetchXPEvents(walletAddress)
      .then(data => {
        setLedger(data);
        // Create a local notification for the newest XP event (dedup by sourceId)
        if (data && data.events.length > 0) {
          const newest = data.events[0];
          if (newest.xpAmount > 0) {
            const { title, message } = formatNotificationMessage({
              type:      'xp_awarded',
              xpAmount:  newest.xpAmount,
              reason:    newest.reason,
            });
            const notif = createNotification({
              type:     'xp_awarded',
              title,
              message,
              sourceId: newest.id,   // dedup key — same event never added twice
              xpAmount: newest.xpAmount,
            });
            addNotification(notif);  // no-op if sourceId already stored
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [walletAddress]);

  if (!walletAddress) return null;

  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl border px-4 py-3.5 space-y-3",
      "border-primary/15 bg-gradient-to-r from-primary/[0.06] to-transparent",
    )}>
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Zap size={12} className="text-primary flex-shrink-0" />
          <p className="text-xs font-bold text-white/70">XP Ledger</p>
        </div>
        {loading ? (
          <span className="text-[10px] font-mono text-white/25 animate-pulse">Loading…</span>
        ) : ledger ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-black text-white">
              {ledger.totalXp.toLocaleString()} XP
            </span>
            <span className="text-[9px] font-mono text-white/25">
              · {ledger.eventCount} event{ledger.eventCount !== 1 ? "s" : ""}
            </span>
          </div>
        ) : null}
      </div>

      {/* Empty state */}
      {!loading && ledger && ledger.eventCount === 0 && (
        <p className="text-[10px] font-mono text-white/25">No settled XP yet</p>
      )}

      {/* Latest 5 events */}
      {!loading && ledger && ledger.eventCount > 0 && (
        <div className="space-y-1.5">
          {ledger.events.slice(0, 5).map((ev) => (
            <div key={ev.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-mono text-white/50 truncate">{ev.reason}</p>
                <p className="text-[9px] font-mono text-white/20">
                  {new Date(ev.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}
                  {" · "}
                  {XP_SOURCE_LABELS[ev.sourceType as keyof typeof XP_SOURCE_LABELS] ?? ev.sourceType}
                </p>
              </div>
              <span className={cn(
                "text-[10px] font-mono font-bold tabular-nums flex-shrink-0",
                ev.xpAmount > 0 ? "text-primary" : "text-white/30",
              )}>
                {ev.xpAmount > 0 ? `+${ev.xpAmount}` : ev.xpAmount} XP
              </span>
            </div>
          ))}
          {ledger.eventCount > 5 && (
            <p className="text-[9px] font-mono text-white/20 pt-0.5">
              +{ledger.eventCount - 5} more event{ledger.eventCount - 5 !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Not-connected state
// ─────────────────────────────────────────────────────────────────────────────

function NotConnected() {
  return (
    <div className={cn(
      "relative overflow-hidden flex flex-col items-center gap-5 py-16 px-6 rounded-3xl text-center",
      "border border-primary/15 bg-gradient-to-b from-[#0b0f28] to-[#060810]",
    )}>
      {/* Wallet connect background */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/backgrounds/wallet-connect-bg.webp" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none" style={{ opacity: 0.30 }} loading="lazy" decoding="async" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[#0b0f28]/30 to-[#060810]/35" />
      <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center relative z-10">
        <Wallet size={24} className="text-primary/60" />
      </div>
      <div className="relative z-10">
        <p className="text-base font-bold text-white/80">Connect your wallet</p>
        <p className="text-sm text-white/35 font-mono mt-1">
          Connect to view your profile, stats, and prediction history.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Base App future items
// ─────────────────────────────────────────────────────────────────────────────

const futureItems = [
  {
    icon:  <Link2 size={15} className="text-primary flex-shrink-0 mt-0.5" />,
    title: "Base Account identity",
    desc:  "In a future phase, this profile connects to your Base Account. Your username and prediction reputation become on-chain identity.",
  },
  {
    icon:  <FileText size={15} className="text-primary flex-shrink-0 mt-0.5" />,
    title: "On-chain prediction proof",
    desc:  "Prediction reputation can later become verifiable on-chain proof — each correct call timestamped on Base.",
  },
  {
    icon:  <Zap size={15} className="text-primary flex-shrink-0 mt-0.5" />,
    title: "Builder Code attribution",
    desc:  "Builder Code-ready transactions come later. PrediXI is registered on Base.dev as a Standard Web App.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { address, isConnected } = useAccount();

  const [profile,     setProfile]     = useState<ApiProfile | null>(null);
  const [predictions, setPredictions] = useState<ApiPrediction[]>([]);
  const [matchMeta,   setMatchMeta]   = useState<Record<string, MatchMeta>>({});
  const [loading,       setLoading]       = useState(false);
  const [showAllBadges, setShowAllBadges] = useState(false);

  // Called by AnchorPredictionButton after PATCH succeeds — updates the row in
  // place so the button switches to "Anchored on Base ✓" without a full refetch.
  const handleAnchorSuccess = useCallback(
    (predictionId: string, txHash: string) => {
      setPredictions(prev =>
        prev.map(p =>
          p.id === predictionId
            ? { ...p, submittedOnchain: true, txHash }
            : p,
        ),
      );
    },
    [],
  );
  // Badge state — populated by /api/badges (read-only, no awards here)
  const [earnedBadgeIds,   setEarnedBadgeIds]   = useState<Set<string>>(new Set<string>());
  // earnedAtMap: badgeId → ISO earnedAt timestamp (for "Unlocked Jan 1" display)
  const [earnedAtMap,      setEarnedAtMap]      = useState<Map<string, string>>(new Map<string, string>());
  // badgeMintInfoMap: badgeId → onchain mint state (minted_onchain, tx hash, etc.)
  const [badgeMintInfoMap, setBadgeMintInfoMap] = useState<Map<string, BadgeMintInfo>>(new Map<string, BadgeMintInfo>());

  useEffect(() => {
    if (!address) {
      setProfile(null);
      setPredictions([]);
      setEarnedBadgeIds(new Set<string>());
      setEarnedAtMap(new Map<string, string>());
      setBadgeMintInfoMap(new Map<string, BadgeMintInfo>());
      return;
    }
    setLoading(true);
    let done = 0;
    const finish = () => { if (++done === 4) setLoading(false); };
    fetch(`/api/profiles?walletAddress=${address}`)
      .then(r => r.json())
      .then(d => { if (d.success) setProfile(d.profile); })
      .catch(() => {})
      .finally(finish);
    fetch(`/api/predictions?walletAddress=${address}`)
      .then(r => r.json())
      .then(d => { if (d.success) setPredictions(d.predictions ?? []); })
      .catch(() => {})
      .finally(finish);
    // Earned badges — read-only, no awards happen here
    fetch(`/api/badges?walletAddress=${address}`)
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setEarnedBadgeIds(new Set<string>((d.earnedBadgeIds ?? []) as string[]));
          const atMap   = new Map<string, string>();
          const mintMap = new Map<string, BadgeMintInfo>();
          for (const eb of (d.earnedBadges ?? []) as {
            badgeId:       string;
            earnedAt:      string;
            mintedOnchain: boolean;
            onchainTxHash: string | null;
            tokenId:       number | null;
            chainId:       number;
          }[]) {
            atMap.set(eb.badgeId, eb.earnedAt);
            mintMap.set(eb.badgeId, {
              mintedOnchain: eb.mintedOnchain ?? false,
              onchainTxHash: eb.onchainTxHash ?? null,
              tokenId:       eb.tokenId       ?? null,
              chainId:       eb.chainId       ?? 8453,
            });
          }
          setEarnedAtMap(atMap);
          setBadgeMintInfoMap(mintMap);
        }
      })
      .catch(() => {})
      .finally(finish);
    // Build match metadata map for fd-* IDs
    fetch(`/api/matches?source=fd&limit=100`)
      .then(r => r.ok ? r.json() : null)
      .then((d: { matches: { id: string; homeTeam: { shortName: string; crest?: string | null }; awayTeam: { shortName: string; crest?: string | null }; leagueId: string }[] } | null) => {
        if (!d) return;
        const map: Record<string, MatchMeta> = {};
        for (const m of d.matches) {
          map[m.id] = { homeShort: m.homeTeam.shortName, awayShort: m.awayTeam.shortName, leagueCode: m.leagueId, logo: "⚽", homeCrest: m.homeTeam.crest, awayCrest: m.awayTeam.crest };
        }
        setMatchMeta(map);
      })
      .catch(() => {})
      .finally(finish);
  }, [address]);

  // Synthetic User for child components
  const syntheticUser: User | null = isConnected && address ? {
    id:                 address,
    username:           truncateAddress(address),
    displayName:        truncateAddress(address),
    avatar:             "⚡",
    initials:           address.slice(2, 4).toUpperCase(),
    xp:                 profile?.xp ?? 0,
    rank:               (profile?.rank as UserRank) ?? "bronze",
    streak:             profile?.streak ?? 0,
    totalPredictions:   profile?.totalPredictions ?? 0,
    correctPredictions: profile?.correctPredictions ?? 0,
    joinedAt:           profile?.createdAt ?? new Date().toISOString(),
    country:            "",
    countryFlag:        "🌐",
    badgeIds:           [],
  } : null;

  // Badge mint callback — updates local state immediately after PATCH succeeds.
  // Switches the card from "Ready to Mint" → "Owned on Base" without a full reload.
  const handleBadgeMinted = useCallback((badgeId: string, txHash: `0x${string}`) => {
    setBadgeMintInfoMap(prev => {
      const next = new Map(prev);
      next.set(badgeId, {
        mintedOnchain: true,
        onchainTxHash: txHash,
        tokenId:       prev.get(badgeId)?.tokenId ?? null,
        chainId:       8453,
      });
      return next;
    });
  }, []);

  // Ref for the Match Predictions section — used by the Onchain Proof summary scroll CTA
  const predictionsRef = useRef<HTMLElement>(null)

  const accuracy       = profile?.accuracy ?? 0;
  const historyEntries = predictions.map(p => toHistoryEntry(p, matchMeta));

  // Onchain proof counts — derived from the already-fetched predictions state
  // anchored:    TX confirmed and recorded in DB
  // proof-ready: commitment hash exists but not yet anchored
  const anchoredCount   = predictions.filter(p => p.submittedOnchain && p.txHash).length
  const proofReadyCount = predictions.filter(p => p.commitmentHash && !p.submittedOnchain).length

  // Split badges into earned (DB-confirmed) and locked (everything else).
  const earnedBadges    = badges.filter(b => earnedBadgeIds.has(b.id));
  const lockedBadges    = badges.filter(b => !earnedBadgeIds.has(b.id));
  // 6 = 2 cols × 3 rows initial view in the compact grid
  const displayedLocked = showAllBadges ? lockedBadges : lockedBadges.slice(0, 6);

  // Badge onchain state counts — derived from earnedBadges + badgeMintInfoMap.
  // Re-derive automatically when handleBadgeMinted updates badgeMintInfoMap.
  const ownedOnBaseCount = earnedBadges.filter(b => {
    const info = badgeMintInfoMap.get(b.id);
    return info?.mintedOnchain === true && !!info?.onchainTxHash;
  }).length;
  const readyToMintCount = earnedBadges.length - ownedOnBaseCount;

  return (
    <main className="min-h-screen bg-bg text-text-primary font-sans relative overflow-hidden">
      {/* Cinematic profile page background */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/backgrounds/profile-bg.webp" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-contain object-top pointer-events-none" style={{ opacity: 0.22 }} loading="lazy" decoding="async" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-bg/20 via-bg/10 to-bg/55" />
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10 space-y-8 relative z-10">

        {/* ── Profile hero / connect state ──────────────────────────────── */}
        {!isConnected ? (
          <NotConnected />
        ) : loading ? (
          <div className={cn(
            "flex items-center justify-center py-16 rounded-3xl",
            "border border-primary/15 bg-gradient-to-b from-[#0b0f28] to-[#060810]",
          )}>
            <p className="text-sm text-white/30 font-mono animate-pulse">Loading profile…</p>
          </div>
        ) : syntheticUser ? (
          <>
            <ProfileHeader
              user={syntheticUser}
              globalRank={0}
              accuracy={accuracy}
              address={address}
            />

            {/* ── Stats ─────────────────────────────────────────────────── */}
            <section>
              <SectionHeader title="Stats" />
              <StatsBar
                totalPredictions={syntheticUser.totalPredictions}
                correctPredictions={syntheticUser.correctPredictions}
                accuracy={accuracy}
                xp={syntheticUser.xp}
                weeklyXp={0}
                streak={syntheticUser.streak}
                globalRank={0}
                joinedAt={syntheticUser.joinedAt}
              />
            </section>

            {/* ── Daily Streak ──────────────────────────────────────────── */}
            <section>
              <SectionHeader title="Daily Streak" />
              <DailyStreak isConnected={isConnected} />
            </section>

            {/* ── Onchain Proof summary ─────────────────────────────────── */}
            {(anchoredCount > 0 || proofReadyCount > 0) && (
              <section>
                <SectionHeader title="Onchain Proof" />
                <div className={cn(
                  "relative overflow-hidden rounded-2xl border border-primary/20",
                  "bg-gradient-to-b from-primary/[0.06] to-transparent",
                  "px-4 py-4",
                )}>
                  <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />

                  <p className="text-[11px] text-white/35 leading-relaxed mb-4">
                    Anchor your best predictions on Base and keep a public proof forever.
                  </p>

                  {/* Counts */}
                  <div className="flex items-stretch gap-3 mb-4">
                    <div className="flex-1 text-center py-3 rounded-xl bg-white/[0.03] border border-emerald-500/15">
                      <p className="text-2xl font-mono font-black text-emerald-400 tabular-nums leading-none">
                        {anchoredCount}
                      </p>
                      <p className="text-[9px] font-mono text-white/25 uppercase tracking-wide mt-1">
                        Anchored
                      </p>
                    </div>
                    <div className="flex-1 text-center py-3 rounded-xl bg-white/[0.03] border border-primary/15">
                      <p className="text-2xl font-mono font-black text-primary/70 tabular-nums leading-none">
                        {proofReadyCount}
                      </p>
                      <p className="text-[9px] font-mono text-white/25 uppercase tracking-wide mt-1">
                        Proof-ready
                      </p>
                    </div>
                  </div>

                  {proofReadyCount > 0 && (
                    <button
                      type="button"
                      onClick={() => predictionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                      className={cn(
                        "w-full flex items-center justify-center gap-2 py-2 rounded-xl",
                        "text-[10px] font-semibold text-primary/70 hover:text-primary",
                        "border border-primary/20 hover:border-primary/35",
                        "bg-primary/5 hover:bg-primary/10 transition-all duration-150 active:scale-[0.99]",
                      )}
                    >
                      <Anchor size={10} />
                      Go to Match Predictions
                    </button>
                  )}
                </div>
              </section>
            )}

            {/* ── Daily XI ──────────────────────────────────────────────── */}
            <section>
              <SectionHeader title="My Daily XI" />
              <DailyXIProfileCard />
            </section>

            {/* ── Badge Collection ──────────────────────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <AccentBar color="primary" />
                  <h2 className="text-[11px] font-bold text-white/50 uppercase tracking-[0.14em]">
                    Badge Collection
                  </h2>
                </div>
                <span className="text-[10px] font-mono text-white/30">
                  <span className={cn(earnedBadges.length > 0 ? "text-white/60 font-bold" : "")}>
                    {earnedBadges.length}
                  </span>
                  <span className="text-white/20"> / {badges.length} unlocked</span>
                </span>
              </div>

              {/* ── Onchain status chips — shown once any badge has been earned ──── */}
              {earnedBadges.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mb-4 -mt-1">
                  {ownedOnBaseCount > 0 && (
                    <span className={cn(
                      "inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md",
                      "bg-emerald-500/[0.08] border border-emerald-500/[0.15]",
                      "text-[8px] font-mono font-semibold text-emerald-400/70 select-none",
                    )}>
                      <span className="w-1 h-1 rounded-full bg-emerald-400 flex-shrink-0" />
                      Owned on Base
                      <span className="text-emerald-400 font-bold">· {ownedOnBaseCount}</span>
                    </span>
                  )}
                  {readyToMintCount > 0 && (
                    <span className={cn(
                      "inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md",
                      "bg-[#00C2FF]/[0.08] border border-[#00C2FF]/[0.15]",
                      "text-[8px] font-mono font-semibold text-[#00C2FF]/60 select-none",
                    )}>
                      <span className="w-1 h-1 rounded-full bg-[#00C2FF] flex-shrink-0" />
                      Ready to Mint
                      <span className="text-[#00C2FF]/80 font-bold">· {readyToMintCount}</span>
                    </span>
                  )}
                  {lockedBadges.length > 0 && (
                    <span className={cn(
                      "inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md",
                      "bg-white/[0.03] border border-white/[0.07]",
                      "text-[8px] font-mono font-semibold text-white/25 select-none",
                    )}>
                      <span className="w-1 h-1 rounded-full bg-white/30 flex-shrink-0" />
                      Locked
                      <span className="text-white/35 font-bold">· {lockedBadges.length}</span>
                    </span>
                  )}
                </div>
              )}

              {/* Earned badges grid */}
              <div className="mb-6">
                {earnedBadges.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {earnedBadges.map((badge, i) => {
                      const mintInfo = badgeMintInfoMap.get(badge.id);
                      return (
                        <BadgeCard
                          key={badge.id}
                          badge={badge}
                          earned={true}
                          earnedAt={earnedAtMap.get(badge.id)}
                          delay={i * 0.05}
                          mintedOnchain={mintInfo?.mintedOnchain ?? false}
                          onchainTxHash={mintInfo?.onchainTxHash ?? null}
                          tokenId={mintInfo?.tokenId ?? null}
                          onMinted={handleBadgeMinted}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className={cn(
                    "relative overflow-hidden rounded-2xl border border-white/[0.06]",
                    "bg-gradient-to-r from-white/[0.02] to-transparent",
                    "px-4 py-5 flex items-center gap-3",
                  )}>
                    <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-lg flex-shrink-0 opacity-40">
                      🏅
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white/35">No badges yet</p>
                      <p className="text-[10px] font-mono text-white/20 mt-0.5">
                        Place your first prediction to start unlocking badges and XP.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Locked badges grid */}
              {lockedBadges.length > 0 && (
                <div>
                  <p className="text-[10px] font-mono text-white/20 uppercase tracking-[0.12em] mb-3">
                    Locked — {lockedBadges.length} remaining
                  </p>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {displayedLocked.map((badge, i) => (
                      <BadgeCard
                        key={badge.id}
                        badge={badge}
                        earned={false}
                        delay={i * 0.02}
                      />
                    ))}
                  </div>
                  {lockedBadges.length > 6 && (
                    <button
                      type="button"
                      onClick={() => setShowAllBadges(p => !p)}
                      className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-white/30 hover:text-primary transition-colors duration-150"
                    >
                      {showAllBadges ? (
                        <><ChevronUp size={12} /> Show less</>
                      ) : (
                        <><ChevronDown size={12} /> Show all {lockedBadges.length} locked badges</>
                      )}
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* ── World Cup Picks ───────────────────────────────────────── */}
            <section>
              <SectionHeader title="World Cup Picks" />
              <WCPicksSummary walletAddress={address} />
            </section>

            {/* ── XP Ledger ─────────────────────────────────────────────── */}
            <section>
              <SectionHeader title="XP Ledger" />
              <XPLedgerPreview walletAddress={address} />
            </section>

            {/* ── Referral Program ──────────────────────────────────────── */}
            <section>
              <SectionHeader title="Referral Program" />
              <ReferralCard walletAddress={address} />
            </section>

            {/* ── Unified activity feed ─────────────────────────────────── */}
            <section>
              <SectionHeader title="Recent Activity" />
              <ActivityFeed walletAddress={address!} matchMeta={matchMeta} />
            </section>

            {/* ── Prediction history ────────────────────────────────────── */}
            <section ref={predictionsRef}>
              <SectionHeader title="Match Predictions" />

              {/* Inline anchor-feature callout — visible once there are predictions */}
              {historyEntries.length > 0 && (
                <div className={cn(
                  "flex items-start gap-2.5 px-3 py-2.5 mb-3 rounded-xl",
                  "bg-primary/[0.05] border border-primary/12",
                )}>
                  <Anchor size={11} className="text-primary/40 flex-shrink-0 mt-px" />
                  <div>
                    <p className="text-[10px] font-bold text-white/45 leading-none mb-0.5">
                      Proof-ready Predictions
                    </p>
                    <p className="text-[10px] text-white/25 leading-relaxed">
                      Your predictions stay free. Anchor only the calls you want to prove publicly on Base.
                    </p>
                    <p className="text-[9px] font-mono text-white/18 mt-1">
                      Optional · Requires a small Base network fee
                    </p>
                  </div>
                </div>
              )}

              <PredictionHistory
                entries={historyEntries}
                onAnchorSuccess={handleAnchorSuccess}
              />
            </section>
          </>
        ) : null}

        {/* ── Base App future identity ───────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.2 }}
        >
          <SectionHeader title="Base App Future" />
          <div className={cn(
            "relative overflow-hidden rounded-3xl",
            "border border-primary/25",
            "bg-gradient-to-br from-primary/10 via-[#070b22] to-bg",
            "p-5 space-y-4"
          )}>
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent" />
            <div className="absolute -right-10 -top-10 w-36 h-36 rounded-full bg-primary opacity-[0.06] blur-2xl pointer-events-none" />

            <div className="flex items-center gap-3 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
                <Shield size={18} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-tight">Base Account Identity</p>
                <p className="text-xs text-white/30 font-mono">Connecting in a future phase</p>
              </div>
            </div>

            <div className="space-y-3 relative z-10">
              {futureItems.map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  {item.icon}
                  <div>
                    <p className="text-xs font-semibold text-white/80 leading-tight">{item.title}</p>
                    <p className="text-[11px] text-white/30 leading-relaxed mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-white/[0.06] relative z-10">
              <Zap size={10} className="text-primary/50" />
              <p className="text-[10px] text-white/20 font-mono">
                {isConnected ? `Connected · ${truncateAddress(address!)}` : "No wallet connected · No on-chain code in this phase"}
              </p>
            </div>
          </div>
        </motion.section>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <footer className="text-center pb-6 pt-2">
          <p className="text-[10px] text-white/15 font-mono tracking-[0.14em] uppercase">
            PrediXI · Profile · {isConnected ? "Live Data" : "Connect Wallet"}
          </p>
        </footer>

      </div>
    </main>
  );
}
