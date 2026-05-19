import type { WorldCupGroup, WorldCupFixture } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Official FIFA World Cup 2026 group composition — Final Draw (Dec 5 2025,
// Kennedy Center, Washington D.C.). Static composition only; no standings
// until the tournament begins Jun 11 2026.
// Source: NBC Sports / FIFA official draw results.
// ─────────────────────────────────────────────────────────────────────────────

export const worldCupGroups: WorldCupGroup[] = [
  // ── Group A ──────────────────────────────────────────────────────────────
  {
    name: "Group A",
    teams: [
      { name: "Mexico",              shortCode: "MEX", flag: "🇲🇽", group: "A" },
      { name: "South Korea",         shortCode: "KOR", flag: "🇰🇷", group: "A" },
      { name: "South Africa",        shortCode: "RSA", flag: "🇿🇦", group: "A" },
      { name: "Czechia",             shortCode: "CZE", flag: "🇨🇿", group: "A" },
    ],
  },
  // ── Group B ──────────────────────────────────────────────────────────────
  {
    name: "Group B",
    teams: [
      { name: "Canada",              shortCode: "CAN", flag: "🇨🇦", group: "B" },
      { name: "Switzerland",         shortCode: "SUI", flag: "🇨🇭", group: "B" },
      { name: "Qatar",               shortCode: "QAT", flag: "🇶🇦", group: "B" },
      { name: "Bosnia-Herzegovina",  shortCode: "BIH", flag: "🇧🇦", group: "B" },
    ],
  },
  // ── Group C ──────────────────────────────────────────────────────────────
  {
    name: "Group C",
    teams: [
      { name: "Brazil",              shortCode: "BRA", flag: "🇧🇷", group: "C" },
      { name: "Morocco",             shortCode: "MAR", flag: "🇲🇦", group: "C" },
      { name: "Scotland",            shortCode: "SCO", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", group: "C" },
      { name: "Haiti",               shortCode: "HAI", flag: "🇭🇹", group: "C" },
    ],
  },
  // ── Group D ──────────────────────────────────────────────────────────────
  {
    name: "Group D",
    teams: [
      { name: "United States",       shortCode: "USA", flag: "🇺🇸", group: "D" },
      { name: "Paraguay",            shortCode: "PAR", flag: "🇵🇾", group: "D" },
      { name: "Australia",           shortCode: "AUS", flag: "🇦🇺", group: "D" },
      { name: "Türkiye",             shortCode: "TUR", flag: "🇹🇷", group: "D" },
    ],
  },
  // ── Group E ──────────────────────────────────────────────────────────────
  {
    name: "Group E",
    teams: [
      { name: "Germany",             shortCode: "GER", flag: "🇩🇪", group: "E" },
      { name: "Ecuador",             shortCode: "ECU", flag: "🇪🇨", group: "E" },
      { name: "Ivory Coast",         shortCode: "CIV", flag: "🇨🇮", group: "E" },
      { name: "Curaçao",             shortCode: "CUW", flag: "🇨🇼", group: "E" },
    ],
  },
  // ── Group F ──────────────────────────────────────────────────────────────
  {
    name: "Group F",
    teams: [
      { name: "Netherlands",         shortCode: "NED", flag: "🇳🇱", group: "F" },
      { name: "Japan",               shortCode: "JPN", flag: "🇯🇵", group: "F" },
      { name: "Tunisia",             shortCode: "TUN", flag: "🇹🇳", group: "F" },
      { name: "Sweden",              shortCode: "SWE", flag: "🇸🇪", group: "F" },
    ],
  },
  // ── Group G ──────────────────────────────────────────────────────────────
  {
    name: "Group G",
    teams: [
      { name: "Belgium",             shortCode: "BEL", flag: "🇧🇪", group: "G" },
      { name: "IR Iran",             shortCode: "IRN", flag: "🇮🇷", group: "G" },
      { name: "Egypt",               shortCode: "EGY", flag: "🇪🇬", group: "G" },
      { name: "New Zealand",         shortCode: "NZL", flag: "🇳🇿", group: "G" },
    ],
  },
  // ── Group H ──────────────────────────────────────────────────────────────
  {
    name: "Group H",
    teams: [
      { name: "Spain",               shortCode: "ESP", flag: "🇪🇸", group: "H" },
      { name: "Uruguay",             shortCode: "URU", flag: "🇺🇾", group: "H" },
      { name: "Saudi Arabia",        shortCode: "KSA", flag: "🇸🇦", group: "H" },
      { name: "Cape Verde",          shortCode: "CPV", flag: "🇨🇻", group: "H" },
    ],
  },
  // ── Group I ──────────────────────────────────────────────────────────────
  {
    name: "Group I",
    teams: [
      { name: "France",              shortCode: "FRA", flag: "🇫🇷", group: "I" },
      { name: "Senegal",             shortCode: "SEN", flag: "🇸🇳", group: "I" },
      { name: "Norway",              shortCode: "NOR", flag: "🇳🇴", group: "I" },
      { name: "Iraq",                shortCode: "IRQ", flag: "🇮🇶", group: "I" },
    ],
  },
  // ── Group J ──────────────────────────────────────────────────────────────
  {
    name: "Group J",
    teams: [
      { name: "Argentina",           shortCode: "ARG", flag: "🇦🇷", group: "J" },
      { name: "Austria",             shortCode: "AUT", flag: "🇦🇹", group: "J" },
      { name: "Algeria",             shortCode: "ALG", flag: "🇩🇿", group: "J" },
      { name: "Jordan",              shortCode: "JOR", flag: "🇯🇴", group: "J" },
    ],
  },
  // ── Group K ──────────────────────────────────────────────────────────────
  {
    name: "Group K",
    teams: [
      { name: "Portugal",            shortCode: "POR", flag: "🇵🇹", group: "K" },
      { name: "Colombia",            shortCode: "COL", flag: "🇨🇴", group: "K" },
      { name: "Uzbekistan",          shortCode: "UZB", flag: "🇺🇿", group: "K" },
      { name: "DR Congo",            shortCode: "COD", flag: "🇨🇩", group: "K" },
    ],
  },
  // ── Group L ──────────────────────────────────────────────────────────────
  {
    name: "Group L",
    teams: [
      { name: "England",             shortCode: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", group: "L" },
      { name: "Croatia",             shortCode: "CRO", flag: "🇭🇷", group: "L" },
      { name: "Panama",              shortCode: "PAN", flag: "🇵🇦", group: "L" },
      { name: "Ghana",               shortCode: "GHA", flag: "🇬🇭", group: "L" },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Demo fixtures (not official schedule)
// All community percentages sum to exactly 100.
// ─────────────────────────────────────────────────────────────────────────────

export const worldCupFixtures: WorldCupFixture[] = [
  // ── Group stage — upcoming final-round matches ────────────────────────────
  {
    id: "wc-g-001",
    homeTeam: "United States", awayTeam: "Mexico",
    homeFlag: "🇺🇸", awayFlag: "🇲🇽",
    date: "2026-06-20T20:00:00Z",
    venue: "MetLife Stadium", city: "East Rutherford, NJ",
    stage: "group", group: "A",
    community: { home: 48, draw: 22, away: 30 },
  },
  {
    id: "wc-g-002",
    homeTeam: "Spain", awayTeam: "Croatia",
    homeFlag: "🇪🇸", awayFlag: "🇭🇷",
    date: "2026-06-21T17:00:00Z",
    venue: "AT&T Stadium", city: "Arlington, TX",
    stage: "group", group: "B",
    community: { home: 53, draw: 20, away: 27 },
  },
  {
    id: "wc-g-003",
    homeTeam: "Argentina", awayTeam: "Brazil",
    homeFlag: "🇦🇷", awayFlag: "🇧🇷",
    date: "2026-06-22T20:00:00Z",
    venue: "Rose Bowl", city: "Pasadena, CA",
    stage: "group", group: "C",
    community: { home: 40, draw: 22, away: 38 },
  },
  {
    id: "wc-g-004",
    homeTeam: "France", awayTeam: "England",
    homeFlag: "🇫🇷", awayFlag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    date: "2026-06-23T20:00:00Z",
    venue: "Levi's Stadium", city: "Santa Clara, CA",
    stage: "group", group: "D",
    community: { home: 42, draw: 24, away: 34 },
  },
  {
    id: "wc-g-005",
    homeTeam: "Germany", awayTeam: "Japan",
    homeFlag: "🇩🇪", awayFlag: "🇯🇵",
    date: "2026-06-24T14:00:00Z",
    venue: "SoFi Stadium", city: "Inglewood, CA",
    stage: "group", group: "E",
    community: { home: 58, draw: 21, away: 21 },
  },
  {
    id: "wc-g-006",
    homeTeam: "Portugal", awayTeam: "Uruguay",
    homeFlag: "🇵🇹", awayFlag: "🇺🇾",
    date: "2026-06-25T17:00:00Z",
    venue: "Arrowhead Stadium", city: "Kansas City, MO",
    stage: "group", group: "F",
    community: { home: 50, draw: 22, away: 28 },
  },
  {
    id: "wc-g-007",
    homeTeam: "Italy", awayTeam: "Netherlands",
    homeFlag: "🇮🇹", awayFlag: "🇳🇱",
    date: "2026-06-26T17:00:00Z",
    venue: "Gillette Stadium", city: "Foxborough, MA",
    stage: "group", group: "G",
    community: { home: 36, draw: 28, away: 36 },
  },
  {
    id: "wc-g-008",
    homeTeam: "Belgium", awayTeam: "Switzerland",
    homeFlag: "🇧🇪", awayFlag: "🇨🇭",
    date: "2026-06-27T20:00:00Z",
    venue: "BC Place", city: "Vancouver, BC",
    stage: "group", group: "H",
    community: { home: 45, draw: 25, away: 30 },
  },
  {
    id: "wc-g-009",
    homeTeam: "Nigeria", awayTeam: "Scotland",
    homeFlag: "🇳🇬", awayFlag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    date: "2026-06-28T14:00:00Z",
    venue: "Estadio Azteca", city: "Mexico City",
    stage: "group", group: "I",
    community: { home: 44, draw: 27, away: 29 },
  },
  {
    id: "wc-g-010",
    homeTeam: "Romania", awayTeam: "Egypt",
    homeFlag: "🇷🇴", awayFlag: "🇪🇬",
    date: "2026-06-29T17:00:00Z",
    venue: "Estadio BBVA", city: "Monterrey, MX",
    stage: "group", group: "J",
    community: { home: 38, draw: 30, away: 32 },
  },
  {
    id: "wc-g-011",
    homeTeam: "Ukraine", awayTeam: "Czechia",
    homeFlag: "🇺🇦", awayFlag: "🇨🇿",
    date: "2026-06-30T14:00:00Z",
    venue: "NRG Stadium", city: "Houston, TX",
    stage: "group", group: "K",
    community: { home: 47, draw: 24, away: 29 },
  },
  {
    id: "wc-g-012",
    homeTeam: "Algeria", awayTeam: "Panama",
    homeFlag: "🇩🇿", awayFlag: "🇵🇦",
    date: "2026-07-01T17:00:00Z",
    venue: "Lincoln Financial Field", city: "Philadelphia, PA",
    stage: "group", group: "L",
    community: { home: 41, draw: 29, away: 30 },
  },
  // ── Round of 16 (demo) ────────────────────────────────────────────────────
  {
    id: "wc-r16-001",
    homeTeam: "Spain", awayTeam: "United States",
    homeFlag: "🇪🇸", awayFlag: "🇺🇸",
    date: "2026-07-04T20:00:00Z",
    venue: "MetLife Stadium", city: "East Rutherford, NJ",
    stage: "r16",
    community: { home: 55, draw: 20, away: 25 },
  },
  {
    id: "wc-r16-002",
    homeTeam: "Argentina", awayTeam: "France",
    homeFlag: "🇦🇷", awayFlag: "🇫🇷",
    date: "2026-07-05T20:00:00Z",
    venue: "Rose Bowl", city: "Pasadena, CA",
    stage: "r16",
    community: { home: 44, draw: 21, away: 35 },
  },
  {
    id: "wc-r16-003",
    homeTeam: "Germany", awayTeam: "Belgium",
    homeFlag: "🇩🇪", awayFlag: "🇧🇪",
    date: "2026-07-06T20:00:00Z",
    venue: "AT&T Stadium", city: "Arlington, TX",
    stage: "r16",
    community: { home: 49, draw: 22, away: 29 },
  },
  {
    id: "wc-r16-004",
    homeTeam: "Portugal", awayTeam: "Nigeria",
    homeFlag: "🇵🇹", awayFlag: "🇳🇬",
    date: "2026-07-07T17:00:00Z",
    venue: "SoFi Stadium", city: "Inglewood, CA",
    stage: "r16",
    community: { home: 56, draw: 19, away: 25 },
  },
  // ── Quarter-finals (demo) ─────────────────────────────────────────────────
  {
    id: "wc-qf-001",
    homeTeam: "Spain", awayTeam: "Germany",
    homeFlag: "🇪🇸", awayFlag: "🇩🇪",
    date: "2026-07-09T20:00:00Z",
    venue: "AT&T Stadium", city: "Arlington, TX",
    stage: "qf",
    community: { home: 46, draw: 22, away: 32 },
  },
  {
    id: "wc-qf-002",
    homeTeam: "Argentina", awayTeam: "Portugal",
    homeFlag: "🇦🇷", awayFlag: "🇵🇹",
    date: "2026-07-10T20:00:00Z",
    venue: "MetLife Stadium", city: "East Rutherford, NJ",
    stage: "qf",
    community: { home: 45, draw: 20, away: 35 },
  },
  // ── Semi-finals (demo) ────────────────────────────────────────────────────
  {
    id: "wc-sf-001",
    homeTeam: "Spain", awayTeam: "Argentina",
    homeFlag: "🇪🇸", awayFlag: "🇦🇷",
    date: "2026-07-14T20:00:00Z",
    venue: "MetLife Stadium", city: "East Rutherford, NJ",
    stage: "sf",
    community: { home: 48, draw: 20, away: 32 },
  },
  {
    id: "wc-sf-002",
    homeTeam: "Germany", awayTeam: "Portugal",
    homeFlag: "🇩🇪", awayFlag: "🇵🇹",
    date: "2026-07-15T20:00:00Z",
    venue: "Rose Bowl", city: "Pasadena, CA",
    stage: "sf",
    community: { home: 43, draw: 24, away: 33 },
  },
  // ── Final (demo) ──────────────────────────────────────────────────────────
  {
    id: "wc-final-001",
    homeTeam: "Spain", awayTeam: "Germany",
    homeFlag: "🇪🇸", awayFlag: "🇩🇪",
    date: "2026-07-19T20:00:00Z",
    venue: "MetLife Stadium", city: "East Rutherford, NJ",
    stage: "final",
    community: { home: 52, draw: 18, away: 30 },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getGroupByName(name: string): WorldCupGroup | undefined {
  return worldCupGroups.find((g) => g.name === name);
}

export function getFixturesByStage(stage: WorldCupFixture["stage"]): WorldCupFixture[] {
  return worldCupFixtures.filter((f) => f.stage === stage);
}

export function getFixturesByGroup(group: string): WorldCupFixture[] {
  return worldCupFixtures.filter((f) => f.group === group);
}

export const stageLabels: Record<WorldCupFixture["stage"], string> = {
  group: "Group Stage",
  r16:   "Round of 16",
  qf:    "Quarter-Final",
  sf:    "Semi-Final",
  final: "Final",
};

// Quick stats (computed at module load, safe for SSR)
export const WC_GROUP_COUNT  = worldCupGroups.length;                                        // 12
export const WC_TEAM_COUNT   = worldCupGroups.reduce((n, g) => n + g.teams.length, 0);      // 48
export const WC_FIXTURE_COUNT = worldCupFixtures.length;
