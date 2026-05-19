# XP Economy V2 Plan

## Status: Design Only — No Code Changes

---

## 1. Core Principles

- **Low inflation** — XP should feel earned, not handed out
- **No huge numbers** — avoid thousands; hundreds are the ceiling for legendary actions
- **Scarcity creates value** — most daily actions give small XP; big tournament picks give meaningful but not crazy rewards
- **Settlement is source of truth** — no XP awarded until the result is confirmed
- **No farming** — one prediction per match, one Daily XI per day, WC picks locked before deadline
- **Consistent scale** — a correct match pick (10 XP) is the baseline unit; everything else is calibrated relative to it

---

## 2. Match Prediction Scoring

| Outcome | XP |
|---|---|
| Correct pick | +10 XP |
| Wrong pick | 0 XP |
| No pick | 0 XP |

- Settlement route is the only source of XP for match predictions
- Streak bonus can be added later (e.g. +2 XP per 5-match correct streak) — not in V2
- Source of truth: `settle-match` API → `correctPredictions` + `xp` on profile row

---

## 3. Daily XI Scoring

| Action | XP |
|---|---|
| Daily XI entry | 0 XP (no entry bonus) |
| Goal by picked player | +3 XP |
| Assist by picked player | +2 XP |
| Clean sheet (GK or CB) | +2 XP |
| Player match rating 7.0–7.9 | +1 XP |
| Player match rating 8.0+ | +2 XP |
| **Daily XI cap** | **20 XP max** |

- Scoring runs after all 11 picked players have played their matches for the day
- Cap at 20 XP prevents inflation from stacked performer days
- Engine not built yet — UI shows "0 XP now · max 20 XP · Scored after matches"
- Data source for player ratings TBD (API-Football or manual admin entry)

---

## 4. World Cup Predictions

| Prediction | XP if Correct |
|---|---|
| Tournament Champion | 200 XP |
| Finalist Pick (both correct) | 120 XP |
| Finalist Pick (one correct) | 40 XP |
| Golden Boot | 100 XP |
| Golden Glove | 80 XP |
| Dark Horse (SF reach) | 150 XP |
| Group Winner (×12) | 40 XP each |
| Most Goals Team | 60 XP |
| Best Young Player | 80 XP |
| Surprise Team (QF reach) | 120 XP |
| First Red Card Nation | 30 XP |

- **Total max WC XP:** 200 + 120 + 100 + 80 + 150 + (12×40) + 60 + 80 + 120 + 30 = **1,420 XP**
- This is a ceiling — tournament champion + all group winners correct is extremely unlikely
- Realistic top performer: 400–600 XP across the full tournament
- All picks lock before Jun 11, 2026 (group winners before Jun 20)

---

## 5. Badge XP Ranges

| Tier | XP Range | Examples |
|---|---|---|
| Common | 10–30 XP | First prediction, first login week |
| Rare | 40–80 XP | 10-match streak, 70% accuracy over 20 games |
| Epic | 100–200 XP | Perfect group stage, 30-match streak |
| Legendary | 250–500 XP | Tournament champion correct, 90%+ accuracy over 50 games |

- Review any existing badge values above 500 XP — reduce to legendary cap
- Badges are one-time awards — cannot be farmed
- Badge system not yet enforced in backend (UI only in current phase)

---

## 6. Leaderboard

### Current (V1)
- Ranked by total XP descending
- Tie-breaker: not defined

### V2 Design
- **Primary sort:** total XP
- **Tie-breaker 1:** accuracy % (correct / total predictions)
- **Tie-breaker 2:** total correct predictions
- **Tie-breaker 3:** total predictions placed (more activity wins tie)

### Future Seasons
- Weekly XP (reset every Monday)
- Season XP (reset per tournament phase)
- All-time XP (never resets)
- Leaderboard tabs: Weekly · Season · All-Time

---

## 7. Anti-Farming Rules

| Rule | Enforcement |
|---|---|
| One prediction per match per wallet | DB unique constraint on (walletAddress, matchId) |
| One Daily XI per wallet per day | localStorage key `predixi-daily-xi-YYYY-MM-DD` (MVP); DB unique on (walletAddress, date) later |
| WC picks lock at deadline | Frontend deadline check; backend enforces on write |
| No XP until settlement | XP only written by settlement worker, never on prediction creation |
| No self-referral XP | Not applicable in current design |

---

## 8. Database Plan

### Current State (MVP)
- Match predictions + XP: Supabase `predictions` + `profiles` tables ✅
- Daily XI: localStorage only
- WC predictions: localStorage only
- Badges: UI only

### V2 Tables (to be created)

```sql
-- XP event ledger — immutable audit trail
CREATE TABLE xp_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  source        text NOT NULL,  -- 'match_prediction' | 'daily_xi' | 'wc_prediction' | 'badge'
  source_id     text,           -- matchId / date / predictionId / badgeId
  xp_delta      int NOT NULL,
  reason        text,
  created_at    timestamptz DEFAULT now()
);

-- Daily XI entries
CREATE TABLE daily_xi_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  date          date NOT NULL,
  slots         jsonb NOT NULL,  -- array of 11 DailyXIPlayer | null
  xp_awarded    int DEFAULT 0,
  settled_at    timestamptz,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (wallet_address, date)
);

-- World Cup prediction entries
CREATE TABLE wc_predictions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  prediction_id  text NOT NULL,  -- 'wc-champion', 'wc-group-a', etc.
  selection      text[] NOT NULL,
  xp_awarded     int DEFAULT 0,
  is_correct     boolean,
  settled_at     timestamptz,
  created_at     timestamptz DEFAULT now(),
  UNIQUE (wallet_address, prediction_id)
);
```

---

## 9. Implementation Phases

### Phase A — XP Events Ledger
- Create `xp_events` table
- Refactor `settle-match` to write to ledger
- Profile XP derived from sum of ledger (or keep cached on profile row)
- No change to frontend

### Phase B — WC Predictions → Supabase
- Create `wc_predictions` table
- Add `/api/wc-predictions` POST endpoint
- Update WC prediction modal to write to DB (requires wallet connection)
- Keep localStorage as optimistic cache
- Deadline enforcement on write

### Phase C — Daily XI → Supabase
- Create `daily_xi_entries` table
- Add `/api/daily-xi` POST endpoint
- Require wallet connection to submit (gate already exists)
- localStorage remains local preview; DB is source of truth

### Phase D — Settlement Workers
- Daily XI scoring worker (runs after match day ends)
- WC prediction settlement (runs after each tournament stage)
- Both write to `xp_events` + update `daily_xi_entries` / `wc_predictions`

### Phase E — Season Leaderboard
- Add `season` column to `xp_events`
- Weekly + season aggregation views
- Leaderboard tabs: Weekly · Season · All-Time

---

## Summary: XP at a Glance

| System | Per Action | Max Realistic | Notes |
|---|---|---|---|
| Match predictions | +10 XP | Unlimited (one per match) | Settlement only |
| Daily XI | 0–20 XP/day | 20 XP/day | Capped |
| WC Tournament picks | 30–200 XP | ~400–600 XP | One-time, locked |
| Badges | 10–500 XP | ~500 XP each | One-time |

**Philosophy:** A dedicated predictor playing daily + all WC picks over 6 months could accumulate ~2,000–3,000 XP total. That's the upper end of a healthy pre-launch season.
