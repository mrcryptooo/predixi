/**
 * API Route — /api/xp-events
 *
 * GET  ?wallet=0x...  → all XP events for wallet + totalXp + bySourceType summary
 * POST               → insert one XP event (duplicate-safe via unique constraint)
 *
 * Server-only. Uses service role key.
 * Phase 1: foundation only — no leaderboard update, no prediction settlement.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }         from '@/lib/supabase/server'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const VALID_SOURCE_TYPES = new Set([
  'match_prediction',
  'wc_prediction',
  'daily_xi',
  'badge',
  'mission',
  'admin_adjustment',
])

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isValidAddress(addr: unknown): addr is string {
  return typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/i.test(addr.trim())
}

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/xp-events?wallet=0x...
// Returns all events, total XP, and a per-source-type summary.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const wallet = req.nextUrl.searchParams.get('wallet')

    if (!wallet)                 return err('wallet query parameter is required', 400)
    if (!isValidAddress(wallet)) return err('Invalid wallet address', 400)

    const supabase = getServerSupabaseClient()

    const { data, error } = await supabase
      .from('xp_events')
      .select('id, source_type, source_id, xp_amount, reason, metadata, created_at')
      .eq('wallet_address', wallet.toLowerCase())
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[GET /api/xp-events]', error)
      return err('Failed to fetch XP events', 500)
    }

    const events = data ?? []

    // Total XP across all events
    const totalXp = events.reduce((sum, e) => sum + e.xp_amount, 0)

    // Group by source_type — sum xp_amount and count events per type
    const bySourceType: Record<string, { totalXp: number; count: number }> = {}
    for (const e of events) {
      const entry = bySourceType[e.source_type] ?? { totalXp: 0, count: 0 }
      entry.totalXp += e.xp_amount
      entry.count   += 1
      bySourceType[e.source_type] = entry
    }

    return NextResponse.json({
      success: true,
      totalXp,
      eventCount: events.length,
      bySourceType,
      events: events.map(e => ({
        id:         e.id,
        sourceType: e.source_type,
        sourceId:   e.source_id,
        xpAmount:   e.xp_amount,
        reason:     e.reason,
        metadata:   e.metadata,
        createdAt:  e.created_at,
      })),
    })
  } catch (e) {
    console.error('[GET /api/xp-events] unhandled:', e)
    return err('Internal server error', 500)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/xp-events
// Body: { walletAddress, sourceType, sourceId, xpAmount, reason, metadata? }
// Duplicate-safe: if unique constraint fires, returns 200 with existing flag.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return err('Invalid JSON body', 400)

    const {
      walletAddress,
      sourceType,
      sourceId,
      xpAmount,
      reason,
      metadata,
    } = body as Record<string, unknown>

    // ── Validation ────────────────────────────────────────────────────────────
    if (!isValidAddress(walletAddress)) {
      return err('Invalid walletAddress — must be a 0x Ethereum address', 400)
    }
    if (!sourceType || typeof sourceType !== 'string' || !VALID_SOURCE_TYPES.has(sourceType)) {
      return err(`Invalid sourceType — must be one of: ${[...VALID_SOURCE_TYPES].join(', ')}`, 400)
    }
    if (!sourceId || typeof sourceId !== 'string' || sourceId.trim() === '') {
      return err('sourceId is required', 400)
    }
    if (typeof xpAmount !== 'number') {
      return err('xpAmount must be a number', 400)
    }
    if (!reason || typeof reason !== 'string' || reason.trim() === '') {
      return err('reason is required', 400)
    }

    const normalizedWallet = (walletAddress as string).toLowerCase()
    const safeMeta = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? metadata
      : {}

    const supabase = getServerSupabaseClient()

    const { data, error } = await supabase
      .from('xp_events')
      .insert({
        wallet_address: normalizedWallet,
        source_type:    sourceType as string,
        source_id:      (sourceId as string).trim(),
        xp_amount:      xpAmount as number,
        reason:         (reason as string).trim(),
        metadata:       safeMeta,
      })
      .select('id, source_type, source_id, xp_amount, reason, created_at')
      .single()

    // ── Duplicate-safe: unique constraint violation = already recorded ────────
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({
          success:   true,
          duplicate: true,
          message:   'XP event already recorded for this source',
        })
      }
      console.error('[POST /api/xp-events]', error)
      return err('Failed to record XP event', 500)
    }

    return NextResponse.json({
      success:   true,
      duplicate: false,
      event: {
        id:         data.id,
        sourceType: data.source_type,
        sourceId:   data.source_id,
        xpAmount:   data.xp_amount,
        reason:     data.reason,
        createdAt:  data.created_at,
      },
    })
  } catch (e) {
    console.error('[POST /api/xp-events] unhandled:', e)
    return err('Internal server error', 500)
  }
}
