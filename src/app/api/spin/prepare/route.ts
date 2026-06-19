/**
 * POST /api/spin/prepare
 *
 * Step 1 of 2 in the spin flow.
 *
 * Pre-determines the spin outcome server-side and stores it in spin_entries
 * with status='pending'.  The XP amount and segment index are committed before
 * the client executes any Base transaction — the animation only reveals what
 * was already decided here.
 *
 * Auth:    x-wallet-message + x-wallet-signature headers (EIP-191 / ERC-1271)
 * Body:    { walletAddress: string }
 * Returns: { spinId, expiresAt, spinsRemaining, nextSpinAt }
 *
 * Cooldown rules (enforced here):
 *   - Max 3 claimed spins per rolling 24-hour window
 *   - Min 8 hours between consecutive claimed spins
 *   - Only one pending spin allowed per wallet at a time
 *     (stale pending entries are expired before a new one is created)
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'
import {
  selectSpinOutcome,
  getSpinStatus,
  SPIN_EXPIRY_MINUTES,
}                                         from '@/lib/spin'
import { trackSpinEvent }                 from '@/lib/spin-analytics'
import { checkRateLimit }                 from '@/lib/ratelimit'

function err(msg: string, status: number) {
  return NextResponse.json({ success: false, error: msg }, { status })
}

export async function POST(req: NextRequest) {
  // ── 0. IP rate limit (Upstash Redis — persistent across Vercel instances) ──
  // 5 requests per minute per IP.  Falls through silently if Redis is not
  // configured (UPSTASH_REDIS_REST_URL / TOKEN unset).
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl  = await checkRateLimit('spin:prepare:ip', ip, 5, '1 m')
  if (rl.limited) {
    return NextResponse.json(
      { success: false, error: 'Too many requests — try again shortly' },
      { status: 429 },
    )
  }

  // ── 1. Parse body ──────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return err('Invalid JSON body', 400) }

  const { walletAddress } = body
  if (!walletAddress || typeof walletAddress !== 'string') {
    return err('walletAddress is required', 400)
  }

  const wallet = walletAddress.toLowerCase()

  const supabase = getServerSupabaseClient()

  // ── 2. Resolve or create profile ────────────────────────────────────────
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .upsert(
      { wallet_address: wallet },
      { onConflict: 'wallet_address' },
    )
    .select('id')
    .single()

  if (profileErr || !profile) {
    console.error('[spin/prepare] profile upsert:', profileErr)
    return err('Failed to create or fetch profile', 500)
  }

  // ── 3. Cooldown + daily-limit check ───────────────────────────────────────
  const status = await getSpinStatus(supabase, wallet)
  if (!status.canSpin) {
    const eventName = status.reason === 'daily_limit_reached'
      ? 'spin_daily_limit_block'
      : 'spin_cooldown_block'
    void trackSpinEvent(eventName, wallet, {
      reason:         status.reason,
      spinsRemaining: status.spinsRemaining,
      nextSpinAt:     status.nextSpinAt,
    })
    return NextResponse.json({
      success:        false,
      error:          status.reason === 'daily_limit_reached'
                        ? 'Daily spin limit reached (3 per day)'
                        : `Spin cooldown active — next spin at ${status.nextSpinAt}`,
      spinsRemaining: status.spinsRemaining,
      nextSpinAt:     status.nextSpinAt,
      cooldownActive: status.cooldownActive,
    }, { status: 429 })
  }

  // ── 4. Idempotent pending spin — return existing rather than stacking ────
  // Expire stale pending entries first, then check for a live one.
  // If a non-expired pending spin already exists for this wallet, return it
  // rather than creating a second one.  This closes the race where two quick
  // prepare calls produce two claimable spins that can both bypass the 8h
  // cooldown (cooldown is checked at prepare-time against claimed spins only).
  await supabase
    .from('spin_entries')
    .update({ status: 'expired' })
    .eq('wallet_address', wallet)
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString())

  const { data: existingPending } = await supabase
    .from('spin_entries')
    .select('id, expires_at')
    .eq('wallet_address', wallet)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (existingPending) {
    void trackSpinEvent('spin_prepare', wallet, {
      spinId:         existingPending.id,
      spinsRemaining: status.spinsRemaining,
      nextSpinAt:     status.nextSpinAt,
      isIdempotent:   true,
    })
    return NextResponse.json({
      success:        true,
      spinId:         existingPending.id,
      expiresAt:      existingPending.expires_at,
      spinsRemaining: status.spinsRemaining,
      nextSpinAt:     status.nextSpinAt,
    })
  }

  // ── 5. Pre-determine outcome (server-side, before animation) ──────────────
  const outcome   = selectSpinOutcome()
  const expiresAt = new Date(
    Date.now() + SPIN_EXPIRY_MINUTES * 60 * 1000,
  ).toISOString()

  const { data: entry, error: insertErr } = await supabase
    .from('spin_entries')
    .insert({
      wallet_address: wallet,
      profile_id:     profile.id,
      xp_amount:      outcome.xp,
      segment_index:  outcome.segmentIndex,
      status:         'pending',
      expires_at:     expiresAt,
    })
    .select('id')
    .single()

  if (insertErr || !entry) {
    console.error('[spin/prepare] insert error:', insertErr)
    return err('Failed to prepare spin — please try again', 500)
  }

  // ── 6. Return session token (outcome is NOT revealed yet) ─────────────────
  void trackSpinEvent('spin_prepare', wallet, {
    spinId:         entry.id,
    spinsRemaining: status.spinsRemaining,
    nextSpinAt:     status.nextSpinAt,
    isIdempotent:   false,
  })

  return NextResponse.json({
    success:        true,
    spinId:         entry.id,
    expiresAt,
    spinsRemaining: status.spinsRemaining,
    nextSpinAt:     status.nextSpinAt,
  })
}
