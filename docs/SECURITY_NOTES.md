# PrediXI Security Notes

Architecture-level security decisions, trust boundaries, known risks, and future recommendations.

---

## 1. Trust Model

### What is trusted
| Source | Trust Level | Reason |
|---|---|---|
| Supabase service role client | High | Server-side only; key never exposed to client |
| Wallet signature (EIP-191) | High | Cryptographically bound to wallet private key |
| `x-admin-key` header | High | Required for all admin routes; 32-byte random secret |
| `CRON_SECRET` header | High | Vercel cron auth; compared constant-time |
| football-data.org / api-football API responses | Medium | External; validated via `validateFixture()` before DB write |

### What is NOT trusted
| Source | Trust Level | Reason |
|---|---|---|
| Request body fields | Untrusted | Validated and sanitised on every route before DB write |
| Client-supplied `pointsAwarded` | Untrusted | Clamped to `>= 0`; actual XP settlement is server-driven |
| Client-supplied `xpAmount` in xp-events POST | Untrusted | Range-guarded (-1000 to 10000) but route lacks wallet sig auth (see §4) |
| Match data embedded in signed message | Verified | Message content re-checked against request body after sig validation |

---

## 2. Offchain / Onchain Separation

PrediXI is currently **fully offchain** (no live smart contract).

- **Commitment hashes** are computed server-side and stored in Supabase. They are SHA-256 digests of `(walletAddress + matchId/predictionKey + outcome + placedAt)` and provide a tamper-evident audit trail.
- **`submitted_onchain`** and **`tx_hash`** columns exist in the DB schema for the future onchain phase but are never written to in the current codebase.
- The commitment scheme uses deterministic hashing — the same inputs always produce the same hash — so hashes can be independently verified by anyone with the input data.

**Caution before contract deployment**: commitment hashes use `placedAt` as a nonce. If two predictions are placed for the same wallet+match within the same millisecond, they produce the same hash. Add a random salt before writing hashes to a public ledger.

---

## 3. Wallet Signature Guarantees

Route: `POST /api/predictions`

### What is verified
1. **Signature validity** — `publicClient.verifyMessage` on Base mainnet supports EOA (ecrecover), ERC-1271 (deployed smart wallets), and ERC-6492 (counterfactual / Base Account).
2. **Message content** — After signature passes, the server re-checks that the signed message contains the exact `walletAddress`, `matchId`, and `outcome` from the request body. Prevents signature reuse across different predictions.
3. **Timestamp freshness** — `Timestamp:` field in the signed message is extracted and compared. Signatures older than `SIGNATURE_MAX_AGE_MS` (10 minutes) are rejected.
4. **Upsert semantics** — The unique constraint on `(profile_id, match_id)` means a second valid signature for the same match updates (not duplicates) the prediction.

### What is NOT verified
- The `signedAt` field in the request body is not used for the expiry check — only the embedded timestamp in the signed `message` string is trusted.
- There is no nonce/counter mechanism; within the 10-minute window a valid signature can be replayed (updating the same prediction row is the only effect, which is benign).

---

## 4. Known Security Gaps

### GAP 1 — xp-events POST has no wallet signature requirement (Medium risk)

**File**: `src/app/api/xp-events/route.ts`

**Issue**: Any caller who knows (or guesses) a wallet address can POST XP events with an arbitrary `sourceId`. The unique constraint on `(wallet_address, source_id)` prevents replay of the *same* `sourceId` but not novel ones.

**Current mitigations**:
- `sourceType` is restricted to a closed enum (`VALID_SOURCE_TYPES` set)
- `xpAmount` is range-guarded to [-1000, 10000]
- `sourceId` max 200 chars, `reason` max 500 chars

**Recommended fix (Phase 2)**:
Move XP settlement entirely server-side. After result sync settles a match, the sync cron job should write `xp_events` rows directly via the service role client — no client-facing POST endpoint needed. If the endpoint must remain public, add `x-admin-key` authentication or require a wallet signature identical to the predictions flow.

---

### GAP 2 — No per-route rate limiting (Low-Medium risk)

**Issue**: No IP-based or wallet-based throttle exists. A bot can submit thousands of prediction attempts per minute.

**Partial mitigation**: Vercel's edge layer provides basic DDoS protection. The kickoff lock and wallet signature requirement limit the blast radius (can only submit one valid prediction per wallet per match).

**Recommended fix (Phase 2)**: Implement rate limiting via Upstash Redis (`@upstash/ratelimit`) at the edge, targeting `POST /api/predictions` and `POST /api/xp-events` at ~10 req/min per IP.

---

### GAP 3 — Admin key transmitted in plaintext HTTP header (Informational)

**Issue**: `x-admin-key` is sent as an HTTP header. Over HTTPS this is encrypted in transit, but the key appears in Vercel access logs.

**Mitigation**: All Vercel deployments run HTTPS. Keys are 32-byte hex secrets. Log access is restricted to project members.

**Recommendation**: Rotate `ADMIN_API_KEY` every 90 days. Do not reuse the key across projects.

---

### GAP 4 — `pointsAwarded` accepted from client body (Low risk)

**File**: `src/app/api/predictions/route.ts`, line ~185

**Issue**: `pointsAwarded` from the request body is stored in the DB if it is `>= 0`. This was originally intended as a convenience for the frontend to send the expected XP. The field is not used for XP calculations (XP is settled by the sync cron writing to `xp_events` based on `is_correct`), but it is stored in the `predictions` row.

**Recommended fix**: Remove `pointsAwarded` from the POST body entirely and set a server-side default (e.g. always 10) unconditionally.

---

## 5. Admin Route Protections

All routes under `/api/admin/` require:
```
x-admin-key: <ADMIN_API_KEY env var>
```

Missing or incorrect key → `401 Unauthorized` (no further information leaked).

Protected routes:
- `POST /api/admin/sync-fixtures` — triggers football data sync
- `POST /api/admin/sync-results` — triggers match result settlement

**Do not expose these URLs in client-side code or public documentation.**

---

## 6. Input Validation Summary

| Field | Route | Checks Applied |
|---|---|---|
| `walletAddress` | All POST routes | Regex `/^0x[0-9a-fA-F]{40}$/i` |
| `matchId` | predictions POST | Non-empty string, max 200 chars |
| `predictedOutcome` | predictions POST | Enum `{H, D, A}` |
| `message` | predictions POST | Non-empty string, starts checked |
| `signature` | predictions POST | Non-empty string, starts with `0x` |
| `sourceType` | xp-events POST | Closed enum (6 values) |
| `sourceId` | xp-events POST | Non-empty, max 200 chars |
| `xpAmount` | xp-events POST | Finite number, range [-1000, 10000] |
| `reason` | xp-events POST | Non-empty, max 500 chars |
| `predictionKey` | wc-predictions POST | Non-empty, max 200 chars |
| `predictionType` | wc-predictions POST | Non-empty, max 100 chars |
| `selectedValue` | wc-predictions POST | Non-empty array, max 10 items, all strings |
| `xpReward` | wc-predictions POST | Finite, non-negative, max 10000 |

---

## 7. Future Recommendations

### Short-term (pre-mainnet scale)
- [ ] Rate limiting on write endpoints (Upstash Redis)
- [ ] Move XP settlement fully server-side (remove unauthenticated xp-events POST)
- [ ] Remove `pointsAwarded` from predictions POST body; use server constant
- [ ] Add request size limit middleware (prevent large JSON body attacks)

### Medium-term (onchain phase)
- [ ] Add random salt to commitment hash inputs before writing to contract
- [ ] Implement commitment batch submission with merkle root (gas-efficient)
- [ ] Formal audit of the commitment scheme before mainnet contract deployment
- [ ] Consider a SIWE (Sign-In with Ethereum) session token approach to replace per-request signatures

### Long-term
- [ ] Multi-sig or timelock on admin operations
- [ ] On-chain result oracle integration (replace trust in football API providers)
- [ ] Slashing or stake mechanism for XP anti-gaming
