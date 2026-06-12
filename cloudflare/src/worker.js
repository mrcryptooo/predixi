/**
 * PrediXI WC Scheduler — Cloudflare Worker
 *
 * Calls the WC cron routes on a schedule.
 * Runs on Cloudflare's free tier (100k requests/day; we use ~770/day).
 *
 * Cron triggers (set in wrangler.toml):
 *   every-3-minutes  → /api/cron/sync-wc-results   (results only, smart-skip inside)
 *   every-5-minutes  → /api/cron/sync-wc-standings  (group table)
 *                    → /api/cron/auto-settle         (XP + leaderboard)
 *
 * Settlement runs in the same 5-min cycle as standings — separate from sync.
 * This eliminates any risk of concurrent settlement with the sync route.
 *
 * Required Worker secret (set once via `wrangler secret put`):
 *   CRON_SECRET   — same value as in Vercel env vars
 *
 * Optional Worker var (wrangler.toml [vars] or secret):
 *   APP_URL       — defaults to https://predixi-base.vercel.app
 */

const CRON_RESULTS = '*/3 * * * *'
const CRON_5MIN    = '*/5 * * * *'

export default {
  async scheduled(event, env, ctx) {
    const appUrl = (env.APP_URL || 'https://predixi-base.vercel.app').replace(/\/$/, '')
    const auth   = `Bearer ${env.CRON_SECRET}`

    const endpoints =
      event.cron === CRON_RESULTS ? ['/api/cron/sync-wc-results'] :
      event.cron === CRON_5MIN    ? ['/api/cron/sync-wc-standings', '/api/cron/auto-settle'] :
      []

    if (endpoints.length === 0) {
      console.warn(`[scheduler] Unknown cron: ${event.cron}`)
      return
    }

    // Run all endpoints for this cron in parallel
    await Promise.all(endpoints.map(async path => {
      try {
        const res  = await fetch(`${appUrl}${path}`, {
          method:  'GET',
          headers: { Authorization: auth },
          signal:  AbortSignal.timeout(55_000),
        })
        const body = await res.json().catch(() => ({}))
        console.log(`[scheduler] ${path} → ${res.status}`, JSON.stringify(body).slice(0, 300))
      } catch (err) {
        console.error(`[scheduler] ${path} failed:`, err.message)
      }
    }))
  },
}
