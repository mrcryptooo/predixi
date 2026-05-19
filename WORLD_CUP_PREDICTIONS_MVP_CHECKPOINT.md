# World Cup Predictions MVP Checkpoint

## Status: Complete ✅

---

## Features Completed

### 21 Interactive Prediction Cards

All cards are fully interactive — no "Coming later" buttons remain.

**Tournament Picks (5)**
- 🏆 Tournament Champion — pick 1 from all 48 nations · 200 XP
- 🥈 Finalist Pick — pick 2 from all 48 nations · 120 XP
- ⚽ Golden Boot — pick 1 from 20 top strikers · 100 XP
- 🧤 Golden Glove — pick 1 from 12 goalkeepers · 80 XP
- 🌟 Dark Horse — pick 1 underdog nation · 150 XP

**Group Winners A–L (12)**
- One card per group, each showing its 4 teams
- Group A · B · C · D · E · F · G · H · I · J · K · L
- 40 XP per correct group winner
- Deadline: Jun 20, 2026

**Fun Picks (4)**
- 🎯 Most Goals Team — all 48 nations · 60 XP
- ⭐ Best Young Player — 12 eligible players · 80 XP
- 💥 Surprise Team — underdog nations · 120 XP
- 🟥 First Red Card Nation — all 48 nations · 30 XP

---

### Prediction Modal / Bottom Sheet

- Fixed bottom sheet slides up on "Predict" click
- Drag handle + close button
- Scrollable options grid (1-col for ≤8 options, 2-col for larger pools)
- Scoring hint: "0 XP now · +N XP projected · Scored after tournament stages"
- Current saved pick shown with visual
- Pending selected pick shown as chip with avatar
- "Lock In" confirm button — saves to localStorage
- "Edit" button to reopen and change pick
- Tap backdrop to dismiss

---

### LocalStorage Persistence

- Key: `predixi-wc-predictions`
- Format: `Record<predictionId, { predictionId, selection[], savedAt }>`
- Helpers: `saveWCPrediction`, `loadAllWCPredictions`, `clearWCPrediction`, `clearAllWCPredictions`
- File: `src/lib/worldcup-predictions.ts`
- All 21 predictions persist across page refreshes
- No Supabase, no blockchain

---

### Visual Identity — Country Options

- All 48 WC nations have circular flag images
- Source: `flagcdn.com` SVGs (reliable CDN, free)
- `FLAG_SRC` map covers all nations in all 12 groups
- Chain: flagcdn image → emoji flag fallback → neutral football placeholder
- No text initials used anywhere

### Visual Identity — Player Options

- All player options (Golden Boot, Golden Glove, Best Young Player) have circular avatars
- Local assets: `/brand/players/avatar-1.svg` through `avatar-6.svg`
- Deterministic mapping via `addAvatars()` helper — index % 6
- No broken external URLs
- Emoji flag as fallback if local asset fails

### Selected State Visuals

- Full prediction card: shows `OptionAvatar` (sm) + player/nation name per saved pick
- Compact group card: shows avatar + name in saved state
- Modal footer: "current pick" row with avatar + name; pending chip with avatar + name
- Green checkmark on confirmed picks
- Glowing neon border on selected card

---

### Profile Integration

- "World Cup Picks" section added to `/profile` page
- Between My Daily XI and Recent Predictions
- Shows `X/21` locked in with animated progress bar
- "Make Picks →" / "View →" link to `/world-cup`
- Loads from localStorage on mount — no API calls

---

### Scoring Placeholder UI

- Each card shows: `+N XP if correct`
- Modal hint: `0 XP now · +N XP projected · Scored after tournament stages`
- No XP awarded yet
- No profile writes
- No database changes

---

## Not Yet Implemented

- Supabase writes for WC predictions
- On-chain transaction / Base submission
- Real scoring engine after match results
- XP awarded to profile
- Prediction deadline enforcement (lock-out after Jun 11 / Jun 20)
- Admin settlement panel for WC results

---

## Files

| File | Status |
|------|--------|
| `src/lib/worldcup-predictions.ts` | Created — localStorage helpers |
| `src/components/world-cup/WorldCupPredictionCard.tsx` | Rewritten — interactive, modal, visuals |
| `src/app/world-cup/page.tsx` | Restructured — 3 sections, 21 predictions, flag sources |
| `src/app/profile/page.tsx` | Updated — WC picks summary added |

---

## Build

```
✓ Compiled successfully
✓ TypeScript passed
✓ 18/18 static pages generated
✓ 0 errors · 0 warnings
```

---

## Ready For

- Production deploy
- Supabase persistence phase
- On-chain submission via Base
- Tournament scoring engine (post Jun 11)
- Result settlement and XP distribution
