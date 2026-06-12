/**
 * PrediXI WC Scheduler — Cloudflare Worker
 *
 * Calls the three WC cron routes on a schedule.
 * Runs on Cloudflare's free tier (100k requests/day; we use ~770/day).
 *
 * Cron triggers (set in wrangler.toml):
 *   every-3-minutes  → /api/cron/sync-wc-results   (results + inline settlement)
 *   every-5-minutes  → /api/cron/sync-wc-standings  (group table)
 *
 * Required Worker secrets (set once via `wrangler secret put`):
 *   CRON_SECRET   — same value as in Vercel env vars
 *
 * Optional Worker vars (set in wrangler.toml [vars] or as secrets):
 *   APP_URL       — defaults to https://predixi-base.vercel.app
 */

const CRON_RESULTS   = '*/3 * * * *'
const CRON_STANDINGS = '*/5 * * * *'

export default {
  async scheduled(event, env, ctx) {
    const appUrl = (env.APP_URL || 'https://predixi-base.vercel.app').replace(/\/$/, '')
    const auth   = `Bearer ${env.CRON_SECRET}`

    // Map each cron expression to its endpoint(s)
    const endpoints =
      event.cron === CRON_RESULTS   ? ['/api/cron/sync-wc-results']   :
      event.cron === CRON_STANDINGS ? ['/api/cron/sync-wc-standings']  :
      []  // unknown cron — log and skip

    if (endpoints.length === 0) {
      console.warn(`[scheduler] Unknown cron expression: ${event.cron}`)
      return
    }

    await Promise.all(endpoints.map(async path => {
      const url = `${appUrl}${path}`
      try {
        const res  = await fetch(url, {
          method:  'GET',
          headers: { Authorization: auth },
          signal:  AbortSignal.timeout(55_000),  // Cloudflare scheduled handler max: 60s
        })
        const body = await res.json().catch(() => ({}))
        console.log(`[scheduler] ${path} → ${res.status}`, JSON.stringify(body).slice(0, 300))
      } catch (err) {
        // Non-fatal: Vercel may be deploying or cold-starting
        console.error(`[scheduler] ${path} failed:`, err.message)
      }
    }))
  },
}
