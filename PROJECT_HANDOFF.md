# PROJECT HANDOFF
# PrediXI — Web3 Football Prediction Platform
# Full handoff package for new assistant (ChatGPT or Claude)
# Created: May 12, 2026
# Source of truth: the actual codebase

---

## 1. Project Overview

### What is this app?

**PrediXI** is a football prediction platform built on the **Base blockchain** (Coinbase's Layer 2 network).

Users connect their crypto wallet, predict the outcome of football matches (Home Win / Draw / Away Win), and earn XP (experience points) and badges for correct predictions. The long-term goal is for predictions to be recorded on-chain — meaning they become permanent, verifiable proof of the user's prediction skills.

### What problem does it solve?

Traditional football prediction apps (like bet365 or fantasy leagues) are centralized — a company controls all the data and results. PrediXI aims to make predictions transparent and verifiable on the blockchain. In the future, every correct prediction can be mathematically proven to have been made before the match result.

### Who are the target users?

- Football fans who want to test their prediction skills
- Crypto users who are interested in apps built on the Base network
- Competitive users who enjoy leaderboards and badge systems

### Main user flow

1. User opens the app (works inside the Base App browser or any regular browser)
2. User sees upcoming football matches
3. User connects their Base wallet (like a crypto ID card)
4. User picks: Home Win, Draw, or Away Win for a match
5. Pick is saved locally and also sent to the Supabase database (if wallet connected)
6. User earns XP for correct predictions
7. User climbs the global leaderboard

### Business logic

- Predictions are saved locally first (always works, even without internet)
- If wallet is connected, predictions are also saved to Supabase database
- XP points are earned for correct predictions
- Rare leagues and live matches give bonus XP multipliers
- In the future: predictions will be recorded on the Base blockchain as permanent proof

### MVP Goal

The current MVP is a **working demo** that:
1. Shows real football match cards with community prediction percentages
2. Lets users pick outcomes and save them
3. Connects to real crypto wallets (Base Account, MetaMask)
4. Saves predictions to Supabase database
5. Shows leaderboards and profile stats (currently using mock/demo data)

The next phases will: connect profile/leaderboard to real database data, add real match data from a football API, and eventually record predictions on-chain.

---

## 2. Current Technical Stack

### Frontend Framework
- **Next.js 16.2.5** with App Router
- Where: `next.config.ts`, `src/app/` folder
- Status: Fully configured and working

### Main Programming Language
- **TypeScript 5** (strict mode)
- Where: All `.ts` and `.tsx` files
- Status: Fully configured

### Styling System
- **Tailwind CSS 3** + PostCSS + Autoprefixer
- Where: `tailwind.config.ts`, `src/app/globals.css`
- Custom design tokens: dark navy/blue color palette (primary blue `#1652F0`)
- Custom utilities: glass cards, gradient text, glow effects
- Status: Fully configured with a complete custom design system

### UI Animations
- **Framer Motion 12**
- Where: Used in most page components and cards
- Status: Complete, used throughout

### State Management
- **Zustand 5** with localStorage persistence
- Where: `src/store/usePredictionStore.ts`
- Used for: Storing user predictions, syncing with Supabase
- Status: Complete and working

### Database / Storage
- **Supabase** (PostgreSQL hosted on supabase.com)
- Schema: `supabase/schema.sql`
- Server client: `src/lib/supabase/server.ts` (uses service role key)
- Client factory: `src/lib/supabase/client.ts` (uses anon key — currently unused)
- Tables: profiles, matches, predictions, leaderboard_stats, badges, user_badges
- Status: Schema is ready. API route working IF env vars are set. Env vars must be configured in `.env.local` and Vercel.

### Wallet / Auth System
- **Wagmi 3 + Viem 2** (wallet connection library)
- **@base-org/account** (Base Account wallet connector)
- Where: `src/config/wagmi.ts`, `src/app/providers.tsx`, `src/components/wallet/ConnectWallet.tsx`
- Supported wallets: Base Account (primary), MetaMask/injected (fallback)
- Network: Base Mainnet only
- Status: Complete. Wallet connect/disconnect UI working. No Supabase Auth — wallet address is the user identity.

### Package Manager
- **npm** (package-lock.json exists)

### Blockchain / Base Integration
- **Chain: Base Mainnet** (not testnet)
- Builder Code attribution: `src/config/attribution.ts` — ERC-8021 standard, prepared but no transactions sent yet
- Where attribution is used: Nowhere yet — it's ready but waiting for on-chain predictions phase
- Status: Prepared, not yet active

### Smart Contracts
- **None yet**. No smart contracts deployed.
- Smart contracts are planned for Phase 4 (on-chain predictions)

### APIs / Integrations
- `/api/predictions` (POST + GET) — internal Next.js API route connecting to Supabase
- No external football API integrated yet — all match data is hardcoded mock data
- Status: Internal API working; external football API is a future task

### Deployment
- **Vercel** — project connected (`.vercel/project.json` exists)
- Project ID: `prj_EupPieDeAxpC7gIye4pFE5zUiVON`
- Status: Deployment config present. Env vars must also be set in Vercel dashboard.

### Testing Tools
- **None** — no tests exist. ESLint is configured (`eslint.config.mjs`).

---

## 3. App Architecture

### Frontend Structure

The app uses Next.js App Router with a `src/` directory layout:

```
src/
  app/           ← Pages (routes)
  components/    ← Reusable UI pieces
  config/        ← Wagmi and attribution config
  data/          ← All mock/demo data (hardcoded)
  lib/           ← Utilities and Supabase clients
  store/         ← Zustand global state
  types/         ← TypeScript type definitions
```

The layout wraps all pages with a `PageWrapper` that shows:
- **Desktop**: Fixed left sidebar (220px) with navigation + wallet button
- **Mobile**: Fixed top header + fixed bottom navigation bar

### Backend / API Structure

One API route:
- `POST /api/predictions` — accepts a wallet address + match ID + outcome → saves to Supabase
- `GET /api/predictions?walletAddress=0x...` — returns all predictions for a wallet

The API uses the Supabase **service role key** (server-only secret). It never exposes this key to the browser.

### Data Flow

```
User picks outcome
      ↓
Zustand store (localStorage) — always updated immediately
      ↓ (if wallet connected)
POST /api/predictions
      ↓
Supabase database
  → upsert profile (creates on first connect)
  → seed match record (if not in DB yet)
  → upsert prediction
```

### User Authentication Flow

**There is NO traditional login.** Identity is the wallet address:
1. User clicks "Connect Base Account" in sidebar or header
2. Wagmi opens the wallet connection flow
3. Once connected, `useAccount()` hook provides the wallet address
4. Wallet address is used as the user's identity in the database

### Wallet Connection Flow

```
User clicks "Connect" button (ConnectWallet component)
      ↓
Wagmi tries: baseAccount() connector first
      ↓ (fallback)
Wagmi tries: injected() connector (MetaMask, Coinbase Wallet)
      ↓
On success: address available via useAccount() hook
      ↓
PredictionModal auto-syncs any existing local predictions to Supabase
```

### Prediction Flow

```
User clicks "Predict Match" on a MatchCard
      ↓
PredictionModal opens with match data
      ↓
User selects Home / Draw / Away (OutcomeButton)
      ↓
User clicks "Confirm"
      ↓
1. setPrediction() → saved to Zustand/localStorage immediately
2. setConfirmed(true) → shows success state
3. (if wallet connected) persistPrediction() → calls POST /api/predictions
      ↓
On re-open: if prediction already exists, auto-syncs to Supabase
```

### Any Admin or Whitelist Logic

- None currently. There is no admin panel.
- TODO comment in route.ts notes that wallet signature verification should be added (Phase 4D) — currently any POST request can submit predictions for any wallet address.

### External API Flow

- No external APIs connected yet.
- All match data (teams, scores, kickoff times) is hardcoded in `src/data/matches.ts`
- All leaderboard data is hardcoded in `src/data/leaderboard.ts`
- All user data is hardcoded in `src/data/users.ts`

---

## 4. Current Project Status

### Completed ✅

1. **Complete design system** — dark navy/blue glass UI, custom Tailwind tokens, gradients, animations
2. **All 5 pages** — Home, Matches, Leaderboard, Profile, World Cup (all fully built)
3. **Navigation** — Desktop sidebar + mobile bottom nav + mobile header
4. **Wallet connection** — Full connect/disconnect UI with Base Account + MetaMask support
5. **Prediction modal** — Pick outcome, confirm, show locked state, sync to Supabase
6. **Match cards** — Full match display with live/upcoming/finished states, community bars
7. **League filter + Status filter** — Working filter on Matches page
8. **Mock data** — 18 football fixtures, 5+ leagues, 10 mock users, 18 badges, World Cup groups
9. **Zustand store** — Predictions saved to localStorage, persist across page refreshes
10. **Supabase schema** — All 6 tables defined with Row Level Security
11. **API route** — POST/GET /api/predictions working with Supabase
12. **Builder Code attribution** — ERC-8021 setup prepared (no transactions yet)
13. **Vercel deployment** — Connected and configured
14. **World Cup preview** — Countdown timer, group tables, fixtures, special predictions (all demo)

### Partially Completed ⚠️

1. **Profile page** — UI is complete but shows hardcoded mock data (`usr-001`), not real wallet data
2. **Leaderboard page** — UI is complete but data comes from mock file, not Supabase
3. **Home page** — User stats show hardcoded `usr-001` data, not connected wallet
4. **Prediction history on Profile** — Hardcoded 5 mock entries, not fetched from database
5. **Supabase integration** — Schema and API exist, but the profile/leaderboard pages don't read from DB yet
6. **XP / points system** — Points are saved to DB but never calculated or updated (no settlement logic)
7. **Community percentages** — Hardcoded in match data, not dynamically computed from real predictions

### Not Started ❌

1. **Real football API** — No live match data, scores, or results from an external source (e.g. API-Football)
2. **Match result settlement** — No system to mark match as finished and award XP to correct predictors
3. **Real leaderboard computation** — No backend job to compute leaderboard from prediction results
4. **Smart contracts** — No on-chain prediction recording
5. **Base App notifications** — No push notifications for match reminders or results
6. **Admin panel** — No way for the founder to manage matches, set results, or award points
7. **Seed SQL** — Badges table has no seed data (must be populated manually)
8. **Wallet signature verification** — API currently trusts any POST (security gap)

### Broken / Risky / Unclear ⚠️🚨

1. **SECURITY RISK** — `POST /api/predictions` has a TODO comment: "Add wallet signature verification before accepting writes." Currently, anyone can submit predictions for any wallet address just by knowing the address. This must be fixed before real users use the app.

2. **Supabase env vars may be missing** — If `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are not set in `.env.local` (locally) and Vercel (production), the API silently fails and predictions only save locally.

3. **ROADMAP.md is very outdated** — It says "Batch 3 (Pages) not started" but all pages are complete. The roadmap does not reflect current reality and should not be trusted as a status indicator.

4. **Home page hardcoded user** — `const CURRENT_USER_ID = "usr-001"` — the home page always shows the same mock user regardless of who is connected.

5. **Profile page hardcoded** — Profile always shows `currentUser` from `src/data/users.ts`, not the connected wallet's real data.

6. **No real match data** — Match kickoff dates are from May 2026 and are hardcoded. If deployed for real users, match data would need to come from a real football API.

7. **`wagmi/connectors` import issue** — `baseAccount` is imported from `wagmi/connectors` in `src/config/wagmi.ts`. This works with the installed `@base-org/account` package, but if the package version changes it could break.

8. **`ox/erc8021` dependency** — `src/config/attribution.ts` imports from `ox/erc8021`. The `ox` package is not listed in `package.json` explicitly — it may be a transitive dependency from `@base-org/account`. This could become a problem if package versions change.

---

## 5. Full Folder and File Structure

```
predixi/
├── .env.example                    ← Template for required env vars (safe to share)
├── .env.local                      ← Real secrets (DO NOT COMMIT — not in git)
├── .gitignore                      ← Excludes node_modules, .next, .env.local
├── .vercel/
│   ├── project.json                ← Vercel project/org IDs
│   └── README.txt
├── AGENTS.md                       ← Claude Code instruction: read Next.js docs first
├── CLAUDE.md                       ← Claude Code config (references AGENTS.md)
├── README.md                       ← Basic project readme
├── ROADMAP.md                      ← ⚠️ OUTDATED — do not trust for current status
├── eslint.config.mjs               ← ESLint configuration
├── next-env.d.ts                   ← Next.js TypeScript declarations (auto-generated)
├── next.config.ts                  ← Next.js config (minimal, reactStrictMode: true)
├── package.json                    ← Dependencies and npm scripts
├── package-lock.json               ← Locked dependency versions
├── postcss.config.mjs              ← PostCSS config (for Tailwind)
├── tailwind.config.ts              ← Tailwind config with custom design tokens
├── tsconfig.json                   ← TypeScript config
├── public/
│   ├── brand/
│   │   └── predixi-logo.png        ← The PrediXI logo image
│   └── *.svg                       ← Default Next.js SVG files
├── supabase/
│   ├── schema.sql                  ← ⭐ Full PostgreSQL database schema
│   └── README.md                   ← Supabase setup instructions
└── src/
    ├── app/
    │   ├── favicon.ico
    │   ├── globals.css             ← ⭐ Global styles + custom Tailwind utilities
    │   ├── layout.tsx              ← ⭐ Root layout (fonts, metadata, providers)
    │   ├── page.tsx                ← Home page (/)
    │   ├── providers.tsx           ← Wagmi + React Query providers
    │   ├── api/
    │   │   └── predictions/
    │   │       └── route.ts        ← ⭐ POST/GET /api/predictions (Supabase API)
    │   ├── leaderboard/
    │   │   └── page.tsx            ← /leaderboard page
    │   ├── matches/
    │   │   └── page.tsx            ← ⭐ /matches page (filter + modal)
    │   ├── profile/
    │   │   └── page.tsx            ← /profile page
    │   └── world-cup/
    │       └── page.tsx            ← /world-cup page
    ├── components/
    │   ├── gamification/
    │   │   ├── BadgeCard.tsx       ← Badge display (earned/locked)
    │   │   ├── PointsCounter.tsx   ← XP counter UI
    │   │   └── StreakBanner.tsx    ← Win streak display
    │   ├── layout/
    │   │   ├── BottomNav.tsx       ← Mobile bottom navigation bar
    │   │   ├── MobileHeader.tsx    ← Mobile top header
    │   │   ├── PageWrapper.tsx     ← ⭐ Shell layout (sidebar + mobile nav)
    │   │   └── Sidebar.tsx         ← ⭐ Desktop sidebar with nav + wallet button
    │   ├── leaderboard/
    │   │   ├── LeaderboardTable.tsx ← Full rankings table
    │   │   ├── MiniLeaderboard.tsx  ← Compact leaderboard for home page
    │   │   └── PodiumCard.tsx       ← Top 3 podium display
    │   ├── matches/
    │   │   ├── LeagueFilter.tsx    ← League filter pills (horizontal scroll)
    │   │   ├── MatchCard.tsx       ← ⭐ Match display card (full featured)
    │   │   └── PredictionBar.tsx   ← Community prediction percentage bar
    │   ├── prediction/
    │   │   ├── OutcomeButton.tsx   ← Home/Draw/Away selection button
    │   │   ├── PointsPreview.tsx   ← XP preview in prediction modal
    │   │   └── PredictionModal.tsx ← ⭐ Full prediction flow modal
    │   ├── profile/
    │   │   ├── PredictionHistory.tsx ← List of past predictions
    │   │   ├── ProfileHeader.tsx     ← User avatar, name, rank
    │   │   └── StatsBar.tsx          ← XP, accuracy, streak stats
    │   ├── ui/
    │   │   ├── Badge.tsx           ← RankBadge, MatchStatusBadge components
    │   │   ├── Button.tsx          ← Generic button
    │   │   ├── Card.tsx            ← Card wrapper, AccentBar
    │   │   └── Skeleton.tsx        ← Loading skeleton
    │   ├── wallet/
    │   │   └── ConnectWallet.tsx   ← ⭐ Wallet connect/disconnect button
    │   └── world-cup/
    │       ├── CountdownPreview.tsx
    │       ├── CountdownTimer.tsx
    │       ├── GroupCard.tsx
    │       ├── WorldCupFixtureCard.tsx
    │       └── WorldCupPredictionCard.tsx
    ├── config/
    │   ├── attribution.ts          ← Base Builder Code (ERC-8021) setup
    │   └── wagmi.ts                ← ⭐ Wagmi/wallet configuration
    ├── data/                       ← ⚠️ ALL MOCK DATA — not from a real API
    │   ├── badges.ts               ← 18 achievement badge definitions
    │   ├── leaderboard.ts          ← 10 mock users ranked
    │   ├── leagues.ts              ← 7 leagues (PL, La Liga, etc.)
    │   ├── matches.ts              ← ⭐ 18 hardcoded match fixtures
    │   ├── users.ts                ← Mock user data
    │   └── worldcup.ts             ← World Cup 2026 demo data (not official)
    ├── lib/
    │   ├── address.ts              ← Ethereum address formatting helpers
    │   ├── utils.ts                ← cn() class-name utility
    │   ├── api/
    │   │   └── predictions.ts      ← Client-side API helper (fetch wrapper)
    │   └── supabase/
    │       ├── client.ts           ← Supabase client for browser (safe)
    │       ├── server.ts           ← ⭐ Supabase server client (service role — secrets)
    │       └── types.ts            ← TypeScript types for DB tables
    ├── store/
    │   └── usePredictionStore.ts   ← ⭐ Zustand prediction store (localStorage)
    └── types/
        └── index.ts                ← ⭐ All TypeScript type definitions
```

### Important Files Explained

| File | What it does | Inspect first? |
|------|-------------|----------------|
| `src/app/layout.tsx` | Root layout — fonts, metadata, Base App ID | Yes |
| `src/app/page.tsx` | Home page — hero, stats, featured matches | Yes |
| `src/app/api/predictions/route.ts` | Backend API — saves predictions to Supabase | YES — security risk |
| `src/app/matches/page.tsx` | Main prediction page with modal | Yes |
| `src/components/prediction/PredictionModal.tsx` | Core prediction UX | Yes |
| `src/store/usePredictionStore.ts` | How predictions are stored + synced | Yes |
| `src/config/wagmi.ts` | Wallet connection config | Yes |
| `src/components/wallet/ConnectWallet.tsx` | Wallet UI button | Yes |
| `src/lib/supabase/server.ts` | Secret key usage — server only | Yes |
| `supabase/schema.sql` | Full database structure | Yes |
| `.env.example` | All required environment variables | YES — check if .env.local is configured |
| `tailwind.config.ts` | All custom colors and design tokens | Optional |
| `src/data/matches.ts` | All match data (MOCK) | Yes |
| `ROADMAP.md` | Old roadmap — ⚠️ OUTDATED | Read but don't trust |

---

## 6. Feature Map

### Feature 1: Home Page Dashboard
- **What it does**: Shows hero section, performance stats, 2 featured matches, top 5 leaderboard, World Cup teaser
- **Status**: Complete — but uses hardcoded mock user (`usr-001`), not real wallet data
- **Main files**: `src/app/page.tsx`, `src/components/leaderboard/MiniLeaderboard.tsx`
- **Env vars needed**: None (uses mock data)
- **Still needs**: Connect to real wallet profile data

### Feature 2: Matches Page
- **What it does**: Lists all 18 matches with league/status filters, prediction badge on predicted matches
- **Status**: Complete
- **Main files**: `src/app/matches/page.tsx`, `src/components/matches/MatchCard.tsx`
- **Env vars needed**: None for display; Supabase vars for saving predictions
- **Still needs**: Real match data from a football API

### Feature 3: Prediction Modal
- **What it does**: Opens when user clicks "Predict Match", shows 3 outcome buttons, confirms pick, syncs to Supabase
- **Status**: Complete
- **Main files**: `src/components/prediction/PredictionModal.tsx`, `src/store/usePredictionStore.ts`
- **Env vars needed**: Supabase vars for DB sync
- **Still needs**: Wallet signature verification for security

### Feature 4: Wallet Connection
- **What it does**: Connect/disconnect Base Account or MetaMask, shows truncated address when connected
- **Status**: Complete
- **Main files**: `src/config/wagmi.ts`, `src/components/wallet/ConnectWallet.tsx`
- **Env vars needed**: None
- **Still needs**: Nothing for basic connection; signature verification for API security

### Feature 5: Leaderboard
- **What it does**: Shows top 10 predictors in podium + table, all-time and weekly toggle
- **Status**: Complete UI — data is all mock, not from Supabase
- **Main files**: `src/app/leaderboard/page.tsx`, `src/data/leaderboard.ts`
- **Env vars needed**: Supabase vars (for future real data)
- **Still needs**: Connect to real `leaderboard_stats` table from Supabase

### Feature 6: Profile Page
- **What it does**: Shows user stats, earned/locked badges, prediction history
- **Status**: Complete UI — all data is mock, not from connected wallet
- **Main files**: `src/app/profile/page.tsx`, `src/components/profile/`
- **Env vars needed**: Supabase vars (for future real data)
- **Still needs**: Fetch real data for connected wallet address from DB

### Feature 7: World Cup 2026 Preview
- **What it does**: Countdown timer, group tables (12 groups, 48 teams), fixtures, special predictions
- **Status**: Complete UI — all demo data, not official FIFA data
- **Main files**: `src/app/world-cup/page.tsx`, `src/data/worldcup.ts`
- **Env vars needed**: None
- **Still needs**: Real FIFA data when World Cup starts (Jun 11, 2026)

### Feature 8: Supabase Prediction Persistence
- **What it does**: POST /api/predictions saves prediction to DB; creates profile on first connect
- **Status**: Working (if env vars are set)
- **Main files**: `src/app/api/predictions/route.ts`, `src/lib/supabase/server.ts`
- **Env vars needed**: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- **Still needs**: Wallet signature verification (security gap)

### Feature 9: Badge System
- **What it does**: 18 achievement badges with rarity levels; shown as earned/locked on profile
- **Status**: UI complete with mock data; DB table defined but not seeded
- **Main files**: `src/data/badges.ts`, `supabase/schema.sql`
- **Env vars needed**: Supabase vars
- **Still needs**: Seed badges table in Supabase; logic to award badges for achievements

### Feature 10: Builder Code Attribution
- **What it does**: Prepares ERC-8021 transaction attribution for Base builder rewards
- **Status**: Code prepared, not yet used in any actual transaction
- **Main files**: `src/config/attribution.ts`
- **Env vars needed**: `NEXT_PUBLIC_BASE_BUILDER_CODE`
- **Still needs**: Wire into actual on-chain transactions (Phase 4+)

---

## 7. Environment Variables and Secrets

| Variable | Where Used | Purpose | Required? | Status |
|----------|-----------|---------|-----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts` | Supabase project URL (safe to expose) | Yes, for DB | Must be set in `.env.local` and Vercel |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `src/lib/supabase/client.ts` | Supabase public/anonymous key | Yes, for DB client | Must be set; client.ts currently unused |
| `SUPABASE_SERVICE_ROLE_KEY` | `src/lib/supabase/server.ts` | Supabase admin secret key — SERVER ONLY | Yes, for API routes | ⚠️ NEVER prefix with NEXT_PUBLIC_; never commit |
| `NEXT_PUBLIC_BASE_BUILDER_CODE` | `src/config/attribution.ts` | Base builder reward code from base.dev | Optional | Set when ready for on-chain features |

### How to find these values

1. **Supabase URL + Keys**: Go to supabase.com → Your project → Settings → API
   - URL = `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key = `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` key = `SUPABASE_SERVICE_ROLE_KEY`

2. **Base Builder Code**: Go to base.dev → Settings → Builder Code

### Security warnings

- ⚠️ The `SUPABASE_SERVICE_ROLE_KEY` gives full admin access to the database. Never expose it in client-side code.
- ⚠️ If `.env.local` was ever committed to Git, those keys should be rotated immediately at supabase.com → Settings → API → Regenerate.
- The `.env.example` file is safe to share — it contains no real values.

### Setting up locally

Copy `.env.example` to `.env.local` and fill in real values:
```
NEXT_PUBLIC_BASE_BUILDER_CODE=your_builder_code_here
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## 8. Commands and How to Run

All commands are verified from `package.json`:

### Install dependencies
```bash
npm install
```

### Run locally (development mode)
```bash
npm run dev
```
Then open: `http://localhost:3000`

### Build for production
```bash
npm run build
```

### Start production server (after build)
```bash
npm start
```

### Lint (find code problems)
```bash
npm run lint
```

### Deploy to Vercel
The project is already connected to Vercel. Simply push to the main branch and Vercel will auto-deploy. Or use:
```bash
npx vercel --prod
```

### Set up the database
1. Go to supabase.com → Your project → SQL Editor
2. Copy the contents of `supabase/schema.sql`
3. Paste and run it → this creates all tables
4. (Future) Run a seed.sql to populate the badges table

---

## 9. Current Bugs, Errors, and Warnings

### 🔴 Security Risk (High Priority)
**File**: `src/app/api/predictions/route.ts`, line 10
**Problem**: The POST endpoint accepts predictions for ANY wallet address without verifying that the request comes from the actual wallet owner. An attacker who knows someone's wallet address can submit fake predictions on their behalf.
**Fix needed**: Add wallet signature verification (wallet signs a message → server verifies signature proves wallet ownership).

### 🟡 Hardcoded Mock User on Home/Profile Pages
**Files**: `src/app/page.tsx`, `src/app/profile/page.tsx`
**Problem**: Both pages use `CURRENT_USER_ID = "usr-001"` from mock data regardless of who is connected.
**Fix needed**: Read connected wallet address via `useAccount()`, look up profile from Supabase, display real data.

### 🟡 Profile Prediction History is Fake
**File**: `src/app/profile/page.tsx`
**Problem**: `historyEntries` array is hardcoded with 5 fake matches.
**Fix needed**: Fetch from `GET /api/predictions?walletAddress=...`

### 🟡 Leaderboard Uses Mock Data
**File**: `src/app/leaderboard/page.tsx`, imports from `src/data/leaderboard.ts`
**Problem**: Rankings are static demo data, not computed from real Supabase predictions.
**Fix needed**: Read from `leaderboard_stats` table (which itself needs a settlement job).

### 🟡 Badges Table Not Seeded
**File**: `supabase/schema.sql` (comment at bottom: "Next step: run seed.sql")
**Problem**: The `badges` table in Supabase is empty — no seed SQL exists yet.
**Fix needed**: Create a seed SQL file with the 18 badge definitions from `src/data/badges.ts`.

### 🟡 ROADMAP.md Is Outdated
**File**: `ROADMAP.md`
**Problem**: Says "Batch 3 (Pages) not started" but all pages are built. Phase 3 (wallet) and 3.5 (attribution) are also done but marked as "not started".
**Fix needed**: Update ROADMAP.md to reflect actual current status.

### 🟡 ox Package Not in package.json
**File**: `src/config/attribution.ts` imports `from 'ox/erc8021'`
**Problem**: `ox` is not listed as a direct dependency in `package.json`. It likely comes in as a transitive dependency. This is fragile.
**Fix needed**: Run `npm install ox` to make it an explicit dependency.

### 🟡 Community Percentages Are Static
**All match cards show community prediction percentages (e.g., "38% Home, 24% Draw, 38% Away")**
**Problem**: These numbers are hardcoded in `src/data/matches.ts` and don't update based on actual predictions.
**Fix needed**: Either query real prediction counts from Supabase or calculate from stored predictions.

### 🟡 XP/Points Never Awarded
**File**: `supabase/schema.sql` — `points_awarded` and `is_correct` columns in `predictions` table
**Problem**: These columns are always `null`. No settlement logic exists to match predictions against results.
**Fix needed**: Create a settlement system — when a match finishes, compare each prediction's outcome to the actual result and update points.

### 🟡 No Real Match Data
**All 18 matches have hardcoded kickoff times in May 2026 with hardcoded scores.**
**Problem**: There is no live football data. The app has no connection to any football data API.
**Fix needed**: Integrate a real football API (e.g., api-football.com, football-data.org) in a future phase.

---

## 10. Important Technical Decisions Already Made

### ✅ Framework: Next.js App Router
App Router (not Pages Router) is used. This is a deliberate choice that affects how layouts, loading states, and server/client code are separated.

### ✅ Platform: Standard Web App (NOT Farcaster Mini App)
The app is explicitly NOT a Farcaster Mini App. It's designed to run in the Base App in-app browser and regular browsers. The `AGENTS.md` file warns Claude not to use outdated mini-app assumptions. The `base:app_id` in the layout metadata connects it to the Base App ecosystem.

### ✅ Wallet: Base Account Primary, MetaMask Fallback
`baseAccount()` is the primary wallet connector (optimized for Base App browser). `injected()` is the fallback for MetaMask/desktop users. No WalletConnect, no Rainbow Kit.

### ✅ Network: Base Mainnet Only
The app only connects to Base Mainnet (not testnet, not Ethereum). This is by design.

### ✅ Auth: Wallet Address = Identity
There is no username/password system. The wallet address IS the user's identity. Supabase stores profiles keyed by wallet address. Supabase Auth (email/OAuth) is explicitly disabled.

### ✅ Storage: Supabase (PostgreSQL)
Supabase was chosen as the backend database. It offers a generous free tier and is suitable for this scale.

### ✅ Local-first Predictions
Predictions are always saved locally first via Zustand/localStorage. Database sync is a non-blocking secondary action. This means the app works even without an internet connection — a deliberate design choice.

### ✅ Row Level Security (RLS) on Supabase
All tables have RLS enabled with "public read, no public write" policies. Writes happen through the API route using the service role key — never directly from the browser. This is a correct security pattern.

### ✅ Builder Code (ERC-8021) Ready
The attribution code is prepared but not yet wired to any transaction. This is intentional — it's waiting for Phase 4 when actual on-chain transactions will be sent.

### ✅ Design: Dark Navy/Blue Glass Aesthetic
The design system is custom (not a UI library like shadcn). Blue `#1652F0` is the brand color. All dark backgrounds use blue-tinted navy (not pure black). Glass effects with backdrop blur are used for navigation elements.

---

## 11. Recommended Next Roadmap

These are the recommended next steps to bring the app to a real, usable MVP with real users.

---

### Step 1: Fix Security — Wallet Signature Verification
**Priority: URGENT before any real users**

**Why**: Right now anyone can fake a prediction for any wallet address. This is a critical vulnerability.

**Files involved**: `src/app/api/predictions/route.ts`

**What to do**:
1. On the frontend, before calling the API, ask the wallet to sign a short message (e.g., "PrediXI prediction: match-id outcome")
2. Send the signature to the API alongside the prediction
3. On the backend, verify the signature matches the claimed wallet address using viem's `verifyMessage`
4. Only accept the prediction if verified

**ChatGPT should explain**: How wallet message signing works (sign a text, verify the signer)

---

### Step 2: Connect Profile Page to Real Wallet Data
**Priority: High — users expect to see their own data**

**Files involved**: `src/app/profile/page.tsx`, `src/lib/api/predictions.ts`

**What to do**:
1. In profile page, get wallet address from `useAccount()`
2. Call `GET /api/predictions?walletAddress=...` to get real predictions
3. Call `GET /api/profiles?walletAddress=...` (need to create this route) for profile stats
4. Replace all mock data references with real fetched data

---

### Step 3: Fix Home Page — Show Real User Data
**Priority: Medium — visual consistency**

**Files involved**: `src/app/page.tsx`

**What to do**:
1. Get connected wallet address
2. Fetch user's real XP, streak, accuracy from Supabase
3. If not connected, show generic/empty state

---

### Step 4: Seed the Badges Table in Supabase
**Priority: Medium — needed for badge system to work**

**Files involved**: `supabase/schema.sql`, `src/data/badges.ts`

**What to do**:
1. Create `supabase/seed.sql` from the badge data in `src/data/badges.ts`
2. Run it in Supabase SQL Editor
3. Add an API route to fetch a user's earned badges

---

### Step 5: Match Settlement System
**Priority: High — without this, no XP is ever awarded**

**Why**: Currently `points_awarded` and `is_correct` are always null in the predictions table.

**Files involved**: New file needed, e.g., `src/app/api/settle/route.ts`

**What to do**:
1. Create a settlement API route that takes a matchId and actual outcome
2. Update all predictions for that match: set `is_correct` and `points_awarded`
3. Update the profile's XP, streak, and total_predictions
4. Trigger leaderboard recalculation

---

### Step 6: Real Leaderboard from Supabase
**Priority: Medium**

**Files involved**: `src/app/leaderboard/page.tsx`, new API route needed

**What to do**:
1. Create `GET /api/leaderboard` route that reads from `leaderboard_stats` table
2. Replace mock data import in leaderboard page with API fetch

---

### Step 7: Integrate Real Football API
**Priority: Medium-High for launch**

**Why**: All current match data is hardcoded and outdated the moment real matches happen.

**Recommendation**: Use [api-football.com](https://api-football.com) or [football-data.org](https://football-data.org)

**What to do**:
1. Create a Supabase Edge Function or Next.js API route to fetch matches from the football API
2. Sync matches into the Supabase `matches` table
3. Update match statuses and scores as they happen
4. Remove the hardcoded `src/data/matches.ts` fixture data (or keep as fallback)

---

### Step 8: On-Chain Predictions (Phase 4)
**Priority: Long-term goal**

**What to do**:
1. Write and deploy a smart contract on Base Mainnet (Solidity/Foundry)
2. Replace the Supabase prediction save with `writeContract` to call the smart contract
3. Include the Builder Code attribution suffix from `src/config/attribution.ts`
4. Store the transaction hash in Supabase for reference

---

## 12. Exact Next Prompt for Claude Code

Copy this prompt and give it to Claude Code when you're ready for the next task:

---

```
I need to connect the Profile page to real wallet data from Supabase.

Currently the profile page (src/app/profile/page.tsx) shows hardcoded mock data from "usr-001".

Please:

1. Use the useAccount() hook from wagmi to get the connected wallet address.

2. If the wallet is not connected, show a "Connect your wallet to see your profile" message.

3. If connected, call GET /api/predictions?walletAddress=ADDRESS to fetch the user's real predictions from Supabase.

4. Also create a new API route: GET /api/profiles?walletAddress=ADDRESS
   - This should query the profiles table in Supabase (using getServerSupabaseClient())
   - Return: xp, rank, streak, total_predictions, correct_predictions, wallet_address
   - If profile doesn't exist yet, return empty/zero defaults

5. Replace the hardcoded historyEntries with the real predictions from the API.
   Map the API response (matchId, outcome, placedAt, pointsAwarded, isCorrect) to the PredictionHistoryEntry type.

6. Replace the hardcoded currentUser stats with real data from the profiles API.

Keep the profile page working even when Supabase env vars are not set — fall back to mock data gracefully.

Important files to read first:
- src/app/profile/page.tsx
- src/lib/api/predictions.ts
- src/app/api/predictions/route.ts
- src/lib/supabase/server.ts
- src/components/profile/PredictionHistory.tsx
```

---

## 13. Context for ChatGPT

### What this project is
PrediXI is a Web3 football prediction platform built for the Base App ecosystem (Coinbase's Layer 2 blockchain). Users connect a crypto wallet, predict football match outcomes (home/draw/away), earn XP points and badges, and compete on a leaderboard. Future phases will record predictions permanently on the Base blockchain.

### Current status
The app is a **working demo with a solid foundation**. All the UI is built and functional. The main gaps are:
- Profile and leaderboard pages show hardcoded mock data instead of real wallet/database data
- No real football match data (everything is hardcoded for demo)
- No match settlement system (XP is never actually awarded)
- Security gap in the API (wallet signatures not verified)
- The ROADMAP.md file is outdated — the actual app is much further along than it says

### Tech stack (simplified for Persian explanation)
- **Next.js** = the main web framework (like a smart website builder)
- **TypeScript** = the programming language (JavaScript with type safety)
- **Tailwind CSS** = the styling system (design in code)
- **Wagmi + Viem** = the wallet connection library
- **Base Account** = Coinbase's wallet (used for connecting to the app)
- **Supabase** = the database (like a Google Sheets that the code talks to)
- **Zustand** = stores temporary data in the browser (like short-term memory)
- **Framer Motion** = animations
- **Vercel** = where the website is published online

### Main files to inspect first
1. `src/app/api/predictions/route.ts` — the backend API (has security gap)
2. `src/store/usePredictionStore.ts` — how predictions are stored
3. `src/components/prediction/PredictionModal.tsx` — the main prediction UI
4. `src/app/matches/page.tsx` — the main user-facing page
5. `.env.example` — all the secrets that need to be set
6. `supabase/schema.sql` — the database structure

### Biggest risks
1. **Security**: The API route accepts predictions for any wallet without verification
2. **Missing data**: Profile and leaderboard show fake data — users will notice
3. **No real matches**: All football data is hardcoded and will become stale
4. **No XP settlement**: Points are never awarded after correct predictions

### What the user needs from ChatGPT
The user is a non-technical founder who:
- Does not understand English well → explain everything in Persian (Farsi)
- Does not understand coding → use simple analogies and step-by-step instructions
- Has been using Claude Code to make code changes based on ChatGPT's guidance
- Has now lost the previous ChatGPT conversation context → needs a fresh start

ChatGPT should:
- Always communicate in Persian
- Explain what each next step will accomplish in simple terms
- Give the user the exact text to paste into Claude Code
- Confirm understanding before moving to the next step
- Not assume the user remembers previous technical discussions

### What should be done next (in order)
1. Fix the security gap in `/api/predictions` (wallet signature verification)
2. Connect Profile page to real Supabase data
3. Connect Home page to real wallet data
4. Create seed SQL for badges table
5. Build a match settlement system (award XP after results)
6. Connect leaderboard to real Supabase data
7. Integrate a real football API

### Assumptions and uncertainties
- The Supabase database may or may not have the schema already applied — ChatGPT should ask the user to confirm they ran `supabase/schema.sql`
- The `.env.local` file content was not visible during this analysis — ChatGPT should ask the user to confirm all 3 Supabase env vars are set
- The `ox` package may need to be explicitly installed (`npm install ox`)
- The ROADMAP.md phases do not match reality — use the actual code as the source of truth, not the roadmap document
