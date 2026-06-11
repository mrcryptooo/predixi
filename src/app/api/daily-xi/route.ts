/**
 * API Route — /api/daily-xi
 *
 * GET  ?wallet=0x...&date=YYYY-MM-DD  → Daily XI entry for wallet/date (defaults today)
 * POST                                → Upsert entry — requires confirmed Base txHash
 *
 * Transaction-first: POST must include a confirmed Base txHash from
 * submitCommitment() on PredixiCommitmentRegistry. Server verifies the
 * CommitmentSubmitted event before writing to Supabase.
 * No wallet message signatures are used or accepted.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'
import { createDailyXICommitment }        from '@/lib/onchain/commitment'
import { verifyOnchainSubmission }        from '@/lib/onchain/verifySubmission'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isValidAddress(addr: unknown): addr is string {
  return typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/i.test(addr.trim())
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

function isValidDate(d: unknown): d is string {
  return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())
}

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/daily-xi?wallet=0x...&date=YYYY-MM-DD
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
// Body: { walletAddress, entryDate?, players, projectedMaxXp?, txHash }
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
      txHash,
    } = body as Record<string, unknown>

    // ── Validation ────────────────────────────────────────────────────────────
    if (!isValidAddress(walletAddress)) {
      return err('Invalid walletAddress — must be a 0x Ethereum address', 400)
    }
    if (!Array.isArray(players)) {
      return err('players must be an array', 400)
    }
    if (!txHash || typeof txHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      return err('txHash is required — must be 0x-prefixed 64-hex transaction hash', 400)
    }

    const date             = isValidDate(entryDate) ? (entryDate as string).trim() : todayUTC()
    const maxXp            = typeof projectedMaxXp === 'number' && projectedMaxXp >= 0 ? projectedMaxXp : 20
    const normalizedWallet = (walletAddress as string).toLowerCase()

    // ── Compute commitment hash ───────────────────────────────────────────────
    const playerIds = (players as Array<Record<string, unknown>>)
      .map(p => String(p.id ?? p.playerId ?? ''))
      .filter(Boolean)
    const { commitmentHash } = createDailyXICommitment({
      walletAddress:  normalizedWallet,
      entryDate:      date,
      playerIds,
      projectedMaxXp: maxXp,
    })

    // ── Verify on-chain TX — must precede any DB write ────────────────────────
    const verify = await verifyOnchainSubmission(
      txHash as string,
      normalizedWallet,
      commitmentHash,
    )
    if (!verify.ok) {
      console.warn('[POST /api/daily-xi] TX verification failed:', verify.error)
      return err(`Transaction verification failed: ${verify.error}`, 400)
    }

    // ── DB client ────────────────────────────────────────────────────────────
    const supabase = getServerSupabaseClient()

    // ── Guard: reject if today's entry is already scored ─────────────────────
    {
      const { data: existing, error: existingErr } = await supabase
        .from('daily_xi_entries')
        .select('status')
        .eq('wallet_address', normalizedWallet)
        .eq('entry_date', date)
        .maybeSingle()

      if (existingErr) {
        console.error('[POST /api/daily-xi] scored-entry check:', existingErr)
        return err('Failed to verify entry status', 500)
      }

      if ((existing as { status: string } | null)?.status === 'scored') {
        return NextResponse.json(
          {
            success:       false,
            error:         "Today's Daily XI has already been scored. Your XP has been awarded — come back tomorrow to build a new XI.",
            alreadyScored: true,
          },
          { status: 409 },
        )
      }
    }

    // ── Upsert ───────────────────────────────────────────────────────────────
    const { data, error } = await supabase
      .from('daily_xi_entries')
      .upsert(
        {
          wallet_address:    normalizedWallet,
          entry_date:        date,
          players:           players,
          status:            'pending',
          projected_max_xp:  maxXp,
          commitment_hash:   commitmentHash,
          submitted_onchain: true,
          tx_hash:           (txHash as string).toLowerCase(),
          updated_at:        new Date().toISOString(),
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
        entryDate: data.entry_date,
        status:    data.status,
        updatedAt: data.updated_at,
      },
    })
  } catch (e) {
    console.error('[POST /api/daily-xi] unhandled:', e)
    return err('Internal server error', 500)
  }
}
