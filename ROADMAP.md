# PrediXI — Implementation Roadmap

> Base App-first Standard Web App · Predict. Earn. Compete.

---

## Platform Identity

PrediXI is a **Standard Web App** built to run natively inside the **Base App in-app browser**
and in any other web browser. It is **NOT a Farcaster Mini App** and does not use the
Farcaster Frame SDK or any deprecated mini-app assumption.

---

## Phase Overview

| Phase | Name | Status |
|---|---|---|
| **Batch 1** | Foundation | ✅ Done |
| **Batch 2** | Data & Components | ✅ Done |
| **Batch 3** | Pages & Routing | 🔜 Next |
| **Phase 3** | Base Account Wallet | ⏳ Planned |
| **Phase 3.5** | Builder Code Attribution | ⏳ Planned |
| **Phase 4** | On-chain Predictions | ⏳ Planned |
| **Phase 5** | Base App Notifications | ⏳ Planned |

---

## ✅ Batch 1 — Foundation

**Completed. No changes needed.**

- Next.js 16 App Router
- TypeScript strict mode
- Tailwind CSS v3 + PostCSS + autoprefixer
- Inter + JetBrains Mono via `next/font/google`
- Dark crypto-native design system (color tokens, gradient utilities)
- `src/lib/utils.ts` — `cn()` helper
- `src/types/index.ts` — base types
- All required folder structure

---

## ✅ Batch 2 — Data & Components

**Completed. No changes needed.**

- `src/data/leagues.ts` — 7 leagues
- `src/data/matches.ts` — 18 fixtures, 6 competitions, community % verified
- `src/data/users.ts` — 10 mock users
- `src/data/leaderboard.ts` — top-10 + rank helpers
- `src/data/badges.ts` — 18 achievement badges
- `src/data/worldcup.ts` — 12 groups A–L, 48 teams, 21 fixtures (DEMO only)
- `src/store/usePredictionStore.ts` — Zustand persist store, duplicate-safe
- `src/components/ui/` — Card, Button, Badge, Skeleton

---

## 🔜 Batch 3 — Pages & Routing

**Scope (not started):**

- `src/app/matches/page.tsx` — match list + live ticker
- `src/app/leaderboard/page.tsx` — ranked table with weekly/all-time toggle
- `src/app/profile/page.tsx` — user stats, badges, prediction history
- `src/app/world-cup/page.tsx` — group tables + knockout bracket (DEMO)
- `src/components/layout/` — Navbar, BottomNav, PageShell
- `src/components/matches/` — MatchCard, PredictionBar, LiveBadge
- `src/components/leaderboard/` — LeaderboardRow, RankPodium
- `src/components/profile/` — ProfileCard, StatGrid, BadgeGrid
- `src/components/world-cup/` — GroupTable, FixtureRow, KnockoutBracket

**Constraints:**
- Tailwind CSS only, no inline styles
- No real APIs, no database, no wallet code
- Mobile-first layout (Base App in-app browser)

---

## ⏳ Phase 3 — Base Account Wallet Connection

**Not started. Do not implement until explicitly instructed.**

### Packages to install

```bash
npm install wagmi viem @tanstack/react-query @base-org/account
```

### Files to create

**`src/config/wagmi.ts`**
```ts
import { createConfig, cookieStorage, createStorage } from "wagmi";
import { base } from "wagmi/chains";
import { baseAccount } from "@base-org/account";
import { injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    baseAccount(),   // primary: Base Account
    injected(),      // fallback: MetaMask / browser wallet
  ],
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,         // Next.js App Router hydration safety
});
```

**`src/app/providers.tsx`** — wrap wagmi + react-query providers (client component)

**`src/components/layout/ConnectButton.tsx`** — wallet connect UI using wagmi hooks

### Key decisions
- `cookieStorage` + `ssr: true` prevents hydration mismatch in Next.js App Router
- `baseAccount()` is the primary connector — optimised for Base App in-app browser
- `injected()` is the fallback for users on desktop browsers with MetaMask / Coinbase Wallet
- Chain: **Base mainnet** only (`import { base } from "wagmi/chains"`)
- No Farcaster SDK, no `@farcaster/frame-sdk`, no mini-app connectors

---

## ⏳ Phase 3.5 — Builder Code Attribution

**Not started. Do not implement until explicitly instructed.**

### Prerequisites
- PrediXI registered on **Base.dev**
- Builder Code obtained from: Base.dev → Settings → Builder Code
- Inside Base App, attribution may be auto-appended once the app is registered

### For users outside Base App

```bash
npm install ox
```

**`src/lib/attribution.ts`**
```ts
import { Attribution } from "ox";

// Builder Code comes from Base.dev → Settings → Builder Code
// Store in .env.local as NEXT_PUBLIC_BASE_BUILDER_CODE
const builderCode = process.env.NEXT_PUBLIC_BASE_BUILDER_CODE ?? "";

export const dataSuffix = builderCode
  ? Attribution.toDataSuffix({ codes: [builderCode] })
  : undefined;
```

**`src/config/wagmi.ts`** — add `dataSuffix` to `createConfig` so every transaction
sent through PrediXI carries Builder Code attribution automatically.

**`.env.local.example`** (to be created, not committed)
```
NEXT_PUBLIC_BASE_BUILDER_CODE=your_builder_code_from_base_dev
```

---

## ⏳ Phase 4 — On-chain Predictions

**Not started. Requires Phase 3 wallet layer.**

- Smart contract deployment on Base mainnet
- Prediction submission via wagmi `writeContract`
- Result settlement + XP distribution
- On-chain leaderboard or Merkle-based reward claims

---

## ⏳ Phase 5 — Base App Notifications

**Not started. Requires Base App registration.**

- Match kick-off reminders
- Prediction result notifications
- Streak alerts
- Delivered via Base App notification system (not Farcaster push)

---

## Architecture Notes

### Why Standard Web App, not Mini App?

- Mini App / Farcaster Frame SDKs are deprecated or not the right fit
- Standard Web Apps get full browser APIs, PWA support, and Base App compatibility
- Base App's in-app browser renders Standard Web Apps natively
- Avoids lock-in to any single social platform

### Why Base Account as primary connector?

- Base Account is the recommended wallet for apps in the Base App ecosystem
- Provides the best UX for mobile users inside the Base App in-app browser
- Seamlessly compatible with smart wallets and passkey auth

### Why cookieStorage + ssr: true?

- Next.js App Router renders on the server first
- Without `ssr: true`, wagmi hydration mismatches cause flicker or errors
- `cookieStorage` persists wallet state across SSR/CSR boundary safely

### Why Builder Code?

- Builder Code attributes user transactions to PrediXI on-chain
- Earns protocol rewards via Base's developer incentive programme
- Inside Base App: may be auto-appended after registration on Base.dev
- Outside Base App: must be added manually via `dataSuffix` in wagmi config
- Builder Code itself is NOT a secret — it is embedded in calldata

---

*Last updated: Batch 2 complete / Base App direction recorded.*
