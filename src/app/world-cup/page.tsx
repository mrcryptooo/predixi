"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, Info, Shield, Zap, Link2, FileText } from "lucide-react";
import { worldCupGroups, worldCupFixtures } from "@/data/worldcup";
import { cn } from "@/lib/utils";
import { CountdownTimer } from "@/components/world-cup/CountdownTimer";
import { WorldCupFixtureCard } from "@/components/world-cup/WorldCupFixtureCard";
import { WorldCupPredictionCard } from "@/components/world-cup/WorldCupPredictionCard";
import { TeamLogo } from "@/components/ui/TeamLogo";
import type { SpecialPrediction, SelectionOption } from "@/components/world-cup/WorldCupPredictionCard";

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
};

function RealWcRow({ m, delay }: { m: RealMatch; delay: number }) {
  const date = new Date(m.kickoffTime).toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false,
  });
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut", delay }}
      className="flex items-center justify-between px-4 py-3 rounded-xl border bg-white/[0.03] border-white/[0.07]"
    >
      <div className="flex items-center gap-2 min-w-0">
        <TeamLogo src={m.homeTeam.crest} name={m.homeTeam.shortName} size="sm" />
        <span className="text-xs font-bold text-white/80 font-mono">{m.homeTeam.shortName}</span>
        <span className="text-[10px] text-white/30 font-mono">vs</span>
        <span className="text-xs font-bold text-white/80 font-mono">{m.awayTeam.shortName}</span>
        <TeamLogo src={m.awayTeam.crest} name={m.awayTeam.shortName} size="sm" />
      </div>
      <div className="text-right flex-shrink-0 ml-3">
        <p className="text-[10px] text-white/40 font-mono">{date}</p>
        {m.venue && <p className="text-[9px] text-white/20 font-mono mt-0.5 truncate max-w-[120px]">{m.venue}</p>}
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

export default function WorldCupPage() {
  const [wcMatches,  setWcMatches]  = useState<RealMatch[]>([]);
  const [dataSource, setDataSource] = useState<"live" | "fallback">("fallback");
  const [crestMap,   setCrestMap]   = useState<Record<string, string>>({});

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
    fetch("/api/matches?source=fd&limit=100")
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

  const mockGroupFixtures = worldCupFixtures.filter(f => f.stage === "group");

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
                  {dataSource === "live" ? "Base App-ready · Live Data" : "Base App-ready · Demo tournament data"}
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
          <SectionHeader title="Countdown to Kick-Off" />
          <CountdownTimer />
        </section>

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

        {/* ── Official Groups ───────────────────────────────────────────────── */}
        <section>
          <SectionHeader title="Official Groups" sub="Official group composition · Standings from Jun 11, 2026" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {worldCupGroups.map((group, gi) => (
              <motion.div key={group.name}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: "easeOut", delay: gi * 0.04 }}
                className="rounded-xl border px-3 py-3 space-y-2 bg-white/[0.03] border-white/[0.07] hover:border-primary/25 hover:bg-primary/[0.04] transition-colors duration-150"
              >
                <p className="text-[10px] font-black text-primary/70 uppercase tracking-widest font-mono">
                  {group.name}
                </p>
                <div className="space-y-1.5">
                  {group.teams.map(team => (
                    <div key={team.shortCode} className="flex items-center gap-1.5 min-w-0">
                      <TeamLogo src={resolveCrest(team.name, team.shortCode, crestMap)} name={team.name} size="sm" />
                      <span className="text-sm leading-none flex-shrink-0">{team.flag}</span>
                      <span className="text-[11px] font-semibold text-white/70 truncate leading-tight">{team.name}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
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
          ) : mockGroupFixtures.length > 0 && (
            <>
              <SectionHeader title="Group Stage Fixtures (Demo)" sub="Demo schedule only · Not official FIFA data" />
              <div className="space-y-2">
                {mockGroupFixtures.map((fixture, i) => (
                  <WorldCupFixtureCard key={fixture.id} fixture={fixture} delay={i * 0.03} />
                ))}
              </div>
            </>
          )}
        </section>

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
