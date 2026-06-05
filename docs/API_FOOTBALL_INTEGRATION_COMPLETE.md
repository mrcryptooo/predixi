# PrediXI API-Football Integration — Complete

**Status:** COMPLETE through Phase D4  
**Latest commit:** `a8cce8c feat: add daily standings cron`  
**Production:** https://predixi-base.vercel.app  
**Date:** 2026-06-06

---

## 1. Executive Summary

PrediXI integrates API-Football (api-sports.io) Pro plan as the primary football data source,
replacing/supplementing the previous football-data.org free tier. The integration is fully
server-side — no API-Football calls are ever made from the browser. All data is cached in
Supabase and served to the frontend from the DB.

**What was integrated:**

| Data type | Source | Cached in |
|---|---|---|
| Fixtures (upcoming) | APF `/fixtures?league&season&from&to` | `matches` table |
| Results (live/finished) | APF `/fixtures?id` | `matches` table |
| League standings | APF `/standings?league&season` | `standings` table |
| Team logos | APF `teams.home/away.logo` | `matches.home/away_team_crest` |
| League logos | APF `league.logo` | `matches.league_logo`, `standings.league_logo` |
| Country flags | APF `country.flag` | `matches.country_flag`, `standings.country_flag` |

**What is NOT yet integrated (future phases):**
- Live match polling (minute-by-minute scores) — Phase E
- Match events (goals, cards, substitutions) — Phase F
- Lineups + coach photos — Phase F
- Player statistics + photos — Phase G (Daily XI upgrade)
- Injuries — Phase G

---

## 2. Provider and Environment Setup

### API Plan

| Property | Value |
|---|---|
| Provider | API-Football / api-sports.io |
| Plan | Pro ($19/month) |
| Daily limit | 7,500 requests |
| Base URL | `https://v3.football.api-sports.io` |
| Auth header | `x-apisports-key: <key>` |

### Environment Variables

| Variable | Location | Purpose |
|---|---|---|
| `API_FOOTBALL_KEY` | Vercel Production + `.env.local` | API authentication (server-only, never client) |
| `APF_CURRENT_SEASON` | Vercel Production + `.env.local` | Season year (e.g. `2025` for 2025/26) |
| `FOOTBALL_DATA_TOKEN` | Vercel + `.env.local` | Legacy football-data.org key (still used for fixtures) |

**Season rollover:** To update the season, set `APF_CURRENT_SEASON=2026` in Vercel env and
redeploy. No code change required.

---

## 3. Request Budget Model

### Constants (src/lib/football/apiFootball.ts)

```typescript
APF_DAILY_BUDGET    = 7,500   // Pro plan daily limit
APF_DAILY_WARNING   = 3,000   // Health check shows 'warning' above this
APF_DAILY_HARD_CAP  = 6,000   // No more calls above this; returns budgetExceeded:true
```

### Tracking Table

Every APF call is logged to `api_request_log` (Supabase):

```sql
api_request_log (
  date             date,     -- UTC calendar day
  provider         text,     -- 'apf' | 'fd'
  endpoint         text,     -- 'fixtures' | 'standings' | 'leagues'
  calls_this_day   integer,  -- incremented per call
  last_called_at   timestamptz
)
```

### Health Dashboard

`GET /api/admin/health` returns `checks.apiBudget`:

```json
{
  "state":            "healthy",
  "provider":         "apf",
  "callsToday":       19,
  "budget":           7500,
  "warningThreshold": 3000,
  "hardCap":          6000,
  "usedPercent":      0.25
}
```

### Budget Guard Logic

Before every APF call, `apfFetch()` in `src/lib/football/apiFootball.ts`:
1. Reads `SUM(calls_this_day)` from `api_request_log` for today
2. If `>= APF_DAILY_HARD_CAP` → returns `{ ok: false, budgetExceeded: true }` — no HTTP call made
3. After successful call → increments the log row (insert or update)
4. API key never appears in any log or error message

---

## 4. DB Migrations and Tables

### `api_request_log`

```
supabase/add-api-request-log.sql   (applied 2026-06-05)
```

Tracks per-day APF call counts. Used by budget guard and health dashboard.

### `matches` — new columns

```
supabase/add-match-media-fields.sql   (applied 2026-06-05)
```

| Column | Type | Purpose |
|---|---|---|
| `home_team_crest` | `text NULL` | Team badge CDN URL |
| `away_team_crest` | `text NULL` | Team badge CDN URL |
| `league_logo` | `text NULL` | League logo CDN URL |
| `country_flag` | `text NULL` | Country flag CDN URL |
| `api_source` | `text NULL` | `'fd'` \| `'apf'` \| `'mock'` |

`api_source` has a CHECK constraint: `NULL OR IN ('fd', 'apf', 'mock')`.

Note: `home_team_crest` and `away_team_crest` were originally added by
`supabase/add-team-crests.sql` (earlier migration). The media migration adds
the three new columns.

### `standings`

```
supabase/add-standings.sql   (applied 2026-06-06)
```

Caches league standings from APF. One row per team per league per season.

```sql
standings (
  league_id    text,      -- 'PL' | 'PD' | ... (matches matches.league_id)
  team_id      text,      -- 'apf-team-{id}' (matches matches.home/away_team_id)
  season       integer,   -- e.g. 2025
  position     integer,
  points, played, won, drawn, lost,
  goals_for, goals_against, goal_diff,
  league_logo, country_flag, team_logo,  -- CDN URLs
  form, description,
  UNIQUE (league_id, season, team_id)
)
```

Current state (after Phase D sync): **132 rows** across 6 leagues.

---

## 5. API Wrapper and Config

### Provider Wrapper: `src/lib/football/apiFootball.ts`

Central server-only module. All APF calls go through `apfFetch()`.

**Exported functions:**

| Function | APF endpoint | Purpose |
|---|---|---|
| `fetchApfFixtures(params)` | `/fixtures` | Fixtures by date range, league, or single ID |
| `fetchApfStandings(params)` | `/standings` | League standings |
| `fetchApfLeagues(params?)` | `/leagues` | League discovery (admin only) |
| `fetchApfFixtureEvents(id)` | `/fixtures/events` | Match events (future use) |
| `fetchApfFixtureLineups(id)` | `/fixtures/lineups` | Lineups (future use) |
| `fetchApfTeams(params)` | `/teams` | Team metadata (future use) |

**Return type — `ApfResult<T>`:**

```typescript
{ ok: true;  data: T; callsToday: number }
| { ok: false; error: string; rateLimitHit?: boolean; budgetExceeded?: boolean; callsToday?: number }
```

Never throws. All errors are captured in the result.

### League Config: `src/lib/football/apiFootballConfig.ts`

```typescript
APF_CURRENT_SEASON = parseInt(process.env.APF_CURRENT_SEASON) || 2025

APF_LEAGUES = [
  { id:  39, code: 'PL',  name: 'Premier League',   country: 'England'       },
  { id: 140, code: 'PD',  name: 'La Liga',           country: 'Spain'         },
  { id:  78, code: 'BL1', name: 'Bundesliga',        country: 'Germany'       },
  { id: 135, code: 'SA',  name: 'Serie A',           country: 'Italy'         },
  { id:  61, code: 'FL1', name: 'Ligue 1',           country: 'France'        },
  { id:   2, code: 'CL',  name: 'Champions League',  country: 'International' },
]
```

League IDs verified live on 2026-06-05 via `GET /api/admin/football/leagues?current=true`.

---

## 6. Fixture Sync Flow

### Sources

Both APF and football-data.org run in parallel. Each has its own ID prefix:
- `fd-{id}` — football-data.org matches
- `apf-{id}` — API-Football matches

### Routes

| Route | Trigger | Behaviour |
|---|---|---|
| `POST /api/admin/sync-fixtures` | Manual admin | Syncs today + 7 days for all leagues |
| `GET /api/cron/sync-fixtures` | Daily 00:30 UTC | Same logic, CRON_SECRET auth |

### APF fixture sync logic (in both routes)

```
For each league in APF_LEAGUES:
  fetchApfFixtures({ league: id, season: APF_CURRENT_SEASON, from, to })
  → budget-tracked, hard cap respected
  → normalizeApfStatus(fx.fixture.status.short) → 'upcoming'|'live'|'finished'|...
  → inferOutcome(home, away, status) → 'H'|'D'|'A'|null
  → upsert into matches:
      id              = 'apf-{fx.fixture.id}'
      home_team_crest = fx.teams.home.logo   ← CDN URL
      away_team_crest = fx.teams.away.logo   ← CDN URL
      league_logo     = fx.league.logo       ← CDN URL
      country_flag    = fx.league.flag       ← CDN URL
      api_source      = 'apf'
  → NEVER overwrites settled actual_outcome
```

Football-data.org sync runs in the same route and sets `api_source = 'fd'`.

### Known caveat

As of 2026-06-05/06, the current date range (today +7 days) falls in the **off-season gap**
between 2025/26 end and 2026/27 start. The APF fixture sync returned 0 matches (correct —
no fixtures are scheduled). Budget tracking was confirmed working (6 calls logged).
The media field pipeline code is correct and will be verified when the 2026/27 season opens
(expected August/September 2026).

---

## 7. Result Sync Flow

### Route

`POST /api/admin/sync-results`

Fetches current status and scores for matches within a configurable kickoff window.
Does not settle predictions — run `auto-settle` separately.

### APF result lookup (since Phase C3)

```typescript
// For each candidate match with id prefix 'apf-':
const numericId = id.slice(4)   // 'apf-12345' → '12345'
const result = await fetchApfFixtures({ id: parseInt(numericId, 10) })
// → budget-tracked under endpoint 'fixtures'
// → budgetExceeded stops remaining APF lookups
// → rateLimitHit stops remaining APF lookups
```

The route supports `dryRun: true` which makes zero API calls and lists candidates only.

---

## 8. Standings Sync Flow

### Shared logic: `src/lib/football/syncStandings.ts`

```typescript
runStandingsSync(supabase, { season?, dryRun? }): Promise<StandingsSyncResult>
```

For each league in `APF_LEAGUES`:
1. `fetchApfStandings({ league, season })` — budget-tracked
2. Flatten `payload.league.standings.flat()` (handles CL multi-group stage)
3. Map to `InsertStanding[]` with CDN URLs for logos/flags
4. Upsert on `UNIQUE(league_id, season, team_id)` — idempotent

### Routes

| Route | Trigger | Behaviour |
|---|---|---|
| `POST /api/admin/sync-standings` | Manual | Supports `dryRun` and `season` override |
| `GET /api/cron/sync-standings` | Daily 01:00 UTC | Real sync, logs to `cron_runs` |

### Current DB state (post Phase D sync)

| League | Rows |
|---|---|
| PL (Premier League) | 20 |
| PD (La Liga) | 20 |
| BL1 (Bundesliga) | 18 |
| SA (Serie A) | 20 |
| FL1 (Ligue 1) | 18 |
| CL (Champions League) | 36 (multiple groups) |
| **Total** | **132** |

---

## 9. Standings Read API and UI Flow

### Read API: `GET /api/standings?leagueId=PL&season=2025`

Source: `standings` table only — **zero APF calls**.

```json
{
  "ok": true,
  "leagueId": "PL",
  "season": 2025,
  "count": 20,
  "updatedAt": "...",
  "league": { "name": "Premier League", "logo": "CDN URL", "country": "England", "countryFlag": "CDN URL" },
  "standings": [
    { "position": 1, "teamId": "apf-team-50", "teamName": "Arsenal", "teamLogo": "CDN URL",
      "played": 38, "won": 27, "drawn": 4, "lost": 7,
      "goalsFor": 88, "goalsAgainst": 48, "goalDiff": 40,
      "points": 85, "form": "WWWDW", "description": "Champions League" }
  ]
}
```

Cache headers: `Cache-Control: public, max-age=60, s-maxage=300`

### UI: `src/components/matches/StandingsTable.tsx`

The Matches page standings tab was switched from live football-data.org calls to the
DB-backed endpoint in Phase D3. The component now calls `/api/standings?leagueId=${comp}`
and renders team crests from APF CDN URLs.

---

## 10. Media Fields Strategy

### Current policy

All APF media URLs are stored in Supabase as returned from the API (CDN URLs on
`media.api-sports.io`). They are served to the frontend via Supabase queries — never
fetched directly from APF per page view.

### Fields currently stored

| APF response field | DB column | Table |
|---|---|---|
| `teams.home.logo` | `home_team_crest` | `matches` |
| `teams.away.logo` | `away_team_crest` | `matches` |
| `league.logo` | `league_logo` | `matches`, `standings` |
| `league.flag` / `country.flag` | `country_flag` | `matches`, `standings` |
| `team.logo` (standings) | `team_logo` | `standings` |

### Fields NOT yet stored (future phases)

| APF response field | Future DB column | Phase |
|---|---|---|
| `coach.photo` (lineups) | `coaches.photo_url` (new table) | Phase F |
| `player.photo` (players) | `players.photo_url` (new table) | Phase G |
| Venue image | `venues.image_url` (new table) | Future |

### Future improvement

The APF CDN (`media.api-sports.io`) is reliable but creates a dependency on an external
service. A future optional improvement is to mirror media URLs to PrediXI's own
storage/CDN bucket for independence. This requires no structural changes — just a
background job that downloads the URLs stored in the DB and updates the columns with
the new self-hosted URLs.

---

## 11. Current Cron Schedule

All crons run daily (Vercel Hobby plan supports daily frequency only).

| UTC time | Route | Purpose | APF calls |
|---|---|---|---|
| 00:30 | `POST /api/cron/sync-fixtures` | Upcoming fixtures for next 7 days | 6 |
| 01:00 | `POST /api/cron/sync-standings` | League standings refresh | 6 |
| 02:00 | `POST /api/cron/score-daily-xi` | Score Daily XI entries | 0 |
| 03:00 | `POST /api/cron/auto-settle` | Settle finished predictions | 0 |

**Daily APF cron total:** 12 calls / 7,500 budget (0.16%)

All crons authenticate with `Authorization: Bearer <CRON_SECRET>` set automatically
by Vercel. Every cron invocation writes one row to `cron_runs` for health monitoring.

---

## 12. Known Caveats

### Off-season fixture gap (2026-06-05/06)

The controlled fixture sync test (`admin/sync-fixtures`) returned **0 inserted / 0 updated**
for the current date range. This is expected — the 2025/26 season has ended and the 2026/27
season has not yet started. No fixtures are scheduled in the next 7 days for the configured
leagues.

**Verification deferred:** The APF fixture sync code is correct (budget tracking confirmed
with 6 calls logged, no errors). Media field population (`home_team_crest`, `away_team_crest`,
`league_logo`, `country_flag`, `api_source='apf'`) will be verified on the first real APF
fixture insert when the 2026/27 season opens (expected August/September 2026).

### `api_source` on existing mock rows

The 167 mock match rows (IDs like `pl-001`, `sa-001`) have `api_source = NULL` because they
were seeded before the media migration. They will not be updated by APF syncs — real APF rows
will have `api_source='apf'` and distinct `apf-{id}` prefixed IDs.

---

## 13. Future Phases

### Phase E — Live match polling *(when active season resumes)*

Add a cron that runs more frequently (Vercel Pro required) or a polling endpoint triggered
by the frontend during match hours. Calls `fetchApfFixtures({ live: 'all' })` to get live
scores for in-progress matches. Updates `matches.home_score`, `away_score`, `status`.

Recommended: every 5 minutes during 12:00–23:00 UTC (European match windows).
APF budget: ~18–50 calls on busy days.

### Phase F — Match events and lineups

After a match finishes:
- `fetchApfFixtureEvents(fixtureId)` → new `match_events` table (goals, cards, subs)
- `fetchApfFixtureLineups(fixtureId)` → new `match_lineups` table
- Coach photos (`coach.photo`) stored for lineup display

### Phase G — Daily XI player data upgrade

- `fetchApfTeams({ league, season })` → team metadata and logos
- Player stats for Daily XI team selection (form, minutes, goals)
- Player photos stored in a `players` table

### Phase H — Monitoring and admin panel

- Extend `/api/admin/health` with a per-endpoint APF usage breakdown
- Admin UI showing `api_request_log` sparkline by day
- Configurable budget alerts (currently hardcoded at 3,000 warning / 6,000 cap)

### Optional: APF media mirroring

Store APF CDN URLs in Supabase Storage (or another CDN) for independence from
`media.api-sports.io`. Background job reads URL columns → downloads → re-uploads →
updates DB with new URL. No structural changes needed.

---

## 14. Final Status

```
┌───────────────────────────────────────────────────────────────────────┐
│    PrediXI API-Football Integration through Phase D4 = COMPLETE       │
│                                                                       │
│  Provider:    API-Football Pro (api-sports.io)                        │
│  Budget:      7,500 req/day  ·  Hard cap: 6,000  ·  Warning: 3,000   │
│  Season:      2025 (APF_CURRENT_SEASON)                               │
│  Leagues:     PL / PD / BL1 / SA / FL1 / CL                          │
│  DB tables:   matches (media+source) · standings (132 rows)           │
│               api_request_log (budget tracking)                       │
│  Crons:       sync-fixtures 00:30 · sync-standings 01:00 (both daily) │
│  Read API:    GET /api/standings — DB-backed, zero APF calls          │
│  UI:          StandingsTable uses DB-backed endpoint                  │
│  Production:  https://predixi-base.vercel.app                        │
└───────────────────────────────────────────────────────────────────────┘
```

The integration chain from provider call → budget tracking → DB cache → read API → UI
is complete and live in production. All APF calls are server-side, budget-guarded, and
logged. The frontend never calls API-Football directly.
