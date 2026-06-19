/**
 * Base App integration action helpers.
 *
 * Safe browser APIs only.  No analytics.  No tracking.
 * All functions are safe to call in SSR — they no-op and return defaults
 * when window/navigator are unavailable.
 */

const PREDIXI_BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
  'https://predixi.xyz'

// ─────────────────────────────────────────────────────────────────────────────
// Share support detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true when the Web Share API (navigator.share) is available.
 * Always true inside Base App / Coinbase Wallet webview on iOS/Android.
 */
export function isShareSupported(): boolean {
  if (typeof navigator === 'undefined') return false
  return typeof navigator.share === 'function'
}

// ─────────────────────────────────────────────────────────────────────────────
// Deep link copy
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Copies a PrediXI deep link to the clipboard.
 * Falls back to a legacy execCommand path for embedded webviews that restrict
 * the Clipboard API.
 * Returns true on success, false if all paths fail.
 */
export async function copyDeepLink(path: string = '/'): Promise<boolean> {
  if (typeof window === 'undefined') return false
  const url = `${PREDIXI_BASE_URL}${path}`
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url)
      return true
    }
    // Legacy fallback for webviews that block Clipboard API
    const el = document.createElement('textarea')
    el.value = url
    el.style.cssText = 'position:absolute;left:-9999px;top:-9999px'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Open in Base App
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attempts to surface the given URL inside Base App via the native share sheet.
 * Falls back to opening in a new tab.
 */
export async function openInBaseApp(url?: string): Promise<void> {
  if (typeof window === 'undefined') return
  const target = url ?? PREDIXI_BASE_URL
  if (isShareSupported()) {
    try {
      await navigator.share({ url: target, title: 'PrediXI' })
      return
    } catch {
      /* user dismissed — fall through */
    }
  }
  window.open(target, '_blank', 'noopener,noreferrer')
}

// ─────────────────────────────────────────────────────────────────────────────
// Share prediction
// ─────────────────────────────────────────────────────────────────────────────

export type ShareResult = 'shared' | 'copied' | 'failed'

export interface SharePredictionParams {
  homeTeam:     string
  awayTeam:     string
  pick:         string   // e.g. "Home Win" | "Draw" | "Away Win"
  leagueName?:  string
}

/**
 * Shares a match prediction via Web Share API or falls back to copying
 * the /matches deep link.
 * Returns 'shared' if navigator.share succeeded, 'copied' if link was copied,
 * 'failed' if both paths failed.
 */
export async function sharePrediction(
  params: SharePredictionParams,
): Promise<ShareResult> {
  const { homeTeam, awayTeam, pick, leagueName } = params
  const league = leagueName ? `${leagueName} · ` : ''
  const text   = `${league}${homeTeam} vs ${awayTeam} — I picked ${pick} on PrediXI 🔮`
  const url    = `${PREDIXI_BASE_URL}/matches`

  if (isShareSupported()) {
    try {
      await navigator.share({ title: 'My PrediXI Prediction', text, url })
      return 'shared'
    } catch {
      // User dismissed share sheet — not an error we surface
      return 'failed'
    }
  }

  const copied = await copyDeepLink('/matches')
  return copied ? 'copied' : 'failed'
}

// ─────────────────────────────────────────────────────────────────────────────
// Share Daily XI
// ─────────────────────────────────────────────────────────────────────────────

export interface ShareDailyXIParams {
  filledCount:    number   // 0–11 slots filled
  projectedMaxXp: number
  earnedXp?:      number
}

/**
 * Shares a Daily XI squad summary via Web Share API or falls back to copying
 * the /profile deep link.
 * Returns 'shared' | 'copied' | 'failed'.
 */
export async function shareDailyXI(
  params: ShareDailyXIParams,
): Promise<ShareResult> {
  const { filledCount, projectedMaxXp, earnedXp } = params
  const xpStr =
    earnedXp !== undefined && earnedXp > 0
      ? `${earnedXp} XP earned`
      : `${projectedMaxXp} XP projected`
  const text = `I built my Daily XI (${filledCount}/11) on PrediXI 🃏 ${xpStr}`
  const url  = `${PREDIXI_BASE_URL}/profile`

  if (isShareSupported()) {
    try {
      await navigator.share({ title: 'My PrediXI Daily XI', text, url })
      return 'shared'
    } catch {
      return 'failed'
    }
  }

  const copied = await copyDeepLink('/profile')
  return copied ? 'copied' : 'failed'
}
