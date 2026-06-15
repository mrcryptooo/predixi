/**
 * GET /api/spin/status?wallet=0x...
 *
 * Returns the current spin state for a wallet — used by the client to
 * render the spin button, cooldown timer, and spins-remaining counter
 * before the user initiates a prepare/claim cycle.
 *
 * No authentication required — spin counts are not sensitive.
 *
 * Query params: wallet (required) — wallet address (checksummed or lowercase)
 * Returns:
 *   spinsToday     — claimed spins in the last 24 hours
 *   spinsRemaining — how many more spins are available today
 *   cooldownActive — true if the 8-hour cooldown is running
 *   nextSpinAt     — ISO timestamp when the next spin unlocks (null if ready now)
 *   canSpin        — convenience boolean: spinsRemaining > 0 && !cooldownActive
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient }        from '@/lib/supabase/server'
import { getSpinStatus }                  from '@/lib/spin'

function err(msg: string, status: number) {
  return NextResponse.json({ success: false, error: msg }, { status })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const rawWallet = searchParams.get('wallet')

  if (!rawWallet) return err('wallet query parameter is required', 400)

  const wallet = rawWallet.toLowerCase()
  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    return err('Invalid wallet address format', 400)
  }

  const supabase = getServerSupabaseClient()
  const status   = await getSpinStatus(supabase, wallet)

  return NextResponse.json({ success: true, ...status })
}
