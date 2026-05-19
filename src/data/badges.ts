import type { Badge } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Achievement badges — unlockable via prediction activity
// ─────────────────────────────────────────────────────────────────────────────

export const badges: Badge[] = [
  // ── Streak badges ─────────────────────────────────────────────────────────
  {
    id: "streak-3",
    name: "On Fire",
    description: "3 correct predictions in a row",
    icon: "🔥",
    rarity: "common",
    category: "streak",
    xpReward: 150,
    criteria: "Get 3 consecutive correct predictions",
  },
  {
    id: "streak-5",
    name: "Hot Streak",
    description: "5 correct predictions in a row",
    icon: "🔥🔥",
    rarity: "rare",
    category: "streak",
    xpReward: 300,
    criteria: "Get 5 consecutive correct predictions",
  },
  {
    id: "streak-9",
    name: "Unstoppable",
    description: "9 correct predictions in a row",
    icon: "⚡",
    rarity: "epic",
    category: "streak",
    xpReward: 750,
    criteria: "Get 9 consecutive correct predictions",
  },
  {
    id: "streak-10",
    name: "Legendary Run",
    description: "10+ correct predictions in a row",
    icon: "👑",
    rarity: "legendary",
    category: "streak",
    xpReward: 1500,
    criteria: "Get 10 consecutive correct predictions",
  },
  // ── Accuracy badges ────────────────────────────────────────────────────────
  {
    id: "sharp-eye",
    name: "Sharp Eye",
    description: "60%+ accuracy over 50 predictions",
    icon: "🎯",
    rarity: "common",
    category: "accuracy",
    xpReward: 200,
    criteria: "Achieve 60%+ accuracy with at least 50 predictions",
  },
  {
    id: "oracle",
    name: "The Oracle",
    description: "70%+ accuracy over 200 predictions",
    icon: "🔮",
    rarity: "legendary",
    category: "accuracy",
    xpReward: 2000,
    criteria: "Achieve 70%+ accuracy with at least 200 predictions",
  },
  {
    id: "hat-trick",
    name: "Hat-Trick Hero",
    description: "3 correct predictions on the same matchday",
    icon: "⛑️",
    rarity: "rare",
    category: "accuracy",
    xpReward: 250,
    criteria: "Predict 3 or more matches correctly on the same matchday",
  },
  // ── Volume badges ──────────────────────────────────────────────────────────
  {
    id: "first-pred",
    name: "First Touch",
    description: "Placed your first prediction",
    icon: "👟",
    rarity: "common",
    category: "volume",
    xpReward: 50,
    criteria: "Place your first prediction",
  },
  {
    id: "centurion",
    name: "Centurion",
    description: "100 predictions placed",
    icon: "💯",
    rarity: "rare",
    category: "volume",
    xpReward: 500,
    criteria: "Place at least 100 predictions",
  },
  {
    id: "veteran",
    name: "Veteran",
    description: "250 predictions placed",
    icon: "🎖️",
    rarity: "epic",
    category: "volume",
    xpReward: 1000,
    criteria: "Place at least 250 predictions",
  },
  // ── League expert badges ───────────────────────────────────────────────────
  {
    id: "pl-expert",
    name: "Premier League Expert",
    description: "65%+ accuracy in Premier League matches",
    icon: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    rarity: "rare",
    category: "league",
    xpReward: 400,
    criteria: "Achieve 65%+ accuracy on at least 30 Premier League matches",
  },
  {
    id: "la-liga-expert",
    name: "La Liga Expert",
    description: "65%+ accuracy in La Liga matches",
    icon: "🇪🇸",
    rarity: "rare",
    category: "league",
    xpReward: 400,
    criteria: "Achieve 65%+ accuracy on at least 30 La Liga matches",
  },
  {
    id: "bundesliga-expert",
    name: "Bundesliga Expert",
    description: "65%+ accuracy in Bundesliga matches",
    icon: "🇩🇪",
    rarity: "rare",
    category: "league",
    xpReward: 400,
    criteria: "Achieve 65%+ accuracy on at least 30 Bundesliga matches",
  },
  {
    id: "ligue1-expert",
    name: "Ligue 1 Expert",
    description: "65%+ accuracy in Ligue 1 matches",
    icon: "🇫🇷",
    rarity: "rare",
    category: "league",
    xpReward: 400,
    criteria: "Achieve 65%+ accuracy on at least 30 Ligue 1 matches",
  },
  {
    id: "ucl-expert",
    name: "UCL Expert",
    description: "65%+ accuracy in Champions League matches",
    icon: "⭐",
    rarity: "epic",
    category: "league",
    xpReward: 600,
    criteria: "Achieve 65%+ accuracy on at least 20 UCL matches",
  },
  // ── Special badges ─────────────────────────────────────────────────────────
  {
    id: "early-adopter",
    name: "Early Adopter",
    description: "Joined PrediXI in the founding season",
    icon: "🚀",
    rarity: "legendary",
    category: "special",
    xpReward: 1000,
    criteria: "Join PrediXI before the end of Season 1",
  },
  {
    id: "el-clasico",
    name: "El Clásico Caller",
    description: "Correctly predicted an El Clásico result",
    icon: "🌟",
    rarity: "epic",
    category: "special",
    xpReward: 500,
    criteria: "Correctly predict the outcome of a Real Madrid vs Barcelona match",
  },
  // ── World Cup badges ───────────────────────────────────────────────────────
  {
    id: "worldcup-2026",
    name: "World Cup Predictor",
    description: "Predicted 10+ World Cup 2026 matches",
    icon: "🏆",
    rarity: "epic",
    category: "worldcup",
    xpReward: 800,
    criteria: "Place predictions on at least 10 World Cup 2026 matches",
  },
  {
    id: "worldcup-champion",
    name: "Tournament Prophet",
    description: "Correctly predicted the World Cup 2026 winner",
    icon: "🌍",
    rarity: "legendary",
    category: "worldcup",
    xpReward: 3000,
    criteria: "Correctly predict the World Cup 2026 champion before the tournament starts",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export const badgeMap: Record<string, Badge> = Object.fromEntries(
  badges.map((b) => [b.id, b])
);

export function getBadgeById(id: string): Badge | undefined {
  return badgeMap[id];
}

export function getBadgesByIds(ids: string[]): Badge[] {
  return ids.map((id) => badgeMap[id]).filter(Boolean);
}

export const rarityOrder: Record<string, number> = {
  common: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};

export const rarityColors: Record<string, string> = {
  common:    "text-text-secondary border-border bg-elevated",
  rare:      "text-[#00C2FF] border-[#00C2FF]/30 bg-[#00C2FF]/5",
  epic:      "text-[#8B5CF6] border-[#8B5CF6]/30 bg-[#8B5CF6]/5",
  legendary: "text-[#F59E0B] border-[#F59E0B]/30 bg-[#F59E0B]/5",
};

// Structured per-element rarity theming used by BadgeCard
export const rarityConfig: Record<string, {
  border:      string;
  cardBg:      string;
  iconBg:      string;
  iconBorder:  string;
  cardGlow:    string;
  pillBg:      string;
  pillText:    string;
  pillBorder:  string;
  accent:      string;
  edgeHighlight: string;
}> = {
  common: {
    border:        "border-white/[0.10]",
    cardBg:        "bg-gradient-to-br from-[#0e1235] to-[#07091a]",
    iconBg:        "bg-white/[0.06]",
    iconBorder:    "border-white/[0.12]",
    cardGlow:      "",
    pillBg:        "bg-white/[0.06]",
    pillText:      "text-white/45",
    pillBorder:    "border-white/[0.10]",
    accent:        "text-white/40",
    edgeHighlight: "via-white/[0.08]",
  },
  rare: {
    border:        "border-[#00C2FF]/25",
    cardBg:        "bg-gradient-to-br from-[#00C2FF]/[0.05] via-[#0d1030] to-[#07091a]",
    iconBg:        "bg-[#00C2FF]/10",
    iconBorder:    "border-[#00C2FF]/30",
    cardGlow:      "shadow-[0_0_22px_rgba(0,194,255,0.10)]",
    pillBg:        "bg-[#00C2FF]/10",
    pillText:      "text-[#00C2FF]",
    pillBorder:    "border-[#00C2FF]/25",
    accent:        "text-[#00C2FF]/75",
    edgeHighlight: "via-[#00C2FF]/30",
  },
  epic: {
    border:        "border-[#8B5CF6]/30",
    cardBg:        "bg-gradient-to-br from-[#8B5CF6]/[0.07] via-[#0d1030] to-[#07091a]",
    iconBg:        "bg-[#8B5CF6]/12",
    iconBorder:    "border-[#8B5CF6]/30",
    cardGlow:      "shadow-[0_0_26px_rgba(139,92,246,0.13)]",
    pillBg:        "bg-[#8B5CF6]/12",
    pillText:      "text-[#8B5CF6]",
    pillBorder:    "border-[#8B5CF6]/30",
    accent:        "text-[#8B5CF6]/75",
    edgeHighlight: "via-[#8B5CF6]/30",
  },
  legendary: {
    border:        "border-[#F59E0B]/35",
    cardBg:        "bg-gradient-to-br from-[#F59E0B]/[0.08] via-[#0d1030] to-[#07091a]",
    iconBg:        "bg-[#F59E0B]/12",
    iconBorder:    "border-[#F59E0B]/35",
    cardGlow:      "shadow-[0_0_32px_rgba(245,158,11,0.16)]",
    pillBg:        "bg-[#F59E0B]/12",
    pillText:      "text-[#F59E0B]",
    pillBorder:    "border-[#F59E0B]/35",
    accent:        "text-[#F59E0B]/80",
    edgeHighlight: "via-[#F59E0B]/35",
  },
};
