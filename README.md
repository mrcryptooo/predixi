# PrediXI — Web3 Football Prediction Platform

> Predict. Earn. Compete.

Dark, crypto-native football prediction platform built as a **Base App-first Standard Web App**.  
Mobile-first, Base Account-ready, Builder Code-ready.

---

## Product Direction

PrediXI is a **Standard Web App + wallet experience**, not a Farcaster Mini App.

| Principle | Detail |
|---|---|
| **Platform target** | Base App in-app browser (mobile-first) + any web browser |
| **Wallet strategy** | Base Account as primary connector, injected wallet as fallback |
| **Attribution** | Builder Code via Base.dev registration |
| **App type** | Standard Web App — NOT a Farcaster Mini App |
| **SDK** | Does NOT use `@farcaster/frame-sdk` or any deprecated mini-app SDK |
| **Registration** | Base.dev → Settings → Builder Code (future) |

---

## Batch Status

| Batch | Scope | Status |
|---|---|---|
| **Batch 1** | Foundation — Next.js 16, TypeScript, Tailwind v3, design system, fonts | ✅ Complete |
| **Batch 2** | Mock data, Zustand store, base UI components | ✅ Complete |
| **Batch 3** | Navigation shell (Sidebar + BottomNav) + Home Dashboard (6 sections) | ✅ Complete |
| **Batch 4** | /matches page, league/status filters, prediction modal, Zustand local save | ✅ Complete |
| **Batch 5** | /leaderboard (podium + table) + /profile (stats, badges, history) | ✅ Complete |
| **Batch 6** | /world-cup page, stub pages for missing routes | 🔜 Next |
| Batch 6+ | Wallet, on-chain, Builder Code — see ROADMAP.md | ⏳ Planned |

See **[ROADMAP.md](./ROADMAP.md)** for the full phase-by-phase implementation plan.

---

## Stack

### Current (Batch 1–3)

| Layer | Package | Version |
|---|---|---|
| Framework | Next.js | 16.2.5 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 3.4.x |
| State | Zustand | 5.x |
| Animation | Framer Motion | 12.x |
| Icons | lucide-react | 1.x |
| Fonts | Inter + JetBrains Mono | next/font/google |
| Utils | clsx + tailwind-merge | 2.x |
| Dates | date-fns | 3.x |

### Planned — Phase 3 (wallet layer, not yet installed)

| Layer | Package | Notes |
|---|---|---|
| Wallet config | wagmi + viem | `ssr: true`, `cookieStorage` for Next.js hydration safety |
| Query | @tanstack/react-query | Required by wagmi |
| Base Account | @base-org/account | `baseAccount` connector as primary |
| Attribution | ox | `Attribution.toDataSuffix()` for Builder Code |

---

## Project Structure

```
src/
├── app/
│   ├── globals.css           # Design tokens, Tailwind directives
│   ├── layout.tsx            # Root layout with fonts
│   └── page.tsx              # Foundation screen (Batch 1)
├── components/
│   ├── ui/
│   │   ├── Badge.tsx         # Generic pill + MatchStatus/Rank/Rarity/XP/Streak badges
│   │   ├── Button.tsx        # 8 variants, 4 sizes, loading state
│   │   ├── Card.tsx          # 6 variants + CardHeader/Body/Footer/AccentBar
│   │   └── Skeleton.tsx      # Shimmer skeletons + pre-built layouts
│   ├── gamification/         # (Batch 3+)
│   ├── layout/               # (Batch 3+)
│   ├── leaderboard/          # (Batch 3+)
│   ├── matches/              # (Batch 3+)
│   ├── prediction/           # (Batch 3+)
│   ├── profile/              # (Batch 3+)
│   └── world-cup/            # (Batch 3+)
├── data/
│   ├── badges.ts             # 18 achievement badges with rarity/XP
│   ├── leaderboard.ts        # Top 10 + rank/colour/emoji helpers
│   ├── leagues.ts            # 7 leagues (PL, LL, BL, SA, L1, UCL, WC26)
│   ├── matches.ts            # 18 fixtures across 6 competitions
│   ├── users.ts              # 10 mock users
│   └── worldcup.ts           # 12 WC26 groups (A–L) × 4 teams = 48 teams + 21 fixtures (DEMO)
├── lib/
│   └── utils.ts              # cn() helper (clsx + tailwind-merge)
├── store/
│   └── usePredictionStore.ts # Zustand store — persisted, duplicate-safe
└── types/
    └── index.ts              # All domain types
```

### Planned additions (Phase 3+)

```
src/
├── app/
│   └── providers.tsx         # wagmi + react-query provider (Phase 3)
├── config/
│   └── wagmi.ts              # wagmi createConfig — ssr:true, cookieStorage,
│                             # baseAccount connector, injected fallback (Phase 3)
└── lib/
    └── attribution.ts        # dataSuffix via ox Attribution (Phase 3.5)
```

---

## Design Tokens

| Token | Hex | Usage |
|---|---|---|
| `bg` | `#07080F` | Page background |
| `surface` | `#0F1018` | Cards |
| `elevated` | `#161822` | Nested elements |
| `border` | `#1E2035` | All borders |
| `primary` | `#0052FF` | Base blue / primary |
| `cyan` | `#00C2FF` | Accent / earn |
| `purple` | `#7C3AED` | Accent / compete |
| `success` | `#22C55E` | Correct / positive |
| `danger` | `#EF4444` | Live / error |
| `warning` | `#F59E0B` | Caution / streak |

---

## Local Development

```bash
# Node.js is at:
# C:\tools\node-v20.18.3-win-x64\

# Start dev server:
C:\tools\node-v20.18.3-win-x64\npm.cmd run dev

# Production build:
C:\tools\node-v20.18.3-win-x64\npm.cmd run build
```

Open **http://localhost:3000**

---

## Supabase Database Foundation (Phase 4A)

PrediXI uses Supabase for persistent storage. Phase 4A prepares the foundation without replacing mock data.

- **Schema**: `supabase/schema.sql` — 6 tables, RLS enabled, indexes included
- **Client**: `src/lib/supabase/client.ts` — safe singleton, returns `null` if env vars absent
- **Types**: `src/lib/supabase/types.ts` — DB row types aligned with app domain model
- **Setup guide**: `supabase/README.md`
- **Mock data still powers the UI** — Supabase is not required to build or run
- No data migration, no wallet signatures, no transactions in this phase
- Next phase (4B) will wire prediction submission and profile creation to the DB

### Required env vars

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase `anon` public key |

Set in `.env.local` locally and in Vercel project settings for production.

---

## Base Builder Code Attribution

PrediXI implements [ERC-8021](https://eips.ethereum.org/EIPS/eip-8021) transaction attribution via the `ox` library.

### Setup

**Local development** — add to `.env.local`:
```
NEXT_PUBLIC_BASE_BUILDER_CODE=your_builder_code_here
```

**Production (Vercel)** — add the same variable in:
Vercel Dashboard → Project → Settings → Environment Variables

### How it works

- `src/config/attribution.ts` reads the env var and exposes two helpers:
  - `getBuilderCode()` — returns the raw code string or `undefined`
  - `getBuilderDataSuffix()` — returns the ERC-8021 hex data suffix or `undefined`
- The suffix is appended to transaction calldata at future call sites (Phase 4+)
- **Phase 3B sends no transactions** — attribution is prepared only
- If the env var is not set, both helpers return `undefined` safely and nothing breaks

### Future usage (Phase 4+)

```ts
import { getBuilderDataSuffix } from '@/config/attribution'

const dataSuffix = getBuilderDataSuffix()
// pass dataSuffix to useWriteContract / sendTransaction if defined
```

---

## Hard Constraints (enforced across all batches)

- No real APIs until explicitly unlocked
- No database until explicitly unlocked
- No wallet / blockchain / smart contracts until Phase 3
- No inline styles — Tailwind CSS classes only
- No Farcaster Mini App SDK — ever
- World Cup data is clearly marked DEMO / not official
