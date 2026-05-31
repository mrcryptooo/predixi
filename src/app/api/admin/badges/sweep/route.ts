/**
 * POST /api/admin/badges/sweep
 *
 * Admin-only retroactive badge backfill.
 *
 * Scans existing profiles and awards all simple badges they are eligible for
 * but have not yet received.  Safe to re-run: the underlying award logic is
 * fully idempotent (user_badges UNIQUE constraint + xp_events UNIQUE constraint
 * prevent any double-award or double-XP, regardless of how many times this
 * route is called).
 *
 * ── Auth ─────────────────────────────────────────────────────────────────────
 *
 *   Header:   x-admin-key: <ADMIN_SETTLEMENT_KEY>
 *   Same key used by all other /api/admin/* routes.
 *   Never expose the key in logs or response bodies.
 *
 * ── Request body ─────────────────────────────────────────────────────────────
 *
 *   {
 *     "dryRun": true,       // (optional, default false)
 *                           // true  → check eligibility but make NO DB writes
 *                           // false → award badges, update XP and leaderboard
 *     "limit":  200         // (optional, default 200, max 500)
 *                           // number of profiles to scan in this run
 *                           // Run multiple times with offset to cover more
 *   }
 *
 * ── Response ─────────────────────────────────────────────────────────────────
 *
 *   {
 *     "ok": true,
 *     "dryRun": false,
 *     "scannedProfiles": 42,
 *     "awardedBadges": 7,
 *     "errors": 0,
 *     "details": [
 *       {
 *         "wallet": "0x1234…5678",
 *         "awarded": [{ "badgeId": "first-pred", "badgeName": "First Touch", "xpAwarded": 50 }]
 *       }
 *       // ... one entry per profile that received at least one badge
 *     ]
 *   }
 *
 * ── Badges covered by this sweep ─────────────────────────────────────────────
 *
 *   ✅ first-pred      — total match predictions ≥ 1
 *   ✅ centurion       — total match predictions ≥ 100
 *   ✅ veteran         — total match predictions ≥ 250
 *   ✅ worldcup-2026   — WC predictions ≥ 10
 *   ✅ early-adopter   — profile created before SEASON_1_END_DATE (2026-09-01)
 *
 * ── Badges DEFERRED to Phase D2 ──────────────────────────────────────────────
 *
 *   ❌ streak-3/5/9/10    — requires ordered correct-prediction streak calculation
 *   ❌ sharp-eye          — requires ≥50 predictions + 60%+ accuracy check
 *   ❌ oracle             — requires ≥200 predictions + 70%+ accuracy check
 *   ❌ hat-trick          — requires 3+ correct on same matchday grouping
 *   ❌ pl/la-liga/bundesliga/ligue1/ucl-expert — per-league accuracy queries
 *   ❌ el-clasico         — requires fixture metadata tagging (match IDs)
 *   ❌ worldcup-champion  — requires WC 2026 final result (future)
 *
 * ── How to run ───────────────────────────────────────────────────────────────
 *
 *   Dry-run (safe, no writes):
 *     curl -X POST https://predixi-base.vercel.app/api/admin/badges/sweep \
 *       -H "Content-Type: application/json" \
 *       -H "x-admin-key: <ADMIN_SETTLEMENT_KEY>" \
 *       -d '{"dryRun":true}'
 *
 *   Live run (awards badges and XP):
 *     curl -X POST https://predixi-base.vercel.app/api/admin/badges/sweep \
 *       -H "Content-Type: application/json" \
 *       -H "x-admin-key: <ADMIN_SETTLEMENT_KEY>" \
 *       -d '{"dryRun":false,"limit":200}'
 *
 *   Idempotency: safe to re-run as many times as needed.
 *   No profile is double-awarded; no XP is double-counted.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'
import { checkAndAwardBadges }            from '@/lib/badges/checkAndAward'

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 200
const MAX_LIMIT     = 500

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function err(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/badges/sweep
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── 1. Admin auth — same pattern as all /api/admin/* routes ────────────────
  const adminKey = process.env.ADMIN_SETTLEMENT_KEY
  if (!adminKey) {
    console.error('[admin/badges/sweep] ADMIN_SETTLEMENT_KEY env var not set')
    return err('Admin key not configured on this server', 500)
  }
  if (req.headers.get('x-admin-key') !== adminKey) {
    return err('Unauthorized', 401)
  }

  // ── 2. Parse body ──────────────────────────────────────────────────────────
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* empty body is fine */ }

  const dryRun = body.dryRun === true
  const rawLimit = typeof body.limit === 'number' ? body.limit : DEFAULT_LIMIT
  const limit    = Math.min(Math.max(1, Math.floor(rawLimit)), MAX_LIMIT)

  console.log(`[admin/badges/sweep] starting — dryRun=${dryRun} limit=${limit}`)

  // ── 3. Fetch profiles ──────────────────────────────────────────────────────
  const supabase = getServerSupabaseClient()

  const { data: profiles, error: profilesErr } = await supabase
    .from('profiles')
    .select('id, wallet_address, created_at')
    .order('created_at', { ascending: true })  // oldest first = most likely to earn early-adopter
    .limit(limit)

  if (profilesErr) {
    console.error('[admin/badges/sweep] profiles fetch:', profilesErr)
    return err('Failed to fetch profiles', 500)
  }

  const rows = profiles ?? []
  if (rows.length === 0) {
    return NextResponse.json({
      ok:              true,
      dryRun,
      scannedProfiles: 0,
      awardedBadges:   0,
      errors:          0,
      details:         [],
    })
  }

  // ── 4. Sweep each profile ──────────────────────────────────────────────────
  type SweepDetail = {
    wallet:   string
    awarded:  { badgeId: string; badgeName: string; xpAwarded: number }[]
  }

  const details: SweepDetail[] = []
  let totalAwarded = 0
  let errorCount   = 0

  for (const profile of rows) {
    const walletAddress    = profile.wallet_address as string
    const profileId        = profile.id             as string
    const profileCreatedAt = profile.created_at     as string

    try {
      const awarded = await checkAndAwardBadges({
        walletAddress,
        profileId,
        profileCreatedAt,
        trigger: 'admin_sweep',
        supabase,
        dryRun,
      })

      if (awarded.length > 0) {
        totalAwarded += awarded.length
        details.push({ wallet: walletAddress, awarded })
      }
    } catch (sweepErr) {
      // One profile failure must not stop the whole sweep
      errorCount++
      console.error(
        `[admin/badges/sweep] error processing profile ${profileId}:`,
        sweepErr instanceof Error ? sweepErr.message : String(sweepErr),
      )
    }
  }

  console.log(
    `[admin/badges/sweep] done — scanned=${rows.length} awarded=${totalAwarded} errors=${errorCount} dryRun=${dryRun}`,
  )

  return NextResponse.json({
    ok:              true,
    dryRun,
    scannedProfiles: rows.length,
    awardedBadges:   totalAwarded,
    errors:          errorCount,
    details,
  })
}
