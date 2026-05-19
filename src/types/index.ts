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
  community: CommunityPredictions;
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
