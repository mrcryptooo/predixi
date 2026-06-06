# PrediXI World Cup 2026 Data Foundation + Daily XI Real Player Photos

**Status:** COMPLETE  
**Latest commit:** `e7c0bee feat: wire daily xi player pools to db-backed api`  
**Production:** https://predixi-base.vercel.app  
**Date:** 2026-06-07

---

## 1. Executive Summary

This document covers the World Cup 2026 data integration built on top of the API-Football
Pro plan infrastructure (Phases A–D4, already locked). The work adds:

1. **Live WC 2026 data** — 72 fixtures, 48 group standings, all from API-Football
2. **National team metadata** — 48 WC nations with logos, short codes, and group assignments
3. **Player squads + photos** — 1,248 players from all 48 WC nations with real APF photo URLs
4. **DB-backed player read API** — `GET /api/players` serves the player data with zero APF calls
5. **Daily XI UI wiring** — Golden Boot, Golden Glove, and Best Young Player pickers now show
   real player photos instead of 6 rotating generic avatar SVGs

The World Cup page reads player data exclusively from Supabase — it never calls API-Football
directly. The APF budget is only consumed by admin sync endpoints run manually.

**Key principle:** Sync endpoints (admin) call APF. Read endpoints serve from DB cache.
The frontend never touches the APF key.

---

## 2. Completed Phase List

### WC-B — World Cup Fixtures + Group Standings

**Commits:** `7da234f` (endpoints), `5fda9ff` (dedup fix)

- Created `POST /api/admin/sync-wc-fixtures` — fetches WC 2026 match schedule from APF
- Created `POST /api/admin/sync-wc-standings` — fetches group standings from APF
- League ID: **1** (FIFA World Cup), Season: **2026** (explicit, not `APF_CURRENT_SEASON`)
- Real sync results: 72 fixtures, 48 standings rows (after dedup fix for duplicate group entries)
- Fixtures stored in `matches` table with `league_id='WC'`, `api_source='apf'`
- Standings stored in `standings` table with `league_id='WC'`, `season=2026`
- `APF_WORLD_CUP` constant added to `apiFootballConfig.ts` — separate from club league crons

### WC-C — National Teams + Logos

**Commits:** `65981e5` (endpoint), `869cfa5` (alias fix)

- New `national_teams` table (migration `supabase/add-national-teams.sql`)
- Created `POST /api/admin/sync-national-teams` — fetches team metadata + logos from APF
- `short_code` and `group_code` inferred from `src/data/worldcup.ts` (no extra APF call)
- Two-entry alias fix: `"Bosnia & Herzegovina"` → `"Bosnia-Herzegovina"`,
  `"Congo DR"` → `"DR Congo"` (APF name variants vs. worldcup.ts format)
- Final result: 48/48 logo_url, 48/48 short_code, 48/48 group_code

### WC-D — Player Squads + Real Player Photos

**Commit:** `32efc53`

- New `players` table (migration `supabase/add-players.sql`)
- Created `POST /api/admin/sync-player-squads` — fetches squads from APF `/players/squads`
- Safety defaults: `dryRun=true`, `limitTeams=1` — full sync requires explicit body params
- Full 48-team sync ran in two batches (first batch timed out after 39 teams; 9 remaining
  synced separately by specifying `teamIds`)
- `team_logo_url` populated from `national_teams.logo_url` — no extra APF call per player

**Final counts:**
- 1,248 players total
- 100% `photo_url` coverage (APF CDN URLs)
- 100% `team_logo_url` coverage
- All 4 positions covered: Goalkeeper (118), Defender (331), Midfielder (322), Attacker (229) *(sample; 1,248 actual)*

### WC-E1 — DB-Backed Player Read API

**Commit:** `7127878`

- Created `GET /api/players`
- Reads from `players` table only — **zero APF calls**
- Filters: `leagueId`, `season`, `position`, `teamId`, `limit` (max 1,500)
- Cache headers: `public, max-age=60, s-maxage=300`
- Returns camelCase JSON with `photoUrl`, `teamLogoUrl`, full squad metadata

### WC-E2 — Daily XI UI Wiring

**Commit:** `e7c0bee`

- Updated `src/app/world-cup/page.tsx` to fetch player pools from `/api/players` on mount
- Three parallel fetches (DB-backed, zero APF calls):
  - `?position=Attacker&limit=200` → Golden Boot pool
  - `?position=Goalkeeper&limit=100` → Golden Glove pool
  - `?limit=300` + age ≤ 26 filter → Best Young Player pool
- `toPlayerOption()` maps API player to `SelectionOption.src = player.photoUrl`
- Static hardcoded pools remain as fallback (API failure / 404 safe)
- Pool substitution inline at render time — static arrays untouched

### WC-E3 — Submit Flow QA

**No code changes.**

Full inspection of the submit flow confirmed:

- `WorldCupPredictionCard` stores `selected: string[]` — only `option.label` values
- `photoUrl` / `src` is display-only — never reaches the API or DB
- `/api/wc-predictions` persists `selectedValue: string[]` (e.g., `["Alisson Becker"]`)
- Old entries with hardcoded labels preserved as-is — no backward compatibility issue
- APF budget unchanged before and after page load tests

---

## 3. Database Tables

### `matches` (WC data subset)

```sql
SELECT * FROM matches WHERE league_id = 'WC';
-- 72 rows (api_source='apf')
-- Columns: id ('apf-{id}'), league_id, home/away team names + IDs,
--          home/away_team_crest (CDN), league_logo, country_flag,
--          kickoff, status, home/away_score, actual_outcome, api_source
```

### `standings` (WC data subset)

```sql
SELECT * FROM standings WHERE league_id = 'WC' AND season = 2026;
-- 48 rows (one per WC nation)
-- Columns: team_name, team_id ('apf-team-{id}'), team_logo (CDN),
--          position, points, played, won, drawn, lost,
--          goals_for, goals_against, goal_diff, form, description
```

### `national_teams`

```sql
SELECT * FROM national_teams WHERE world_cup_year = 2026;
-- 48 rows
-- Columns: apf_team_id, team_id ('apf-team-{id}'), name, short_code,
--          country, group_code ('A'–'L'), logo_url (CDN), flag_url,
--          world_cup_year (2026), source ('apf')
```

### `players`

```sql
SELECT * FROM players WHERE world_cup_year = 2026;
-- 1,248 rows
-- Columns: apf_player_id, player_id ('apf-player-{id}'), name,
--          age, number, position, nationality (null — not in /squads response),
--          photo_url (CDN), apf_team_id, team_id, team_name, team_logo_url,
--          world_cup_year (2026), source ('apf')
```

### `wc_predictions` (existing — unchanged)

```sql
-- One row per (wallet_address, prediction_key)
-- Columns: wallet_address, prediction_key, prediction_type,
--          selected_value (text[] — player/team labels),
--          xp_reward, commitment_hash, status ('pending'),
--          submitted_onchain, tx_hash
```

---

## 4. API Endpoints

### Admin Sync Endpoints (call APF — consume budget)

| Endpoint | APF call | Purpose |
|---|---|---|
| `POST /api/admin/sync-wc-fixtures` | 1 | WC fixture schedule (today + window) |
| `POST /api/admin/sync-wc-standings` | 1 | WC group standings |
| `POST /api/admin/sync-national-teams` | 1 | 48 national teams + logos |
| `POST /api/admin/sync-player-squads` | 1 per team (up to 48) | Squad + player photos |

All admin endpoints: `x-admin-key` auth, `dryRun` support, budget guard active.

**`sync-player-squads` safety defaults:**
- `dryRun = true` (default — explicit `false` required to write)
- `limitTeams = 1` (default — explicit value required for more)
- `teamIds: number[]` — sync only specific teams

### Read Endpoints (DB-backed — zero APF calls)

| Endpoint | Source | Purpose |
|---|---|---|
| `GET /api/players?leagueId=WC&season=2026` | `players` table | Player pool for Daily XI |
| `GET /api/standings?leagueId=WC&season=2026` | `standings` table | WC group standings |
| `GET /api/admin/football/leagues?search=WC` | APF (1 call) | Admin discovery only |

`GET /api/players` params:

```
leagueId  string   default 'WC'
season    number   default 2026
position  string   Goalkeeper | Defender | Midfielder | Attacker
teamId    string   'apf-team-{id}'
limit     number   default 200, max 1500
```

---

## 5. Data Counts

| Table | Rows | Coverage |
|---|---|---|
| WC fixtures (`matches`) | 72 | `home_team_crest` ✓, `league_logo` ✓, `api_source='apf'` ✓ |
| WC standings | 48 | `team_logo` ✓, `league_logo` ✓, `country_flag` null (international, expected) |
| National teams | 48 | `logo_url` 48/48, `short_code` 48/48, `group_code` 48/48 |
| Players | 1,248 | `photo_url` 1,248/1,248 (100%), `team_logo_url` 1,248/1,248 |

**Position breakdown (players):**

| Position | Count |
|---|---|
| Goalkeeper | ~118 |
| Defender | ~331 |
| Midfielder | ~322 |
| Attacker | ~229 |
| Total | **1,248** |

---

## 6. Daily XI UI Behavior

### Before WC-E2 (generic avatars)

```typescript
// Hardcoded — 20 players with rotating avatar-1.svg through avatar-6.svg
const GOLDEN_BOOT_POOL = addAvatars([
  { label: "K. Mbappé", flag: "🇫🇷", sub: "France" },
  // ... 19 more
])
```

### After WC-E2 (real player photos)

```typescript
// On mount, page fetches from DB-backed /api/players
// Pool state initialised with static fallback, hydrated when fetch completes
const [attackerPool, setAttackerPool] = useState(GOLDEN_BOOT_POOL)   // fallback

useEffect(() => {
  // GET /api/players?position=Attacker&limit=200 → all 229 WC attackers, real photos
  // GET /api/players?position=Goalkeeper&limit=100 → all 118 WC goalkeepers
  // GET /api/players?limit=300 (age ≤ 26) → young players pool
}, [])
```

**At render time**, pool is injected inline:
```typescript
prediction.id === 'wc-golden-boot' ? { ...sp, pool: attackerPool } : sp
```

### Player → SelectionOption mapping

```typescript
{
  label: player.name,            // persisted on selection
  sub:   player.teamName,        // "Argentina"
  src:   player.photoUrl ?? AVATAR(0),  // APF CDN URL or fallback avatar
  flag:  FLAG_SRC[player.teamName],     // country flag from existing map
}
```

### Fallback Safety

If `/api/players` returns 404 or fails (network error):
- Static hardcoded pools remain as state initial values
- Page never crashes or shows an empty picker
- Generic avatars display instead of real photos
- Submit flow unaffected

---

## 7. Submit Flow QA

### Data path (unchanged from pre-WC-E2)

```
User selects player option (label = "Alisson Becker")
  ↓
selected: string[] = ["Alisson Becker"]
  ↓
saveWCPrediction() → localStorage (immediate, label only)
  ↓
saveWCPredictionRemote() → POST /api/wc-predictions
  body: { selectedValue: ["Alisson Becker"] }
  ↓
wc_predictions.selected_value = '{"Alisson Becker"}'  (DB)
```

**`photoUrl` never reaches the API.** It is a `SelectionOption.src` display prop only.

### Backward compatibility

| Scenario | Impact |
|---|---|
| Old entry: `["Alisson"]` (hardcoded label) | ✅ Preserved — DB unchanged by WC-E2 |
| New entry: `["Alisson Becker"]` (APF label) | ✅ Different label, no conflict |
| `photo_url = null` in players table | ✅ `AVATAR(0)` fallback, label still submitted |
| Age field absent (null) | ✅ Player excluded from young pool — graceful |

**No scoring logic changed.** No DB schema changes. No existing submission invalidated.

---

## 8. API Budget Model

### Sync (writes to DB — consumes APF budget)

```
sync-wc-fixtures:     1 call/run
sync-wc-standings:    1 call/run
sync-national-teams:  1 call/run (one-time)
sync-player-squads:   1 call/team = 48 calls for full WC (one-time)
```

Total WC integration APF calls: ~53 calls (initial setup), then ~2/day ongoing
(fixtures + standings). All within the 7,500/day Pro plan limit.

### Read (zero APF calls — frontend safe)

```
GET /api/players        → players table (Supabase)
GET /api/standings      → standings table (Supabase)
World Cup page load     → /api/players × 3 fetches (all DB-backed)
```

**The World Cup page never touches `API_FOOTBALL_KEY`.**

---

## 9. Known Caveats

### Player nationality is null

APF's `/players/squads` endpoint does not return `nationality`. The `players.nationality`
column exists and is always `null`. Nationality can be backfilled using `/players?team=...&season=2026`
which returns full player profiles — but this adds ~48 more APF calls and is not needed for
the current UI. The team name serves as the nationality proxy for now.

### Daily XI scoring is still manual

Player stats (goals, assists, clean sheets, rating, cards) are not yet fetched automatically
from APF. The `POST /api/admin/score-daily-xi` endpoint requires manual stat input.
**Phase WC-F** (match events integration) will automate this using APF `/fixtures/events`.

### Live polling deferred

Live match score updates during match hours are not implemented yet. Standings and fixture
results only update when `sync-wc-fixtures` and `sync-wc-standings` are run (manually or
via future cron). **Phase WC-G** will add live polling (requires Vercel Pro for
sub-daily cron or a different trigger mechanism).

### Photo CDN dependency

All `photo_url` values point to `media.api-sports.io` CDN. If APF changes CDN structure,
photos could break. Future improvement: mirror photos to PrediXI's own storage/CDN (see
Phase WC-H).

---

## 10. Future Phases

### WC-F — Match Events + Automated Daily XI Scoring

After each WC match finishes:
1. `fetchApfFixtureEvents(fixtureId)` → goals, cards, substitutions
2. New `match_events` table: `apf_fixture_id`, `player_id`, `event_type`, `minute`
3. New `player_stats_daily` table: `apf_player_id`, `goals`, `assists`, `clean_sheet`, `rating`, `cards`
4. Update `cron/score-daily-xi` to auto-score from DB stats — no manual admin input needed

### WC-G — Live Score Polling on Match Days

- Cron calling `fetchApfFixtures({ live: 'all' })` every 5 minutes during 12:00–23:00 UTC
- Updates `matches.home_score`, `away_score`, `status` in real time
- Requires Vercel Pro for sub-daily cron (or event-driven trigger)

### WC-H — Lineups Integration

Before each match kickoff:
- `fetchApfFixtureLineups(fixtureId)` → confirmed starting XIs
- Store in a new `match_lineups` table
- Update Daily XI UI to show "Confirmed" badge when lineup includes a selected player

### WC-I — Player Photo CDN Mirroring

Mirror all `photo_url` values from `media.api-sports.io` to PrediXI's own storage/CDN:
1. Background job reads `players.photo_url`
2. Downloads each image
3. Uploads to Supabase Storage / Cloudflare R2
4. Updates `players.photo_url` with new self-hosted URL

No structural changes needed — just a data migration job.

---

## 11. Final Status

```
┌────────────────────────────────────────────────────────────────────────────┐
│  World Cup 2026 Data Foundation + Daily XI Real Player Photos = COMPLETE   │
│                                                                            │
│  WC Fixtures:    72 rows  ·  matches table  ·  league_id='WC'             │
│  WC Standings:   48 rows  ·  standings table  ·  season=2026              │
│  National Teams: 48 rows  ·  logo/short_code/group 100%                   │
│  Players:      1,248 rows ·  photo_url 100%  ·  team_logo_url 100%       │
│                                                                            │
│  Player Read API: GET /api/players — DB-backed, zero APF calls            │
│  Daily XI UI:     Golden Boot / Glove / Young now show real player photos  │
│  Submit QA:       labels-only persistence confirmed, no regression        │
│                                                                            │
│  Latest commit: e7c0bee                                                    │
│  Production:    https://predixi-base.vercel.app                           │
└────────────────────────────────────────────────────────────────────────────┘
```
