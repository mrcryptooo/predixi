/**
 * GET /api/referrals/me?wallet=0x...
 *
 * Returns the connected user's referral code, full referral link, and
 * lightweight referral stats (count + XP earned).
 *
 * No signature required — the referral code is public data intended for
 * sharing. The wallet address is validated for format only.
 *
 * Responses:
 *   200 { ok: true,  referralCode, referralLink, referralCount, referralXp }
 *   400 { ok: false, error: "WALLET_REQUIRED" | "INVALID_WALLET" }
 *   500 { ok: false, error: "FETCH_FAILED" }
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }         from '@/lib/supabase/server'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://predixi.xyz'

function isValidAddress(addr: unknown): addr is string {
  return typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/i.test(addr.trim())
}

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')

  if (!wallet) {
    return NextResponse.json({ ok: false, error: 'WALLET_REQUIRED' }, { status: 400 })
  }
  if (!isValidAddress(wallet)) {
    return NextResponse.json({ ok: false, error: 'INVALID_WALLET' }, { status: 400 })
  }

  const normalizedWallet = wallet.toLowerCase()

  try {
    const supabase = getServerSupabaseClient()

    // ── 1. Referral code from profile ──────────────────────────────────────
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('referral_code')
      .eq('wallet_address', normalizedWallet)
      .maybeSingle()

    if (profileErr) {
      console.error('[GET /api/referrals/me] profile lookup:', profileErr)
      return NextResponse.json({ ok: false, error: 'FETCH_FAILED' }, { status: 500 })
    }

    const referralCode: string | null = profile?.referral_code ?? null
    const referralLink = referralCode ? `${BASE_URL}/?ref=${referralCode}` : null

    // ── 2. Count of successful referrals ──────────────────────────────────
    const { count: referralCount, error: countErr } = await supabase
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_wallet', normalizedWallet)
      .eq('status', 'completed')

    if (countErr) {
      console.warn('[GET /api/referrals/me] count query:', countErr)
    }

    // ── 3. Total XP earned from referral events ────────────────────────────
    const { data: xpRows, error: xpErr } = await supabase
      .from('xp_events')
      .select('xp_amount')
      .eq('wallet_address', normalizedWallet)
      .in('source_type', ['referral_reward', 'referral_bonus'])

    if (xpErr) {
      console.warn('[GET /api/referrals/me] xp query:', xpErr)
    }

    const referralXp = (xpRows ?? []).reduce(
      (sum, row) => sum + (row.xp_amount ?? 0),
      0,
    )

    return NextResponse.json({
      ok:            true,
      referralCode,
      referralLink,
      referralCount: referralCount ?? 0,
      referralXp,
    })
  } catch (e) {
    console.error('[GET /api/referrals/me] unhandled:', e)
    return NextResponse.json({ ok: false, error: 'FETCH_FAILED' }, { status: 500 })
  }
}
