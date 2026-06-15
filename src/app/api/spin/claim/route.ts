/**
 * POST /api/spin/claim
 *
 * Step 2 of 2 in the spin flow.
 *
 * Receives the Base transaction hash the client submitted after /api/spin/prepare.
 * Verifies the transaction on-chain, then atomically:
 *   1. Marks spin_entries.status = 'claimed'
 *   2. Inserts into xp_events ledger          (source_type = 'spin')
 *   3. Atomically increments profiles.xp       (via increment_profile_xp RPC)
 *   4. Updates profiles.rank
 *   5. Upserts leaderboard_stats xp/weekly_xp  (spin-specific, no prediction counts)
 *
 * Returns the pre-determined segmentIndex so the client can play the reveal
 * animation landing on the correct wheel segment.
 *
 * Body:    { spinId: string, txHash: string }
 * Returns: { xpAwarded, segmentIndex, newTotalXp, rank, spinsRemaining, nextSpinAt }
 *
 * Anti-abuse:
 *   - spin_entries.tx_hash UNIQUE constraint blocks transaction replay
 *   - status guard (pending → claimed) blocks concurrent double-claims
 *   - expiry check blocks claims on sessions older than 15 minutes
 *   - Base receipt status must be 'success' (reverted tx rejected)
 */

import { type NextRequest, NextResponse }            from 'next/server'
import { getServerSupabaseClient }                   from '@/lib/supabase/server'
import { basePublicClient }                          from '@/lib/auth/verify-base-wallet'
import { computeRank }                               from '@/lib/ranks'
import { updateLeaderboardXpForSpin, getSpinStatus } from '@/lib/spin'
import { trackSpinEvent }                            from '@/lib/spin-analytics'

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/

function err(msg: string, status: number) {
  return NextResponse.json({ success: false, error: msg }, { status })
}

export async function POST(req: NextRequest) {
  // ── 1. Parse + validate body ──────────────────────────────────────────────
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return err('Invalid JSON body', 400) }

  const { spinId, txHash } = body
  if (!spinId  || typeof spinId  !== 'string') return err('spinId is required', 400)
  if (!txHash  || typeof txHash  !== 'string') return err('txHash is required', 400)
  if (!TX_HASH_RE.test(txHash))                return err('Invalid txHash format — expected 0x-prefixed 64-hex', 400)

  const supabase = getServerSupabaseClient()

  // ── 2. Load spin entry ────────────────────────────────────────────────────
  const { data: entry } = await supabase
    .from('spin_entries')
    .select('id, wallet_address, profile_id, xp_amount, segment_index, status, expires_at')
    .eq('id', spinId)
    .maybeSingle()

  if (!entry)                     return err('Spin not found', 404)
  if (entry.status === 'claimed') return err('Spin already claimed', 409)
  if (entry.status === 'expired') return err('Spin session expired — prepare a new spin', 410)

  if (new Date(entry.expires_at as string) < new Date()) {
    await supabase
      .from('spin_entries')
      .update({ status: 'expired' })
      .eq('id', spinId)
    return err('Spin session expired — prepare a new spin', 410)
  }

  // ── 3. Re-verify cooldown at claim time (defence-in-depth) ──────────────
  // prepare/route.ts already checks cooldown, but claim is the final gate.
  // Without this check, a wallet that prepared multiple pending spins before
  // claiming any could claim them back-to-back, bypassing the 8h cooldown.
  const claimStatus = await getSpinStatus(supabase, entry.wallet_address as string)
  if (!claimStatus.canSpin) {
    const eventName = claimStatus.reason === 'daily_limit_reached'
      ? 'spin_daily_limit_block' : 'spin_cooldown_block'
    void trackSpinEvent(eventName, entry.wallet_address as string, {
      spinId, reason: claimStatus.reason, nextSpinAt: claimStatus.nextSpinAt,
    })
    return NextResponse.json({
      success:        false,
      error:          claimStatus.reason === 'daily_limit_reached'
                        ? 'Daily spin limit reached (3 per day)'
                        : `Spin cooldown active — next spin at ${claimStatus.nextSpinAt}`,
      spinsRemaining: claimStatus.spinsRemaining,
      nextSpinAt:     claimStatus.nextSpinAt,
    }, { status: 429 })
  }

  // ── 4. Block transaction replay ───────────────────────────────────────────
  const { data: txConflict } = await supabase
    .from('spin_entries')
    .select('id')
    .eq('tx_hash', txHash)
    .maybeSingle()

  if (txConflict) return err('Transaction already used for a spin', 409)

  // ── 5. Verify transaction on Base mainnet ─────────────────────────────────
  let receipt: Awaited<ReturnType<typeof basePublicClient.getTransactionReceipt>>
  try {
    receipt = await basePublicClient.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return err(`Could not fetch transaction from Base: ${detail}`, 422)
  }

  if (receipt.status !== 'success') {
    return err('Transaction reverted on Base — only successful transactions are accepted', 422)
  }

  // Verify the transaction was sent by the wallet that prepared the spin
  if (receipt.from.toLowerCase() !== (entry.wallet_address as string).toLowerCase()) {
    return err('Transaction sender does not match spin wallet', 422)
  }

  // ── 6. Load profile ───────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, xp')
    .eq('id', entry.profile_id as string)
    .maybeSingle()

  if (!profile) return err('Profile not found', 404)

  const xpAwarded  = entry.xp_amount     as number
  const newXp      = (profile.xp ?? 0) + xpAwarded
  const newRank    = computeRank(newXp)
  const claimedAt  = new Date().toISOString()

  // ── 7. Mark spin claimed (status guard prevents concurrent double-claim) ──
  // Use .select('id') so Supabase returns the updated rows instead of count=null.
  // If another concurrent request claimed this spin first, the .eq('status','pending')
  // guard matches 0 rows and data is [].  Without .select() Supabase v2 always
  // returns count=null, making the 0-row check impossible.
  const { data: claimed, error: claimErr } = await supabase
    .from('spin_entries')
    .update({ status: 'claimed', tx_hash: txHash, claimed_at: claimedAt })
    .eq('id', spinId)
    .eq('status', 'pending')  // only update if still pending — race guard
    .select('id')

  if (claimErr) {
    console.error('[spin/claim] status update:', claimErr)
    return err('Failed to claim spin', 500)
  }
  if (!claimed || claimed.length === 0) {
    void trackSpinEvent('spin_duplicate_claim', entry.wallet_address as string, { spinId, txHash })
    return err('Spin already claimed', 409)
  }

  // ── 8. xp_events ledger ───────────────────────────────────────────────────
  const { error: xpEventErr } = await supabase
    .from('xp_events')
    .insert({
      wallet_address: (entry.wallet_address as string).toLowerCase(),
      source_type:    'spin',
      source_id:      spinId,
      xp_amount:      xpAwarded,
      reason:         'spin_reward',
      metadata: {
        segment_index: entry.segment_index,
        tx_hash:       txHash,
      },
    })

  if (xpEventErr && xpEventErr.code !== '23505') {
    // 23505 = unique_violation — idempotent re-claim, not a real error
    console.error('[spin/claim] xp_events insert:', xpEventErr)
  }

  // ── 9. Atomically increment profiles.xp ──────────────────────────────────
  const { error: xpRpcErr } = await supabase
    .rpc('increment_profile_xp', {
      p_id:    entry.profile_id,
      p_delta: xpAwarded,
    })

  if (xpRpcErr) {
    console.error('[spin/claim] increment_profile_xp:', xpRpcErr)
  }

  // ── 10. Update profiles.rank ──────────────────────────────────────────────
  await supabase
    .from('profiles')
    .update({ rank: newRank })
    .eq('id', entry.profile_id as string)

  // ── 11. Leaderboard XP (spin-specific — no prediction count changes) ─────
  const lbResult = await updateLeaderboardXpForSpin(
    supabase,
    entry.profile_id as string,
    xpAwarded,
  )
  if (!lbResult.success) {
    console.error('[spin/claim] leaderboard_stats errors:', lbResult.errors)
  }

  // ── 12. Analytics ────────────────────────────────────────────────────────
  const walletAddr = entry.wallet_address as string
  void trackSpinEvent('spin_claim', walletAddr, { spinId, txHash })
  void trackSpinEvent('spin_reward', walletAddr, {
    spinId,
    txHash,
    xpAwarded,
    segmentIndex: entry.segment_index,
    newTotalXp:   newXp,
    rank:         newRank,
  })

  // ── 13. Return outcome for animation ─────────────────────────────────────
  const spinStatus = await getSpinStatus(supabase, walletAddr)

  return NextResponse.json({
    success:        true,
    xpAwarded,
    segmentIndex:   entry.segment_index,
    newTotalXp:     newXp,
    rank:           newRank,
    spinsRemaining: spinStatus.spinsRemaining,
    nextSpinAt:     spinStatus.nextSpinAt,
  })
}
