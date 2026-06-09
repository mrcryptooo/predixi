// ─────────────────────────────────────────────────────────────────────────────
// Daily XI — shared types, player pool, localStorage helpers + Supabase remote
// localStorage is always written first. Remote helpers are fire-and-forget.
// ─────────────────────────────────────────────────────────────────────────────

export const XI_POSITIONS = [
  "GK","RB","CB","CB","LB","RM","CM","CM","LM","ST","ST",
] as const;

export type XIPosition = typeof XI_POSITIONS[number];

export type DailyXIPlayer = {
  id:       string;
  name:     string;
  position: string; // GK | RB | CB | LB | RM | CM | LM | ST
  team:     string;
  teamShort: string;
  image:    string; // /brand/players/avatar-N.svg
  styleTag: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Player pool — enough per position
// GK:3  RB:3  CB:6  LB:3  RM:4  CM:6  LM:4  ST:6
// ─────────────────────────────────────────────────────────────────────────────

export const PLAYER_POOL: DailyXIPlayer[] = [
  // ── GK ──────────────────────────────────────────────────────────────────
  { id:"gk1", name:"T. Courtois",   position:"GK", team:"Real Madrid", teamShort:"RMA", image:"/brand/players/avatar-1.svg", styleTag:"Shot Stopper"   },
  { id:"gk2", name:"Alisson",       position:"GK", team:"Liverpool",   teamShort:"LIV", image:"/brand/players/avatar-2.svg", styleTag:"Distributor"    },
  { id:"gk3", name:"M. Neuer",      position:"GK", team:"Bayern",      teamShort:"FCB", image:"/brand/players/avatar-3.svg", styleTag:"Sweeper Keeper" },

  // ── RB ──────────────────────────────────────────────────────────────────
  { id:"rb1", name:"T. Arnold",     position:"RB", team:"Real Madrid", teamShort:"RMA", image:"/brand/players/avatar-4.svg", styleTag:"Overlapping Wing" },
  { id:"rb2", name:"D. Carvajal",   position:"RB", team:"Real Madrid", teamShort:"RMA", image:"/brand/players/avatar-5.svg", styleTag:"Veteran Right"    },
  { id:"rb3", name:"A. Hakimi",     position:"RB", team:"PSG",         teamShort:"PSG", image:"/brand/players/avatar-6.svg", styleTag:"Flying Wingback"  },

  // ── CB ──────────────────────────────────────────────────────────────────
  { id:"cb1", name:"R. Dias",       position:"CB", team:"Man City",    teamShort:"MCI", image:"/brand/players/avatar-1.svg", styleTag:"The Wall"          },
  { id:"cb2", name:"Van Dijk",      position:"CB", team:"Liverpool",   teamShort:"LIV", image:"/brand/players/avatar-2.svg", styleTag:"Aerial Dominator"  },
  { id:"cb3", name:"É. Militão",    position:"CB", team:"Real Madrid", teamShort:"RMA", image:"/brand/players/avatar-3.svg", styleTag:"Ball-Playing CB"   },
  { id:"cb4", name:"Upamecano",     position:"CB", team:"Bayern",      teamShort:"FCB", image:"/brand/players/avatar-4.svg", styleTag:"Pace & Power"      },
  { id:"cb5", name:"A. Laporte",    position:"CB", team:"Al Nassr",    teamShort:"ALN", image:"/brand/players/avatar-5.svg", styleTag:"Left-Foot Libero"  },
  { id:"cb6", name:"K. Koulibaly",  position:"CB", team:"Al Hilal",    teamShort:"ALH", image:"/brand/players/avatar-6.svg", styleTag:"Commanding Pres."  },

  // ── LB ──────────────────────────────────────────────────────────────────
  { id:"lb1", name:"T. Hernández",  position:"LB", team:"AC Milan",    teamShort:"ACM", image:"/brand/players/avatar-1.svg", styleTag:"Attacking Full"   },
  { id:"lb2", name:"A. Grimaldo",   position:"LB", team:"Bayer Lev.",  teamShort:"B04", image:"/brand/players/avatar-2.svg", styleTag:"Crossing Machine" },
  { id:"lb3", name:"A. Robertson",  position:"LB", team:"Liverpool",   teamShort:"LIV", image:"/brand/players/avatar-3.svg", styleTag:"Engine"           },

  // ── RM ──────────────────────────────────────────────────────────────────
  { id:"rm1", name:"M. Salah",      position:"RM", team:"Liverpool",   teamShort:"LIV", image:"/brand/players/avatar-4.svg", styleTag:"Clinical Winger" },
  { id:"rm2", name:"B. Saka",       position:"RM", team:"Arsenal",     teamShort:"ARS", image:"/brand/players/avatar-5.svg", styleTag:"Consistent Elite"},
  { id:"rm3", name:"L. Yamal",      position:"RM", team:"Barcelona",   teamShort:"BAR", image:"/brand/players/avatar-6.svg", styleTag:"Next Gen"        },
  { id:"rm4", name:"J. Musiala",    position:"RM", team:"Bayern",      teamShort:"FCB", image:"/brand/players/avatar-1.svg", styleTag:"Dribble Master"  },

  // ── CM ──────────────────────────────────────────────────────────────────
  { id:"cm1", name:"Rodri",         position:"CM", team:"Man City",    teamShort:"MCI", image:"/brand/players/avatar-2.svg", styleTag:"Midfield Rock"  },
  { id:"cm2", name:"K. De Bruyne",  position:"CM", team:"Man City",    teamShort:"MCI", image:"/brand/players/avatar-3.svg", styleTag:"Vision King"    },
  { id:"cm3", name:"Pedri",         position:"CM", team:"Barcelona",   teamShort:"BAR", image:"/brand/players/avatar-4.svg", styleTag:"Technician"     },
  { id:"cm4", name:"T. Kroos",      position:"CM", team:"Real Madrid", teamShort:"RMA", image:"/brand/players/avatar-5.svg", styleTag:"Maestro"        },
  { id:"cm5", name:"F. Valverde",   position:"CM", team:"Real Madrid", teamShort:"RMA", image:"/brand/players/avatar-6.svg", styleTag:"Box-to-Box"     },
  { id:"cm6", name:"M. Ødegaard",   position:"CM", team:"Arsenal",     teamShort:"ARS", image:"/brand/players/avatar-1.svg", styleTag:"Captain Class"  },

  // ── LM ──────────────────────────────────────────────────────────────────
  { id:"lm1", name:"Vinicius Jr.",  position:"LM", team:"Real Madrid", teamShort:"RMA", image:"/brand/players/avatar-2.svg", styleTag:"Pace Monster"    },
  { id:"lm2", name:"H-M. Son",      position:"LM", team:"Tottenham",   teamShort:"TOT", image:"/brand/players/avatar-3.svg", styleTag:"Flair Merchant"  },
  { id:"lm3", name:"L. Díaz",       position:"LM", team:"Liverpool",   teamShort:"LIV", image:"/brand/players/avatar-4.svg", styleTag:"Electric Winger" },
  { id:"lm4", name:"Kvaratskhelia", position:"LM", team:"PSG",         teamShort:"PSG", image:"/brand/players/avatar-5.svg", styleTag:"Unstoppable"     },

  // ── ST ──────────────────────────────────────────────────────────────────
  { id:"st1", name:"E. Haaland",    position:"ST", team:"Man City",    teamShort:"MCI", image:"/brand/players/avatar-6.svg", styleTag:"Goal Machine"    },
  { id:"st2", name:"K. Mbappé",     position:"ST", team:"Real Madrid", teamShort:"RMA", image:"/brand/players/avatar-1.svg", styleTag:"Lightning"       },
  { id:"st3", name:"H. Kane",       position:"ST", team:"Bayern",      teamShort:"FCB", image:"/brand/players/avatar-2.svg", styleTag:"Complete Striker" },
  { id:"st4", name:"R. Lewandowski",position:"ST", team:"Barcelona",   teamShort:"BAR", image:"/brand/players/avatar-3.svg", styleTag:"Penalty King"    },
  { id:"st5", name:"V. Osimhen",    position:"ST", team:"Galatasaray", teamShort:"GAL", image:"/brand/players/avatar-4.svg", styleTag:"Explosive Pace"  },
  { id:"st6", name:"J. Álvarez",    position:"ST", team:"Atlético",    teamShort:"ATM", image:"/brand/players/avatar-5.svg", styleTag:"Engine Room ST"  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export function getTodayKey(): string {
  return `predixi-daily-xi-${todayStr()}`;
}

export function loadTodayXI(): (DailyXIPlayer | null)[] {
  if (typeof window === "undefined") return Array(11).fill(null);
  try {
    const raw = localStorage.getItem(getTodayKey());
    if (!raw) return Array(11).fill(null);
    const parsed = JSON.parse(raw) as (DailyXIPlayer | null)[];
    if (!Array.isArray(parsed) || parsed.length !== 11) return Array(11).fill(null);
    return parsed;
  } catch {
    return Array(11).fill(null);
  }
}

export function saveTodayXI(slots: (DailyXIPlayer | null)[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getTodayKey(), JSON.stringify(slots));
  } catch { /* quota or SSR */ }
}

export function clearTodayXI(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(getTodayKey());
  } catch { /* ignore */ }
}

export function pickRandomPlayerForPosition(
  position: string,
  alreadySelectedIds: string[],
): DailyXIPlayer | null {
  const available = PLAYER_POOL.filter(
    p => p.position === position && !alreadySelectedIds.includes(p.id),
  );
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

// ── Dynamic pool override ──────────────────────────────────────────────────
// Set by DailyHeroes component on mount when it fetches real WC player photos
// from the DB-backed /api/players endpoint. Falls back to PLAYER_POOL if null.

let _dynamicPool: DailyXIPlayer[] | null = null;

/**
 * Override the player pool with DB-backed players (e.g. WC 2026 squad data).
 * Called once on mount by DailyHeroes — never called from server code.
 */
export function setDynamicPlayerPool(pool: DailyXIPlayer[]): void {
  _dynamicPool = pool.length > 0 ? pool : null;
}

/** Returns pool of players for a position, excluding already-selected ids. */
export function getPositionPool(
  position: string,
  alreadySelectedIds: string[],
): DailyXIPlayer[] {
  const pool = _dynamicPool ?? PLAYER_POOL;
  return pool.filter(
    p => p.position === position && !alreadySelectedIds.includes(p.id),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Remote helpers (async, Supabase-backed via /api/daily-xi)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch the Daily XI entry for a wallet/date from Supabase.
 * Returns the 11-slot array on success, null on any error or missing entry.
 * Caller falls back to localStorage when null is returned.
 */
export async function fetchDailyXIRemote(
  walletAddress: string,
  date?: string,
): Promise<(DailyXIPlayer | null)[] | null> {
  try {
    const params = new URLSearchParams({ wallet: walletAddress });
    if (date) params.set("date", date);
    const res = await fetch(`/api/daily-xi?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json() as {
      success: boolean;
      entry?: { players: (DailyXIPlayer | null)[] } | null;
    };
    if (!data.success || !data.entry || !Array.isArray(data.entry.players)) return null;
    const arr = data.entry.players;
    // Validate shape — must be an 11-element array
    if (arr.length !== 11) return null;
    return arr as (DailyXIPlayer | null)[];
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// fetchDailyXIEntryMeta — returns status/earnedXp/projectedMaxXp for display
// ─────────────────────────────────────────────────────────────────────────────

export type DailyXIEntryMeta = {
  status:           string;
  earnedXp:         number;
  projectedMaxXp:   number;
  commitmentHash?:  string | null;
  submittedOnchain?: boolean;
  txHash?:          string | null;
};

/**
 * Fetch entry metadata (status, earnedXp, projectedMaxXp, proof fields) for a wallet/date.
 * Returns null on any error or missing entry. Does not return player slots.
 */
export async function fetchDailyXIEntryMeta(
  walletAddress: string,
  date?: string,
): Promise<DailyXIEntryMeta | null> {
  try {
    const params = new URLSearchParams({ wallet: walletAddress });
    if (date) params.set("date", date);
    const res = await fetch(`/api/daily-xi?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json() as {
      success: boolean;
      entry?: {
        status:           string;
        earnedXp:         number;
        projectedMaxXp:   number;
        commitmentHash?:  string | null;
        submittedOnchain?: boolean;
        txHash?:          string | null;
      } | null;
    };
    if (!data.success || !data.entry) return null;
    return {
      status:           data.entry.status,
      earnedXp:         data.entry.earnedXp        ?? 0,
      projectedMaxXp:   data.entry.projectedMaxXp   ?? 20,
      commitmentHash:   data.entry.commitmentHash   ?? null,
      submittedOnchain: data.entry.submittedOnchain ?? false,
      txHash:           data.entry.txHash           ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Persist the current Daily XI slots to Supabase.
 * Fire-and-forget — never throws. localStorage must be saved before calling.
 *
 * auth.message + auth.signature are required by the backend (Phase 2).
 * Pass the EIP-191 signed message and its hex signature from the wallet.
 */
/**
 * Persist the Daily XI slots to Supabase.
 * Returns { commitmentHash } from the POST response so the caller can
 * show the Anchor on Base button immediately without a separate meta refetch.
 * Throws on network failure or non-ok HTTP response with the server's error message.
 * localStorage must already be saved before calling this.
 */
export async function saveDailyXIRemote(
  walletAddress: string,
  players: (DailyXIPlayer | null)[],
  date?: string,
  auth?: { message: string; signature: string },
): Promise<{ commitmentHash: string | null }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  // HTTP header values cannot contain newlines (RFC 7230) — the auth message is
  // a multiline string joined with \n.  encodeURIComponent makes it header-safe.
  // The server decodes with decodeURIComponent before signature verification.
  if (auth?.message)   headers["x-wallet-message"]   = encodeURIComponent(auth.message);
  if (auth?.signature) headers["x-wallet-signature"] = auth.signature;

  let res: Response;
  try {
    res = await fetch("/api/daily-xi", {
      method:  "POST",
      headers,
      body:    JSON.stringify({
        walletAddress,
        players,
        ...(date ? { entryDate: date } : {}),
        projectedMaxXp: 20,
      }),
    });
  } catch (fetchErr) {
    // Network-level failure (offline, fetch aborted, invalid header value, DNS error)
    const detail = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    console.warn("[DailyXI] fetch threw:", detail);
    throw new Error(`Network error — ${detail}`);
  }

  if (!res.ok) {
    // Surface the server's own error message so the user sees the real reason
    let serverMsg = `Server error ${res.status}`;
    try {
      const body = await res.json() as { error?: string };
      if (body.error) serverMsg = body.error;
    } catch { /* ignore JSON parse failure */ }
    console.warn("[DailyXI] remote save rejected:", res.status, serverMsg);
    throw new Error(serverMsg);
  }

  // Extract commitmentHash from successful response so callers can display
  // the Anchor on Base button immediately without a separate entryMeta refetch.
  try {
    const data = await res.json() as { commitmentHash?: string };
    return { commitmentHash: data.commitmentHash ?? null };
  } catch {
    return { commitmentHash: null };
  }
}
