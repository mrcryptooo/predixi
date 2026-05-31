/**
 * API Route — /api/badges
 *
 * GET /api/badges?walletAddress=0x...
 *
 * Returns the earned badges for a given wallet address by querying
 * the user_badges table. Read-only — no writes, no badge awards here.
 *
 * Response:
 *   {
 *     ok:             true,
 *     earnedBadgeIds: string[],          // badge IDs the wallet has earned
 *     earnedBadges:   { badgeId: string, earnedAt: string }[]
 *   }
 *
 * If the wallet has no profile or has earned no badges the arrays are
 * empty — not an error.
 *
 * Phase B (not yet): badge award engine will write to user_badges.
 * This route is intentionally read-only for Phase A.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isValidAddress(addr: unknown): addr is string {
  return typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/i.test(addr.trim())
}

function err(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/badges?walletAddress=0x...
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const walletAddress = req.nextUrl.searchParams.get('walletAddress')

  if (!walletAddress) {
    return err('walletAddress query parameter is required', 400)
  }
  if (!isValidAddress(walletAddress)) {
    return err('Invalid walletAddress — must be a 0x Ethereum address', 400)
  }

  const normalized = walletAddress.toLowerCase()

  try {
    const supabase = getServerSupabaseClient()

    // ── 1. Resolve profile ID ─────────────────────────────────────────────────
    // user_badges is keyed by profile UUID — we need to look it up first.
    // If no profile exists yet (new wallet), return empty arrays — not an error.
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('wallet_address', normalized)
      .maybeSingle()

    if (profileErr) {
      console.error('[GET /api/badges] profile lookup:', profileErr)
      return err('Failed to look up profile', 500)
    }

    if (!profile) {
      // Wallet exists but has never connected — no badges possible yet.
      return NextResponse.json({
        ok:             true,
        earnedBadgeIds: [] as string[],
        earnedBadges:   [] as { badgeId: string; earnedAt: string }[],
      })
    }

    // ── 2. Fetch earned badges for this profile ───────────────────────────────
    // user_badges has a UNIQUE (profile_id, badge_id) constraint — no dupes.
    const { data: userBadges, error: badgesErr } = await supabase
      .from('user_badges')
      .select('badge_id, awarded_at')
      .eq('profile_id', profile.id)
      .order('awarded_at', { ascending: true })   // oldest first → consistent order

    if (badgesErr) {
      console.error('[GET /api/badges] user_badges query:', badgesErr)
      return err('Failed to fetch badges', 500)
    }

    const rows = userBadges ?? []

    return NextResponse.json({
      ok:             true,
      earnedBadgeIds: rows.map(r => r.badge_id),
      earnedBadges:   rows.map(r => ({
        badgeId:  r.badge_id,
        earnedAt: r.awarded_at,
      })),
    })
  } catch (error) {
    console.error('[GET /api/badges] unhandled:', error)
    return err('Internal server error', 500)
  }
}
