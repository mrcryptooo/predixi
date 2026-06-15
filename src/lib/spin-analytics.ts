// ─────────────────────────────────────────────────────────────────────────────
// Spin Analytics — lightweight server-side event tracking for the SPIN feature.
//
// Events are written to the spin_analytics_events table.
// Requires the migration in supabase/add-spin-analytics.sql to be applied.
//
// IMPORTANT: trackSpinEvent never throws — analytics failures must never
// break the main spin flow.
// ─────────────────────────────────────────────────────────────────────────────

import { getServerSupabaseClient } from '@/lib/supabase/server'

// ── Event names ───────────────────────────────────────────────────────────────

export type SpinEventName =
  | 'spin_prepare'          // wallet called /api/spin/prepare successfully
  | 'spin_claim'            // wallet called /api/spin/claim (tx submitted)
  | 'spin_reward'           // XP awarded after successful claim
  | 'spin_cooldown_block'   // prepare or claim rejected due to 8h cooldown
  | 'spin_daily_limit_block'// prepare or claim rejected due to 3/day limit
  | 'spin_tx_invalid'       // transaction verification failed on Base
  | 'spin_expired'          // spin session expired before claim
  | 'spin_duplicate_claim'  // concurrent double-claim blocked

// ── Payloads ──────────────────────────────────────────────────────────────────

export type SpinPreparePayload = {
  spinId:         string
  spinsRemaining: number
  nextSpinAt:     string | null
  isIdempotent?:  boolean   // true when returning existing pending spin
}

export type SpinClaimPayload = {
  spinId:       string
  txHash:       string
  xpAwarded:    number
  segmentIndex: number
  newTotalXp:   number
  rank:         string
}

export type SpinBlockPayload = {
  reason:         string
  spinsRemaining: number
  nextSpinAt:     string | null
}

// ── Core tracker ─────────────────────────────────────────────────────────────

export async function trackSpinEvent(
  event:      SpinEventName,
  wallet:     string | null,
  properties: Record<string, unknown> = {},
): Promise<void> {
  try {
    const supabase = getServerSupabaseClient()
    const { error } = await supabase
      .from('spin_analytics_events')
      .insert({
        event_name:  event,
        wallet:      wallet ? wallet.toLowerCase() : null,
        properties:  { ...properties, recorded_at: new Date().toISOString() },
      })
    if (error) {
      // Table may not exist yet (migration pending) — degrade gracefully
      console.warn('[spin-analytics] insert skipped:', error.code, error.message)
    }
  } catch (e) {
    console.error('[spin-analytics] track error (non-fatal):', e)
  }
}
