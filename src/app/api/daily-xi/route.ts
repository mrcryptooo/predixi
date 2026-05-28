/**
 * API Route — /api/daily-xi
 *
 * GET  ?wallet=0x...&date=YYYY-MM-DD  → Daily XI entry for wallet/date (defaults today)
 * POST                                → Upsert entry (wallet + date = unique)
 *
 * Server-only. Uses service role key.
 * No XP settlement. No blockchain. status stays 'pending'.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }         from '@/lib/supabase/server'
import { verifyBaseWalletAuth }            from '@/lib/auth/verify-base-wallet'
import { createDailyXICommitment }        from '@/lib/onchain/commitment'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isValidAddress(addr: unknown): addr is string {
  return typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/i.test(addr.trim())
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

function isValidDate(d: unknown): d is string {
  return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())
}

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/daily-xi?wallet=0x...&date=YYYY-MM-DD
// Returns the Daily XI entry for the given wallet and date (defaults to today).
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const wallet = req.nextUrl.searchParams.get('wallet')
    const date   = req.nextUrl.searchParams.get('date') ?? todayUTC()

    if (!wallet)                 return err('wallet query parameter is required', 400)
    if (!isValidAddress(wallet)) return err('Invalid wallet address', 400)
    if (!isValidDate(date))      return err('Invalid date format — use YYYY-MM-DD', 400)

    const supabase = getServerSupabaseClient()

    const { data, error } = await supabase
      .from('daily_xi_entries')
      .select('players, status, projected_max_xp, earned_xp, submitted_onchain, commitment_hash, tx_hash, created_at, updated_at')
      .eq('wallet_address', wallet.toLowerCase())
      .eq('entry_date', date)
      .maybeSingle()

    if (error) {
      console.error('[GET /api/daily-xi]', error)
      return err('Failed to fetch Daily XI entry', 500)
    }

    if (!data) {
      return NextResponse.json({ success: true, entry: null })
    }

    return NextResponse.json({
      success: true,
      entry: {
        players:          data.players,
        status:           data.status,
        projectedMaxXp:   data.projected_max_xp,
        earnedXp:         data.earned_xp,
        submittedOnchain: data.submitted_onchain,
        commitmentHash:   data.commitment_hash ?? null,
        txHash:           data.tx_hash         ?? null,
        createdAt:        data.created_at,
        updatedAt:        data.updated_at,
      },
    })
  } catch (e) {
    console.error('[GET /api/daily-xi] unhandled:', e)
    return err('Internal server error', 500)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/daily-xi
// Body: { walletAddress, entryDate?, players, projectedMaxXp? }
// Upserts on (wallet_address, entry_date). status stays 'pending'. earned_xp stays 0.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return err('Invalid JSON body', 400)

    const {
      walletAddress,
      entryDate,
      players,
      projectedMaxXp,
    } = body as Record<string, unknown>

    // ── Validation ────────────────────────────────────────────────────────────
    if (!isValidAddress(walletAddress)) {
      return err('Invalid walletAddress — must be a 0x Ethereum address', 400)
    }
    if (!Array.isArray(players)) {
      return err('players must be an array', 400)
    }

    const date  = isValidDate(entryDate) ? (entryDate as string).trim() : todayUTC()
    const maxXp = typeof projectedMaxXp === 'number' && projectedMaxXp >= 0 ? projectedMaxXp : 20

    const normalizedWallet = (walletAddress as string).toLowerCase()

    // ── Wallet auth — smart-wallet-compatible ────────────────────────────────
    // Uses publicClient.verifyMessage() which supports EOA, ERC-1271, and
    // ERC-6492 (Base Account / Coinbase Smart Wallet).  The EOA-only standalone
    // verifyMessage() always fails for Base App wallets — do not use it here.
    const walletAuth = await verifyBaseWalletAuth(req, normalizedWallet, 'daily-xi')
    if (!walletAuth.verified) {
      const reason = walletAuth.reason ?? 'missing'
      console.warn('[POST /api/daily-xi] auth failed:', reason, 'wallet:', normalizedWallet)
      return NextResponse.json(
        {
          success:    false,
          error:      reason === 'missing-headers'
            ? 'Wallet signature required — please sign the message in your wallet'
            : reason === 'wallet-mismatch' || reason === 'action-mismatch'
            ? 'Invalid signature — message does not match this wallet or action'
            : 'Signature verification failed — please try again',
          walletAuth: { checked: walletAuth.checked, verified: false, reason },
        },
        { status: 401 },
      )
    }

    // ── Compute commitment hash before upsert — stored atomically with row ──
    const playerIds = (players as Array<Record<string, unknown>>)
      .map(p => String(p.id ?? p.playerId ?? ''))
      .filter(Boolean)
    const { commitmentHash } = createDailyXICommitment({
      walletAddress:  normalizedWallet,
      entryDate:      date,
      playerIds,
      projectedMaxXp: maxXp,
    })

    // ── Upsert ───────────────────────────────────────────────────────────────
    const supabase = getServerSupabaseClient()

    const { data, error } = await supabase
      .from('daily_xi_entries')
      .upsert(
        {
          wallet_address:   normalizedWallet,
          entry_date:       date,
          players:          players,
          status:           'pending',
          projected_max_xp: maxXp,
          commitment_hash:  commitmentHash,
          updated_at:       new Date().toISOString(),
        },
        { onConflict: 'wallet_address,entry_date' },
      )
      .select('entry_date, status, updated_at')
      .single()

    if (error) {
      console.error('[POST /api/daily-xi]', error)
      return err('Failed to save Daily XI entry', 500)
    }

    return NextResponse.json({
      success: true,
      commitmentHash,
      entry: {
        entryDate:  data.entry_date,
        status:     data.status,
        updatedAt:  data.updated_at,
      },
      walletAuth,
    })
  } catch (e) {
    console.error('[POST /api/daily-xi] unhandled:', e)
    return err('Internal server error', 500)
  }
}
