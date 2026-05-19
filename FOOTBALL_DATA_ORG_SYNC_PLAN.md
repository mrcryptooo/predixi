# football-data.org Sync Plan — PrediXI

## 1. Provider Strategy

| Provider | Role |
|---|---|
| **football-data.org** | **Primary** — current fixtures, results, standings for top 5 leagues + World Cup |
| API-Football | Secondary — advanced stats, players, squads (later phase) |

Reason: API-Football free tier blocks 2025/26 season. football-data.org returns live 2025/26 data confirmed working.

---

## 2. Token

```
FOOTBALL_DATA_TOKEN  — server-only, no NEXT_PUBLIC_ prefix
Header: X-Auth-Token: <token>
Base URL: https://api.football-data.org/v4
```

---

## 3. Initial Sync Scope (MVP)

- **Competition:** Premier League (`PL`)
- **Date range:** May 13–19 2026 (or `next=10` if API supports it)
- **Endpoint:** `GET /v4/competitions/PL/matches?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD`
- **Cost:** 1 request

---

## 4. Future Competitions

| Code | Name | Status |
|---|---|---|
| PL | Premier League | Ends May 24 |
| PD | La Liga (Primera Division) | Ends May 24 |
| BL1 | Bundesliga | Ends May 16 |
| SA | Serie A | Ends May 24 |
| FL1 | Ligue 1 | Ends May 16 |
| WC | FIFA World Cup 2026 | Starts June 11 |

---

## 5. Proposed Route

```
POST /api/football-data/sync-matches
Body: { competition: "PL", dateFrom: "YYYY-MM-DD", dateTo: "YYYY-MM-DD" }
Defaults: competition=PL, dateFrom=today, dateTo=today+7
```

---

## 6. Admin Protection

- Header: `x-admin-secret`
- Compare with `SETTLEMENT_ADMIN_SECRET` env var
- Return 401 if invalid, 500 if env var missing

---

## 7. Supabase Mapping (existing matches table)

| football-data.org field | matches column | Notes |
|---|---|---|
| `id` | `external_api_id` (future) | Store for dedup |
| competition code | `league_id` | e.g. `"PL"` |
| `homeTeam.name` | `home_team_name` | |
| `homeTeam.shortName` | `home_team_short` | Already provided |
| `homeTeam.id` | `home_team_id` | As string |
| `awayTeam.name` | `away_team_name` | |
| `awayTeam.shortName` | `away_team_short` | Already provided |
| `awayTeam.id` | `away_team_id` | As string |
| `utcDate` | `kickoff` | ISO8601 UTC |
| `status` | `status` | Map below |
| `score.fullTime.home` | `home_score` | |
| `score.fullTime.away` | `away_score` | |
| `matchday` | `matchday` | |
| `venue` | `venue` | |

**Match ID:** `"fdorg-{match.id}"` — avoids collision with mock (`pl-001`) and apf- IDs.

**Status mapping:**

| football-data.org | matches.status |
|---|---|
| TIMED, SCHEDULED | upcoming |
| IN_PLAY, PAUSED, HALFTIME | live |
| FINISHED | finished |
| POSTPONED, SUSPENDED, CANCELLED | postponed |

**actual_outcome:** set only if FINISHED and `score.fullTime.home` is not null.

---

## 8. No Automatic Settlement

- Route only syncs match data
- Does NOT call `/api/settle-match`
- Admin manually triggers settlement after verifying results

---

## 9. Rate Limit / Cache Strategy

football-data.org free tier: **10 requests/minute**, no daily cap stated.

| Action | Frequency |
|---|---|
| Fixtures sync (1 competition, 1 week) | Manual only for now |
| Results check (finished matches) | Manual after match day |
| Full season sync | Once per competition, then incremental |

- Store `synced_at` per competition in `sync_log` (if table exists)
- Skip re-sync if last sync < 30 min ago

---

## 10. Testing Steps

1. Run build after route is created — confirm `/api/football-data/sync-matches` compiles
2. POST with `{ competition: "PL", dateFrom: "2026-05-13", dateTo: "2026-05-19" }`
3. Check response: `fetched`, `inserted`, `updated` counts
4. Verify in Supabase: `matches` table has rows with `id` like `fdorg-*`
5. Confirm no predictions or profiles were modified
6. Check quota: confirm only 1 request used
