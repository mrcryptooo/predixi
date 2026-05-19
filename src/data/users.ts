import type { User } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Mock users — rich data for UI development
// ─────────────────────────────────────────────────────────────────────────────

export const users: User[] = [
  {
    id: "usr-001",
    username: "cryptokicker",
    displayName: "CryptoKicker",
    avatar: "⚽",
    initials: "CK",
    xp: 14850,
    rank: "legend",
    streak: 11,
    totalPredictions: 312,
    correctPredictions: 224,
    joinedAt: "2024-01-15T10:00:00Z",
    country: "United Kingdom",
    countryFlag: "🇬🇧",
    badgeIds: ["hat-trick", "oracle", "centurion", "streak-10", "early-adopter"],
  },
  {
    id: "usr-002",
    username: "goalmachine",
    displayName: "GoalMachine",
    avatar: "🥅",
    initials: "GM",
    xp: 11240,
    rank: "diamond",
    streak: 7,
    totalPredictions: 278,
    correctPredictions: 189,
    joinedAt: "2024-02-20T14:00:00Z",
    country: "Spain",
    countryFlag: "🇪🇸",
    badgeIds: ["centurion", "streak-5", "la-liga-expert"],
  },
  {
    id: "usr-003",
    username: "tacticaltom",
    displayName: "TacticalTom",
    avatar: "🧠",
    initials: "TT",
    xp: 9620,
    rank: "diamond",
    streak: 4,
    totalPredictions: 241,
    correctPredictions: 162,
    joinedAt: "2024-03-08T09:00:00Z",
    country: "Germany",
    countryFlag: "🇩🇪",
    badgeIds: ["centurion", "bundesliga-expert", "streak-5"],
  },
  {
    id: "usr-004",
    username: "elclasicoqueen",
    displayName: "ElClasicoQueen",
    avatar: "👑",
    initials: "EQ",
    xp: 8910,
    rank: "platinum",
    streak: 9,
    totalPredictions: 198,
    correctPredictions: 141,
    joinedAt: "2024-04-01T11:00:00Z",
    country: "Brazil",
    countryFlag: "🇧🇷",
    badgeIds: ["streak-5", "ucl-expert", "streak-9"],
  },
  {
    id: "usr-005",
    username: "nftstriker",
    displayName: "NFTStriker",
    avatar: "🎯",
    initials: "NS",
    xp: 7350,
    rank: "platinum",
    streak: 3,
    totalPredictions: 176,
    correctPredictions: 112,
    joinedAt: "2024-04-18T16:00:00Z",
    country: "France",
    countryFlag: "🇫🇷",
    badgeIds: ["centurion", "ligue1-expert"],
  },
  {
    id: "usr-006",
    username: "blockchainbarca",
    displayName: "BlockchainBarca",
    avatar: "🔵",
    initials: "BB",
    xp: 5980,
    rank: "gold",
    streak: 6,
    totalPredictions: 154,
    correctPredictions: 96,
    joinedAt: "2024-05-10T08:00:00Z",
    country: "Argentina",
    countryFlag: "🇦🇷",
    badgeIds: ["streak-5", "la-liga-expert"],
  },
  {
    id: "usr-007",
    username: "web3winger",
    displayName: "Web3Winger",
    avatar: "🌐",
    initials: "WW",
    xp: 4210,
    rank: "gold",
    streak: 2,
    totalPredictions: 121,
    correctPredictions: 72,
    joinedAt: "2024-06-25T12:00:00Z",
    country: "Netherlands",
    countryFlag: "🇳🇱",
    badgeIds: ["centurion"],
  },
  {
    id: "usr-008",
    username: "satsoshi_fc",
    displayName: "Satoshi FC",
    avatar: "₿",
    initials: "SF",
    xp: 2880,
    rank: "silver",
    streak: 1,
    totalPredictions: 87,
    correctPredictions: 48,
    joinedAt: "2024-08-14T15:00:00Z",
    country: "Japan",
    countryFlag: "🇯🇵",
    badgeIds: [],
  },
  {
    id: "usr-009",
    username: "defi_defender",
    displayName: "DeFi Defender",
    avatar: "🛡️",
    initials: "DD",
    xp: 1640,
    rank: "bronze",
    streak: 0,
    totalPredictions: 54,
    correctPredictions: 27,
    joinedAt: "2024-10-02T10:00:00Z",
    country: "South Korea",
    countryFlag: "🇰🇷",
    badgeIds: [],
  },
  {
    id: "usr-010",
    username: "chain_goalkeeper",
    displayName: "ChainKeeper",
    avatar: "🧤",
    initials: "CG",
    xp: 820,
    rank: "bronze",
    streak: 2,
    totalPredictions: 31,
    correctPredictions: 14,
    joinedAt: "2025-01-20T09:00:00Z",
    country: "Nigeria",
    countryFlag: "🇳🇬",
    badgeIds: [],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Mock "current" logged-in user (usr-001 for demo)
// ─────────────────────────────────────────────────────────────────────────────

export const currentUser: User = users[0];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export const userMap: Record<string, User> = Object.fromEntries(
  users.map((u) => [u.id, u])
);

export function getUserById(id: string): User | undefined {
  return userMap[id];
}

export function getAccuracy(user: User): number {
  if (user.totalPredictions === 0) return 0;
  return Math.round((user.correctPredictions / user.totalPredictions) * 100);
}
