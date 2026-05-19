/**
 * POST /api/admin/daily-xi-stats-preview
 *
 * Read-only preview: fetches a Daily XI entry, generates mock player stats,
 * calculates the projected score, and returns the result.
 *
 * No DB writes. No XP awarded. Preview only.
 *
 * Auth:  x-admin-key header vs ADMIN_SETTLEMENT_KEY env var
 * Body:  { walletAddress, entryDate }
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'
import { fetchStatsForPlayers }           from '@/lib/player-stats-provider'
import { calculateDailyXIScore }          from '@/lib/daily-xi-scoring'

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

function isValidAddress(addr: unknown): addr is string {
  return typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/i.test((addr as string).trim())
}

function isValidDate(d: unknown): d is string {
  return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test((d as string).trim())
}

export async function POST(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const adminKey = process.env.ADMIN_SETTLEMENT_KEY
  if (!adminKey) return err('Admin key not configured', 500)
  if (req.headers.get('x-admin-key') !== adminKey) return err('Unauthorized', 401)

  // ── Body ───────────────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return err('Invalid JSON body', 400) }

  const { walletAddress, entryDate } = body

  if (!isValidAddress(walletAddress)) return err('Invalid walletAddress', 400)
  if (!isValidDate(entryDate))        return err('entryDate must be YYYY-MM-DD', 400)

  const wallet = (walletAddress as string).toLowerCase()
  const date   = (entryDate as string).trim()

  const supabase = getServerSupabaseClient()

  // ── Fetch entry ────────────────────────────────────────────────────────────
  const { data: entry, error: fetchErr } = await supabase
    .from('daily_xi_entries')
    .select('id, players, status')
    .eq('wallet_address', wallet)
    .eq('entry_date', date)
    .maybeSingle()

  if (fetchErr) return err(`DB error: ${fetchErr.message}`, 500)
  if (!entry)   return err(`No Daily XI entry found for ${wallet} on ${date}`, 404)

  // ── Extract player IDs from entry.players (jsonb array) ───────────────────
  const playerList = Array.isArray(entry.players) ? entry.players : []
  const playerIds: string[] = (playerList as Record<string, unknown>[])
    .map(p => (p.id ?? p.playerId) as string)
    .filter(id => typeof id === 'string' && id.length > 0)

  if (playerIds.length === 0) return err('No players found in entry', 400)

  // ── Fetch stats from provider (mock — no real API call) ───────────────────
  const stats = await fetchStatsForPlayers(playerIds, date)

  // ── Calculate projected score ──────────────────────────────────────────────
  const { totalXp, playerBreakdown } = calculateDailyXIScore(stats)

  // ── Return preview — no DB writes, no XP events ───────────────────────────
  return NextResponse.json({
    success:         true,
    entryId:         entry.id,
    entryStatus:     entry.status,
    providerName:    'mock',
    stats,
    totalXp,
    playerBreakdown,
  })
}
