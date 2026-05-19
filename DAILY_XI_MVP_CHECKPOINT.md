# Daily XI MVP Checkpoint

## Status: Complete ✅

---

## Features Completed

### Home — Daily XI Section
- Cinematic Daily XI card added to home page
- Wallet gate: locked behind wallet connection
- Horizontal roulette carousel with 5 visible cards
- Center card is the selector — glowing neon ring indicator
- Spin button picks a random eligible player per position

### Roulette Logic
- Horizontal animation (x-axis slide) — not vertical
- Center player always matches the saved player (race condition fixed)
- `buildStablePool` guarantees `finalPlayer` lands at center after exactly `SPIN_TICKS` increments
- `justPicked` guard prevents `rebuildDisplay` from overwriting center display after spin
- `spinRunId` increments each spin — forces Framer Motion key remount so animation always fires
- `intervalRef.current = null` after clear — prevents double-interval bugs
- `setTimeout(32ms)` delay before interval starts — ensures React paints first frame

### Formation & Positions
- 11 slots in fixed formation order: GK · RB · CB · CB · LB · RM · CM · CM · LM · ST · ST
- Each spin picks only players matching the current required position
- No duplicate players — already-selected IDs excluded from pool per spin
- Pool sizes: GK×3, RB×3, CB×6, LB×3, RM×4, CM×6, LM×4, ST×6 (35 total)

### Player Avatars
- 6 avatar SVGs added: `/public/brand/players/avatar-1.svg` through `avatar-6.svg`
- Players cycle through avatars by index
- Fallback: initial letter on gradient background if image fails

### LocalStorage Persistence
- Daily key format: `predixi-daily-xi-YYYY-MM-DD`
- XI saves automatically after each spin
- Persists across page refreshes
- Clears on reset
- Helpers: `loadTodayXI`, `saveTodayXI`, `clearTodayXI` in `src/lib/daily-xi.ts`

### Final XI Football Pitch
- Shown after all 11 players are selected
- Dark green pitch with grass stripe texture (repeating CSS gradient)
- SVG field lines: boundary, halfway line, center circle/spot, penalty areas, 6-yard boxes, penalty spots, penalty arcs, corner arcs
- Blue neon glow overlay matching PrediXI branding
- Players absolutely positioned — staggered realistic formation:
  - GK: deep center
  - RB/LB: wide, slightly higher than CBs
  - CBs: center, deepest in back four
  - RM/LM: wide, slightly higher than CMs
  - CMs: central, slightly deeper
  - STs: highest, offset center-left / center-right
- Per-player entrance animation with staggered delay
- Glow halo behind each player avatar
- "Today's XI Locked" status pill
- Reset XI button

### Profile — My Daily XI
- Section added to `/profile` between Stats and Recent Predictions
- Loads today's XI from localStorage on mount
- Complete XI: horizontal scrollable strip of 11 circular avatars with position labels
- Partial XI: compact slot grid with progress bar showing remaining positions
- Empty: "Pick today's XI from Home" prompt

### Scoring UI Groundwork
- MVP score panel shown below the final pitch
- Star icon, "Daily XI Score" label
- Current: **0 XP** (not awarded yet)
- Projected max: **20 XP**
- Empty score bar (visual only)
- "Pending · Scored after matches play" badge
- Profile strip shows "Score: 0 XP · Max 20 XP · Scored after matches"

---

## Not Yet Implemented

- Base / on-chain transaction (shown as "coming soon")
- Supabase writes for Daily XI
- Real player performance scoring
- XP awarded to profile
- Match-day scoring engine
- Daily XI profile card full pitch view (deferred)

---

## Files

| File | Status |
|------|--------|
| `src/lib/daily-xi.ts` | Created — types, player pool, localStorage helpers |
| `src/components/home/DailyHeroes.tsx` | Created — roulette, slot strip, wallet gate |
| `src/components/home/DailyXIPitch.tsx` | Created — pitch layout, scoring panel |
| `src/components/profile/DailyXIProfileCard.tsx` | Created — player strip, progress, empty state |
| `src/app/profile/page.tsx` | Updated — My Daily XI section added |
| `src/app/page.tsx` | Updated — DailyHeroes wired in |
| `public/brand/players/avatar-1.svg` through `avatar-6.svg` | Created |

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
- Next feature phase (on-chain submission, match scoring, leaderboard integration)
