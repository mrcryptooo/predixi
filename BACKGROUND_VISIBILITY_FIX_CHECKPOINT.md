# Background Visibility Fix Checkpoint

## Status: Complete ✅

## Root Causes Identified
- Page-level backgrounds (`profile-bg`, `worldcup-hero`) were at opacity 0.07 — essentially invisible
- WC predictions section overlay `from-bg/80 to-bg/70` was nearly opaque, completely hiding the image beneath
- Profile and World Cup page overlays were too dark (`from-bg/60 to-bg/80`), neutralising the background
- `glass-nav` CSS (`background: rgba(6,8,16,0.88)`) combined with nav image at opacity 0.10 made nav background imperceptible
- All card-level backgrounds too low (0.12–0.14) to show through existing gradients

## All 10 Background Assets Confirmed Referenced

| Asset | Section | File |
|---|---|---|
| `home-main-hero.webp` | Home hero card | `src/app/page.tsx` |
| `daily-xi-bg.webp` | Daily XI Heroes card | `src/components/home/DailyHeroes.tsx` |
| `matches-hero.webp` | Matches page hero card | `src/app/matches/page.tsx` |
| `worldcup-hero.webp` | World Cup page background | `src/app/world-cup/page.tsx` |
| `wc-predictions-bg.webp` | WC Tournament Picks section | `src/app/world-cup/page.tsx` |
| `leaderboard-bg.webp` | Leaderboard hero card | `src/app/leaderboard/page.tsx` |
| `profile-bg.webp` | Profile page background | `src/app/profile/page.tsx` |
| `wallet-connect-bg.webp` | Profile NotConnected card | `src/app/profile/page.tsx` |
| `live-match-card-bg.webp` | MatchCard when live | `src/components/matches/MatchCard.tsx` |
| `mobile-nav-bg.webp` | Mobile bottom navigation | `src/components/layout/BottomNav.tsx` |

## Opacity Changes Applied

| Asset | Before | After |
|---|---|---|
| `home-main-hero.webp` | 0.14 | 0.22 |
| `daily-xi-bg.webp` | 0.12 | 0.18 |
| `matches-hero.webp` | 0.14 | 0.22 |
| `worldcup-hero.webp` | 0.07 | 0.20 |
| `wc-predictions-bg.webp` | 0.09 | 0.16 |
| `leaderboard-bg.webp` | 0.14 | 0.22 |
| `profile-bg.webp` | 0.07 | 0.20 |
| `wallet-connect-bg.webp` | 0.11 | 0.18 |
| `live-match-card-bg.webp` | 0.13 | 0.22 |
| `mobile-nav-bg.webp` | 0.10 | 0.22 |

## Overlay Fixes
- WC predictions: `from-bg/80 to-bg/70` → `from-bg/35 to-bg/25`
- World Cup page: `from-bg/60 via-transparent to-bg/80` → `from-bg/50 via-transparent to-bg/70`
- Profile page: `from-bg/60 via-transparent to-bg/80` → `from-bg/40 via-transparent to-bg/60`

## Mobile Positioning Improvements

| Asset | Mobile | Desktop |
|---|---|---|
| `matches-hero.webp` | `object-top` | `object-center` |
| `worldcup-hero.webp` | `object-top` | `object-center` |
| `leaderboard-bg.webp` | `object-top` | `object-center` |
| `profile-bg.webp` | `object-top` | `object-center` |
| `mobile-nav-bg.webp` | `object-bottom` | `object-bottom` |
| All others | `object-center` | `object-center` |

## Changed Files
- `src/app/page.tsx`
- `src/components/home/DailyHeroes.tsx`
- `src/app/matches/page.tsx`
- `src/app/leaderboard/page.tsx`
- `src/app/world-cup/page.tsx`
- `src/app/profile/page.tsx`
- `src/components/matches/MatchCard.tsx`
- `src/components/layout/BottomNav.tsx`

## Build
- Build passed clean ✅
- All 18 pages generated without errors
- No TypeScript errors

## Ready for Production Deploy ✅
