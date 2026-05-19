# Standings Integration Plan — PrediXI

## 1. Provider
football-data.org (primary, token already working).

---

## 2. Competitions
| Code | League |
|---|---|
| PL | Premier League |
| PD | La Liga |
| BL1 | Bundesliga |
| SA | Serie A |
| FL1 | Ligue 1 |

WC standings use group tables — handle separately when WC starts June 11.

---

## 3. Proposed Routes

### Live (no cache)
```
GET /api/football-data/standings?competition=PL
Auth: none required (read-only, public)
```
Fetches live from football-data.org and returns normalized standings.

### Admin sync (with Supabase cache)
```
POST /api/football-data/sync-standings
Auth: x-admin-secret
Body: { competition: "PL" }
```
Fetches and upserts into `league_standings` table.

---

## 4. Supabase Table: `league_standings`

| Column | Type | Notes |
|---|---|---|
| id | text PK | `{competition}-{season}-{position}` |
| competition | text | e.g. `PL` |
| season | text | e.g. `2025` |
| position | int | 1–20 |
| team_id | text | football-data.org team id |
| team_name | text | |
| team_short | text | 3-letter |
| played | int | |
| won | int | |
| draw | int | |
| lost | int | |
| goals_for | int | |
| goals_against | int | |
| goal_difference | int | |
| points | int | |
| form | text | e.g. `WWDLW` (if available) |
| synced_at | timestamptz | |

---

## 5. football-data.org Endpoint
```
GET /v4/competitions/{competition}/standings
```
Returns `standings[0].table[]` array with full team stats.

---

## 6. Rate-Limit Strategy
- Free tier: 10 requests/minute.
- Sync manually after matchdays only.
- Cache in Supabase; UI reads from cache, not live API.
- Skip re-sync if `synced_at` < 30 min ago.

---

## 7. UI Idea
- New `/standings` page with league selector tabs (PL, PD, BL1, SA, FL1).
- Table: position, team, P W D L GF GA GD Pts, form dots.
- Link from Matches page header or nav.

---

## 8. Testing Steps
1. Call `GET /api/football-data/standings?competition=PL` manually.
2. Verify response shape matches expected fields.
3. If caching: check `league_standings` rows in Supabase.
4. Confirm rate limit not exceeded (1 request per competition).
5. Render table in UI with PL data first.
