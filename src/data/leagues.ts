import type { League } from "@/types";

export const leagues: League[] = [
  {
    id: "premier-league",
    name: "Premier League",
    shortName: "PL",
    country: "England",
    countryFlag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    logo: "⚽",
    tier: "domestic",
    season: "2025/26",
  },
  {
    id: "la-liga",
    name: "La Liga",
    shortName: "PD",
    country: "Spain",
    countryFlag: "🇪🇸",
    logo: "🔴",
    tier: "domestic",
    season: "2025/26",
  },
  {
    id: "bundesliga",
    name: "Bundesliga",
    shortName: "BL1",
    country: "Germany",
    countryFlag: "🇩🇪",
    logo: "🟡",
    tier: "domestic",
    season: "2025/26",
  },
  {
    id: "serie-a",
    name: "Serie A",
    shortName: "SA",
    country: "Italy",
    countryFlag: "🇮🇹",
    logo: "🔵",
    tier: "domestic",
    season: "2025/26",
  },
  {
    id: "ligue-1",
    name: "Ligue 1",
    shortName: "L1",
    country: "France",
    countryFlag: "🇫🇷",
    logo: "🟣",
    tier: "domestic",
    season: "2025/26",
  },
  {
    id: "champions-league",
    name: "UEFA Champions League",
    shortName: "UCL",
    country: "Europe",
    countryFlag: "🇪🇺",
    logo: "⭐",
    tier: "continental",
    season: "2025/26",
  },
  {
    id: "world-cup-2026",
    name: "FIFA World Cup 2026",
    shortName: "WC26",
    country: "International",
    countryFlag: "🌍",
    logo: "🏆",
    tier: "international",
    season: "2026",
  },
];

export const leagueMap: Record<string, League> = Object.fromEntries(
  leagues.map((l) => [l.id, l])
);

export function getLeagueById(id: string): League | undefined {
  return leagueMap[id];
}
