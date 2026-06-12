// Registers (or refreshes) QStash cron schedules for WC real-time sync.
// Runs at the start of `vercel build` — idempotent, safe to run on every deploy.
//
// Required env vars:
//   QSTASH_TOKEN       — from https://console.upstash.com/ → QStash → token
//   CRON_SECRET        — already set in Vercel (same one the route handlers check)
//
// Optional env vars:
//   PREDIXI_APP_URL    — defaults to https://predixi-base.vercel.app

const QSTASH_TOKEN = process.env.QSTASH_TOKEN
const CRON_SECRET  = process.env.CRON_SECRET
const APP_URL      = (
  process.env.PREDIXI_APP_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'https://predixi-base.vercel.app')
).replace(/\/$/, '')

// ─── schedule definitions ──────────────────────────────────────────────────────
const SCHEDULES = [
  { id: 'predixi-wc-sync-results',   path: '/api/cron/sync-wc-results',  cron: '*/3 * * * *' },
  { id: 'predixi-wc-sync-standings', path: '/api/cron/sync-wc-standings', cron: '*/5 * * * *' },
  { id: 'predixi-wc-auto-settle',    path: '/api/cron/auto-settle',       cron: '*/5 * * * *' },
]

// ─── QStash REST helper ────────────────────────────────────────────────────────
async function qstash(method, path, extraHeaders = {}) {
  const res = await fetch(`https://qstash.upstash.io/v2${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${QSTASH_TOKEN}`,
      ...extraHeaders,
    },
  })
  if (res.status === 204) return null
  const text = await res.text()
  if (!res.ok) throw new Error(`QStash ${method} ${path} → ${res.status}: ${text}`)
  try { return JSON.parse(text) } catch { return text }
}

// ─── main ──────────────────────────────────────────────────────────────────────
;(async () => {
  if (!QSTASH_TOKEN) {
    console.log('[qstash-setup] QSTASH_TOKEN not set — skipping schedule registration.')
    return
  }
  if (!CRON_SECRET) {
    console.error('[qstash-setup] CRON_SECRET not set — cannot create authenticated schedules.')
    process.exit(1)
  }

  console.log(`[qstash-setup] Target app: ${APP_URL}`)

  // List existing schedules and delete ours (clean slate approach)
  const existing = await qstash('GET', '/schedules')
  const ourIds = new Set(SCHEDULES.map(s => s.id))

  for (const s of (existing ?? [])) {
    if (ourIds.has(s.scheduleId)) {
      await qstash('DELETE', `/schedules/${s.scheduleId}`)
      console.log(`[qstash-setup] Removed old schedule: ${s.scheduleId}`)
    }
  }

  // Create fresh schedules with stable IDs
  for (const { id, path, cron } of SCHEDULES) {
    const destination = `${APP_URL}${path}`
    await qstash(
      'POST',
      `/schedules/${encodeURIComponent(destination)}`,
      {
        'Content-Type':                  'application/json',
        'Upstash-Cron':                   cron,
        'Upstash-Schedule-Id':            id,
        'Upstash-Retries':               '3',
        'Upstash-Forward-Authorization': `Bearer ${CRON_SECRET}`,
      }
    )
    console.log(`[qstash-setup] ✓ ${id}  (${cron})  →  ${destination}`)
  }

  console.log('[qstash-setup] All schedules registered. QStash will begin firing within the next cron window.')
})().catch(err => {
  // Non-fatal: a QStash API blip should not abort the Vercel build.
  // Existing schedules keep running until next successful deploy.
  console.error('[qstash-setup] Warning — schedule registration failed:', err.message)
  console.error('[qstash-setup] Existing QStash schedules (if any) remain active.')
})
