/**
 * src/lib/activity.ts
 *
 * Unified activity normalization for the PrediXI user profile.
 * Combines match predictions, WC predictions (via XP events), Daily XI
 * (via XP events), and standalone XP events into a single sorted feed.
 *
 * Read-only. No mutations.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ActivityType =
  | 'match_prediction'
  | 'wc_prediction'
  | 'daily_xi'
  | 'xp_event'

export type ActivityResult = 'correct' | 'incorrect' | 'pending'

export interface ActivityItem {
  id:               string
  type:             ActivityType
  timestamp:        string        // ISO — used for descending sort
  title:            string        // "Arsenal vs Chelsea", "World Cup Pick", …
  subtitle:         string        // detail line below the title
  xpDelta:          number
  result?:          ActivityResult
  proofHash?:       string | null
  submittedOnchain?: boolean
  txHash?:          string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Raw shapes (minimal — only what the normalizers need)
// ─────────────────────────────────────────────────────────────────────────────

export type RawPrediction = {
  id:               string
  matchId:          string
  outcome:          'H' | 'D' | 'A'
  placedAt:         string
  pointsAwarded:    number | null
  isCorrect:        boolean | null
  commitmentHash?:  string | null
  submittedOnchain?: boolean
  txHash?:          string | null
}

export type RawXPEvent = {
  id:         string
  sourceType: string
  sourceId:   string
  xpAmount:   number
  reason:     string
  createdAt:  string
}

export type MatchMetaEntry = {
  homeShort: string
  awayShort: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalizers
// ─────────────────────────────────────────────────────────────────────────────

export function normalizePrediction(
  p:         RawPrediction,
  matchMeta?: Record<string, MatchMetaEntry>,
): ActivityItem {
  const meta      = matchMeta?.[p.matchId]
  const homeShort = meta?.homeShort ?? '?'
  const awayShort = meta?.awayShort ?? '?'
  const pickLabel = p.outcome === 'H' ? homeShort : p.outcome === 'A' ? awayShort : 'Draw'
  const result:   ActivityResult =
    p.isCorrect === true  ? 'correct' :
    p.isCorrect === false ? 'incorrect' : 'pending'
  const xpDelta = p.pointsAwarded ?? 0

  const subtitleSuffix =
    result === 'correct'   ? ` · +${xpDelta} XP` :
    result === 'incorrect' ? ' · +0 XP' :
    ' · Pending'

  return {
    id:               p.id,
    type:             'match_prediction',
    timestamp:        p.placedAt,
    title:            `${homeShort} vs ${awayShort}`,
    subtitle:         `Picked ${pickLabel}${subtitleSuffix}`,
    xpDelta,
    result,
    proofHash:        p.commitmentHash  ?? null,
    submittedOnchain: p.submittedOnchain ?? false,
    txHash:           p.txHash          ?? null,
  }
}

const XP_TYPE_TITLE: Record<string, string> = {
  wc_prediction:    'World Cup Pick',
  daily_xi:         'Daily XI',
  badge:            'Badge Unlocked',
  mission:          'Mission Complete',
  admin_adjustment: 'XP Adjustment',
}

export function normalizeXPEvent(ev: RawXPEvent): ActivityItem {
  const typeMap: Record<string, ActivityType> = {
    wc_prediction: 'wc_prediction',
    daily_xi:      'daily_xi',
  }

  return {
    id:        `xp-${ev.id}`,
    type:      typeMap[ev.sourceType] ?? 'xp_event',
    timestamp: ev.createdAt,
    title:     XP_TYPE_TITLE[ev.sourceType] ?? 'XP Earned',
    subtitle:  ev.reason,
    xpDelta:   ev.xpAmount,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified fetch helper (client-side only — uses browser fetch)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch a unified, descending-timestamp sorted activity feed.
 *
 * Strategy:
 * - Match predictions are fetched directly (include result, xp, proof).
 * - XP events where sourceType !== 'match_prediction' capture WC picks,
 *   Daily XI scoring, badges, and missions with reliable timestamps.
 *   Filtering out 'match_prediction' prevents duplicate entries.
 */
export async function fetchUnifiedActivity(
  walletAddress: string,
  matchMeta?:    Record<string, MatchMetaEntry>,
  limit          = 15,
): Promise<ActivityItem[]> {
  const [predsResult, xpResult] = await Promise.allSettled([
    fetch(`/api/predictions?walletAddress=${encodeURIComponent(walletAddress)}`)
      .then(r => r.ok ? r.json() as Promise<{ success: boolean; predictions?: RawPrediction[] }> : null),
    fetch(`/api/xp-events?wallet=${encodeURIComponent(walletAddress)}`)
      .then(r => r.ok ? r.json() as Promise<{ success: boolean; events?: RawXPEvent[] }> : null),
  ])

  const preds: RawPrediction[] =
    predsResult.status === 'fulfilled' && predsResult.value?.success
      ? predsResult.value.predictions ?? []
      : []

  const xpEvents: RawXPEvent[] =
    xpResult.status === 'fulfilled' && xpResult.value?.success
      ? xpResult.value.events ?? []
      : []

  const predItems = preds.map(p => normalizePrediction(p, matchMeta))

  const xpItems = xpEvents
    .filter(ev => ev.sourceType !== 'match_prediction')
    .map(ev => normalizeXPEvent(ev))

  return [...predItems, ...xpItems]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit)
}
