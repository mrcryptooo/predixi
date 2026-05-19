/**
 * POST /api/admin/auto-settle
 *
 * Admin-triggered auto settlement. Supports dry run.
 * Auth: x-admin-key header vs ADMIN_SETTLEMENT_KEY env var.
 * Core logic lives in src/lib/auto-settle.ts (shared with cron route).
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'
import { findQualifiedMatches, runAutoSettle, outcomeLabel } from '@/lib/auto-settle'

const DEFAULT_LIMIT = 10
const MAX_LIMIT     = 100

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function POST(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const adminKey = process.env.ADMIN_SETTLEMENT_KEY
  if (!adminKey) return err('Settlement not configured on this server', 500)
  if (req.headers.get('x-admin-key') !== adminKey) return err('Unauthorized', 401)

  // ── Body ───────────────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return err('Invalid JSON body', 400) }

  const { dryRun, limit: limitRaw } = body
  if (typeof dryRun !== 'boolean') return err('dryRun is required and must be true or false', 400)

  const limit = typeof limitRaw === 'number' && limitRaw > 0
    ? Math.min(Math.floor(limitRaw), MAX_LIMIT)
    : DEFAULT_LIMIT

  const supabase = getServerSupabaseClient()

  // ── Find candidates ────────────────────────────────────────────────────────
  const { qualified, scanned, error: scanErr } = await findQualifiedMatches(supabase, limit)

  if (scanErr) {
    console.error('[admin/auto-settle] scan:', scanErr)
    return err('Failed to fetch finished matches', 500)
  }

  if (scanned === 0) {
    return NextResponse.json({
      success: true, dryRun, scanned: 0, candidates: [],
      message: 'No finished unsettled matches found.',
    })
  }

  // ── Dry run ────────────────────────────────────────────────────────────────
  if (dryRun) {
    return NextResponse.json({
      success:    true,
      dryRun:     true,
      scanned,
      candidates: qualified.map(({ dbOutcome: _, ...rest }) => rest),
      message:    qualified.length === 0
        ? 'No matches with unsettled predictions found.'
        : `${qualified.length} match(es) ready to settle.`,
    })
  }

  // ── Real run ───────────────────────────────────────────────────────────────
  const result = await runAutoSettle(supabase, qualified, scanned)

  return NextResponse.json({
    ...result,
    dryRun: false,
    errors: result.errors.length > 0 ? result.errors : undefined,
  })
}
