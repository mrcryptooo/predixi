/**
 * knockoutUtils — bracket-building utilities for the WC knockout stage.
 *
 * Converts raw match rows from the database into a structured BracketData
 * object that the KnockoutBracket UI component consumes directly.
 *
 * Design rules:
 *   - No API calls here — pure data transformation.
 *   - All round detection is string-based using the `round` DB column.
 *   - Slot ordering within each round is by kickoff ASC, then by DB insertion
 *     order — this preserves the API-Football canonical bracket ordering.
 *   - TBD slots (missing team names) are normalised to null so the UI can
 *     render a placeholder without special-casing empty strings.
 */

import type {
  BracketMatch,
  BracketTeam,
  BracketData,
  BracketStage,
  KnockoutRoundKey,
} from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Round string → KnockoutRoundKey
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps the raw API-Football `league.round` string to an internal key.
 * Returns null for group-stage rounds or unrecognised strings.
 *
 * Known API-Football WC round strings:
 *   "Group Stage - 1" | "Group Stage - 2" | "Group Stage - 3"
 *   "Round of 32" | "Round of 16"
 *   "Quarter-finals" | "Semi-finals"
 *   "3rd Place Final" | "Final"
 */
export function parseKnockoutRound(round: string | null | undefined): KnockoutRoundKey | null {
  if (!round) return null;
  const r = round.toLowerCase().trim();

  if (r.includes("group"))                          return null;  // group stage
  if (r === "round of 32" || r === "of 32")         return "r32";
  if (r === "round of 16" || r === "of 16")         return "r16";
  if (r.startsWith("quarter"))                       return "qf";
  if (r.startsWith("semi"))                          return "sf";
  // "3rd place" must be tested BEFORE "final" (it also contains "final")
  if (r.includes("3rd") || r.includes("third"))      return "third";
  if (r === "final" || r.includes("final"))          return "final";

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canonical round ordering
// ─────────────────────────────────────────────────────────────────────────────

export const ROUND_ORDER: Record<KnockoutRoundKey, number> = {
  r32:   0,
  r16:   1,
  qf:    2,
  sf:    3,
  final: 4,
  third: 4, // same display depth as Final
};

export const ROUND_LABELS: Record<KnockoutRoundKey, string> = {
  r32:   "Round of 32",
  r16:   "Round of 16",
  qf:    "Quarter-Finals",
  sf:    "Semi-Finals",
  final: "Final",
  third: "3rd Place",
};

export const ROUND_SHORT: Record<KnockoutRoundKey, string> = {
  r32:   "R32",
  r16:   "R16",
  qf:    "QF",
  sf:    "SF",
  final: "Final",
  third: "3rd",
};

/** XP reward per knockout round (higher stake = higher reward). */
export const ROUND_XP: Record<KnockoutRoundKey, number> = {
  r32:   50,
  r16:   100,
  qf:    200,
  sf:    400,
  final: 800,
  third: 200,
};

// ─────────────────────────────────────────────────────────────────────────────
// Raw DB row shape (subset of what the /api/matches query returns)
// ─────────────────────────────────────────────────────────────────────────────

export type RawMatchRow = {
  id: string;
  league_id: string;
  home_team_id: string;
  home_team_name: string;
  home_team_short: string;
  home_team_crest: string | null;
  away_team_id: string;
  away_team_name: string;
  away_team_short: string;
  away_team_crest: string | null;
  kickoff: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  actual_outcome: string | null;
  round: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// TBD normalisation
// ─────────────────────────────────────────────────────────────────────────────

const TBD_PATTERNS = new Set(["tbd", "tbr", "?", "", "winner", "loser"]);

function isTbd(name: string | null | undefined): boolean {
  if (!name) return true;
  return TBD_PATTERNS.has(name.toLowerCase().trim());
}

function toTeam(
  id: string,
  name: string,
  shortName: string,
  crest: string | null,
): BracketTeam | null {
  if (isTbd(name)) return null;
  return { id, name, shortName, crest };
}

// ─────────────────────────────────────────────────────────────────────────────
// Winner derivation
// ─────────────────────────────────────────────────────────────────────────────

function deriveWinnerId(
  row: RawMatchRow,
  home: BracketTeam | null,
  away: BracketTeam | null,
): string | null {
  if (row.actual_outcome === "H") return home?.id ?? null;
  if (row.actual_outcome === "A") return away?.id ?? null;
  // Draws don't happen in knockout — outcome is determined by penalties (PEN
  // status normalised to "finished" by normalizeApfStatus). If outcome is "D"
  // something has gone wrong; return null defensively.
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Projection — derive next-round slots from completed feeder matches when
// API-Football hasn't published the real fixture yet.
//
// Single-elimination bracket rule: within a round sorted by slotIndex, the
// pair (2i, 2i+1) feeds into slot i of the next round. Applies uniformly for
// r32→r16→qf→sf→final. The 3rd-place match is fed by the two SF *losers*.
// ─────────────────────────────────────────────────────────────────────────────

/** Resolves the winner (or loser, for the 3rd-place feed) of a finished match. */
function resolveAdvancingTeam(
  m: BracketMatch | undefined,
  pick: "winner" | "loser",
): BracketTeam | null {
  if (!m || m.status !== "finished" || !m.actualOutcome) return null;
  if (m.actualOutcome === "D") return null; // knockout draws are never final — defensive guard
  if (pick === "winner") {
    return m.actualOutcome === "H" ? m.homeTeam : m.awayTeam;
  }
  return m.actualOutcome === "H" ? m.awayTeam : m.homeTeam;
}

/**
 * Fills the gaps in `targetRound` with synthetic "projected" matches derived
 * from `feederRound`, up to `expectedCount` slots. Real fixtures (already in
 * `targetRound`) always take priority over a projected slot at the same index.
 * A slot is left out entirely (renders as a generic TBD card) when neither
 * feeder match has been decided yet.
 */
function deriveProjectedSlots(
  feederRound: BracketMatch[],
  targetRound: BracketMatch[],
  targetRoundKey: KnockoutRoundKey,
  expectedCount: number,
  pick: "winner" | "loser",
): BracketMatch[] {
  const bySlot = new Map(targetRound.map(m => [m.slotIndex, m]));
  const result: BracketMatch[] = [];

  for (let i = 0; i < expectedCount; i++) {
    const real = bySlot.get(i);
    if (real) { result.push(real); continue; }

    const teamA = resolveAdvancingTeam(feederRound[i * 2],     pick);
    const teamB = resolveAdvancingTeam(feederRound[i * 2 + 1], pick);

    if (!teamA && !teamB) continue; // nothing decided yet — plain TBD slot

    result.push({
      id:            `projected-${targetRoundKey}-${i}`,
      homeTeam:      teamA,
      awayTeam:      teamB,
      kickoffTime:   null,
      status:        "projected",
      homeScore:     null,
      awayScore:     null,
      actualOutcome: null,
      round:         targetRoundKey,
      slotIndex:     i,
      winnerId:      null,
      projected:     true,
    });
  }

  return result.sort((a, b) => a.slotIndex - b.slotIndex);
}

// ─────────────────────────────────────────────────────────────────────────────
// buildBracketData
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts an array of raw WC match rows into a structured BracketData object.
 *
 * Accepts the full WC fixture list (including group stage); group stage rows
 * are silently filtered out. The caller does NOT need to pre-filter.
 *
 * Any round slot without a real API-Football fixture yet is backfilled with a
 * projected placeholder (team names derived from the previous round's
 * results) wherever that's derivable — see `deriveProjectedSlots`.
 */
export function buildBracketData(rows: RawMatchRow[]): BracketData {
  // ── 1. Collect knockout matches grouped by round ───────────────────────────
  const buckets: Record<KnockoutRoundKey, BracketMatch[]> = {
    r32: [], r16: [], qf: [], sf: [], final: [], third: [],
  };

  for (const row of rows) {
    const roundKey = parseKnockoutRound(row.round);
    if (!roundKey) continue; // group stage or unknown

    const home = toTeam(row.home_team_id, row.home_team_name, row.home_team_short, row.home_team_crest);
    const away = toTeam(row.away_team_id, row.away_team_name, row.away_team_short, row.away_team_crest);

    buckets[roundKey].push({
      id:            row.id,
      homeTeam:      home,
      awayTeam:      away,
      kickoffTime:   row.kickoff ?? null,
      status:        row.status ?? "upcoming",
      homeScore:     row.home_score,
      awayScore:     row.away_score,
      actualOutcome: (row.actual_outcome as "H" | "D" | "A" | null) ?? null,
      round:         roundKey,
      slotIndex:     0, // assigned below after sorting
      winnerId:      deriveWinnerId(row, home, away),
      projected:     false,
    });
  }

  // ── 2. Sort each round by kickoff ASC (preserves API-Football bracket order) ─
  for (const key of Object.keys(buckets) as KnockoutRoundKey[]) {
    buckets[key].sort((a, b) => {
      if (!a.kickoffTime) return 1;
      if (!b.kickoffTime) return -1;
      return a.kickoffTime < b.kickoffTime ? -1 : a.kickoffTime > b.kickoffTime ? 1 : 0;
    });
    // Assign slot indices after sorting
    buckets[key].forEach((m, i) => { m.slotIndex = i; });
  }

  // ── 3. Derive current stage + total (real matches only, before projection) ──
  const stage = deriveStage(buckets);

  const totalKnockoutMatches =
    buckets.r32.length + buckets.r16.length + buckets.qf.length +
    buckets.sf.length + buckets.final.length + buckets.third.length;

  // ── 4. Project next-round slots not yet published by API-Football ──────────
  // Order matters: each round's projection depends on the previous round's
  // buckets already being final (including any of ITS OWN projected slots
  // from an earlier round in this same chain would be wrong — but a bracket
  // is only ever short one level at a time in practice, so we chain forward
  // through the already-mutated arrays).
  const r16   = deriveProjectedSlots(buckets.r32, buckets.r16,   "r16",   8, "winner");
  const qf    = deriveProjectedSlots(r16,         buckets.qf,    "qf",    4, "winner");
  const sf    = deriveProjectedSlots(qf,          buckets.sf,    "sf",    2, "winner");
  const final = deriveProjectedSlots(sf,          buckets.final, "final", 1, "winner");
  const third = deriveProjectedSlots(sf,          buckets.third, "third", 1, "loser");

  return {
    r32: buckets.r32,
    r16,
    qf,
    sf,
    final,
    third,
    stage,
    totalKnockoutMatches,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage derivation
// ─────────────────────────────────────────────────────────────────────────────

function allFinished(matches: BracketMatch[]): boolean {
  return matches.length > 0 && matches.every(m => m.status === "finished");
}

/**
 * Walks the bracket shallow → deep (r32 → r16 → qf → sf → final). The
 * "current" stage is the FIRST round that isn't fully finished yet — either
 * because it still has a live/upcoming real match, or because API-Football
 * hasn't published any real fixture for it at all.
 *
 * This must NOT jump ahead just because a later round already has a
 * published fixture — e.g. football-data.org/API-Football routinely publish
 * a Quarter-Final fixture the moment its two Round-of-16 feeders are both
 * finished, while OTHER Round-of-16 matches are still unplayed. The
 * tournament is still "in" Round of 16 until every R16 match is finished,
 * even though a QF fixture already exists on the calendar.
 */
function deriveStage(buckets: Record<KnockoutRoundKey, BracketMatch[]>): BracketStage {
  // No knockout fixtures yet
  if (buckets.r32.length === 0 && buckets.r16.length === 0 &&
      buckets.qf.length   === 0 && buckets.sf.length === 0  &&
      buckets.final.length === 0) {
    return "pre_knockout";
  }

  const order: readonly [BracketStage, BracketMatch[]][] = [
    ["r32",   buckets.r32],
    ["r16",   buckets.r16],
    ["qf",    buckets.qf],
    ["sf",    buckets.sf],
    ["final", buckets.final],
  ]

  for (const [stage, matches] of order) {
    if (!allFinished(matches)) return stage
  }

  return "complete"
}

// ─────────────────────────────────────────────────────────────────────────────
// Bracket halves helper — splits a round into left/right halves for the
// horizontal desktop layout
// ─────────────────────────────────────────────────────────────────────────────

export function splitHalves<T>(arr: T[]): { left: T[]; right: T[] } {
  const half = Math.ceil(arr.length / 2);
  return { left: arr.slice(0, half), right: arr.slice(half) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rounds present in a BracketData (for rendering tabs / navigation)
// ─────────────────────────────────────────────────────────────────────────────

export function getAvailableRounds(data: BracketData): KnockoutRoundKey[] {
  const allRounds: KnockoutRoundKey[] = ["r32", "r16", "qf", "sf", "final", "third"];
  return allRounds.filter(r => data[r].length > 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-select the active round tab for mobile view
// ─────────────────────────────────────────────────────────────────────────────

export function getActiveRound(stage: BracketStage): KnockoutRoundKey {
  switch (stage) {
    case "r32":       return "r32";
    case "r16":       return "r16";
    case "qf":        return "qf";
    case "sf":        return "sf";
    case "final":
    case "complete":  return "final";
    default:          return "r32";
  }
}
