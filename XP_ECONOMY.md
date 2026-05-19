# PrediXI XP Economy

## Principles

- XP stays small and valuable. Base reward is **10 XP** per correct prediction.
- Wrong predictions earn **0 XP**.
- No inflation: bonuses are additive flat values, capped per prediction.
- Easy to implement in a single settlement function.

---

## Phase 1 Formula (Simple — implement this first)

```
Correct prediction  → 10 XP base
Big match bonus     → +5 XP  (derby, UCL, World Cup)
Underdog bonus      → +5 XP  (pick was low-probability / against community consensus)
Wrong prediction    → 0 XP

Max XP per prediction = 20 XP
```

### How bonuses are determined

| Condition                                    | Bonus |
|----------------------------------------------|-------|
| Normal league match                          | +0    |
| Derby / rivalry match (flagged on match)     | +5    |
| UCL / major tournament match                 | +5    |
| World Cup match                              | +5    |
| Community pick < 40% for chosen outcome      | +5 underdog |
| Community pick ≥ 40% for chosen outcome      | +0    |

> Bonuses stack but cap at 20 XP total.

### Examples

| Scenario                                          | XP |
|---------------------------------------------------|----|
| Correct, normal match, popular pick               | 10 |
| Correct, normal match, underdog pick              | 15 |
| Correct, UCL match, popular pick                  | 15 |
| Correct, UCL match, underdog pick                 | 20 |
| Correct, World Cup Final, underdog pick           | 20 |
| Wrong prediction (any)                            |  0 |

---

## Phase 2 Formula (Optional future — multiplier-based)

```
Final XP = min(25, round(10 × MatchMultiplier × DifficultyMultiplier))
```

### Match multipliers

| Match type                   | Multiplier |
|------------------------------|-----------|
| Normal league                | 1.0×      |
| Derby / big match            | 1.2×      |
| Champions League             | 1.3×      |
| World Cup group stage        | 1.3×      |
| World Cup knockout           | 1.5×      |
| Final / special event        | 2.0×      |

### Difficulty multipliers (based on community consensus %)

| Community pick % for chosen outcome | Multiplier |
|-------------------------------------|-----------|
| ≥ 60% (popular pick)               | 1.0×      |
| 40–59% (medium pick)               | 1.2×      |
| < 40% (underdog pick)              | 1.5×      |

### Examples

| Scenario                                     | Calculation            | XP |
|----------------------------------------------|------------------------|----|
| Normal match, popular pick                   | 10 × 1.0 × 1.0        | 10 |
| Normal match, underdog pick                  | 10 × 1.0 × 1.5        | 15 |
| UCL match, medium pick                       | 10 × 1.3 × 1.2        | 16 |
| World Cup final, underdog pick               | 10 × 2.0 × 1.5 = 30 → cap | 25 |
| Derby, popular pick                          | 10 × 1.2 × 1.0        | 12 |

---

## Badge XP Rewards (revised — lower values)

| Rarity    | XP Reward |
|-----------|-----------|
| Common    | 20        |
| Rare      | 50        |
| Epic      | 100       |
| Legendary | 200       |

> Update `src/data/badges.ts` `xpReward` fields and re-run `supabase/seed-badges.sql` when implementing.

---

## Settlement Implementation Notes

When a match result is known:

1. For each prediction on that match:
   - Compute `is_correct = (predicted_outcome === actual_outcome)`
   - If correct: compute `points_awarded` using Phase 1 formula
   - If wrong: `points_awarded = 0`
2. Update `predictions` row: `is_correct`, `points_awarded`
3. Update `profiles` row:
   - `xp += points_awarded`
   - `total_predictions += 1`
   - `correct_predictions += 1` (if correct)
   - `streak = streak + 1` (if correct) or `0` (if wrong)
   - Recompute `rank` based on XP thresholds (see below)

### Rank thresholds (suggested)

| Rank     | Min XP |
|----------|--------|
| bronze   | 0      |
| silver   | 100    |
| gold     | 300    |
| platinum | 600    |
| diamond  | 1000   |
| legend   | 2000   |

---

## Files to update when implementing

- `src/app/api/predictions/route.ts` — settlement trigger or separate route
- `supabase/schema.sql` — add `match_result` column or settlement trigger
- `supabase/seed-badges.sql` — update xp_reward values
- `src/data/badges.ts` — update xpReward values to match table above
