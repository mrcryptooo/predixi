/**
 * awardReferralBonus — awards 10% XP to a referrer when a referred user earns XP.
 *
 * Called after any normal XP event is successfully inserted.
 * Never throws — returns a result object on all paths.
 * Failure is logged internally and is non-fatal to the caller.
 *
 * ── Exclusion list (no referral bonus on these source_types) ─────────────────
 *   referral_reward  — the initial 200 XP for referring someone
 *   referral_bonus   — a bonus already IS a referral bonus (recursion guard)
 *   admin_adjustment — manual corrections; not eligible
 *   badge            — not yet awarded; excluded for consistency
 *   mission          — not yet awarded; excluded for consistency
 *
 * ── Duplicate safety ─────────────────────────────────────────────────────────
 *   source_id is deterministic:
 *     referral-bonus:{referrerWallet}:{originalSourceType}:{originalSourceId}
 *   xp_events unique constraint fires on retry → graceful no-op (code 23505).
 *
 * ── Bonus calculation ────────────────────────────────────────────────────────
 *   bonusXp = floor(originalXp * futureBonusBps / 10_000)
 *   futureBonusBps comes from referrals.future_bonus_bps (default 1000 = 10%).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import type { SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_BONUS_BPS = 1000   // 10% = 1000 / 10 000

/**
 * source_type values that must NEVER trigger a referral bonus.
 * Prevents recursion and excludes administrative XP.
 */
const EXCLUDED_SOURCE_TYPES = new Set([
  'referral_reward',
  'referral_bonus',
  'admin_adjustment',
  'badge',
  'mission',
])

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AwardReferralBonusInput = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase:           SupabaseClient<any>
  referredWallet:     string   // wallet of the user who earned XP (lowercase)
  originalXp:         number   // the XP amount the referred user earned
  originalSourceType: string   // source_type of the triggering xp_events row
  originalSourceId:   string   // source_id of the triggering xp_events row
}

export type AwardReferralBonusResult = {
  awarded:         boolean
  bonusXp?:        number
  referrerWallet?: string
  reason?:         string   // human-readable, for logs only
}

// ─────────────────────────────────────────────────────────────────────────────
// Main function
// ─────────────────────────────────────────────────────────────────────────────

export async function awardReferralBonus(
  input: AwardReferralBonusInput,
): Promise<AwardReferralBonusResult> {
  const {
    supabase,
    referredWallet,
    originalXp,
    originalSourceType,
    originalSourceId,
  } = input

  try {
    // ── 1. Exclusion guard — no recursion, no admin XP ───────────────────────
    if (EXCLUDED_SOURCE_TYPES.has(originalSourceType)) {
      return { awarded: false, reason: `excluded-source-type:${originalSourceType}` }
    }

    // ── 2. Zero-XP guard — nothing to share ──────────────────────────────────
    if (originalXp <= 0) {
      return { awarded: false, reason: 'original-xp-zero' }
    }

    // ── 3. Look up referrer from referrals table ──────────────────────────────
    // Prefer referrals table (has future_bonus_bps) over profiles.referred_by_wallet.
    const { data: referralRow, error: referralErr } = await supabase
      .from('referrals')
      .select('referrer_wallet, future_bonus_bps')
      .eq('referred_wallet', referredWallet)
      .eq('status', 'completed')
      .maybeSingle()

    if (referralErr) {
      console.error('[awardReferralBonus] referral lookup:', referralErr.message)
      return { awarded: false, reason: 'referral-lookup-error' }
    }

    if (!referralRow) {
      return { awarded: false, reason: 'no-referrer' }
    }

    const referrerWallet: string = referralRow.referrer_wallet
    const bonusBps: number       = referralRow.future_bonus_bps ?? DEFAULT_BONUS_BPS

    // ── 4. Calculate bonus (integer floor) ────────────────────────────────────
    const bonusXp = Math.floor((originalXp * bonusBps) / 10_000)

    if (bonusXp <= 0) {
      return { awarded: false, referrerWallet, reason: 'bonus-rounds-to-zero' }
    }

    // ── 5. Insert xp_events for referrer (duplicate-safe) ────────────────────
    const sourceId = `referral-bonus:${referrerWallet}:${originalSourceType}:${originalSourceId}`

    const { error: xpErr } = await supabase
      .from('xp_events')
      .insert({
        wallet_address: referrerWallet,
        source_type:    'referral_bonus',
        source_id:      sourceId,
        xp_amount:      bonusXp,
        reason:         'referral_bonus',
        metadata: {
          referred_wallet:      referredWallet,
          original_source_type: originalSourceType,
          original_source_id:   originalSourceId,
          original_xp:          originalXp,
          bonus_bps:            bonusBps,
        },
      })

    if (xpErr) {
      if (xpErr.code === '23505') {
        // Already awarded for this exact original event — idempotent, not an error
        return { awarded: false, referrerWallet, bonusXp, reason: 'already-awarded' }
      }
      console.error('[awardReferralBonus] xp_events insert:', xpErr)
      return { awarded: false, referrerWallet, bonusXp, reason: 'xp-insert-error' }
    }

    // ── 6 + 7. Increment referrer profiles.xp and leaderboard_stats ─────────
    // Single profiles query — id is reused for leaderboard lookup below.
    let profileId: string | undefined

    try {
      const { data: refProf } = await supabase
        .from('profiles')
        .select('id, xp')
        .eq('wallet_address', referrerWallet)
        .maybeSingle()

      if (refProf) {
        profileId = refProf.id as string
        await supabase
          .from('profiles')
          .update({ xp: (refProf.xp ?? 0) + bonusXp })
          .eq('id', refProf.id)
      }
    } catch (e) {
      console.warn('[awardReferralBonus] profiles.xp update skipped:', e)
    }

    // ── 7. Increment referrer leaderboard_stats (all_time + weekly) ───────────
    try {
      if (profileId) {
        const now = new Date().toISOString()

        for (const period of ['all_time', 'weekly'] as const) {
          const { data: lbRow } = await supabase
            .from('leaderboard_stats')
            .select('id, xp, weekly_xp')
            .eq('profile_id', profileId)
            .eq('period', period)
            .maybeSingle()

          if (lbRow) {
            await supabase
              .from('leaderboard_stats')
              .update({
                xp:          (lbRow.xp ?? 0) + bonusXp,
                weekly_xp:   period === 'weekly'
                  ? (lbRow.weekly_xp ?? 0) + bonusXp
                  : (lbRow.weekly_xp ?? 0),
                computed_at: now,
              })
              .eq('id', lbRow.id)
          } else {
            await supabase
              .from('leaderboard_stats')
              .insert({
                profile_id:          profileId,
                period,
                xp:                  bonusXp,
                weekly_xp:           period === 'weekly' ? bonusXp : 0,
                total_predictions:   0,
                correct_predictions: 0,
                accuracy:            0,
                position:            null,
                computed_at:         now,
              })
          }
        }
      }
    } catch (e) {
      console.warn('[awardReferralBonus] leaderboard_stats update skipped:', e)
    }

    return { awarded: true, bonusXp, referrerWallet }

  } catch (e) {
    // Belt-and-suspenders: the function must never throw
    console.error('[awardReferralBonus] unexpected error:', e)
    return { awarded: false, reason: `unexpected: ${e instanceof Error ? e.message : String(e)}` }
  }
}
