# Football Data Integration Plan — PrediXI Phase 5

## 1. Recommended API Provider

**Primary: API-Football (api-sports.io)**
- Covers fixtures, live scores, results, teams, leagues, standings, players, statistics
- Free tier: 100 requests/day (sufficient for MVP sync)
- Consistent JSON structure, well-documented
- Same API key works across API-Sports umbrella (football, basketball, etc.)
- RapidAPI hosted version also available as alternative access method

**Backup: football-data.org**
- Simpler, more limited (fewer leagues, no players/stats on free tier)
- Good fallback for Premier League and major European competitions
- Use only if API-Football coverage is insufficient for a specific league

**Future: ScoreBat**
- Match highlight videos only
- Add in a later phase for highlight embeds on match detail pages

---

## 2. Sync First (MVP Priority)

| Data | Reason |
|---|---|
| Leagues (supported leagues list) | Required before syncing anything else |
| Teams per league | Required for fixture display |
| Fixtures (upcoming, current season) | Core prediction feature |
| Live match status | Show "LIVE" on match cards |
| Final scores / results | Required for settlement trigger |

---

## 3. Delay Until Later

| Data | Reason |
|---|---|
| Standings / league tables | Nice-to-have; not needed for predictions |
| Player rosters | Not needed for match prediction |
| Player statistics | Future feature (player-level predictions) |
| Historical seasons | Not needed for MVP |
| Injuries / suspensions | Future feature |

---

## 4. Required Environment Variables

```
# API-Football (server-only — never prefix with NEXT_PUBLIC_)
API_FOOTBALL_KEY=
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
```

Add to `.env.example` and Vercel dashboard. Never expose to client.

---

## 5. Supabase Table Additions / Changes

### New tables

**`sync_log`** — track last sync per data type
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
sync_type   TEXT NOT NULL  -- 'fixtures' | 'results' | 'standings' | 'teams'
league_id   TEXT
synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
records     INTEGER      -- how many rows upserted
status      TEXT         -- 'ok' | 'error'
error       TEXT
```

### Changes to existing tables

**`matches`** — add columns:
```sql
api_fixture_id   INTEGER UNIQUE   -- API-Football fixture ID for dedup
home_score       INTEGER          -- already exists, confirm not null after result
away_score       INTEGER          -- already exists
status_short     TEXT             -- 'NS' | 'LIVE' | 'FT' | 'PST' etc
elapsed          INTEGER          -- live minute
```

**`teams`** (new, optional) — normalize teams:
```sql
id           TEXT PRIMARY KEY  -- API-Football team ID (as text)
name         TEXT NOT NULL
short_name   TEXT
logo_url     TEXT
country      TEXT
```

---

## 6. Sync Strategy

### Phase 1: Manual sync API routes (implement first)

Admin-only POST routes, secured with `x-admin-secret`:

```
POST /api/sync/fixtures     -- sync upcoming fixtures for a league+season
POST /api/sync/results      -- sync final scores for finished fixtures
POST /api/sync/live         -- sync live match statuses (call every ~2 min during matches)
```

Each route:
1. Calls API-Football
2. Upserts into Supabase `matches` table on `api_fixture_id`
3. If result is final → sets `actual_outcome` + triggers `/api/settle-match` automatically
4. Logs to `sync_log`

### Phase 2: Scheduled cron (later)

- Use Vercel Cron Jobs (vercel.json `crons`) or external cron (e.g. cron-job.org)
- Fixtures sync: once daily
- Results sync: every 5 min on match days, hourly otherwise
- Live sync: every 2 min during live windows

---

## 7. Cache Strategy (Free Tier: 100 req/day)

| Endpoint | Cache TTL | Notes |
|---|---|---|
| Leagues list | 7 days | Rarely changes |
| Teams | 7 days | Rarely changes |
| Fixtures (upcoming) | 1 hour | Check for postponements |
| Live scores | 2 min | Only during active matches |
| Final results | Permanent | Once `FT`, never changes |
| Standings | 6 hours | After matchday |

Implementation: store `synced_at` in `sync_log`; skip API call if within TTL.
This keeps daily usage well under 100 requests on free tier.

---

## 8. Connection to Settlement

When a result sync confirms a match is finished (`status_short = 'FT'`):

1. Set `matches.actual_outcome` = computed from home/away score
2. Automatically call internal settlement logic (same as `/api/settle-match`)
3. XP awarded to correct predictors
4. `predictions.is_correct` and `points_awarded` updated
5. `profiles.xp`, `correct_predictions`, `total_predictions`, `rank` updated

This closes the full loop: **API result → Supabase match → settlement → XP → leaderboard**.

---

## 9. Implementation Phases

### Phase 5A — Plan (this document)
- Architecture defined, no code changes

### Phase 5B — Env setup
- Add `API_FOOTBALL_KEY` to `.env.local` and Vercel dashboard
- Add `API_FOOTBALL_BASE_URL` to `.env.example`
- Create `src/lib/football-api.ts` — typed API client, server-only

### Phase 5C — Sync leagues / teams / fixtures
- `POST /api/sync/fixtures` route
- Upsert into `matches` table using `api_fixture_id`
- Admin-secret protected
- Test with one league (e.g. Premier League, league_id=39, season=2025)

### Phase 5D — Sync scores / results + auto-settlement
- `POST /api/sync/results` route
- For each finished match: upsert score, set `actual_outcome`, run settlement
- Test end-to-end: fixture → prediction → result sync → XP awarded

### Phase 5E — Standings
- `POST /api/sync/standings` route
- Store in new `standings` table
- Display on league pages

### Phase 5F — Players / statistics (future)
- Out of scope for MVP
- Enable when player-level predictions are added

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Free tier 100 req/day limit | Aggressive caching via `sync_log`; only sync changed data |
| Team name/ID mismatch with mock data | Map API-Football `team.id` to existing mock IDs during migration; use `api_fixture_id` as source of truth |
| Data coverage gaps (lower leagues) | Stick to top 5 leagues + UCL + World Cup for MVP |
| Rate limiting (429) | Respect `x-ratelimit-remaining` header; back off on error |
| Provider lock-in | Abstract behind `src/lib/football-api.ts` interface; football-data.org as drop-in backup |
| Postponed / cancelled matches | Handle `PST`, `CANC`, `ABD` status codes; do not settle, notify admin |
| Live sync cost on Vercel cron | Free tier crons limited; use external cron for high-frequency live updates |
