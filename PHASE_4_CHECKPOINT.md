# PrediXI — Phase 4 Checkpoint

Phases 4C and 4D are complete and manually verified.
This document is the authoritative record of what was built, why, and what to do next.

---

## Phase 4C — Supabase Sync on Windows (Proxy Fix)

### Problem
Server-side Supabase API requests timed out in local development on Windows.
The app appeared to work (predictions saved to localStorage) but no rows were
ever written to Supabase.

### Root Cause
Node.js uses `undici` as its built-in fetch implementation.
Unlike browsers or PowerShell, `undici` does **not** read Windows system proxy
settings (WinHTTP / Internet Explorer proxy registry). On this machine the
network requires routing through a local proxy (`127.0.0.1:2080`, managed by
nekobox/v2ray). Because `undici` bypassed it, all HTTPS requests from the
Next.js server to `*.supabase.co` silently failed with a connection timeout.

### Fix
`src/lib/supabase/server.ts` was updated to build a proxy-aware fetch function:

- Reads `HTTPS_PROXY` / `https_proxy` / `HTTP_PROXY` / `http_proxy` from env.
- When a proxy URL is found, wraps `undici`'s fetch with a `ProxyAgent`
  that routes all Supabase requests through the proxy.
- When no proxy env var is set (e.g. on Vercel) the native `fetch` is used
  unchanged — the fix is a no-op in production.
- The custom fetch is passed to `createClient` via `global: { fetch: customFetch }`.

`undici` was added as a direct dependency (`npm install undici`).

`.env.local` received one new line (local dev only, gitignored):
```
HTTPS_PROXY=http://127.0.0.1:2080
```

### Verification
Manual UI test: connected wallet, submitted a prediction, confirmed rows were
written to all three Supabase tables: `profiles`, `matches`, `predictions`.

---

## Phase 4D — Wallet Signature Verification

### Problem
The `POST /api/predictions` endpoint accepted any wallet address without proof
of ownership. Anyone could forge a prediction for any address.

### Fix Overview
1. **Frontend** asks the wallet to sign a canonical plain-text message before
   sending the prediction to the API.
2. **Backend** verifies the signature cryptographically, checks that the signed
   message matches the request body fields, and rejects expired signatures
   (anti-replay). Only then are Supabase writes performed.

### Signed Message Format
Defined in `src/lib/prediction-message.ts` (single source of truth):
```
PrediXI Prediction
Action: Submit prediction
Wallet: 0x<lowercase address>
Match ID: <matchId>
Outcome: <H|D|A>
Timestamp: <ISO 8601>
```
Signatures older than 10 minutes are rejected to prevent replay attacks.

### Critical Detail — Base Account / ERC-6492 Signatures
The wallet used is **Base Account** (Coinbase Smart Wallet).
Base Account produces ERC-6492 wrapped signatures (~993 bytes, starting with
`0x00000000`). These encode `(factory_address, factory_calldata, inner_signature)`
so the wallet contract can be verified even before it is deployed on-chain.

The standalone `verifyMessage` utility from viem (`import { verifyMessage } from 'viem'`)
uses only `ecrecover` (standard ECDSA recovery). It **throws** on ERC-6492
signatures. Using it was the cause of "Signature verification failed" errors
during testing.

**The correct approach** is `publicClient.verifyMessage` on the Base chain, which
handles all three signature types:
- EOA / MetaMask (65-byte ecrecover)
- ERC-1271 deployed smart contract wallets (`isValidSignature` on-chain call)
- ERC-6492 counterfactual smart wallets (Base Account)

The public client in `route.ts` uses the same proxy-aware fetch pattern as the
Supabase client so that Base RPC calls (`https://mainnet.base.org`) also route
through the local proxy on Windows:

```typescript
const baseClient = createPublicClient({
  chain: base,
  transport: custom(buildRpcProvider()),   // proxy-aware JSON-RPC provider
})

isValid = await baseClient.verifyMessage({ address, message, signature })
```

### UX Rules Implemented
| Scenario | Behaviour |
|---|---|
| No wallet connected | Save to localStorage immediately, lock prediction |
| Wallet connected, signature accepted, API success | Lock locally only after API returns 200 |
| Wallet connected, signature accepted, API fails | Show error, do not lock, allow retry |
| Wallet connected, signature rejected by user | Show "declined" message, do not lock, allow retry |
| Unsigned direct API request | `401 Unauthorized`, no Supabase write |

### Files Changed in Phase 4D

| File | Change |
|---|---|
| `src/lib/prediction-message.ts` | **New.** Canonical message builder shared by frontend and backend. |
| `src/lib/api/predictions.ts` | Updated `submitPredictionToApi` to include `message`, `signature`, `signedAt` in POST body. |
| `src/store/usePredictionStore.ts` | Added `SignedProof` type and `setPersistError` action. `persistPrediction` now returns `Promise<boolean>` so the modal can conditionally lock. |
| `src/components/prediction/PredictionModal.tsx` | Sign-then-POST flow: signing happens before local save. Lock only on API success. Rejection is retryable. |
| `src/app/api/predictions/route.ts` | Replaced standalone `verifyMessage` with `baseClient.verifyMessage` (proxy-aware Base public client). Added content and timestamp checks. |

### Files Changed in Phase 4C

| File | Change |
|---|---|
| `src/lib/supabase/server.ts` | Added `buildFetch()` with `ProxyAgent`, passed as `global.fetch` to Supabase client. |
| `package.json` / `package-lock.json` | Added `undici` as a direct dependency. |
| `.env.local` | Added `HTTPS_PROXY=http://127.0.0.1:2080` — local dev only, gitignored, no secrets printed here. |

---

## Final Manual Test Results

| Test | Status | Notes |
|---|---|---|
| A — Accept signature (Base Account) | **PASSED** | Modal showed "Saved to your PrediXI profile. On-chain proof coming soon." Row inserted in Supabase `predictions`. |
| B — Reject signature | **PASSED** | No lock, no Supabase row, retry works, modal stays on prediction flow. |
| C — Unsigned direct API POST | **PASSED** | `401 {"error":"Missing message — wallet signature required"}`, no DB write. |

---

## Recommended Next Tasks

Listed in suggested priority order.

1. **Connect Profile page to real Supabase data**
   Query `profiles` table by connected wallet address. Display real XP, rank,
   streak, total predictions, correct predictions.

2. **Connect Home page stats to real profile data**
   Replace hardcoded/mock stats with live Supabase queries for the connected user.

3. **Connect Leaderboard to real Supabase data**
   Query `profiles` ordered by XP descending. Replace mock leaderboard entries.

4. **Seed badges table**
   Define badge criteria, create the `badges` and `profile_badges` tables in
   Supabase, seed initial badge definitions.

5. **Build match settlement / XP awarding system**
   When a match result is final, compare each prediction's `outcome` to the
   actual result, set `is_correct`, award `points_awarded`, and update profile
   XP and streak.

---

## Important Warnings

> **Do not** remove `ProxyAgent` from `src/lib/supabase/server.ts`.
> Removing it will break Supabase sync in local development on this machine.
> The proxy env var is simply not set on Vercel, so it has no production impact.

> **Do not** replace `baseClient.verifyMessage` with the standalone
> `import { verifyMessage } from 'viem'` utility. The standalone version
> does not support ERC-6492 (Base Account) signatures and will throw.

> **Do not** expose `SUPABASE_SERVICE_ROLE_KEY` to the browser bundle.
> It must never have a `NEXT_PUBLIC_` prefix.

> **Do not** deploy to Vercel until all required environment variables are
> confirmed in the Vercel project settings:
> - `NEXT_PUBLIC_SUPABASE_URL`
> - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
> - `SUPABASE_SERVICE_ROLE_KEY`
> (`HTTPS_PROXY` must **not** be set on Vercel — direct fetch is correct there.)
