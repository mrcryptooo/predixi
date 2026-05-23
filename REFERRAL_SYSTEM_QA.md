# Referral System — QA & Deployment Guide

## Overview

The PrediXI referral system lets users share a personal referral link. When a new user
connects their wallet via that link, the referrer earns **200 XP** immediately. After
registration, the referrer also earns **10% of every XP event** the referred user generates
(predictions, Daily XI, daily streaks). Rewards are XP only — no tokens, no money.

---

## File Map

| File | Role |
|------|------|
| `supabase/add-referrals.sql` | DB schema: adds columns to `profiles`, creates `referrals` table, extends `xp_events` check constraint, SQL helper function |
| `src/hooks/useReferralCapture.ts` | Client: captures `?ref=` URL param → localStorage, fires signed registration on wallet connect |
| `src/app/providers.tsx` | Mounts `useReferralCapture` app-wide via `AppEffects` inner component |
| `src/lib/referrals/registerReferral.ts` | Server: core registration logic (guards, DB writes, 200 XP award) |
| `src/app/api/referrals/register/route.ts` | POST endpoint: validates headers, verifies EIP-191 signature, rate-limits, delegates to `registerReferral` |
| `src/app/api/referrals/me/route.ts` | GET endpoint: returns referral code, link, referral count, total referral XP |
| `src/components/profile/ReferralCard.tsx` | Profile UI: displays code, copy-link button, stats |
| `src/lib/referrals/awardReferralBonus.ts` | Server helper: awards 10% XP bonus to referrer after each referred-user XP event |
| `src/lib/settlement.ts` | Integration: calls `awardReferralBonus` after match prediction XP |
| `src/lib/worldcup-settlement.ts` | Integration: calls `awardReferralBonus` after World Cup prediction XP |
| `src/app/api/daily-streak/route.ts` | Integration: calls `awardReferralBonus` after daily streak XP |
| `src/app/api/cron/score-daily-xi/route.ts` | Integration: calls `awardReferralBonus` after Daily XI scoring |
| `src/app/api/admin/score-daily-xi/route.ts` | Integration: calls `awardReferralBonus` after admin Daily XI scoring |

---

## Manual Test Checklist

### A — Referral link capture

- [ ] Visit `/?ref=TESTCODE1` — check localStorage key `predixi_pending_referral_code` = `TESTCODE1`
- [ ] Visit `/?ref=testcode1` (lowercase) — key should be normalized to `TESTCODE1`
- [ ] Visit `/?ref=!!BAD!!` — key should NOT be written (invalid format)
- [ ] Visit `/?ref=NEWCODE` when `predixi_pending_referral_code` already exists — old code should be kept (first-referrer wins)
- [ ] Visit any page without `?ref=` — no key written

### B — Registration happy path

1. Referrer has wallet A with referral code `XXXXXXXX` (visible in Profile → Referral Program)
2. Open app in incognito / different wallet as wallet B
3. Visit `/?ref=XXXXXXXX`
4. Connect wallet B — signature popup appears
5. Sign → referral registered
6. Check wallet A's Profile: referral count increments, referral XP shows 200

### C — Error handling in the hook

| Scenario | Expected |
|----------|----------|
| Own link (`?ref=` = own code) | Signature prompt appears, API returns `SELF_REFERRAL_NOT_ALLOWED`, localStorage cleared, no re-prompt |
| Code that doesn't exist | `REFERRAL_CODE_NOT_FOUND`, localStorage cleared |
| Already referred by a different user | `ALREADY_REFERRED_BY_ANOTHER_USER`, localStorage cleared |
| Existing active user past 7-day grace | `ALREADY_ACTIVE_USER_CANNOT_BE_REFERRED`, localStorage cleared, no infinite re-prompt |
| Same referral registered twice (idempotent) | `already_registered` (200 OK), localStorage cleared |
| Signature rejected by user | localStorage kept, wallet still in `attemptedWallets` — no re-prompt this session |
| Network error | localStorage kept, wallet removed from `attemptedWallets` — retries next page load |

### D — Referral bonus (10% XP pass-through)

For each XP-awarding action by a referred user, confirm the referrer receives 10%:

| Action | Referred XP | Referrer bonus |
|--------|------------|----------------|
| Daily streak claim | 5 XP | 0 XP (rounds to 0 — floor(5 × 0.10) = 0) |
| Daily XI entry | varies | floor(XP × 0.10) |
| Match prediction win | varies | floor(XP × 0.10) |
| World Cup prediction win | varies | floor(XP × 0.10) |

> **Note:** Daily streak bonus rounds to zero at 10% of 5 XP. This is by design (integer floor).
> Increase `future_bonus_bps` in the `referrals` row or `XP_REWARD` in the streak route if desired.

### E — Rate limiting

- [ ] Send 6 POST requests to `/api/referrals/register` from the same authenticated wallet within 60 seconds
- [ ] Requests 1–5: normal responses
- [ ] Request 6+: `429 { ok: false, error: "RATE_LIMITED" }`

### F — Referral card UI

- [ ] Profile page → "Referral Program" section visible
- [ ] Referral code shown as uppercase pill
- [ ] Referral link = `{origin}/?ref={code}`
- [ ] Copy button writes link to clipboard
- [ ] Referral count and XP stats display correctly
- [ ] "Rewards are XP-only" disclaimer visible

---

## Supabase Verification Queries

```sql
-- All referrals
SELECT referrer_wallet, referred_wallet, referral_code, status,
       direct_reward_xp, future_bonus_bps, completed_at, direct_rewarded_at
FROM referrals
ORDER BY completed_at DESC;

-- Referral reward events (200 XP each)
SELECT wallet_address, xp_amount, source_id, created_at
FROM xp_events
WHERE source_type = 'referral_reward'
ORDER BY created_at DESC;

-- Referral bonus events (10% pass-through)
SELECT wallet_address, xp_amount, source_id, metadata, created_at
FROM xp_events
WHERE source_type = 'referral_bonus'
ORDER BY created_at DESC;

-- Check for duplicate XP events (should return 0 rows)
SELECT source_type, source_id, COUNT(*) AS cnt
FROM xp_events
GROUP BY source_type, source_id
HAVING COUNT(*) > 1;

-- Referred-by stamp on profiles
SELECT wallet_address, referral_code, referred_by_wallet, referred_at
FROM profiles
WHERE referred_by_wallet IS NOT NULL
ORDER BY referred_at DESC;

-- Sanity: profiles where referral_code is NULL (should be 0 after backfill)
SELECT COUNT(*) FROM profiles WHERE referral_code IS NULL;
```

---

## Expected API Responses

### POST /api/referrals/register

```
# Success — new registration
200 { ok: true, status: "registered", referrerWallet: "0x...", xpAwarded: 200 }

# Success — idempotent re-registration
200 { ok: true, status: "already_registered", referrerWallet: "0x...", xpAwarded: 0 }

# Errors
400 { ok: false, error: "INVALID_REFERRAL_CODE" }
401 { ok: false, error: "SIGNATURE_REQUIRED" }
401 { ok: false, error: "INVALID_SIGNATURE" }
404 { ok: false, error: "REFERRAL_CODE_NOT_FOUND" }
409 { ok: false, error: "SELF_REFERRAL_NOT_ALLOWED" }
409 { ok: false, error: "ALREADY_REFERRED_BY_ANOTHER_USER" }
409 { ok: false, error: "ALREADY_ACTIVE_USER_CANNOT_BE_REFERRED" }
429 { ok: false, error: "RATE_LIMITED" }
500 { ok: false, error: "REFERRAL_REGISTER_FAILED" }
```

### GET /api/referrals/me?wallet=0x...

```
200 {
  ok: true,
  referralCode: "ABCD1234",
  referralLink: "https://predixi-base.vercel.app/?ref=ABCD1234",
  referralCount: 3,
  referralXp: 750
}

400 { ok: false, error: "wallet query parameter is required" }
400 { ok: false, error: "Invalid wallet address" }
500 { ok: false, error: "..." }
```

---

## Known Limitations

| Limitation | Impact | Mitigation |
|-----------|--------|------------|
| In-memory rate limiter resets on serverless cold start | Burst abuse possible across cold starts | Covers same-session spam; persistent Redis would be required for stronger guarantees |
| Daily streak bonus rounds to 0 XP | Referrer gets no bonus from 5 XP streak claims | By design (integer floor). Acceptable; streak XP is low-value |
| No UI notification when referral is registered | User doesn't see confirmation toast | Can add in a follow-up — hook has `data.status === 'registered'` check ready |
| `future_bonus_bps` stored per referral row | Changing the global bonus % doesn't affect existing referrals | Insert-time snapshot is intentional (contract-like) |
| No referral expiry | Old pending `?ref=` codes stay in localStorage until cleared | Cleared on all terminal error states; 7-day grace window limits abuse |

---

## Deployment Checklist

- [ ] Run `supabase/add-referrals.sql` against the production database
  - Adds `referral_code`, `referred_by_wallet`, `referred_at` columns to `profiles`
  - Creates `referrals` table
  - Backfills `referral_code` for all existing profiles
  - Extends `xp_events` source_type check constraint
- [ ] Verify backfill: `SELECT COUNT(*) FROM profiles WHERE referral_code IS NULL` → 0
- [ ] Deploy Next.js app to Vercel
- [ ] Spot-check one referral flow end-to-end in production
- [ ] Confirm `CRON_SECRET` and `ADMIN_SETTLEMENT_KEY` env vars are set on Vercel (used by the score-daily-xi routes that call `awardReferralBonus`)
- [ ] Monitor `xp_events` for `referral_bonus` rows after first real user activity
