// ─────────────────────────────────────────────────────────────────────────────
// Batch 1 — Design system helpers
// ─────────────────────────────────────────────────────────────────────────────

export type ColorToken = {
  name: string;
  hex: string;
  label: string;
  bgClass: string;
};

export type ChecklistItem = {
  label: string;
  done: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// Batch 2 — Domain types
// ─────────────────────────────────────────────────────────────────────────────

// ── Leagues ──────────────────────────────────────────────────────────────────

export type League = {
  id: string;
  name: string;
  shortName: string;
  country: string;
  countryFlag: string;  // emoji
  logo: string;         // emoji
  tier: "domestic" | "continental" | "international";
  season: string;
};

// ── Teams ─────────────────────────────────────────────────────────────────────

export type Team = {
  id: string;
  name: string;
  shortName: string;    // 3-letter code, e.g. "ARS"
  logo: string;         // emoji or initials string
  crest?: string | null; // URL from football-data.org (optional, populated after sync)
  leagueId: string;
  city: string;
  country: string;
};

// ── Matches ───────────────────────────────────────────────────────────────────

export type MatchStatus = "upcoming" | "live" | "finished" | "postponed";

export type MatchOutcome = "home" | "draw" | "away";

export type CommunityPredictions = {
  home: number;   // percentage, must sum to 100 with draw + away
  draw: number;
  away: number;
};

export type Match = {
  id: string;
  leagueId: string;
  homeTeam: Team;
  awayTeam: Team;
  kickoff: string;      // ISO 8601 string
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  community: CommunityPredictions | null;
  matchday: number;
  venue: string;
};

// ── Users ─────────────────────────────────────────────────────────────────────

export type UserRank = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "legend";

export type User = {
  id: string;
  username: string;
  displayName: string;
  avatar: string;         // emoji
  initials: string;       // 2-char fallback
  xp: number;
  rank: UserRank;
  streak: number;         // current correct-prediction streak
  totalPredictions: number;
  correctPredictions: number;
  joinedAt: string;       // ISO date string
  country: string;
  countryFlag: string;    // emoji
  badgeIds: string[];
};

// ── Leaderboard ───────────────────────────────────────────────────────────────

export type LeaderboardEntry = {
  position: number;
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  initials: string;
  countryFlag: string;
  xp: number;
  rank: UserRank;
  streak: number;
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;       // 0–100 percentage
  weeklyXp: number;
  badgeIds: string[];
};

// ── Badges ────────────────────────────────────────────────────────────────────

export type BadgeRarity = "common" | "rare" | "epic" | "legendary";

export type Badge = {
  id: string;
  name: string;
  description: string;
  icon: string;           // emoji
  rarity: BadgeRarity;
  category: "streak" | "accuracy" | "volume" | "special" | "league" | "worldcup";
  xpReward: number;
  criteria: string;       // human-readable unlock condition
};

// ── World Cup ─────────────────────────────────────────────────────────────────

export type WorldCupTeam = {
  name: string;
  shortCode: string;      // 3-letter FIFA code
  flag: string;           // emoji
  group: string;
  // Standings — optional; only populated once tournament starts (Jun 11 2026)
  played?: number;
  won?: number;
  drawn?: number;
  lost?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  goalDiff?: number;
  points?: number;
};

export type WorldCupGroup = {
  name: string;           // "Group A", "Group B", etc.
  teams: WorldCupTeam[];
};

export type WorldCupFixture = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeFlag: string;
  awayFlag: string;
  date: string;
  venue: string;
  city: string;
  stage: "group" | "r16" | "qf" | "sf" | "final";
  group?: string;
  community: CommunityPredictions;
};

// ── Zustand Store ─────────────────────────────────────────────────────────────

export type PredictionRecord = {
  matchId: string;
  outcome: MatchOutcome;
  placedAt: string;       // ISO timestamp
};

// ── Knockout Bracket ──────────────────────────────────────────────────────────

/** Canonical knockout round keys, in progression order. */
export type KnockoutRoundKey = "r32" | "r16" | "qf" | "sf" | "final" | "third";

/** Minimal team shape used inside bracket match nodes. */
export type BracketTeam = {
  id: string;
  name: string;
  shortName: string;
  crest: string | null;
};

/** A single match node in the knockout bracket. */
export type BracketMatch = {
  /** Supabase match ID for a real fixture, or a synthetic "projected-..." id
   *  when the match doesn't exist in API-Football yet (see `projected`). */
  id: string;
  homeTeam: BracketTeam | null;   // null = slot not yet filled (TBD)
  awayTeam: BracketTeam | null;
  kickoffTime: string | null;
  status: string;                  // "upcoming" | "live" | "finished" | "projected" | ...
  homeScore: number | null;
  awayScore: number | null;
  actualOutcome: "H" | "D" | "A" | null;
  round: KnockoutRoundKey;
  /** 0-based index within the round, determines bracket position */
  slotIndex: number;
  /** The id of the winning BracketTeam, or null when not yet decided */
  winnerId: string | null;
  /** True when this slot has no real API-Football fixture yet — team names
   *  (if any) are derived from completed feeder-round results client-side.
   *  Not linkable to /matches/[id]; no real match exists. */
  projected: boolean;
};

/** Bracket progression stage — drives which tab/view auto-selects. */
export type BracketStage =
  | "pre_knockout"   // group stage still ongoing / not started
  | "r32"
  | "r16"
  | "qf"
  | "sf"
  | "final"
  | "complete";

/** Full bracket payload returned by /api/wc-bracket */
export type BracketData = {
  r32:   BracketMatch[];   // up to 16 matches
  r16:   BracketMatch[];   // up to 8 matches
  qf:    BracketMatch[];   // up to 4 matches
  sf:    BracketMatch[];   // up to 2 matches
  final: BracketMatch[];   // 1 match
  third: BracketMatch[];   // 1 match (3rd place)
  stage: BracketStage;
  totalKnockoutMatches: number;
};
