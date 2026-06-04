# PrediXI Badge NFT — Final Checkpoint

**Status:** COMPLETE  
**Date:** 2026-06-04  
**Latest commit:** `46e221f chore: remove unused badge mint signing helpers`  
**Production:** https://predixi-base.vercel.app

---

## 1. Executive Summary

The PrediXI Badge NFT system adds optional, soulbound ERC-1155 NFT minting to the existing
free-to-play badge system. Earned badges become "Ready to Mint" — users who want on-chain
ownership proof can mint their badge as an NFT on Base Mainnet with a single wallet transaction
(gas fee only). Minting does not award extra XP, does not change gameplay, and is entirely
optional. The core badge earn/unlock flow, XP system, referral system, prediction settlement
pipeline, and Anchor on Base feature are all unchanged.

---

## 2. Contract Details

| Property | Value |
|---|---|
| **Contract name** | `PrediXIBadges` |
| **Standard** | ERC-1155 |
| **Network** | Base Mainnet (Chain ID 8453) |
| **Contract address** | `0x87231AA7FAeB23B3E674E905d7af4B1c91E10B2d` |
| **Deploy tx** | `0x10f60f220cbd79ea5c09e8385ca7e158946805f5297f4c3acf2b91cdb5edfc4d` |
| **Owner** | `0x29F38B1eD360acf9c09AaF46De9933D9d19770fB` |
| **Current signer** | `0x29F38B1eD360acf9c09AaF46De9933D9d19770fB` |
| **Base URI** | `https://predixi-base.vercel.app/api/badges/metadata/{id}` |
| **Source** | `contracts/src/PrediXIBadges.sol` |
| **Tests** | `contracts/test/PrediXIBadges.t.sol` — 42/42 pass |
| **OpenZeppelin** | v5.2.0 (ERC1155, EIP712, ECDSA, Ownable) |

### Contract Properties

- **Soulbound** — all transfer functions revert (`safeTransferFrom`, `safeBatchTransferFrom`,
  `setApprovalForAll`). Badges cannot be traded or moved.
- **EIP-712 authorization** — `mintBadge(tokenId, nonce, signature)` requires a valid
  signature from the on-chain `signer` address over the struct
  `MintBadge(address wallet, uint256 tokenId, bytes32 nonce)`. The contract verifies
  `msg.sender == wallet` so signatures cannot be used by third parties.
- **One mint per wallet per token ID** — `hasMinted[wallet][tokenId]` prevents duplicates.
- **Nonce replay protection** — `usedNonces[bytes32]` prevents signature reuse.
- **Valid token IDs** — 1–25; 1–19 active, 20–25 reserved.
- **Owner functions** — `setSigner(address)` to rotate the backend signing key.

### Key Contract Events / Errors

| Event/Error | Signature |
|---|---|
| `BadgeMinted` | `BadgeMinted(address indexed wallet, uint256 indexed tokenId, bytes32 nonce)` |
| `SignerUpdated` | `SignerUpdated(address indexed oldSigner, address indexed newSigner)` |
| `InvalidTokenId` | `InvalidTokenId(uint256 tokenId)` |
| `NonceAlreadyUsed` | `NonceAlreadyUsed(bytes32 nonce)` |
| `AlreadyMinted` | `AlreadyMinted(address wallet, uint256 tokenId)` |
| `InvalidSignature` | `InvalidSignature()` |
| `TransferNotAllowed` | `TransferNotAllowed()` |

---

## 3. Backend Endpoints

### `GET /api/badges/mint-signature?badgeId=...&walletAddress=0x...`

Issues an EIP-712 `MintBadge` authorization. No wallet message signature required.

**Checks (in order):**
1. `walletAddress` valid 0x address format
2. `badgeId` maps to an active token ID (1–19)
3. `profiles` row exists for `walletAddress`
4. `user_badges` row exists for `(profile_id, badge_id)`
5. `minted_onchain = false`

**On success:**
1. Generates a `bytes32` nonce via `crypto.randomBytes(32)`
2. Inserts row into `badge_mint_nonces` (`used_at = null`)
3. Signs `MintBadge(wallet, tokenId, nonce)` with `BADGE_SIGNER_KEY`
4. Returns `{ ok, badgeId, tokenId, nonce, signature, expiresAt }`

**Errors:** 400 invalid params · 403 not earned · 409 already minted · 500 signer error

---

### `PATCH /api/badges`

Persists a completed mint after the `mintBadge()` TX confirms on-chain.
No wallet message signature required — security is enforced by on-chain event verification.

**Request body:** `{ badgeId, tokenId, nonce, txHash, walletAddress }`

**Checks (in order):**
1. Body field validation (address format, token ID mapping, tx hash regex, bytes32 nonce)
2. `profiles` row exists
3. `user_badges` row exists
4. **Idempotency:** if `minted_onchain=true` + same `txHash` → 200 (safe retry); different `txHash` → 409
5. Nonce row exists and matches wallet/badge/tokenId; `used_at IS NULL`
6. **On-chain verification** via proxy-aware viem public client:
   - `getTransactionReceipt(txHash)` — status must be `success`
   - Parse `BadgeMinted` event from `PrediXIBadges` contract logs
   - Assert `event.wallet == walletAddress`, `event.tokenId == tokenId`, `event.nonce == nonce`

**On success:**
- Updates `user_badges`: `minted_onchain=true`, `minted_at`, `onchain_tx_hash`, `token_id`, `chain_id=8453`
- Updates `badge_mint_nonces`: `used_at = now()`

**Errors:** 400 validation/onchain · 403 not earned · 409 different tx · 500 RPC/DB error

---

### `GET /api/badges/metadata/[tokenId]`

ERC-1155 metadata endpoint. Returns OpenSea-compatible JSON.

- Token IDs 1–19: returns metadata with badge name, description, artwork URL, attributes
- Token IDs 20–25: 404 (reserved)
- Out of range / non-integer: 404

**Cache headers:** `Cache-Control: public, max-age=3600, s-maxage=86400`

**Image URL pattern:** `https://predixi-base.vercel.app/badges/{badgeId}.webp`

---

### `GET /api/badges?walletAddress=0x...`

Returns all earned badges for a wallet. Extended in Phase 3 to include onchain mint state.

**Response per badge:**
```json
{
  "badgeId":       "first-pred",
  "earnedAt":      "2026-05-31T22:22:32Z",
  "mintedOnchain": false,
  "onchainTxHash": null,
  "tokenId":       null,
  "chainId":       8453
}
```

---

## 4. DB Schema Additions

### `user_badges` — new columns (migration: `supabase/add-badge-nft-minting.sql`)

| Column | Type | Default | Purpose |
|---|---|---|---|
| `minted_onchain` | `boolean NOT NULL` | `false` | Core state: Ready to Mint vs Owned on Base |
| `minted_at` | `timestamptz NULL` | `null` | Set when PATCH persists the mint |
| `onchain_tx_hash` | `text NULL` | `null` | Base Mainnet tx hash |
| `token_id` | `integer NULL` | `null` | ERC-1155 token ID (1–25) |
| `chain_id` | `integer NOT NULL` | `8453` | Always Base Mainnet |

**Constraints:**
- `chk_user_badges_token_id_range` — `token_id IS NULL OR (token_id >= 1 AND token_id <= 25)`
- `chk_user_badges_mint_consistency` — when `minted_onchain=true`, all supporting columns non-null

**Indexes:**
- `idx_user_badges_minted_onchain` — partial `WHERE minted_onchain = true`
- `idx_user_badges_token_id` — partial `WHERE token_id IS NOT NULL`

### `badge_mint_nonces` — new table

| Column | Type | Purpose |
|---|---|---|
| `nonce` | `text PRIMARY KEY` | bytes32 hex (0x-prefixed) |
| `wallet_address` | `text NOT NULL` | Lowercase wallet that was issued the nonce |
| `badge_id` | `text NOT NULL` | e.g. `'first-pred'` |
| `token_id` | `integer NOT NULL` | ERC-1155 token ID (1–25) |
| `created_at` | `timestamptz DEFAULT now()` | Nonce issuance time |
| `used_at` | `timestamptz NULL` | `null` until mint TX confirmed and PATCH persists |

**Indexes:** `(wallet_address, badge_id)`, `(wallet_address)`, `(token_id)`, partial `WHERE used_at IS NULL`

---

## 5. Frontend Flow

### `src/lib/onchain/predixiBadges.ts`
Contract config: `PREDIXI_BADGE_CONTRACT`, `PREDIXI_BASE_CHAIN_ID`, `PREDIXI_BADGES_ABI`,
validation helpers, `getBadgeTxUrl`.

### `src/lib/badges/tokenIds.ts`
Canonical token ID mapping: `BADGE_TOKEN_IDS`, `TOKEN_ID_TO_BADGE_ID`, lookup helpers,
`MIN/MAX_BADGE_TOKEN_ID`, `MAX_ACTIVE_BADGE_TOKEN_ID`.

### `src/hooks/useMintBadge.ts`
Orchestrates the four-step flow:
1. `GET /api/badges/mint-signature` → receives `{ tokenId, nonce, signature }`
2. `writeContract.mintBadge(tokenId, nonce, signature)` — **the only wallet interaction**
3. `useWaitForTransactionReceipt` — waits for Base confirmation
4. `PATCH /api/badges` — server verifies on-chain event, persists DB state

**States:** `isRequestingSignature` → `isMintPending` → `isMintConfirming` → `isPersisting` → `isMinted`

**Duplicate-TX protection:** `cachedTxHashRef` caches the confirmed TX. If PATCH fails and user retries, `writeContract` is never called again — only PATCH is retried.

### `src/components/onchain/MintBadgeButton.tsx`
Self-contained button component. Renders:
- `null` when wallet not connected and badge not minted
- **Idle:** `✦ Mint on Base` + subtle `optional · small Base fee` hint
- **Active:** spinner + phase label (`Requesting…` / `Minting…` / `Confirming…` / `Saving…`)
- **Error:** `↺ Save again` (PATCH retry, no new TX) or `↺ Try again` (fresh attempt)
- **Owned:** `Owned on Base` + BaseScan link (emerald green)

Calls `onMinted(badgeId, txHash)` exactly once via `mintedCallbackFiredRef`.

### `src/components/gamification/BadgeCard.tsx`
Accepts `mintedOnchain`, `onchainTxHash`, `tokenId`, `onMinted` props.
Renders `MintBadgeButton` on earned cards only. Locked cards receive no mint action.

### `src/app/profile/page.tsx`
- Loads `minted_onchain`, `onchain_tx_hash`, `token_id`, `chain_id` from `GET /api/badges`
- Stores in `badgeMintInfoMap: Map<string, BadgeMintInfo>`
- `handleBadgeMinted` updates the map instantly on mint — no page reload needed
- Badge Collection header shows three count chips: **Owned on Base · N** / **Ready to Mint · N** / **Locked · N**

---

## 6. User UX

### Badge States

| State | Condition | Visual |
|---|---|---|
| **Locked** | No `user_badges` row | Badge card greyscale, lock icon overlay |
| **Ready to Mint** | `user_badges` row, `minted_onchain=false` | Full-colour card, `Mint on Base` button |
| **Owned on Base** | `user_badges` row, `minted_onchain=true` | Full-colour card, `Owned on Base ✓` + BaseScan link |

### Mint Flow (one wallet interaction)

```
User on Profile page, wallet connected
       ↓
Clicks "Mint on Base" on an earned badge
       ↓
App: GET /api/badges/mint-signature → EIP-712 sig issued silently
       ↓
Wallet opens once: "Confirm mintBadge() transaction" (gas fee only)
       ↓
User confirms → TX broadcast to Base Mainnet
       ↓
App waits for receipt: "Confirming…"
       ↓
App: PATCH /api/badges → on-chain event verified → DB updated
       ↓
Badge card: "Owned on Base ✓" + BaseScan link
```

### Important UX Notes

- Minting is **optional** — earned badges provide full XP and gameplay recognition without minting
- Minting costs a small Base gas fee (typically fractions of a cent)
- Minting does **not** award extra XP — XP is awarded at badge earn time
- No financial reward or token promise is associated with minting
- Soulbound: minted badges cannot be transferred or traded

---

## 7. Token ID Mapping

| Token ID | Badge ID | Badge Name |
|---|---|---|
| 1 | `first-pred` | First Touch |
| 2 | `centurion` | Centurion |
| 3 | `veteran` | Veteran |
| 4 | `early-adopter` | Early Adopter |
| 5 | `streak-3` | Hat-Trick Streak |
| 6 | `streak-5` | Five Star Streak |
| 7 | `streak-9` | Nine Lives |
| 8 | `streak-10` | Perfect Ten |
| 9 | `sharp-eye` | Sharp Eye |
| 10 | `oracle` | Oracle |
| 11 | `hat-trick` | Hat-Trick |
| 12 | `pl-expert` | Premier League Expert |
| 13 | `la-liga-expert` | La Liga Expert |
| 14 | `bundesliga-expert` | Bundesliga Expert |
| 15 | `ligue1-expert` | Ligue 1 Expert |
| 16 | `ucl-expert` | UCL Expert |
| 17 | `el-clasico` | El Clásico |
| 18 | `worldcup-2026` | World Cup 2026 |
| 19 | `worldcup-champion` | World Cup Champion |
| 20–25 | *(reserved)* | Future badges |

**Canonical source:** `src/lib/badges/tokenIds.ts`

> ⚠️ Token IDs are immutable once the contract is deployed. Never change an assigned ID.
> Only append new badges from the reserved range (20–25).

---

## 8. Security Model

### Mint Signature (GET endpoint)

- Signature is EIP-712 typed data: `MintBadge(address wallet, uint256 tokenId, bytes32 nonce)`
- Bound to a specific `walletAddress` — the contract verifies `msg.sender == wallet`
- Even if an attacker requests a signature for another wallet's address, they cannot use it
  because they cannot send a TX from that wallet
- DB check enforces eligibility (earned badge, not yet minted) before any signature is issued
- Nonce is stored in DB before signing — if signing fails, nonce is cleaned up

### On-Chain TX Verification (PATCH endpoint)

- Server fetches the `getTransactionReceipt` from Base Mainnet via proxy-aware viem client
- Asserts: `receipt.status === 'success'`
- Finds `BadgeMinted` event in logs from the `PrediXIBadges` contract address
- Asserts: `event.wallet === walletAddress`, `event.tokenId === tokenId`, `event.nonce === nonce`
- Only after all assertions pass does the DB write happen
- This replaces the old wallet signature as the security gate — an on-chain event cannot be faked

### Contract-Level Security

- Signer key can be rotated by owner via `setSigner(address)` — no contract redeploy needed
- `usedNonces` mapping on-chain prevents replay even if the DB is compromised
- `hasMinted[wallet][tokenId]` prevents double-minting at the contract level
- All transfer functions revert — badges cannot leave the minting wallet

### Environment Variables

| Variable | Location | Notes |
|---|---|---|
| `BADGE_SIGNER_KEY` | Vercel (encrypted) + `.env.local` (gitignored) | Server-only. Never exposed to client bundle. |
| `BADGE_SIGNER_ADDRESS` | Vercel (readable) + `.env.local` | Public address — used to validate key on startup. |
| `NEXT_PUBLIC_PREDIXI_BADGE_CONTRACT` | Vercel + `.env.local` | Client-safe. Read at build time. |
| `NEXT_PUBLIC_BASE_CHAIN_ID` | Vercel + `.env.local` | `8453`. Client-safe. |

---

## 9. Known Caveat — Signer Rotation Recommended

The current `BADGE_SIGNER_KEY` (private key for `0x29F38B1eD360acf9c09AaF46De9933D9d19770fB`)
was visible in the development chat session during deployment. It is a temporary throwaway
deployer wallet, but rotating to a fresh key is recommended as a security hygiene step.

**To rotate the signer (no code changes required):**

1. Generate a fresh wallet (e.g. `cast wallet new`)
2. Note the new address and private key securely
3. Call `setSigner(newAddress)` from the owner wallet:
   ```bash
   cast send 0x87231AA7FAeB23B3E674E905d7af4B1c91E10B2d \
     "setSigner(address)" <newAddress> \
     --private-key $OWNER_KEY \
     --rpc-url https://mainnet.base.org
   ```
4. Update in Vercel: `BADGE_SIGNER_KEY=<newKey>` and `BADGE_SIGNER_ADDRESS=<newAddress>`
5. Update `.env.local` locally
6. Redeploy (no commit needed — env-only change)
7. Verify: `cast call 0x87231AA7FAeB23B3E674E905d7af4B1c91E10B2d "signer()(address)" --rpc-url https://mainnet.base.org`

---

## 10. Completed Phase List

| Phase | Description | Commit |
|---|---|---|
| Phase 1 | PrediXIBadges smart contract + 42 Foundry tests | `b2f041b` |
| Phase 2A | Deploy script (`DeployPrediXIBadges.s.sol`) | `3d64d07` |
| Phase 2B | Base Mainnet deployment + env activation | — |
| Phase 3 | DB migration: mint columns + nonce table | `0212b45` |
| Phase 4 | Token ID mapping + metadata endpoint | `63393d1` |
| Phase 5A | `GET /api/badges/mint-signature` backend | `2e103b2` |
| Phase 5B | `PATCH /api/badges` persistence + on-chain verification | `7370dad` |
| Phase 6A | `useMintBadge` hook + contract config helper | `6dc095e` |
| Phase 6B | `MintBadgeButton` component | `a4e9cf6` |
| Phase 6C | Wire `MintBadgeButton` into `BadgeCard` + Profile | `2ee7526` |
| Phase 6D | Simplify to single-transaction UX (remove double signing) | `8406cdc` |
| Polish | Clarify fee copy, update doc comment | `4e90221` |
| Phase 7 | Badge Collection status counts in Profile | `8503a3d` |
| Cleanup | Remove unused two-signature helpers | `46e221f` |

---

## 11. Remaining Optional Future Improvements

These are **not required** for the current live system. The Badge NFT mint is fully functional
without any of these.

### 🔑 Signer Rotation *(recommended — security hygiene)*
Rotate `BADGE_SIGNER_KEY` to a fresh wallet never used in any chat or deployment session.
See Section 9 for exact steps. Zero code changes required.

### 🔍 Basescan Contract Verification *(transparency)*
Verify the `PrediXIBadges` source code on Basescan so users can read the contract:
```bash
cd contracts
forge verify-contract 0x87231AA7FAeB23B3E674E905d7af4B1c91E10B2d \
  src/PrediXIBadges.sol:PrediXIBadges \
  --chain-id 8453 \
  --etherscan-api-key $BASESCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(address,address,string)" \
    0x29F38B1eD360acf9c09AaF46De9933D9d19770fB \
    0x29F38B1eD360acf9c09AaF46De9933D9d19770fB \
    "https://predixi-base.vercel.app/api/badges/metadata/{id}")
```

### 🌐 IPFS / Arweave Metadata *(permanence)*
Migrate badge artwork and metadata JSON from the Vercel endpoint to IPFS or Arweave
for permanent, decentralised storage. Update the contract's base URI via the metadata
endpoint — no contract change required since the URI is stored off-chain.

### 🖼 OpenSea / NFT Marketplace Polish *(discoverability)*
Add OpenSea collection metadata (`contractURI()`), improve attribute formatting,
add `animation_url` if badge artwork gets animated versions.

### 🎉 First Mint Social Share *(engagement)*
When a user mints their first badge, show a share sheet or copy-to-clipboard with
a pre-filled tweet/Farcaster cast celebrating the on-chain achievement.

### 📦 Batch Mint *(convenience, if needed)*
If users accumulate many ready-to-mint badges, a `batchMint` function could be added
to mint multiple in one transaction. Requires a contract upgrade or new contract version.

---

## 12. Final Status

```
┌─────────────────────────────────────────────────────────┐
│          PrediXI Badge NFT Mint Flow = COMPLETE         │
│                                                         │
│  Contract:  0x87231AA7FAeB23B3E674E905d7af4B1c91E10B2d  │
│  Network:   Base Mainnet (Chain ID 8453)                │
│  Standard:  ERC-1155 Soulbound                         │
│  UX:        Single wallet transaction                   │
│  Tests:     42/42 Foundry tests passing                 │
│  Production: https://predixi-base.vercel.app            │
└─────────────────────────────────────────────────────────┘
```

The complete badge lifecycle is live:
- **Earn** badges through predictions and gameplay (free, offchain, XP awarded)
- **See** earned badges in the Profile Badge Collection (Ready to Mint state)
- **Mint** any earned badge as a soulbound NFT on Base (optional, one TX, small gas)
- **Own** the badge on-chain with a permanent BaseScan record (Owned on Base state)

Core gameplay remains free and offchain. Minting is an optional premium layer.
