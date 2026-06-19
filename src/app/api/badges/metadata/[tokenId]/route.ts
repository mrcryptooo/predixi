/**
 * API Route — /api/badges/metadata/[tokenId]
 *
 * GET /api/badges/metadata/{tokenId}
 *
 * Returns ERC-1155 compatible JSON metadata for a PrediXIBadges token.
 * Used as the base URI on the PrediXIBadges contract:
 *   https://predixi-base.vercel.app/api/badges/metadata/{id}
 *
 * Response shape:
 *   {
 *     "name":         "PrediXI Badge: <badge name>",
 *     "description":  <badge description>,
 *     "image":        "https://predixi-base.vercel.app/badges/<badgeId>.webp",
 *     "external_url": "https://predixi-base.vercel.app/profile",
 *     "attributes": [
 *       { "trait_type": "Badge ID",   "value": "<badgeId>" },
 *       { "trait_type": "Token ID",   "value": <tokenId>   },
 *       { "trait_type": "Rarity",     "value": "<rarity>"  },
 *       { "trait_type": "XP Reward",  "value": <xpReward>  },
 *       { "trait_type": "Soulbound",  "value": "true"      },
 *       { "trait_type": "Network",    "value": "Base"      }
 *     ]
 *   }
 *
 * Status codes:
 *   200 — valid active token ID (1–19)
 *   404 — token ID out of range, reserved (20–25), or non-integer
 *
 * Cache headers:
 *   Cache-Control: public, max-age=3600, s-maxage=86400
 *   Badge metadata is static — CDN can cache for 24 h, browser for 1 h.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getBadgeById }            from '@/data/badges'
import {
  getBadgeIdForTokenId,
  isValidBadgeTokenId,
  isActiveBadgeTokenId,
}                                  from '@/lib/badges/tokenIds'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PRODUCTION_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://predixi.xyz'

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=3600, s-maxage=86400',
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const { tokenId: tokenIdParam } = await params

  // ── Parse token ID ─────────────────────────────────────────────────────────
  const parsed = Number(tokenIdParam)
  if (!Number.isInteger(parsed) || isNaN(parsed)) {
    return NextResponse.json(
      { error: 'Invalid token ID — must be an integer' },
      { status: 404 }
    )
  }

  // ── Range check ────────────────────────────────────────────────────────────
  if (!isValidBadgeTokenId(parsed)) {
    return NextResponse.json(
      { error: `Token ID ${parsed} is out of range (valid: 1–25)` },
      { status: 404 }
    )
  }

  // ── Reserved IDs (20–25): 404 until future badges are assigned ─────────────
  if (!isActiveBadgeTokenId(parsed)) {
    return NextResponse.json(
      { error: `Token ID ${parsed} is reserved` },
      { status: 404 }
    )
  }

  // ── Resolve badge ID ────────────────────────────────────────────────────────
  const badgeId = getBadgeIdForTokenId(parsed)
  if (!badgeId) {
    // Should not be reachable given the checks above, but guard anyway
    return NextResponse.json(
      { error: `No badge mapped to token ID ${parsed}` },
      { status: 404 }
    )
  }

  // ── Resolve badge metadata ──────────────────────────────────────────────────
  const badge = getBadgeById(badgeId)
  if (!badge) {
    // tokenIds.ts references a badge ID not present in badges.ts — data drift
    return NextResponse.json(
      { error: `Badge definition not found for ID: ${badgeId}` },
      { status: 404 }
    )
  }

  // ── Build ERC-1155 metadata ─────────────────────────────────────────────────
  const metadata = {
    name:         `PrediXI Badge: ${badge.name}`,
    description:  badge.description,
    image:        `${PRODUCTION_BASE_URL}/badges/${badgeId}.webp`,
    external_url: `${PRODUCTION_BASE_URL}/profile`,
    attributes: [
      { trait_type: 'Badge ID',  value: badgeId        },
      { trait_type: 'Token ID',  value: parsed          },
      { trait_type: 'Rarity',    value: badge.rarity    },
      { trait_type: 'XP Reward', value: badge.xpReward  },
      { trait_type: 'Soulbound', value: 'true'          },
      { trait_type: 'Network',   value: 'Base'          },
    ],
  }

  return NextResponse.json(metadata, {
    status: 200,
    headers: CACHE_HEADERS,
  })
}
