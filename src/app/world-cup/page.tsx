"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Info, Shield, Zap, Link2, FileText, Layers, ListOrdered, Swords } from "lucide-react";
import { worldCupGroups } from "@/data/worldcup";
import { cn } from "@/lib/utils";
import { CountdownTimer } from "@/components/world-cup/CountdownTimer";
import { WorldCupFixtureCard } from "@/components/world-cup/WorldCupFixtureCard";
import { WorldCupPredictionCard } from "@/components/world-cup/WorldCupPredictionCard";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { KnockoutBracket } from "@/components/world-cup/KnockoutBracket";
import type { SpecialPrediction, SelectionOption } from "@/components/world-cup/WorldCupPredictionCard";
import type { BracketData } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Flag image sources — flagcdn.com SVGs for all 48 WC nations
// ─────────────────────────────────────────────────────────────────────────────

const FC = "https://flagcdn.com/";
const FLAG_SRC: Record<string, string> = {
  // Group A
  "Mexico":               `${FC}mx.svg`,
  "South Korea":          `${FC}kr.svg`,
  "South Africa":         `${FC}za.svg`,
  "Czechia":              `${FC}cz.svg`,
  // Group B
  "Canada":               `${FC}ca.svg`,
  "Switzerland":          `${FC}ch.svg`,
  "Qatar":                `${FC}qa.svg`,
  "Bosnia-Herzegovina":   `${FC}ba.svg`,
  // Group C
  "Brazil":               `${FC}br.svg`,
  "Morocco":              `${FC}ma.svg`,
  "Scotland":             `${FC}gb-sct.svg`,
  "Haiti":                `${FC}ht.svg`,
  // Group D
  "United States":        `${FC}us.svg`,
  "Paraguay":             `${FC}py.svg`,
  "Australia":            `${FC}au.svg`,
  "Türkiye":              `${FC}tr.svg`,
  // Group E
  "Germany":              `${FC}de.svg`,
  "Ecuador":              `${FC}ec.svg`,
  "Ivory Coast":          `${FC}ci.svg`,
  "Curaçao":              `${FC}cw.svg`,
  // Group F
  "Netherlands":          `${FC}nl.svg`,
  "Japan":                `${FC}jp.svg`,
  "Tunisia":              `${FC}tn.svg`,
  "Sweden":               `${FC}se.svg`,
  // Group G
  "Belgium":              `${FC}be.svg`,
  "IR Iran":              `${FC}ir.svg`,
  "Egypt":                `${FC}eg.svg`,
  "New Zealand":          `${FC}nz.svg`,
  // Group H
  "Spain":                `${FC}es.svg`,
  "Uruguay":              `${FC}uy.svg`,
  "Saudi Arabia":         `${FC}sa.svg`,
  "Cape Verde":           `${FC}cv.svg`,
  // Group I
  "France":               `${FC}fr.svg`,
  "Senegal":              `${FC}sn.svg`,
  "Norway":               `${FC}no.svg`,
  "Iraq":                 `${FC}iq.svg`,
  // Group J
  "Argentina":            `${FC}ar.svg`,
  "Austria":              `${FC}at.svg`,
  "Algeria":              `${FC}dz.svg`,
  "Jordan":               `${FC}jo.svg`,
  // Group K
  "Portugal":             `${FC}pt.svg`,
  "Colombia":             `${FC}co.svg`,
  "Uzbekistan":           `${FC}uz.svg`,
  "DR Congo":             `${FC}cd.svg`,
  // Group L
  "England":              `${FC}gb-eng.svg`,
  "Croatia":              `${FC}hr.svg`,
  "Panama":               `${FC}pa.svg`,
  "Ghana":                `${FC}gh.svg`,
};

// Player avatar helper — deterministic, uses local avatar SVGs
const AVATAR = (i: number) => `/brand/players/avatar-${(i % 6) + 1}.svg`;
const addAvatars = (pool: Omit<SelectionOption, "src">[]): SelectionOption[] =>
  pool.map((p, i) => ({ ...p, src: AVATAR(i) }));

// ─────────────────────────────────────────────────────────────────────────────
// Team / player pools — all options include src for visual identity
// ─────────────────────────────────────────────────────────────────────────────

const ALL_TEAMS: SelectionOption[] = worldCupGroups.flatMap(g =>
  g.teams.map(t => ({
    label: t.name,
    flag:  t.flag,
    sub:   g.name,
    src:   FLAG_SRC[t.name],
  }))
);

const DARK_HORSE_POOL: SelectionOption[] = [
  { label: "Morocco",     flag: "🇲🇦", sub: "Group C", src: FLAG_SRC["Morocco"]     },
  { label: "Japan",       flag: "🇯🇵", sub: "Group F", src: FLAG_SRC["Japan"]       },
  { label: "Senegal",     flag: "🇸🇳", sub: "Group I", src: FLAG_SRC["Senegal"]     },
  { label: "South Korea", flag: "🇰🇷", sub: "Group A", src: FLAG_SRC["South Korea"] },
  { label: "Croatia",     flag: "🇭🇷", sub: "Group L", src: FLAG_SRC["Croatia"]     },
  { label: "Australia",   flag: "🇦🇺", sub: "Group D", src: FLAG_SRC["Australia"]   },
  { label: "Scotland",    flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", sub: "Group C", src: FLAG_SRC["Scotland"]    },
  { label: "Norway",      flag: "🇳🇴", sub: "Group I", src: FLAG_SRC["Norway"]      },
  { label: "Ecuador",     flag: "🇪🇨", sub: "Group E", src: FLAG_SRC["Ecuador"]     },
  { label: "Czechia",     flag: "🇨🇿", sub: "Group A", src: FLAG_SRC["Czechia"]     },
  { label: "Algeria",     flag: "🇩🇿", sub: "Group J", src: FLAG_SRC["Algeria"]     },
  { label: "Egypt",       flag: "🇪🇬", sub: "Group G", src: FLAG_SRC["Egypt"]       },
  { label: "Colombia",    flag: "🇨🇴", sub: "Group K", src: FLAG_SRC["Colombia"]    },
  { label: "Austria",     flag: "🇦🇹", sub: "Group J", src: FLAG_SRC["Austria"]     },
  { label: "Türkiye",     flag: "🇹🇷", sub: "Group D", src: FLAG_SRC["Türkiye"]     },
  { label: "Ivory Coast", flag: "🇨🇮", sub: "Group E", src: FLAG_SRC["Ivory Coast"] },
];

const GOLDEN_BOOT_POOL: SelectionOption[] = addAvatars([
  { label: "K. Mbappé",      flag: "🇫🇷", sub: "France"      },
  { label: "E. Haaland",     flag: "🇳🇴", sub: "Norway"      },
  { label: "H. Kane",        flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", sub: "England"     },
  { label: "Vinicius Jr.",   flag: "🇧🇷", sub: "Brazil"      },
  { label: "L. Messi",       flag: "🇦🇷", sub: "Argentina"   },
  { label: "Lamine Yamal",   flag: "🇪🇸", sub: "Spain"       },
  { label: "J. Bellingham",  flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", sub: "England"     },
  { label: "J. Musiala",     flag: "🇩🇪", sub: "Germany"     },
  { label: "F. Wirtz",       flag: "🇩🇪", sub: "Germany"     },
  { label: "R. Lukaku",      flag: "🇧🇪", sub: "Belgium"     },
  { label: "C. Gakpo",       flag: "🇳🇱", sub: "Netherlands" },
  { label: "M. Salah",       flag: "🇪🇬", sub: "Egypt"       },
  { label: "L. Díaz",        flag: "🇨🇴", sub: "Colombia"    },
  { label: "D. Núñez",       flag: "🇺🇾", sub: "Uruguay"     },
  { label: "B. Saka",        flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", sub: "England"     },
  { label: "A. Griezmann",   flag: "🇫🇷", sub: "France"      },
  { label: "K. Benzema",     flag: "🇫🇷", sub: "France"      },
  { label: "W. Zaïre-Emery", flag: "🇫🇷", sub: "France"      },
  { label: "Endrick",        flag: "🇧🇷", sub: "Brazil"      },
  { label: "V. Osimhen",     flag: "🇳🇬", sub: "—"           },
]);

const GOLDEN_GLOVE_POOL: SelectionOption[] = addAvatars([
  { label: "Alisson",         flag: "🇧🇷", sub: "Brazil"      },
  { label: "M. Maignan",      flag: "🇫🇷", sub: "France"      },
  { label: "J. Pickford",     flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", sub: "England"     },
  { label: "Unai Simón",      flag: "🇪🇸", sub: "Spain"       },
  { label: "M-A. ter Stegen", flag: "🇩🇪", sub: "Germany"     },
  { label: "Y. Sommer",       flag: "🇨🇭", sub: "Switzerland" },
  { label: "Diogo Costa",     flag: "🇵🇹", sub: "Portugal"    },
  { label: "É. Mendy",        flag: "🇸🇳", sub: "Senegal"     },
  { label: "G. Kobel",        flag: "🇨🇭", sub: "Switzerland" },
  { label: "M. Turner",       flag: "🇺🇸", sub: "USA"         },
  { label: "R. Patrício",     flag: "🇵🇹", sub: "Portugal"    },
  { label: "K. Casteels",     flag: "🇧🇪", sub: "Belgium"     },
]);

const YOUNG_PLAYER_POOL: SelectionOption[] = addAvatars([
  { label: "Lamine Yamal",    flag: "🇪🇸", sub: "Spain · b.2007"    },
  { label: "Endrick",         flag: "🇧🇷", sub: "Brazil · b.2006"   },
  { label: "W. Zaïre-Emery",  flag: "🇫🇷", sub: "France · b.2004"   },
  { label: "J. Bellingham",   flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", sub: "England · b.2003"  },
  { label: "J. Musiala",      flag: "🇩🇪", sub: "Germany · b.2003"  },
  { label: "F. Wirtz",        flag: "🇩🇪", sub: "Germany · b.2003"  },
  { label: "Gavi",            flag: "🇪🇸", sub: "Spain · b.2004"    },
  { label: "A. Garnacho",     flag: "🇦🇷", sub: "Argentina · b.2004"},
  { label: "C. Nkunku",       flag: "🇫🇷", sub: "France · b.2000"   },
  { label: "M. Camavinga",    flag: "🇫🇷", sub: "France · b.2002"   },
  { label: "P. Gavi",         flag: "🇪🇸", sub: "Spain · b.2004"    },
  { label: "B. Saka",         flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", sub: "England · b.2001"  },
]);

// ─────────────────────────────────────────────────────────────────────────────
// Prediction definitions — 3 sections
// ─────────────────────────────────────────────────────────────────────────────

const TOURNAMENT_PICKS: SpecialPrediction[] = [
  {
    id: "wc-champion", icon: "🏆", title: "Tournament Champion",
    description: "Which nation will lift the FIFA World Cup 2026 trophy?",
    xpReward: 200, deadline: "Jun 11, 2026", difficulty: "legendary",
    maxSelect: 1, pool: ALL_TEAMS,
  },
  {
    id: "wc-finalist", icon: "🥈", title: "Finalist Pick",
    description: "Predict both teams that will reach the World Cup Final.",
    xpReward: 120, deadline: "Jun 11, 2026", difficulty: "hard",
    maxSelect: 2, pool: ALL_TEAMS,
  },
  {
    id: "wc-golden-boot", icon: "⚽", title: "Golden Boot",
    description: "Who will be the tournament's top scorer?",
    xpReward: 100, deadline: "Jun 11, 2026", difficulty: "hard",
    maxSelect: 1, pool: GOLDEN_BOOT_POOL,
  },
  {
    id: "wc-golden-glove", icon: "🧤", title: "Golden Glove",
    description: "Which goalkeeper will keep the most clean sheets?",
    xpReward: 80, deadline: "Jun 11, 2026", difficulty: "medium",
    maxSelect: 1, pool: GOLDEN_GLOVE_POOL,
  },
  {
    id: "wc-dark-horse", icon: "🌟", title: "Dark Horse",
    description: "Pick an underdog nation outside the top favourites to reach the Semi-Finals.",
    xpReward: 150, deadline: "Jun 11, 2026", difficulty: "legendary",
    maxSelect: 1, pool: DARK_HORSE_POOL,
  },
];

const GROUP_WINNER_PREDS: SpecialPrediction[] = worldCupGroups.map(g => ({
  id:          `wc-group-${g.name.toLowerCase().replace(" ", "-")}`,
  icon:        "🔮",
  title:       `${g.name} Winner`,
  description: `Predict which nation tops ${g.name}.`,
  xpReward:    40,
  deadline:    "Jun 20, 2026",
  difficulty:  "medium" as const,
  maxSelect:   1,
  pool:        g.teams.map(t => ({ label: t.name, flag: t.flag, src: FLAG_SRC[t.name] })),
}));

const FUN_PICKS: SpecialPrediction[] = [
  {
    id: "wc-most-goals-team", icon: "🎯", title: "Most Goals Team",
    description: "Which nation will score the most goals in the entire tournament?",
    xpReward: 60, deadline: "Jun 11, 2026", difficulty: "medium",
    maxSelect: 1, pool: ALL_TEAMS,
  },
  {
    id: "wc-best-young", icon: "⭐", title: "Best Young Player",
    description: "Pick the standout youngster of the tournament (born 2001+).",
    xpReward: 80, deadline: "Jun 11, 2026", difficulty: "hard",
    maxSelect: 1, pool: YOUNG_PLAYER_POOL,
  },
  {
    id: "wc-surprise-team", icon: "💥", title: "Surprise Team",
    description: "Which outsider nation will defy expectations and reach the Quarter-Finals?",
    xpReward: 120, deadline: "Jun 11, 2026", difficulty: "legendary",
    maxSelect: 1, pool: DARK_HORSE_POOL,
  },
  {
    id: "wc-first-red", icon: "🟥", title: "First Red Card Nation",
    description: "Predict which nation will receive the first red card of the tournament.",
    xpReward: 30, deadline: "Jun 11, 2026", difficulty: "easy",
    maxSelect: 1, pool: ALL_TEAMS,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Real WC match row
// ─────────────────────────────────────────────────────────────────────────────

type RealMatch = {
  id: string;
  homeTeam: { name: string; shortName: string; crest?: string | null };
  awayTeam: { name: string; shortName: string; crest?: string | null };
  kickoffTime: string; status: string; venue: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
};

type WcStanding = {
  teamName:     string;
  position:     number;
  played:       number;
  won:          number;
  drawn:        number;
  lost:         number;
  goalsFor:     number;
  goalsAgainst: number;
  goalDiff:     number;
  points:       number;
};

// DB team_name → static worldCupGroups team.name aliases
// Needed because the standings API returns DB names that differ from static data names.
const STANDINGS_DB_ALIASES: Record<string, string[]> = {
  "Bosnia & Herzegovina": ["Bosnia-Herzegovina"],
  "Iran":                 ["IR Iran"],
  "Cape Verde Islands":   ["Cape Verde"],
  "Congo DR":             ["DR Congo"],
  "USA":                  ["United States"],
};

function RealWcRow({ m, delay }: { m: RealMatch; delay: number }) {
  const isFinished = m.status === "finished" || m.status === "FINISHED";
  const isLive     = m.status === "live"     || m.status === "LIVE" || m.status === "IN_PLAY";
  const hasScore   = isFinished || isLive;

  const date = new Date(m.kickoffTime).toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false,
  });
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut", delay }}
      className={cn(
        "flex items-center justify-between px-4 py-3 rounded-xl border",
        isLive
          ? "bg-primary/[0.06] border-primary/25"
          : "bg-white/[0.03] border-white/[0.07]",
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <TeamLogo src={m.homeTeam.crest} name={m.homeTeam.shortName} size="sm" />
        <span className="text-xs font-bold text-white/80 font-mono">{m.homeTeam.shortName}</span>
        {hasScore ? (
          <span className="text-sm font-black text-white font-mono tabular-nums px-1.5 py-0.5 rounded bg-white/[0.07]">
            {m.homeScore ?? 0}–{m.awayScore ?? 0}
          </span>
        ) : (
          <span className="text-[10px] text-white/30 font-mono">vs</span>
        )}
        <span className="text-xs font-bold text-white/80 font-mono">{m.awayTeam.shortName}</span>
        <TeamLogo src={m.awayTeam.crest} name={m.awayTeam.shortName} size="sm" />
        {isLive && <span className="text-[8px] font-black text-red-400 uppercase tracking-wider animate-pulse ml-1">LIVE</span>}
      </div>
      <div className="text-right flex-shrink-0 ml-3">
        <p className="text-[10px] text-white/40 font-mono">{isFinished ? "FT" : date}</p>
        {m.venue && !isFinished && <p className="text-[9px] text-white/20 font-mono mt-0.5 truncate max-w-[120px]">{m.venue}</p>}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section header
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-1 h-5 rounded-full bg-primary flex-shrink-0" />
      <div>
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest">{title}</h2>
        {sub && <p className="text-[10px] font-mono text-white/25 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Crest helpers (unchanged from original)
// ─────────────────────────────────────────────────────────────────────────────

const CREST_ALIASES: Record<string, string[]> = {
  "IR Iran":    ["Iran", "IRN", "IR Iran"],
  "DR Congo":   ["Congo DR", "COD", "DR Congo", "Democratic Republic of Congo"],
  "England":    ["ENG", "England"],
  "Croatia":    ["CRO", "Croatia"],
  "Portugal":   ["POR", "Portugal"],
  "Colombia":   ["COL", "Colombia"],
  "Uzbekistan": ["UZB", "Uzbekistan"],
  "Ghana":      ["GHA", "Ghana"],
  "Panama":     ["PAN", "Panama"],
  "Cape Verde": ["CPV", "Cape Verde", "Cabo Verde", "CV", "Cape Verde Islands"],
};
const MANUAL_CREST: Record<string, string> = {
  "Portugal": `${FC}pt.svg`, "POR": `${FC}pt.svg`,
  "Colombia": `${FC}co.svg`, "COL": `${FC}co.svg`,
  "Uzbekistan": `${FC}uz.svg`, "UZB": `${FC}uz.svg`,
  "DR Congo": `${FC}cd.svg`, "COD": `${FC}cd.svg`, "Congo DR": `${FC}cd.svg`,
  "England": `${FC}gb-eng.svg`, "ENG": `${FC}gb-eng.svg`,
  "Croatia": `${FC}hr.svg`, "CRO": `${FC}hr.svg`,
  "Panama": `${FC}pa.svg`, "PAN": `${FC}pa.svg`,
  "Ghana": `${FC}gh.svg`, "GHA": `${FC}gh.svg`,
  "Cape Verde": `${FC}cv.svg`, "Cabo Verde": `${FC}cv.svg`, "CPV": `${FC}cv.svg`,
};

function resolveCrest(name: string, code: string, map: Record<string, string>): string | null {
  if (map[name]) return map[name];
  if (map[code]) return map[code];
  for (const a of (CREST_ALIASES[name] ?? [])) { if (map[a]) return map[a]; }
  return MANUAL_CREST[name] ?? MANUAL_CREST[code] ?? null;
}

// Sort group teams by live standings (pts → GD → GF).
// Falls back to static order when no matches have been played.
function sortGroupTeams(
  teams: { name: string; shortCode: string; flag: string }[],
  map: Record<string, WcStanding>,
): { name: string; shortCode: string; flag: string }[] {
  const hasLiveData = teams.some(t => (map[t.name]?.played ?? 0) > 0);
  if (!hasLiveData) return teams;
  return [...teams].sort((a, b) => {
    const sa = map[a.name], sb = map[b.name];
    if (!sa && !sb) return 0;
    if (!sa) return 1;
    if (!sb) return -1;
    if (sb.points !== sa.points) return sb.points - sa.points;
    if (sb.goalDiff !== sa.goalDiff) return sb.goalDiff - sa.goalDiff;
    return sb.goalsFor - sa.goalsFor;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

// Minimal shape of a player returned by /api/players
type ApiPlayer = {
  name:        string;
  teamName:    string;
  position:    string | null;
  photoUrl:    string | null;
  age:         number | null;
};

// Map an API player to a SelectionOption for WorldCupPredictionCard
function toPlayerOption(p: ApiPlayer): SelectionOption {
  return {
    label: p.name,
    sub:   p.teamName,
    // Use real APF photo; fall back to generic avatar if absent
    src:   p.photoUrl ?? AVATAR(0),
    flag:  FLAG_SRC[p.teamName],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Top-level tabs — Group Stage / Knockout Stage / Standings
// ─────────────────────────────────────────────────────────────────────────────

type WcTab = "group" | "knockout" | "standings";

const WC_TABS: { id: WcTab; label: string; icon: typeof Layers }[] = [
  { id: "group",     label: "Group Stage",    icon: Layers      },
  { id: "knockout",  label: "Knockout Stage", icon: Swords      },
  { id: "standings", label: "Standings",      icon: ListOrdered },
];

export default function WorldCupPage() {
  const [wcMatches,    setWcMatches]    = useState<RealMatch[]>([]);
  const [dataSource,   setDataSource]   = useState<"live" | "fallback">("fallback");
  const [crestMap,     setCrestMap]     = useState<Record<string, string>>({});
  const [standingsMap, setStandingsMap] = useState<Record<string, WcStanding>>({});

  // ── Knockout bracket state ───────────────────────────────────────────────────
  const [bracketData,    setBracketData]    = useState<BracketData | null>(null);
  const [bracketLoading, setBracketLoading] = useState(true);
  const [bracketError,   setBracketError]   = useState<string | null>(null);

  // ── Active tab — auto-detected from bracket stage on first load ────────────
  const [activeTab, setActiveTab] = useState<WcTab>("group");
  // Ref (not state) — flips once the first bracket response decides the tab,
  // so it never re-triggers a render and never overrides a manual switch.
  const hasAutoSelectedRef = useRef(false);

  // ── DB-backed player pools — initial values are the static fallbacks ────────
  // When the DB fetch succeeds, these update with real player photos from APF.
  // If the fetch fails, static pools with generic avatars remain — no page crash.
  const [attackerPool,   setAttackerPool]   = useState<SelectionOption[]>(GOLDEN_BOOT_POOL);
  const [goalkeeperPool, setGoalkeeperPool] = useState<SelectionOption[]>(GOLDEN_GLOVE_POOL);
  const [youngPool,      setYoungPool]      = useState<SelectionOption[]>(YOUNG_PLAYER_POOL);

  useEffect(() => {
    // Fetch three player pools from the DB-backed /api/players endpoint.
    // Never calls API-Football directly — zero APF budget impact.
    const fetchPlayers = (url: string) =>
      fetch(url)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null) as Promise<{ ok: boolean; players: ApiPlayer[] } | null>;

    Promise.all([
      fetchPlayers('/api/players?leagueId=WC&season=2026&position=Attacker&limit=200'),
      fetchPlayers('/api/players?leagueId=WC&season=2026&position=Goalkeeper&limit=100'),
      fetchPlayers('/api/players?leagueId=WC&season=2026&limit=300'),
    ]).then(([attackers, goalkeepers, allPlayers]) => {
      if (attackers?.ok   && attackers.players.length   > 0)
        setAttackerPool(attackers.players.map(toPlayerOption));
      if (goalkeepers?.ok && goalkeepers.players.length > 0)
        setGoalkeeperPool(goalkeepers.players.map(toPlayerOption));
      if (allPlayers?.ok  && allPlayers.players.length  > 0) {
        // Young player pool: prefer players age ≤ 26; fall back to all if too few
        const young = allPlayers.players
          .filter(p => p.age !== null && p.age <= 26)
          .map(toPlayerOption);
        setYoungPool(young.length >= 10 ? young : allPlayers.players.map(toPlayerOption));
      }
    });
  }, []);

  useEffect(() => {
    // source omitted (defaults to "all") — WC 2026 fixtures are synced via
    // football-data.org (fd-*) now; /api/matches dedupes any provider
    // duplicates itself, and this callback already filters to leagueId==="WC".
    // limit=500 (the route's max under includePast=true) — needed so WC's
    // knockout-stage fixtures (dated well into July) aren't truncated by
    // matches from other leagues earlier in the kickoff-ASC ordering.
    fetch("/api/matches?limit=500&includePast=true")
      .then(r => r.ok ? r.json() : null)
      .then((d: { matches: (RealMatch & { leagueId?: string })[] } | null) => {
        if (!d) return;
        const wc = d.matches.filter(m => m.leagueId === "WC");
        if (wc.length > 0) {
          setWcMatches(wc);
          setDataSource("live");
          const map: Record<string, string> = {};
          for (const m of wc) {
            if (m.homeTeam.crest) { map[m.homeTeam.name] = m.homeTeam.crest; map[m.homeTeam.shortName] = m.homeTeam.crest; }
            if (m.awayTeam.crest) { map[m.awayTeam.name] = m.awayTeam.crest; map[m.awayTeam.shortName] = m.awayTeam.crest; }
          }
          setCrestMap(map);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/standings?leagueId=WC&season=2026")
      .then(r => r.ok ? r.json() : null)
      .then((d: { ok: boolean; standings: WcStanding[] } | null) => {
        if (!d?.ok || !d.standings?.length) return;
        const map: Record<string, WcStanding> = {};
        for (const s of d.standings) {
          map[s.teamName] = s;
          for (const alias of (STANDINGS_DB_ALIASES[s.teamName] ?? [])) {
            map[alias] = s;
          }
        }
        setStandingsMap(map);
      })
      .catch(() => {});
  }, []);

  // ── Fetch knockout bracket — auto-updates when matches finish (poll on mount) ─
  // Tab auto-selection happens right here in the response handler (not in a
  // separate effect watching state) so we never trigger a setState-in-effect
  // cascade — the decision is made once, at the moment fresh data arrives.
  const fetchBracket = useCallback(() => {
    fetch("/api/wc-bracket")
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((d: {
        ok: boolean; stage: BracketData["stage"]; totalKnockoutMatches: number;
        r32: BracketData["r32"]; r16: BracketData["r16"]; qf: BracketData["qf"];
        sf: BracketData["sf"]; final: BracketData["final"]; third: BracketData["third"];
      }) => {
        if (!d.ok) throw new Error("Bracket fetch failed");
        setBracketData({
          r32: d.r32, r16: d.r16, qf: d.qf, sf: d.sf, final: d.final, third: d.third,
          stage: d.stage, totalKnockoutMatches: d.totalKnockoutMatches,
        });
        setBracketError(null);

        // Auto-prioritise the Knockout tab once the tournament reaches that
        // stage — only on the very first successful load, never overriding
        // a manual tab switch the user makes afterward.
        if (!hasAutoSelectedRef.current) {
          hasAutoSelectedRef.current = true;
          if (d.stage !== "pre_knockout") setActiveTab("knockout");
        }
      })
      .catch((e: Error) => setBracketError(e.message))
      .finally(() => setBracketLoading(false));
  }, []);

  useEffect(() => {
    fetchBracket();
  }, [fetchBracket]);

  const isKnockoutLive = useMemo(
    () => bracketData !== null && bracketData.stage !== "pre_knockout",
    [bracketData],
  );

  return (
    <main className="min-h-screen bg-bg text-text-primary font-sans relative overflow-hidden">
      {/* Cinematic WC page background */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/backgrounds/worldcup-hero.webp" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover object-top sm:object-center pointer-events-none" style={{ opacity: 0.20 }} loading="lazy" decoding="async" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-bg/50 via-transparent to-bg/70" />
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10 space-y-10 relative z-10">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative overflow-hidden rounded-3xl border border-primary/20">
          {/* WC hero background — visible card-level image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/backgrounds/worldcup-hero.webp" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover object-top sm:object-center pointer-events-none" style={{ opacity: 0.28 }} loading="eager" decoding="async" />
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/60 via-black/35 to-[#050a1a]/75" />
          <div className="relative z-10 p-5 sm:p-6 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-[#4d7ef7] flex items-center justify-center flex-shrink-0 shadow-lg">
                <Trophy size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white leading-tight">World Cup 2026</h1>
                <p className="text-xs text-white/35 font-mono">
                  {dataSource === "live" ? "Base App-ready · Live Data" : "Base App-ready · Loading data…"}
                </p>
              </div>
            </div>
            <p className="text-sm text-white/50 leading-relaxed max-w-2xl">
              The biggest football prediction season. Build your reputation, earn XP, and climb global rankings
              across all 104 matches. Lock in your picks before the tournament starts.
            </p>
            <div className="flex items-start gap-2 rounded-xl bg-amber-500/8 border border-amber-500/20 px-3 py-2.5">
              <Info size={12} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-400/80 font-mono leading-relaxed">
                Fixture schedules are indicative — official match times to follow. Picks save to your account.
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Countdown ─────────────────────────────────────────────────────── */}
        <section>
          <SectionHeader title="Countdown to the Final" sub="World Cup Final · 19 Jul 2026" />
          <CountdownTimer />
        </section>

        {/* ── Stage tabs ────────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 p-1 rounded-2xl bg-white/[0.03] border border-white/[0.07] overflow-x-auto scrollbar-hide">
            {WC_TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative flex-1 min-w-[110px] flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl",
                    "text-xs font-bold transition-all duration-200",
                    active
                      ? "bg-primary text-white shadow-[0_0_16px_rgba(22,82,240,0.30)]"
                      : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]",
                  )}
                >
                  <Icon size={14} strokeWidth={active ? 2.5 : 2} />
                  {tab.label}
                  {tab.id === "knockout" && isKnockoutLive && !active && (
                    <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <AnimatePresence>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="space-y-10"
          >

        {activeTab === "group" && (<>

        {/* ── Tournament Picks ──────────────────────────────────────────────── */}
        <section className="relative overflow-hidden rounded-2xl">
          {/* WC predictions background */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/backgrounds/wc-predictions-bg.webp" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none" style={{ opacity: 0.28 }} loading="lazy" decoding="async" />
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-bg/15 to-bg/10" />
          <div className="relative">
            <SectionHeader
              title="Tournament Picks"
              sub={`${TOURNAMENT_PICKS.length} special predictions · Lock in before Jun 11`}
            />
            <div className="space-y-3">
              {TOURNAMENT_PICKS.map((sp, i) => (
                <WorldCupPredictionCard
                  key={sp.id}
                  prediction={
                    sp.id === 'wc-golden-boot'  ? { ...sp, pool: attackerPool }   :
                    sp.id === 'wc-golden-glove' ? { ...sp, pool: goalkeeperPool } :
                    sp
                  }
                  delay={i * 0.05}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ── Group Winners ─────────────────────────────────────────────────── */}
        <section>
          <SectionHeader
            title="Group Winners"
            sub="12 groups · 40 XP each · Deadline Jun 20"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {GROUP_WINNER_PREDS.map((sp, i) => (
              <WorldCupPredictionCard
                key={sp.id}
                prediction={sp}
                delay={i * 0.03}
                compact
              />
            ))}
          </div>
        </section>

        {/* ── Fun Picks ─────────────────────────────────────────────────────── */}
        <section>
          <SectionHeader title="Fun Picks" sub="Extra predictions · Bonus XP" />
          <div className="space-y-3">
            {FUN_PICKS.map((sp, i) => (
              <WorldCupPredictionCard
                key={sp.id}
                prediction={
                  sp.id === 'wc-best-young' ? { ...sp, pool: youngPool } :
                  sp
                }
                delay={i * 0.05}
              />
            ))}
          </div>
        </section>

        {/* ── Fixtures ──────────────────────────────────────────────────────── */}
        <section>
          {dataSource === "live" ? (
            <>
              <SectionHeader title={`Group Stage Fixtures · ${wcMatches.length} matches`} sub="Live Data · football-data.org" />
              <div className="space-y-2">
                {wcMatches.map((m, i) => <RealWcRow key={m.id} m={m} delay={i * 0.02} />)}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-8 text-center">
              <p className="text-sm font-semibold text-white/40">Live fixtures will appear here</p>
              <p className="text-[11px] text-white/20 font-mono mt-1.5">Group stage is underway · Data syncs automatically</p>
            </div>
          )}
        </section>

        </>)}

        {activeTab === "knockout" && (
        <section>
          <SectionHeader
            title="Knockout Bracket"
            sub="Round of 32 → Round of 16 → Quarter-Finals → Semi-Finals → Final"
          />
          <KnockoutBracket data={bracketData} loading={bracketLoading} error={bracketError} />
        </section>
        )}

        {activeTab === "standings" && (
        <section>
          <SectionHeader title="Official Groups" sub="FIFA World Cup 2026 · Top 2 from each group advance" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {worldCupGroups.map((group, gi) => {
              const sorted = sortGroupTeams(group.teams, standingsMap);
              return (
                <motion.div key={group.name}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut", delay: gi * 0.03 }}
                  className="rounded-xl border overflow-hidden bg-white/[0.03] border-white/[0.08]"
                >
                  {/* Group header */}
                  <div className="flex items-center justify-between px-3 py-2 bg-white/[0.025] border-b border-white/[0.07]">
                    <p className="text-[11px] font-black text-white/90 uppercase tracking-widest font-mono">{group.name}</p>
                    <span className="text-[9px] text-primary/50 font-mono tracking-wide">Top 2 advance</span>
                  </div>
                  {/* Column headers */}
                  <div className="flex items-center px-2 py-[5px] border-b border-white/[0.04]">
                    <div className="w-7 flex-shrink-0" />
                    <div className="flex-1 min-w-0" />
                    {["P","W","D","L","GF","GA","GD","PTS"].map((h, ci) => (
                      <span key={h} className={cn(
                        "text-center font-mono flex-shrink-0",
                        ci === 7 ? "w-6 text-[8px] font-bold text-white/30" : "w-5 text-[8px] text-white/20",
                      )}>{h}</span>
                    ))}
                  </div>
                  {/* Team rows */}
                  {sorted.map((team, pos) => {
                    const s = standingsMap[team.name];
                    const isAdvancing = pos < 2;
                    const flagUrl = FLAG_SRC[team.name];
                    return (
                      <div key={team.shortCode}
                        className={cn(
                          "flex items-center px-2 py-1.5 border-b border-white/[0.04] last:border-0",
                          isAdvancing && "bg-primary/[0.04]",
                        )}
                      >
                        {/* Qualification bar + position */}
                        <div className="w-7 flex-shrink-0 flex items-center gap-1">
                          <span className={cn(
                            "w-0.5 h-4 rounded-full flex-shrink-0",
                            isAdvancing ? "bg-primary/55" : "bg-white/[0.07]",
                          )} />
                          <span className={cn(
                            "text-[10px] font-bold font-mono tabular-nums",
                            isAdvancing ? "text-primary/75" : "text-white/20",
                          )}>{pos + 1}</span>
                        </div>
                        {/* SVG flag + 3-letter code */}
                        <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-1">
                          {flagUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={flagUrl} alt="" aria-hidden="true"
                              className="w-[18px] h-[13px] rounded-[2px] object-cover flex-shrink-0"
                              style={{ opacity: isAdvancing ? 1 : 0.6 }}
                            />
                          ) : (
                            <span className="text-[11px] leading-none flex-shrink-0"
                              style={{ opacity: isAdvancing ? 1 : 0.6 }}>{team.flag}</span>
                          )}
                          <span className={cn(
                            "text-[10px] font-semibold font-mono tracking-wide leading-tight",
                            isAdvancing ? "text-white/85" : "text-white/45",
                          )}>{team.shortCode}</span>
                        </div>
                        {/* Stats */}
                        {s ? (
                          <>
                            {[s.played, s.won, s.drawn, s.lost, s.goalsFor, s.goalsAgainst].map((v, ci) => (
                              <span key={ci} className="w-5 text-center text-[10px] font-mono text-white/40 flex-shrink-0 tabular-nums">{v}</span>
                            ))}
                            <span className={cn(
                              "w-5 text-center text-[10px] font-mono flex-shrink-0 tabular-nums",
                              s.goalDiff > 0 ? "text-emerald-400/70" :
                              s.goalDiff < 0 ? "text-red-400/60" :
                              "text-white/25",
                            )}>
                              {s.goalDiff > 0 ? `+${s.goalDiff}` : s.goalDiff}
                            </span>
                            <span className={cn(
                              "w-6 text-center text-[11px] font-black font-mono flex-shrink-0 tabular-nums",
                              isAdvancing ? "text-white" : "text-white/55",
                            )}>{s.points}</span>
                          </>
                        ) : (
                          <>
                            {Array.from({ length: 7 }, (_, ci) => (
                              <span key={ci} className="w-5 text-center text-[10px] font-mono text-white/[0.12] flex-shrink-0 tabular-nums">0</span>
                            ))}
                            <span className="w-6 text-center text-[10px] font-black font-mono text-white/[0.12] flex-shrink-0 tabular-nums">0</span>
                          </>
                        )}
                      </div>
                    );
                  })}
                </motion.div>
              );
            })}
          </div>
        </section>
        )}

          </motion.div>
        </AnimatePresence>

        {/* ── Base App future ───────────────────────────────────────────────── */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.2 }}>
          <SectionHeader title="Base App Future" />
          <div className="rounded-2xl border border-primary/25 bg-primary/8 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
                <Shield size={18} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">World Cup Reputation on Base</p>
                <p className="text-xs text-white/30 font-mono">Coming in a future phase</p>
              </div>
            </div>
            <div className="space-y-3">
              {[
                { icon: <Link2 size={15} className="text-primary flex-shrink-0 mt-0.5" />, title: "Base Account identity", desc: "World Cup prediction reputation can connect to your Base Account — your accuracy becomes on-chain identity." },
                { icon: <FileText size={15} className="text-primary flex-shrink-0 mt-0.5" />, title: "On-chain prediction proof", desc: "Special prediction badges become verifiable on-chain proof — each correct call timestamped on Base." },
                { icon: <Zap size={15} className="text-primary flex-shrink-0 mt-0.5" />, title: "Builder Code attribution", desc: "Builder Code-ready transactions come later. PrediXI is registered on Base.dev as a Standard Web App." },
              ].map(item => (
                <div key={item.title} className="flex items-start gap-3">
                  {item.icon}
                  <div>
                    <p className="text-xs font-semibold text-white/80">{item.title}</p>
                    <p className="text-[11px] text-white/30 leading-relaxed mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-primary/15">
              <Zap size={11} className="text-primary" />
              <p className="text-[10px] text-white/30 font-mono">No wallet connected · No on-chain code in this phase</p>
            </div>
          </div>
        </motion.section>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <footer className="text-center pb-6 pt-2">
          <p className="text-[10px] text-white/15 font-mono tracking-widest uppercase">
            PrediXI · World Cup 2026 · {TOURNAMENT_PICKS.length + GROUP_WINNER_PREDS.length + FUN_PICKS.length} Predictions Available
          </p>
        </footer>

      </div>
    </main>
  );
}
