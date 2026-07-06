"use client";

import { useState, useMemo, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Zap, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { BracketMatchCard, BracketTBDCard, MobileBracketMatchCard } from "./BracketMatchCard";
import {
  ROUND_LABELS,
  ROUND_SHORT,
  splitHalves,
  getAvailableRounds,
  getActiveRound,
} from "@/lib/football/knockoutUtils";
import type { BracketData, BracketMatch, KnockoutRoundKey } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Layout constants — all in px
// ─────────────────────────────────────────────────────────────────────────────

const SLOT   = 80;   // height of a single R32 slot
const CARD_H = 60;   // match card height (must fit inside SLOT)
const COL_W  = 148;  // bracket column width
const CONN_W = 20;   // connector strip width between columns

// Total half-bracket height: 8 R32 slots per half × SLOT
// (WC 2026: 16 R32 matches → 8 per half)
const HALF_SLOTS = 8;
const TOTAL_H    = HALF_SLOTS * SLOT; // 640px

// Expected match counts per side (left half = right half)
const EXPECTED_PER_SIDE: Record<KnockoutRoundKey, number> = {
  r32:   8,
  r16:   4,
  qf:    2,
  sf:    1,
  final: 1,
  third: 1,
};

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Pad (or trim) an array to exactly `count` elements, filling with null. */
function padToCount(arr: BracketMatch[], count: number): (BracketMatch | null)[] {
  const result: (BracketMatch | null)[] = arr.slice(0, count);
  while (result.length < count) result.push(null);
  return result;
}

/** Connector colour: primary blue if winner decided, else subtle white. */
function connColor(hasWinner: boolean): string {
  return hasWinner ? "rgba(22,82,240,0.55)" : "rgba(255,255,255,0.10)";
}

// ─────────────────────────────────────────────────────────────────────────────
// BracketColumn
// Shows match cards at absolute vertical positions within a fixed-height column.
// ─────────────────────────────────────────────────────────────────────────────

const BracketColumn = memo(function BracketColumn({
  matches,
  slotHeight,
  roundKey,
  animDelay,
}: {
  matches: (BracketMatch | null)[];
  slotHeight: number;
  roundKey: KnockoutRoundKey;
  animDelay: number;
}) {
  return (
    <div className="relative flex-shrink-0" style={{ width: COL_W, height: TOTAL_H }}>
      {matches.map((match, i) => {
        const top = i * slotHeight + (slotHeight - CARD_H) / 2;
        return (
          <div key={match?.id ?? `tbd-${roundKey}-${i}`} className="absolute" style={{ top, left: 0, right: 0 }}>
            {match ? (
              <BracketMatchCard match={match} roundKey={roundKey} delay={animDelay + i * 0.03} />
            ) : (
              <BracketTBDCard />
            )}
          </div>
        );
      })}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// BracketConnector
// Renders vertical bracket arms + horizontal mid-line connecting a column's
// pairs to the next column's single match.
// ─────────────────────────────────────────────────────────────────────────────

const BracketConnector = memo(function BracketConnector({
  pairCount,
  slotHeight,
  matches,
  nextMatches,
}: {
  pairCount: number;
  slotHeight: number;
  matches: (BracketMatch | null)[];
  nextMatches: (BracketMatch | null)[];
}) {
  return (
    <div className="relative flex-shrink-0" style={{ width: CONN_W, height: TOTAL_H }}>
      {Array.from({ length: pairCount }).map((_, i) => {
        const topMatchCenter = i * 2 * slotHeight + slotHeight / 2;
        const botMatchCenter = (i * 2 + 1) * slotHeight + slotHeight / 2;
        const midY           = (i * 2 + 1) * slotHeight; // = (topMatchCenter + botMatchCenter) / 2

        // Both matches of this pair + the target next-round match
        const m0 = matches[i * 2];
        const m1 = matches[i * 2 + 1];
        const next = nextMatches[i];

        // Show winner colour when both this-round matches are done
        const bothDone = m0?.status === "finished" && m1?.status === "finished";
        const color = connColor(bothDone && !!next?.winnerId);

        return (
          <div key={i}>
            {/* Vertical arm */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: topMatchCenter,
                width: 1,
                height: botMatchCenter - topMatchCenter,
                background: color,
                transition: "background 0.4s ease",
              }}
            />
            {/* Horizontal arm at midpoint */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: midY - 0.5,
                width: CONN_W,
                height: 1,
                background: color,
                transition: "background 0.4s ease",
              }}
            />
          </div>
        );
      })}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// BracketConnectorRight
// Mirror of BracketConnector for the right half (arm on the right side)
// ─────────────────────────────────────────────────────────────────────────────

const BracketConnectorRight = memo(function BracketConnectorRight({
  pairCount,
  slotHeight,
  matches,
  nextMatches,
}: {
  pairCount: number;
  slotHeight: number;
  matches: (BracketMatch | null)[];
  nextMatches: (BracketMatch | null)[];
}) {
  return (
    <div className="relative flex-shrink-0" style={{ width: CONN_W, height: TOTAL_H }}>
      {Array.from({ length: pairCount }).map((_, i) => {
        const topMatchCenter = i * 2 * slotHeight + slotHeight / 2;
        const botMatchCenter = (i * 2 + 1) * slotHeight + slotHeight / 2;
        const midY           = (i * 2 + 1) * slotHeight;

        const m0   = matches[i * 2];
        const m1   = matches[i * 2 + 1];
        const next = nextMatches[i];
        const bothDone = m0?.status === "finished" && m1?.status === "finished";
        const color    = connColor(bothDone && !!next?.winnerId);

        return (
          <div key={i}>
            <div style={{
              position: "absolute",
              right: 0,
              top: topMatchCenter,
              width: 1,
              height: botMatchCenter - topMatchCenter,
              background: color,
              transition: "background 0.4s ease",
            }} />
            <div style={{
              position: "absolute",
              left: 0,
              top: midY - 0.5,
              width: CONN_W,
              height: 1,
              background: color,
              transition: "background 0.4s ease",
            }} />
          </div>
        );
      })}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// FinalCenterColumn
// The center column: Final match (vertically centered) + 3rd place below
// ─────────────────────────────────────────────────────────────────────────────

function FinalCenterColumn({
  finalMatch,
  thirdMatch,
}: {
  finalMatch: BracketMatch | null;
  thirdMatch: BracketMatch | null;
}) {
  const finalTop  = TOTAL_H / 2 - CARD_H / 2;      // perfectly centered
  const thirdTop  = TOTAL_H - CARD_H - 8;           // bottom of column

  return (
    <div className="relative flex-shrink-0" style={{ width: COL_W, height: TOTAL_H }}>
      {/* Final match */}
      <div className="absolute" style={{ top: finalTop, left: 0, right: 0 }}>
        {finalMatch ? (
          <div className="relative">
            {/* Trophy icon above Final */}
            <div className="absolute -top-6 inset-x-0 flex items-center justify-center">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25">
                <Trophy size={9} className="text-amber-400" />
                <span className="text-[8px] font-black text-amber-400 uppercase tracking-widest">Final</span>
              </div>
            </div>
            <BracketMatchCard match={finalMatch} roundKey="final" delay={0.5} />
          </div>
        ) : (
          <div className="relative">
            <div className="absolute -top-6 inset-x-0 flex items-center justify-center">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/15">
                <Trophy size={9} className="text-amber-400/50" />
                <span className="text-[8px] font-black text-amber-400/50 uppercase tracking-widest">Final</span>
              </div>
            </div>
            <BracketTBDCard />
          </div>
        )}
      </div>

      {/* 3rd Place match */}
      <div className="absolute" style={{ top: thirdTop, left: 0, right: 0 }}>
        <div className="relative">
          <div className="absolute -top-5 inset-x-0 flex items-center justify-center">
            <span className="text-[8px] font-mono text-white/25 uppercase tracking-widest">3rd Place</span>
          </div>
          {thirdMatch ? (
            <BracketMatchCard match={thirdMatch} roundKey="third" delay={0.5} />
          ) : (
            <BracketTBDCard />
          )}
        </div>
      </div>

      {/* Vertical separator between Final and 3rd Place */}
      <div
        className="absolute inset-x-4 h-px bg-white/[0.05]"
        style={{ top: TOTAL_H - CARD_H - 24 }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Column header label
// ─────────────────────────────────────────────────────────────────────────────

function ColumnHeader({ label }: { label: string }) {
  return (
    <div
      className="flex-shrink-0 flex items-end justify-center pb-2"
      style={{ width: COL_W, height: 32 }}
    >
      <span className="text-[9px] font-mono font-bold text-white/30 uppercase tracking-widest">
        {label}
      </span>
    </div>
  );
}

function ConnectorSpacer() {
  return <div className="flex-shrink-0" style={{ width: CONN_W, height: 32 }} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// DesktopBracket — full horizontal layout
// ─────────────────────────────────────────────────────────────────────────────

function DesktopBracket({ data }: { data: BracketData }) {
  const { left: r32L, right: r32R } = useMemo(() => splitHalves(data.r32), [data.r32]);
  const { left: r16L, right: r16R } = useMemo(() => splitHalves(data.r16), [data.r16]);
  const { left: qfL,  right: qfR  } = useMemo(() => splitHalves(data.qf),  [data.qf]);

  // Pad each side to expected count
  const r32LP = useMemo(() => padToCount(r32L, EXPECTED_PER_SIDE.r32), [r32L]);
  const r32RP = useMemo(() => padToCount(r32R, EXPECTED_PER_SIDE.r32), [r32R]);
  const r16LP = useMemo(() => padToCount(r16L, EXPECTED_PER_SIDE.r16), [r16L]);
  const r16RP = useMemo(() => padToCount(r16R, EXPECTED_PER_SIDE.r16), [r16R]);
  const qfLP  = useMemo(() => padToCount(qfL,  EXPECTED_PER_SIDE.qf),  [qfL]);
  const qfRP  = useMemo(() => padToCount(qfR,  EXPECTED_PER_SIDE.qf),  [qfR]);
  const sfLP  = useMemo(() => padToCount(data.sf.slice(0, 1), EXPECTED_PER_SIDE.sf), [data.sf]);
  const sfRP  = useMemo(() => padToCount(data.sf.slice(1, 2), EXPECTED_PER_SIDE.sf), [data.sf]);

  const finalMatch = data.final[0] ?? null;
  const thirdMatch = data.third[0] ?? null;

  return (
    <div className="overflow-x-auto overflow-y-visible pb-4 -mx-4 px-4">
      {/* Header row */}
      <div className="flex items-end mb-2" style={{ minWidth: "fit-content" }}>
        <ColumnHeader label="R32" />
        <ConnectorSpacer />
        <ColumnHeader label="R16" />
        <ConnectorSpacer />
        <ColumnHeader label="QF" />
        <ConnectorSpacer />
        <ColumnHeader label="SF" />
        <ConnectorSpacer />
        <ColumnHeader label="Final" />
        <ConnectorSpacer />
        <ColumnHeader label="SF" />
        <ConnectorSpacer />
        <ColumnHeader label="QF" />
        <ConnectorSpacer />
        <ColumnHeader label="R16" />
        <ConnectorSpacer />
        <ColumnHeader label="R32" />
      </div>

      {/* Bracket body */}
      <div className="flex items-start" style={{ minWidth: "fit-content" }}>

        {/* ── LEFT HALF ────────────────────────────────────────────────── */}
        <BracketColumn matches={r32LP} slotHeight={SLOT}      roundKey="r32" animDelay={0}    />
        <BracketConnector pairCount={4} slotHeight={SLOT}      matches={r32LP} nextMatches={r16LP} />
        <BracketColumn matches={r16LP} slotHeight={SLOT * 2}  roundKey="r16" animDelay={0.05} />
        <BracketConnector pairCount={2} slotHeight={SLOT * 2}  matches={r16LP} nextMatches={qfLP}  />
        <BracketColumn matches={qfLP}  slotHeight={SLOT * 4}  roundKey="qf"  animDelay={0.10} />
        <BracketConnector pairCount={1} slotHeight={SLOT * 4}  matches={qfLP}  nextMatches={sfLP}  />
        <BracketColumn matches={sfLP}  slotHeight={SLOT * 8}  roundKey="sf"  animDelay={0.15} />

        {/* SF→Final connector (horizontal arm at center height) */}
        <div className="relative flex-shrink-0" style={{ width: CONN_W, height: TOTAL_H }}>
          <div style={{
            position: "absolute",
            left: 0,
            top: TOTAL_H / 2 - 0.5,
            width: CONN_W,
            height: 1,
            background: sfLP[0]?.status === "finished"
              ? connColor(true)
              : connColor(false),
            transition: "background 0.4s ease",
          }} />
        </div>

        {/* ── CENTER ───────────────────────────────────────────────────── */}
        <FinalCenterColumn finalMatch={finalMatch} thirdMatch={thirdMatch} />

        {/* Final→SF right connector */}
        <div className="relative flex-shrink-0" style={{ width: CONN_W, height: TOTAL_H }}>
          <div style={{
            position: "absolute",
            left: 0,
            top: TOTAL_H / 2 - 0.5,
            width: CONN_W,
            height: 1,
            background: sfRP[0]?.status === "finished"
              ? connColor(true)
              : connColor(false),
            transition: "background 0.4s ease",
          }} />
        </div>

        {/* ── RIGHT HALF (mirrored) ──────────────────────────────────── */}
        <BracketColumn matches={sfRP}  slotHeight={SLOT * 8}  roundKey="sf"  animDelay={0.15} />
        <BracketConnectorRight pairCount={1} slotHeight={SLOT * 4}  matches={qfRP}  nextMatches={sfRP}  />
        <BracketColumn matches={qfRP}  slotHeight={SLOT * 4}  roundKey="qf"  animDelay={0.10} />
        <BracketConnectorRight pairCount={2} slotHeight={SLOT * 2}  matches={r16RP} nextMatches={qfRP}  />
        <BracketColumn matches={r16RP} slotHeight={SLOT * 2}  roundKey="r16" animDelay={0.05} />
        <BracketConnectorRight pairCount={4} slotHeight={SLOT}      matches={r32RP} nextMatches={r16RP} />
        <BracketColumn matches={r32RP} slotHeight={SLOT}      roundKey="r32" animDelay={0}    />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MobileBracket — tabbed rounds with match lists
// ─────────────────────────────────────────────────────────────────────────────

function MobileBracket({ data }: { data: BracketData }) {
  const availableRounds = useMemo(() => getAvailableRounds(data), [data]);
  const defaultRound    = useMemo(() => getActiveRound(data.stage), [data.stage]);

  const [activeRound, setActiveRound] = useState<KnockoutRoundKey>(
    availableRounds.includes(defaultRound) ? defaultRound : (availableRounds[0] ?? "r32"),
  );

  const currentMatches = useMemo<BracketMatch[]>(() => {
    return data[activeRound] ?? [];
  }, [data, activeRound]);

  return (
    <div className="space-y-4">
      {/* Round tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {availableRounds.map(rk => (
          <button
            key={rk}
            onClick={() => setActiveRound(rk)}
            className={cn(
              "flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-all duration-150",
              activeRound === rk
                ? "bg-primary text-white shadow-[0_0_12px_rgba(22,82,240,0.35)]"
                : "bg-white/[0.05] text-white/50 hover:bg-white/[0.08] hover:text-white/75 border border-white/[0.07]",
            )}
          >
            {ROUND_SHORT[rk]}
          </button>
        ))}
      </div>

      {/* Match list for selected round */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeRound}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="space-y-2"
        >
          {currentMatches.length > 0 ? (
            currentMatches.map((m, i) => (
              <MobileBracketMatchCard key={m.id} match={m} roundKey={activeRound} delay={i * 0.04} />
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] py-10 text-center">
              <p className="text-sm font-semibold text-white/30">
                {ROUND_LABELS[activeRound]} fixtures will appear here
              </p>
              <p className="text-[11px] font-mono text-white/15 mt-1.5">
                Updated automatically when the draw is made
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton loader
// ─────────────────────────────────────────────────────────────────────────────

export function KnockoutBracketSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-8 w-64 rounded-lg bg-white/[0.04] animate-pulse" />
      <div className="h-[200px] w-full rounded-2xl bg-white/[0.03] animate-pulse" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-knockout empty state
// ─────────────────────────────────────────────────────────────────────────────

function PreKnockoutState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="rounded-2xl border border-dashed border-white/[0.10] bg-white/[0.02] py-14 text-center px-6"
    >
      <div className="w-12 h-12 rounded-2xl bg-primary/[0.08] border border-primary/20 flex items-center justify-center mx-auto mb-4">
        <Trophy size={22} className="text-primary/50" />
      </div>
      <p className="text-sm font-semibold text-white/50">Knockout Stage Coming</p>
      <p className="text-[12px] font-mono text-white/25 mt-2 max-w-xs mx-auto leading-relaxed">
        The bracket populates automatically once the group stage concludes and
        knockout fixtures are confirmed.
      </p>
      <div className="flex items-center justify-center gap-1.5 mt-4">
        <Zap size={11} className="text-primary/40" />
        <span className="text-[10px] font-mono text-white/20">Updates live — no refresh needed</span>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KnockoutBracket — main export
// ─────────────────────────────────────────────────────────────────────────────

interface KnockoutBracketProps {
  data: BracketData | null;
  loading?: boolean;
  error?: string | null;
}

export function KnockoutBracket({ data, loading, error }: KnockoutBracketProps) {
  if (loading) return <KnockoutBracketSkeleton />;

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] px-5 py-6 text-center">
        <p className="text-sm font-semibold text-red-400/80">Failed to load bracket</p>
        <p className="text-[11px] font-mono text-white/25 mt-1">{error}</p>
      </div>
    );
  }

  if (!data || data.stage === "pre_knockout") {
    return <PreKnockoutState />;
  }

  return (
    <div className="space-y-4">
      {/* Stage pill */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/[0.08] border border-primary/20">
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span className="text-[10px] font-mono font-bold text-primary/80 uppercase tracking-wider">
            {data.stage === "complete"
              ? "Tournament Complete"
              : `${ROUND_LABELS[data.stage as KnockoutRoundKey] ?? "Knockout Stage"} Underway`
            }
          </span>
        </div>
        {data.totalKnockoutMatches > 0 && (
          <span className="text-[10px] font-mono text-white/25">
            {data.totalKnockoutMatches} matches
          </span>
        )}
      </div>

      {/* Desktop bracket — hidden on mobile */}
      <div className="hidden lg:block">
        <DesktopBracket data={data} />
      </div>

      {/* Mobile bracket — hidden on desktop */}
      <div className="lg:hidden">
        <MobileBracket data={data} />
      </div>

      {/* View-all link */}
      <p className="text-[10px] font-mono text-white/20 text-center hidden lg:block">
        Click any match card to predict or view details
        <ChevronRight size={10} className="inline ml-0.5 -mt-px" />
      </p>
    </div>
  );
}
