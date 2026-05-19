import { type NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient } from '@/lib/supabase/server'
import { getRankProgress } from '@/lib/ranks'

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function GET(req: NextRequest) {
  const walletAddress = req.nextUrl.searchParams.get('walletAddress')
  if (!walletAddress) return err('walletAddress required', 400)
  if (!/^0x[0-9a-fA-F]{40}$/i.test(walletAddress.trim())) return err('Invalid address', 400)

  try {
    const supabase = getServerSupabaseClient()
    const { data } = await supabase
      .from('profiles')
      .select('wallet_address, xp, rank, streak, total_predictions, correct_predictions, created_at')
      .eq('wallet_address', walletAddress.toLowerCase())
      .maybeSingle()

    if (!data) {
      const rankMeta = getRankProgress(0)
      return NextResponse.json({
        success: true,
        exists: false,
        profile: {
          walletAddress: walletAddress.toLowerCase(),
          xp: 0, rank: 'bronze', streak: 0,
          totalPredictions: 0, correctPredictions: 0,
          accuracy: 0, createdAt: null,
        },
        rankMetadata: {
          tier:        rankMeta.tier.id,
          tierLabel:   rankMeta.tier.label,
          tierColor:   rankMeta.tier.color,
          tierEmoji:   rankMeta.tier.emoji,
          nextTier:    rankMeta.nextTier?.id    ?? null,
          nextTierLabel: rankMeta.nextTier?.label ?? null,
          xpInTier:    rankMeta.xpInTier,
          xpForTier:   rankMeta.xpForTier,
          progressPct: rankMeta.progressPct,
        },
      })
    }

    const accuracy = data.total_predictions > 0
      ? Math.round((data.correct_predictions / data.total_predictions) * 100)
      : 0

    const rankMeta = getRankProgress(data.xp ?? 0)

    return NextResponse.json({
      success: true,
      exists: true,
      profile: {
        walletAddress:      data.wallet_address,
        xp:                 data.xp,
        rank:               data.rank,
        streak:             data.streak,
        totalPredictions:   data.total_predictions,
        correctPredictions: data.correct_predictions,
        accuracy,
        createdAt:          data.created_at ?? null,
      },
      rankMetadata: {
        tier:          rankMeta.tier.id,
        tierLabel:     rankMeta.tier.label,
        tierColor:     rankMeta.tier.color,
        tierEmoji:     rankMeta.tier.emoji,
        nextTier:      rankMeta.nextTier?.id    ?? null,
        nextTierLabel: rankMeta.nextTier?.label ?? null,
        xpInTier:      rankMeta.xpInTier,
        xpForTier:     rankMeta.xpForTier,
        progressPct:   rankMeta.progressPct,
      },
    })
  } catch (error) {
    console.error('[GET /api/profiles]', error)
    return err('Internal server error', 500)
  }
}
