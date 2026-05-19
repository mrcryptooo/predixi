# Football Fixtures Sync Plan — PrediXI Phase 5C

## 1. League to Test First

**Recommended: La Liga (API-Football league_id = 140)**
- Well-covered on free tier
- Season 2024 (use `season=2024` — API-Football uses year the season started)
- Alternative: Premier League (league_id = 39) — also fine

---

## 2. API-Football Endpoint

```
GET https://v3.football.api-sports.io/fixtures
Headers: x-apisports-key: <API_FOOTBALL_KEY>
```

---

## 3. Required Params

| Param | Value | Notes |
|---|---|---|
| `league` | `140` | La Liga. Change for other leagues. |
| `season` | `2024` | Year season started. |
| `next` | `10` | **Use this first** — fetches only next 10 upcoming fixtures, saves quota. |
| `from` / `to` | optional | Use date range instead of `next` for historical or specific window. |
| `status` | optional | Filter by `NS` (not started), `FT` (finished), etc. |

**First test call:** `?league=140&season=2024&next=10`
Costs: **1 request**. Returns up to 10 upcoming fixtures.

---

## 4. Avoiding Wasted Requests

- **Manual sync only** in Phase 5C — no cron, no auto-trigger
- Use `next=10` for initial test (1 request)
- After each sync, store `synced_at` in `sync_log` table
- Skip re-sync if last sync was < 1 hour ago
- Never sync from browser — only admin-protected server route
- Do not sync historical seasons until needed

**Budget estimate for MVP:**
| Action | Requests |
|---|---|
| /status test | 1 |
| /fixtures next=10 (test) | 1 |
| /fixtures full sync (one league) | 1–2 |
| /fixtures results sync | 1–2 per day |
| Total daily typical | < 10 |

---

## 5. Mapping API-Football Fields → Supabase matches Table

| API-Football field | Supabase column | Notes |
|---|---|---|
| `fixture.id` | `external_api_id` (new) | Unique external ID for dedup |
| `league.id` | `league_id` | Store as text |
| `teams.home.name` | `home_team_name` | Already exists |
| `teams.home.id` | `home_team_id` | Store API team ID |
| `teams.away.name` | `away_team_name` | Already exists |
| `teams.away.id` | `away_team_id` | Store API team ID |
| `fixture.date` | `kickoff` | ISO8601 — convert to UTC |
| `fixture.status.short` | `status_short` (new) | `NS`, `FT`, `LIVE`, `PST`, etc. |
| `fixture.status.elapsed` | `elapsed` (new) | Live minute, null if not live |
| `goals.home` | `home_score` | Already exists |
| `goals.away` | `away_score` | Already exists |
| `league.round` | `matchday` | Already exists |
| `fixture.venue.name` | `venue` | Already exists |

---

## 6. Schema Changes Needed

Current `matches` table is mostly sufficient. Add these columns:

```sql
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS external_api_id  INTEGER UNIQUE,   -- API-Football fixture.id
  ADD COLUMN IF NOT EXISTS api_provider     TEXT DEFAULT 'api-football',
  ADD COLUMN IF NOT EXISTS status_short     TEXT,             -- NS | LIVE | FT | PST | ABD
  ADD COLUMN IF NOT EXISTS elapsed          INTEGER;          -- live minute, null otherwise
```

**Upsert key:** `external_api_id` (not the text `id` used by mock data).
Mock data matches (`pl-001`, `sa-001`, etc.) keep their existing `id`s — new real matches use `external_api_id` as dedup key and a generated UUID-based `id`.

---

## 7. Proposed API Route

```
POST /api/football/sync-fixtures
Body: { "league": 140, "season": 2024, "next": 10 }
```

Behavior:
1. Validate admin secret
2. Read params from body (league, season, next or from/to)
3. Call API-Football `/fixtures`
4. For each fixture: upsert into `matches` on `external_api_id`
5. Log to `sync_log` (sync_type: 'fixtures', league_id, records, status)
6. Return summary: `{ synced, inserted, updated, skipped }`

---

## 8. Admin Protection

**Reuse `SETTLEMENT_ADMIN_SECRET` for MVP** — no new env var needed.
Same header pattern: `x-admin-secret: <SETTLEMENT_ADMIN_SECRET>`

Add `FOOTBALL_SYNC_ADMIN_SECRET` only if different access levels are needed later.

---

## 9. Testing Steps

1. Run build to confirm route compiles
2. Call `POST /api/football/sync-fixtures` with `{ league: 140, season: 2024, next: 10 }`
3. Check response: `synced`, `inserted`, `updated` counts
4. Verify in Supabase Table Editor: `matches` table has new rows with `external_api_id` populated
5. Confirm `sync_log` has a new row
6. Check quota: call `/api/football/test` to see `usedToday` incremented
7. Do NOT run again within 1 hour (cache window)

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| API rate limit (100/day) | Use `next=10` first; cache; manual only in Phase 5C |
| Mismatched league IDs | Confirm league_id via API-Football `/leagues` endpoint before bulk sync |
| Timezone issues | All API-Football dates are ISO8601 UTC — store as-is in `TIMESTAMPTZ` |
| Duplicate matches | Upsert on `external_api_id`; mock matches unaffected (no `external_api_id`) |
| Mock match IDs vs real IDs | Coexist — mock matches have text IDs (`pl-001`), real matches have UUIDs + `external_api_id`. Predictions against mock IDs still work. |
| Missing home/away short names | Derive `short_name` from first word of team name as fallback |
| Postponed / cancelled matches | Store `status_short = PST/ABD`; never trigger settlement for these |
| Free plan coverage gaps | Verify league coverage first via `/leagues?id=140` — 1 request |
