# Badges Checkpoint

## What was done

1. **Badge cards redesigned** — `BadgeCard.tsx` rebuilt with rarity-aware premium styling: per-rarity card gradients, border colors, icon container glow, top-edge highlight, rarity pill, hover lift animation for earned badges, and a refined locked state (lock overlay badge on icon, opacity reduction — no heavy grayscale). `rarityConfig` added to `badges.ts` with structured per-element theming for common / rare / epic / legendary tiers.

2. **`supabase/seed-badges.sql` created** — safe idempotent seed using `ON CONFLICT (id) DO UPDATE`. Instructions to run included as comments at the top of the file.

3. **Badge count** — 19 badges across 6 categories: streak, accuracy, volume, league, special, worldcup.

4. **Build** — passed (Next.js 16.2.5, no TypeScript errors).

5. **Supabase seed** — run `supabase/seed-badges.sql` in Supabase SQL Editor to populate the `badges` table. Safe to re-run.

## Files changed

- `src/components/gamification/BadgeCard.tsx` — full redesign
- `src/data/badges.ts` — added `rarityConfig` export
- `supabase/seed-badges.sql` — new seed file (19 badges)

## Next recommended task

Connect leaderboard to real Supabase data — create `/api/leaderboard` reading from `profiles` ordered by XP descending, replace mock `leaderboard` array in `MiniLeaderboard` and the full leaderboard page.
