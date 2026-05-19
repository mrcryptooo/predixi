# PrediXI — Supabase Setup Guide

## Phase 4A — Foundation Only

This phase prepares the database schema and client utilities.
**The app UI still runs entirely on mock data.** Supabase is not required for the app to build or run.

---

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Choose a name (e.g. `predixi`) and a strong database password
3. Select the **closest region** to your users
4. Wait for provisioning (~1 minute)

---

## 2. Run the schema

1. In your Supabase project, go to **SQL Editor** → **New query**
2. Paste the entire contents of `supabase/schema.sql`
3. Click **Run**
4. Verify all 6 tables appear in **Table Editor**:
   - `profiles`
   - `matches`
   - `predictions`
   - `leaderboard_stats`
   - `badges`
   - `user_badges`

---

## 3. Get your environment variables

In your Supabase project: **Settings → API**

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (e.g. `https://xxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` / `public` key |

**Never use the `service_role` key on the client.**

---

## 4. Configure environment variables

### Local development

Add to `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### Production (Vercel)

Vercel Dashboard → Project → **Settings → Environment Variables**

Add both variables above scoped to **Production** (and optionally Preview).

---

## 5. What Phase 4A does NOT do

- ❌ Does not replace mock data in the UI
- ❌ Does not require a Supabase connection to build or run
- ❌ Does not send any blockchain transactions
- ❌ Does not sign any messages
- ❌ Does not perform any data migration

---

## 6. What comes next (Phase 4B)

- Wire prediction submission to write `predictions` rows
- Create/update `profiles` row on wallet connect
- Add wallet-scoped RLS write policies
- Seed `badges` and `matches` tables from mock data
- Show real leaderboard from `leaderboard_stats`

---

## Schema overview

```
profiles          ← one row per wallet address
  └── predictions ← one per (profile, match), outcome = H/D/A
  └── user_badges ← junction to badges earned
  └── leaderboard_stats ← computed snapshot (backend-managed)

matches           ← fixture data, actual_outcome set on settlement
badges            ← static definitions, admin-seeded
```

## RLS policy summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | ✅ public | 🔒 service role | 🔒 service role | 🔒 service role |
| `matches` | ✅ public | 🔒 service role | 🔒 service role | 🔒 service role |
| `predictions` | ✅ public | 🔒 service role | 🔒 service role | 🔒 service role |
| `leaderboard_stats` | ✅ public | 🔒 service role | 🔒 service role | 🔒 service role |
| `badges` | ✅ public | 🔒 service role | 🔒 service role | 🔒 service role |
| `user_badges` | ✅ public | 🔒 service role | 🔒 service role | 🔒 service role |

Phase 4B will add INSERT/UPDATE policies scoped to authenticated wallet owners for `predictions` and `profiles`.
