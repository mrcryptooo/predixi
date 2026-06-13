/**
 * registerReferral — core referral registration logic
 *
 * Called by POST /api/referrals/register.
 * Separated so it can be unit-tested or called from other server-side contexts.
 *
 * Responsibilities:
 *   1. Resolve the referrer from the referral code (with wallet format guard)
 *   2. Guard against self-referral and already-referred states
 *   3. Guard against existing-user referral abuse (7-day grace + activity check)
 *   4. Ensure the referred user's profile exists (creates it if not)
 *   5. Insert the referrals row
 *   6. Update profiles.referred_by_wallet + referred_at
 *   7. Issue 200 XP referral_reward event to referrer (duplicate-safe)
 *   8. Increment referrer's profiles.xp and leaderboard_stats
 *
 * All writes are sequential — no transactions (Supabase JS SDK does not expose
 * a transaction API). The xp_events unique constraint is the final duplicate guard.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import type { SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DIRECT_REWARD_XP  = 200
const FUTURE_BONUS_BPS  = 1000  // 10% = 1000 / 10 000

/**
 * Referred users whose profiles are older than this AND have any XP/predictions
 * are treated as organic users and cannot retroactively claim a referral.
 */
const REFERRAL_GRACE_DAYS = 7

// ─────────────────────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────────────────────

export type RegisterReferralOk = {
  ok:             true
  status:         'registered' | 'already_registered'
  referrerWallet: string
  xpAwarded:      number    // 0 if already rewarded
}

export type RegisterReferralErr = {
  ok:    false
  error: ReferralErrorCode
}

export type RegisterReferralResult = RegisterReferralOk | RegisterReferralErr

export type ReferralErrorCode =
  | 'SIGNATURE_REQUIRED'
  | 'INVALID_SIGNATURE'
  | 'INVALID_WALLET'
  | 'INVALID_REFERRAL_CODE'
  | 'REFERRAL_CODE_NOT_FOUND'
  | 'SELF_REFERRAL_NOT_ALLOWED'
  | 'ALREADY_REFERRED_BY_ANOTHER_USER'
  | 'ALREADY_ACTIVE_USER_CANNOT_BE_REFERRED'
  | 'REFERRAL_REGISTER_FAILED'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isValidEthAddress(addr: unknown): addr is string {
  return typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/i.test(addr)
}

// ─────────────────────────────────────────────────────────────────────────────
// Main function
// ─────────────────────────────────────────────────────────────────────────────

export async function registerReferral(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase:       SupabaseClient<any>,
  referredWallet: string,   // already normalized (lowercase)
  referralCode:   string,   // already normalized (trimmed, uppercase)
): Promise<RegisterReferralResult> {

  // ── 1. Resolve referrer from code ────────────────────────────────────────
  const { data: referrerProfile, error: lookupErr } = await supabase
    .from('profiles')
    .select('wallet_address, xp')
    .eq('referral_code', referralCode)
    .maybeSingle()

  if (lookupErr) {
    console.error('[registerReferral] code lookup:', lookupErr.message)
    return { ok: false, error: 'REFERRAL_REGISTER_FAILED' }
  }
  if (!referrerProfile) {
    return { ok: false, error: 'REFERRAL_CODE_NOT_FOUND' }
  }

  // Defensive: referrer must have a well-formed wallet address
  const referrerWallet: string = referrerProfile.wallet_address ?? ''
  if (!isValidEthAddress(referrerWallet)) {
    console.warn('[registerReferral] referrer profile has invalid wallet_address for code:', referralCode)
    return { ok: false, error: 'REFERRAL_CODE_NOT_FOUND' }
  }

  // ── 2. Self-referral guard ────────────────────────────────────────────────
  // Normalized comparison — both are already lowercase
  if (referrerWallet.toLowerCase() === referredWallet.toLowerCase()) {
    return { ok: false, error: 'SELF_REFERRAL_NOT_ALLOWED' }
  }

  // ── 3. Check if referred user already has a referrer ─────────────────────
  // Fetch additional fields needed for the existing-user activity guard.
  const { data: referredProfile, error: referredLookupErr } = await supabase
    .from('profiles')
    .select('id, xp, referred_by_wallet, total_predictions, created_at')
    .eq('wallet_address', referredWallet)
    .maybeSingle()

  if (referredLookupErr) {
    console.error('[registerReferral] referred profile lookup:', referredLookupErr.message)
    return { ok: false, error: 'REFERRAL_REGISTER_FAILED' }
  }

  if (referredProfile?.referred_by_wallet) {
    // Already referred
    if (referredProfile.referred_by_wallet === referrerWallet) {
      // Idempotent: same referrer called again
      return { ok: true, status: 'already_registered', referrerWallet, xpAwarded: 0 }
    }
    // Different referrer — reject
    return { ok: false, error: 'ALREADY_REFERRED_BY_ANOTHER_USER' }
  }

  // ── 3b. Existing-user activity guard ─────────────────────────────────────
  // If the referred user already has a profile, check that they are a new user
  // and not retroactively claiming a referral after being active organically.
  // Rule: profile older than REFERRAL_GRACE_DAYS with any XP or predictions → reject.
  if (referredProfile) {
    const hasActivity =
      (referredProfile.total_predictions ?? 0) > 0 ||
      (referredProfile.xp                ?? 0) > 0

    if (hasActivity && referredProfile.created_at) {
      const ageDays =
        (Date.now() - new Date(referredProfile.created_at).getTime()) /
        (1000 * 60 * 60 * 24)

      if (ageDays > REFERRAL_GRACE_DAYS) {
        return { ok: false, error: 'ALREADY_ACTIVE_USER_CANNOT_BE_REFERRED' }
      }
    }
  }

  // ── 4. Ensure referred user profile exists ───────────────────────────────
  // The referral may arrive before the user's profile is created via other flows.
  if (!referredProfile) {
    const { error: createErr } = await supabase
      .from('profiles')
      .upsert(
        {
          wallet_address:      referredWallet,
          xp:                  0,
          rank:                'bronze',
          streak:              0,
          total_predictions:   0,
          correct_predictions: 0,
          referral_code:       generateReferralCode(referredWallet),
          referred_by_wallet:  referrerWallet,
          referred_at:         new Date().toISOString(),
        },
        { onConflict: 'wallet_address', ignoreDuplicates: false },
      )
    if (createErr) {
      console.error('[registerReferral] create referred profile:', createErr.message)
      return { ok: false, error: 'REFERRAL_REGISTER_FAILED' }
    }
  } else {
    // Profile exists — stamp the referral onto it
    const { error: stampErr } = await supabase
      .from('profiles')
      .update({
        referred_by_wallet: referrerWallet,
        referred_at:        new Date().toISOString(),
      })
      .eq('wallet_address', referredWallet)
    if (stampErr) {
      console.error('[registerReferral] stamp referral on profile:', stampErr.message)
      return { ok: false, error: 'REFERRAL_REGISTER_FAILED' }
    }
  }

  // ── 5. Insert referrals row (unique constraint on referred_wallet) ────────
  const now = new Date().toISOString()
  const { error: insertErr } = await supabase
    .from('referrals')
    .insert({
      referrer_wallet:  referrerWallet,
      referred_wallet:  referredWallet,
      referral_code:    referralCode,
      status:           'completed',
      direct_reward_xp: DIRECT_REWARD_XP,
      future_bonus_bps: FUTURE_BONUS_BPS,
      completed_at:     now,
    })

  if (insertErr) {
    if (insertErr.code === '23505') {
      // Unique constraint on referred_wallet — already registered (race or retry)
      return { ok: true, status: 'already_registered', referrerWallet, xpAwarded: 0 }
    }
    // CHECK constraint violation (self-referral at DB level — belt + suspenders)
    if (insertErr.code === '23514') {
      return { ok: false, error: 'SELF_REFERRAL_NOT_ALLOWED' }
    }
    console.error('[registerReferral] insert referrals:', insertErr.message)
    return { ok: false, error: 'REFERRAL_REGISTER_FAILED' }
  }

  // ── 6. Award 200 XP to referrer via xp_events ────────────────────────────
  // source_id is deterministic — the unique constraint makes this idempotent.
  const sourceId = `referral-reward:${referrerWallet}:${referredWallet}`
  const { error: xpErr } = await supabase
    .from('xp_events')
    .insert({
      wallet_address: referrerWallet,
      source_type:    'referral_reward',
      source_id:      sourceId,
      xp_amount:      DIRECT_REWARD_XP,
      reason:         'referral_reward',
      metadata:       { referred_wallet: referredWallet, referral_code: referralCode },
    })

  let xpAwarded = 0

  if (xpErr) {
    if (xpErr.code === '23505') {
      // Already rewarded — non-fatal
      xpAwarded = 0
    } else {
      console.error('[registerReferral] xp_events insert:', xpErr.message)
      // Non-fatal: referral row already inserted; XP can be retried
    }
  } else {
    xpAwarded = DIRECT_REWARD_XP

    // ── 7. Mark referrals.direct_rewarded_at ─────────────────────────────
    try {
      await supabase
        .from('referrals')
        .update({ direct_rewarded_at: now })
        .eq('referrer_wallet', referrerWallet)
        .eq('referred_wallet', referredWallet)
    } catch (e) {
      console.warn('[registerReferral] direct_rewarded_at update skipped:', e)
    }

    // ── 8. Increment referrer profiles.xp (atomic) ───────────────────────
    try {
      const { data: rp } = await supabase
        .from('profiles')
        .select('id')
        .eq('wallet_address', referrerWallet)
        .maybeSingle()
      if (rp) {
        const { error: xpRpcErr } = await supabase
          .rpc('increment_profile_xp', { p_id: rp.id as string, p_delta: DIRECT_REWARD_XP })
        if (xpRpcErr) {
          console.warn('[registerReferral] profiles.xp rpc error:', xpRpcErr.message)
        }
      }
    } catch (e) {
      console.warn('[registerReferral] profiles.xp update skipped:', e)
    }

    // ── 9. Increment referrer leaderboard_stats (all_time + weekly) ──────
    try {
      const lbNow = new Date().toISOString()

      const { data: refProf } = await supabase
        .from('profiles')
        .select('id')
        .eq('wallet_address', referrerWallet)
        .maybeSingle()

      const profileId: string | undefined = refProf?.id

      if (profileId) {
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
                xp:          (lbRow.xp       ?? 0) + DIRECT_REWARD_XP,
                weekly_xp:   period === 'weekly'
                  ? (lbRow.weekly_xp ?? 0) + DIRECT_REWARD_XP
                  : (lbRow.weekly_xp ?? 0),
                computed_at: lbNow,
              })
              .eq('id', lbRow.id)
          } else {
            await supabase
              .from('leaderboard_stats')
              .insert({
                profile_id:  profileId,
                period,
                xp:          DIRECT_REWARD_XP,
                weekly_xp:   period === 'weekly' ? DIRECT_REWARD_XP : 0,
                computed_at: lbNow,
              })
          }
        }
      }
    } catch (e) {
      console.warn('[registerReferral] leaderboard_stats update skipped:', e)
    }
  }

  return { ok: true, status: 'registered', referrerWallet, xpAwarded }
}

// ─────────────────────────────────────────────────────────────────────────────
// Client-side referral code generator — mirrors the SQL function
// Used when creating a profile for a referred user who doesn't exist yet.
// ─────────────────────────────────────────────────────────────────────────────

function generateReferralCode(wallet: string): string {
  // Simple 8-char uppercase hex from wallet — same logic as SQL generate_referral_code()
  // In Node.js we use crypto.createHash; this is server-only code.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('crypto') as typeof import('crypto')
  return crypto
    .createHash('sha256')
    .update(wallet.toLowerCase().trim())
    .digest('hex')
    .slice(0, 8)
    .toUpperCase()
}
