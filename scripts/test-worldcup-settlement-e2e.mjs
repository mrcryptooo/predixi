/**
 * World Cup Settlement — End-to-End Verification Script
 *
 * Tests the full pipeline: prediction → settlement → xp_events → leaderboard_stats
 *
 * Safety:
 *   - Isolated test wallet (0x...e2e0) — never in production data
 *   - Cleans up ALL test rows on exit (success or failure)
 *   - No permanent production XP or leaderboard pollution
 *
 * Usage:
 *   node scripts/test-worldcup-settlement-e2e.mjs
 */

import { ProxyAgent } from 'undici'
import { readFileSync }  from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))

// ── Load .env.local ──────────────────────────────────────────────────────────

function loadEnv() {
  try {
    const lines = readFileSync(resolve(__dir, '..', '.env.local'), 'utf8').split('\n')
    for (const line of lines) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const idx = t.indexOf('=')
      if (idx === -1) continue
      const key = t.slice(0, idx).trim()
      const val = t.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
      if (key && !(key in process.env)) process.env[key] = val
    }
  } catch { /* use process.env as-is */ }
}
loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const PROXY_URL    = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')
  process.exit(1)
}

// ── undici request wrapper — proxy optional, falls back to direct ────────────

import { request as undiciRequest } from 'undici'


let _dispatcher = undefined
if (PROXY_URL) {
  try {
    // Quick connectivity check — if proxy is unreachable, go direct
    const testDispatcher = new ProxyAgent(PROXY_URL)
    // We'll set it and let the first real request fail gracefully if needed
    _dispatcher = testDispatcher
  } catch { /* go direct */ }
}

async function apiFetch(path, opts = {}) {
  const url = `${SUPABASE_URL}/rest/v1${path}`
  const method  = opts.method ?? 'GET'
  const body    = opts.body
  const headers = {
    'apikey':        SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type':  'application/json',
    'Prefer':        'return=representation',
    ...(opts.headers ?? {}),
  }

  // Try with proxy first (if configured), fall back to direct on ECONNREFUSED
  async function doRequest(dispatcher) {
    const reqOpts = { method, headers, ...(body !== undefined ? { body } : {}) }
    if (dispatcher) reqOpts.dispatcher = dispatcher
    const { statusCode, body: resBody } = await undiciRequest(url, reqOpts)
    const text = await resBody.text()
    let data
    try { data = JSON.parse(text) } catch { data = text }
    return { status: statusCode, ok: statusCode >= 200 && statusCode < 300, data }
  }

  if (_dispatcher) {
    try {
      return await doRequest(_dispatcher)
    } catch (e) {
      if (e.code === 'ECONNREFUSED' || e.code === 'UND_ERR_CONNECT_TIMEOUT') {
        _dispatcher = undefined // proxy down — go direct for remaining requests
        return doRequest(undefined)
      }
      throw e
    }
  }
  return doRequest(undefined)
}

async function dbSelect(table, params = {}) {
  const qs = new URLSearchParams(params).toString()
  const { data, ok, status } = await apiFetch(`/${table}${qs ? '?' + qs : ''}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  })
  if (!ok) throw new Error(`SELECT ${table} failed (${status}): ${JSON.stringify(data)}`)
  return Array.isArray(data) ? data : []
}

async function dbInsert(table, body) {
  const { data, ok, status } = await apiFetch(`/${table}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Prefer': 'return=representation,resolution=merge-duplicates' },
  })
  if (!ok) throw new Error(`INSERT ${table} failed (${status}): ${JSON.stringify(data)}`)
  return Array.isArray(data) ? data[0] : data
}

async function dbInsertIgnoreDup(table, body) {
  // For inserting xp_events where we expect possible unique constraint violations
  const { data, ok, status } = await apiFetch(`/${table}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Prefer': 'return=representation' },
  })
  if (!ok) {
    const errCode = (typeof data === 'object' && data?.code) ? data.code : ''
    if (errCode === '23505') return { duplicate: true }
    throw new Error(`INSERT ${table} failed (${status}): ${JSON.stringify(data)}`)
  }
  return Array.isArray(data) ? data[0] : data
}

async function dbUpdate(table, body, params = {}) {
  const qs = new URLSearchParams(params).toString()
  const { data, ok, status } = await apiFetch(`/${table}${qs ? '?' + qs : ''}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Prefer': 'return=representation' },
  })
  if (!ok) throw new Error(`UPDATE ${table} failed (${status}): ${JSON.stringify(data)}`)
  return Array.isArray(data) ? data : []
}

async function dbDelete(table, params = {}) {
  const qs = new URLSearchParams(params).toString()
  const { ok, status, data } = await apiFetch(`/${table}${qs ? '?' + qs : ''}`, { method: 'DELETE' })
  if (!ok) throw new Error(`DELETE ${table} failed (${status}): ${JSON.stringify(data)}`)
}

// ── Test constants ───────────────────────────────────────────────────────────

const TEST_WALLET   = '0x000000000000000000000000000000000000e2e0'
const TEST_KEY_WIN  = 'e2e-test-wc-winner'
const TEST_KEY_LOSE = 'e2e-test-wc-loser'
const TEST_KEY_DUP  = 'e2e-test-wc-dup'
const CORRECT       = 'TestNation'
const WRONG         = 'OtherNation'
const FAKE_HASH     = `0x${'ab'.repeat(32)}`

// ── Assertion helpers ────────────────────────────────────────────────────────

let passed = 0, failed = 0
const failures = []

function pass(label) { console.log(`  ✓  ${label}`); passed++ }
function fail(label, detail = '') {
  console.log(`  ✗  ${label}${detail ? `  →  ${detail}` : ''}`)
  failed++; failures.push(`${label}${detail ? ` → ${detail}` : ''}`)
}
function check(cond, ok, bad, detail = '') { cond ? pass(ok) : fail(bad, String(detail)) }

// ── isWCPredictionCorrect — inline (matches worldcup-settlement.ts exactly) ──

function isCorrect(selected, correctValues) {
  if (!selected.length || !correctValues.length) return false
  const norm = s => s.trim().toLowerCase()
  const set  = new Set(correctValues.map(norm))
  return selected.map(norm).every(v => set.has(v))
}

// ── DB helpers ───────────────────────────────────────────────────────────────

async function insertPrediction(key, selection, xpReward = 10) {
  const row = await dbInsert('wc_predictions', {
    wallet_address:  TEST_WALLET,
    prediction_key:  key,
    prediction_type: 'tournament',
    selected_value:  selection,
    xp_reward:       xpReward,
    status:          'pending',
    commitment_hash: FAKE_HASH,
    updated_at:      new Date().toISOString(),
  })
  if (!row?.id) throw new Error(`insertPrediction(${key}): no id returned`)
  return row
}

async function getRow(key) {
  const rows = await dbSelect('wc_predictions', {
    'wallet_address': `eq.${TEST_WALLET}`,
    'prediction_key': `eq.${key}`,
    'select':         '*',
  })
  return rows[0] ?? null
}

async function getXpEvents(rowId) {
  return dbSelect('xp_events', {
    'source_type': 'eq.wc_prediction',
    'source_id':   `eq.${rowId}`,
    'select':      '*',
  })
}

async function getLbRows(profileId) {
  return dbSelect('leaderboard_stats', {
    'profile_id': `eq.${profileId}`,
    'select':     'xp,weekly_xp,period',
  })
}

// ── Settlement logic (inline — mirrors worldcup-settlement.ts) ────────────────

async function incrementLbXp(profileId, xpDelta) {
  for (const period of ['all_time', 'weekly']) {
    const rows = await dbSelect('leaderboard_stats', {
      'profile_id': `eq.${profileId}`,
      'period':     `eq.${period}`,
      'select':     'id,xp,weekly_xp',
    })
    const ex = rows[0]
    if (ex) {
      await dbUpdate('leaderboard_stats', {
        xp:          (ex.xp      ?? 0) + xpDelta,
        weekly_xp:   period === 'weekly' ? (ex.weekly_xp ?? 0) + xpDelta : (ex.weekly_xp ?? 0),
        computed_at: new Date().toISOString(),
      }, { 'id': `eq.${ex.id}` })
    } else {
      await dbInsert('leaderboard_stats', {
        profile_id: profileId, period,
        xp: xpDelta, weekly_xp: period === 'weekly' ? xpDelta : 0,
        total_predictions: 0, correct_predictions: 0, accuracy: 0,
        position: null, computed_at: new Date().toISOString(),
      })
    }
  }
}

async function settle(row, correctValues) {
  const result = { predictionId: row.id, walletAddress: row.wallet_address, isWinner: false, xpAwarded: 0, xpDuplicate: false, error: null }
  try {
    result.isWinner  = isCorrect(row.selected_value, correctValues)
    result.xpAwarded = result.isWinner ? (row.xp_reward ?? 0) : 0

    await dbUpdate('wc_predictions',
      { status: result.isWinner ? 'won' : 'lost', updated_at: new Date().toISOString() },
      { 'id': `eq.${row.id}` },
    )

    if (result.isWinner && result.xpAwarded > 0) {
      const xpResult = await dbInsertIgnoreDup('xp_events', {
        wallet_address: row.wallet_address,
        source_type:    'wc_prediction',
        source_id:      row.id,
        xp_amount:      result.xpAwarded,
        reason:         'wc_prediction_correct',
        metadata:       { predictionKey: row.prediction_key, selectedValue: row.selected_value, correctValues },
      })
      if (xpResult?.duplicate) {
        result.xpDuplicate = true
      } else {
        const profiles = await dbSelect('profiles', { 'wallet_address': `eq.${row.wallet_address}`, 'select': 'id' })
        if (profiles[0]?.id) await incrementLbXp(profiles[0].id, result.xpAwarded)
      }
    }
  } catch (e) { result.error = e.message }
  return result
}

// ── Test profile ─────────────────────────────────────────────────────────────

async function ensureTestProfile() {
  const existing = await dbSelect('profiles', { 'wallet_address': `eq.${TEST_WALLET}`, 'select': 'id' })
  if (existing[0]) return existing[0].id
  const row = await dbInsert('profiles', {
    wallet_address: TEST_WALLET, xp: 0, rank: 'bronze', streak: 0,
    total_predictions: 0, correct_predictions: 0,
  })
  if (!row?.id) throw new Error('profile insert: no id returned')
  return row.id
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

async function cleanup() {
  console.log('\n── Cleanup ──────────────────────────────────────────────────')
  const preds = await dbSelect('wc_predictions', { 'wallet_address': `eq.${TEST_WALLET}`, 'select': 'id' })
  for (const p of preds) {
    await dbDelete('xp_events', { 'source_type': 'eq.wc_prediction', 'source_id': `eq.${p.id}` })
  }
  if (preds.length) {
    await dbDelete('wc_predictions', { 'wallet_address': `eq.${TEST_WALLET}` })
    console.log(`  removed ${preds.length} wc_predictions + xp_events`)
  }
  const profiles = await dbSelect('profiles', { 'wallet_address': `eq.${TEST_WALLET}`, 'select': 'id' })
  if (profiles[0]) {
    await dbDelete('leaderboard_stats', { 'profile_id': `eq.${profiles[0].id}` })
    await dbDelete('profiles', { 'wallet_address': `eq.${TEST_WALLET}` })
    console.log('  removed test profile + leaderboard_stats')
  }
  console.log('  ✓ all test data removed')
}

// ── Test suites ───────────────────────────────────────────────────────────────

function suiteCorrectnessLogic() {
  console.log('\n── Suite 1: isWCPredictionCorrect logic ─────────────────────')
  check(isCorrect(['Brazil'],            ['Brazil']),          'exact match correct',         'exact match failed')
  check(isCorrect(['brazil'],            ['Brazil']),          'case-insensitive correct',    'case-insensitive failed')
  check(!isCorrect(['France'],           ['Brazil']),          'wrong team incorrect',         'wrong team passed')
  check(!isCorrect([],                   ['Brazil']),          'empty selection incorrect',    'empty selection passed')
  check(!isCorrect(['Brazil'],           []),                  'empty correctValues → false',  'empty correctValues passed')
  check(isCorrect(['Brazil', 'France'],  ['France', 'Brazil']), 'multi-pick all correct',     'multi-pick all failed')
  check(!isCorrect(['Brazil', 'Germany'],['France', 'Brazil']), 'partial multi incorrect',    'partial multi passed')
  check(isCorrect([' Brazil '],          ['Brazil']),          'trim-normalised correct',      'trim-normalised failed')
  check(!isCorrect(['  '],               ['Brazil']),          'whitespace-only incorrect',    'whitespace-only passed')
  check(isCorrect(['BRAZIL'],            ['brazil']),          'all-caps vs lowercase correct','all-caps failed')
}

async function suiteWinnerPipeline(profileId) {
  console.log('\n── Suite 2: Winner — status → xp_events → leaderboard ───────')
  const row = await insertPrediction(TEST_KEY_WIN, [CORRECT], 15)
  check(row.status === 'pending',         'inserted status=pending',          'wrong initial status', row.status)
  check(!!row.commitment_hash,            'commitment_hash present on insert', 'commitment_hash missing on insert')

  const res = await settle(row, [CORRECT])
  check(res.isWinner,                     'isWinner = true',                  'should be winner')
  check(res.xpAwarded === 15,             'xpAwarded = 15',                   'wrong xpAwarded', res.xpAwarded)
  check(!res.xpDuplicate,                 'not a duplicate',                  'flagged as duplicate')
  check(!res.error,                       'no error',                         'settlement error: ' + res.error)

  const dbRow = await getRow(TEST_KEY_WIN)
  check(dbRow?.status === 'won',          'DB status = won',                  'DB status wrong', dbRow?.status)
  check(!!dbRow?.commitment_hash,         'commitment_hash preserved',         'commitment_hash lost after settlement')

  const events = await getXpEvents(row.id)
  check(events.length === 1,              '1 xp_event inserted',               'xp_events count wrong', events.length)
  check(events[0]?.xp_amount === 15,      'xp_amount = 15',                    'xp_amount wrong', events[0]?.xp_amount)
  check(events[0]?.source_type === 'wc_prediction', 'source_type = wc_prediction', 'wrong source_type')
  check(events[0]?.source_id === row.id,  'source_id matches row',              'wrong source_id')

  const lb      = await getLbRows(profileId)
  const allTime = lb.find(r => r.period === 'all_time')
  const weekly  = lb.find(r => r.period === 'weekly')
  check((allTime?.xp ?? 0) >= 15, 'leaderboard all_time xp ≥ 15', 'all_time xp insufficient', allTime?.xp)
  check((weekly?.xp  ?? 0) >= 15, 'leaderboard weekly xp ≥ 15',   'weekly xp insufficient',   weekly?.xp)
}

async function suiteLoserPipeline() {
  console.log('\n── Suite 3: Loser — status=lost, no XP ─────────────────────')
  const row = await insertPrediction(TEST_KEY_LOSE, [WRONG], 10)
  const res = await settle(row, [CORRECT])

  check(!res.isWinner,           'isWinner = false',    'loser should not win')
  check(res.xpAwarded === 0,     'xpAwarded = 0',       'loser got XP', res.xpAwarded)
  check(!res.error,              'no error',            'error: ' + res.error)

  const dbRow = await getRow(TEST_KEY_LOSE)
  check(dbRow?.status === 'lost', 'DB status = lost',   'DB status wrong', dbRow?.status)

  const events = await getXpEvents(row.id)
  check(events.length === 0,     'no xp_events for loser', 'loser has xp_events', events.length)
}

async function suiteDuplicateSafety(profileId) {
  console.log('\n── Suite 4: Duplicate safety — settle twice, no double XP ───')
  const row = await insertPrediction(TEST_KEY_DUP, [CORRECT], 20)

  const res1 = await settle(row, [CORRECT])
  check(res1.isWinner,           'first: isWinner',          'first should win')
  check(!res1.xpDuplicate,       'first: not duplicate',     'first flagged as dup')
  check(res1.xpAwarded === 20,   'first: xpAwarded = 20',    'first XP wrong', res1.xpAwarded)

  // Second settlement — same row (simulate retry/bug)
  const res2 = await settle({ ...row, status: 'won' }, [CORRECT])
  check(res2.isWinner,            'second: still winner',       'second not winner')
  check(res2.xpDuplicate === true,'second: xpDuplicate = true', 'dup flag missing', res2.xpDuplicate)

  // Only one xp_event (unique constraint on source_id)
  const events = await getXpEvents(row.id)
  check(events.length === 1, 'exactly 1 xp_event after 2 settlements', 'duplicate xp_events', events.length)

  // Leaderboard must not have grown on third settlement
  const lb1   = await getLbRows(profileId)
  const xp1   = lb1.find(r => r.period === 'all_time')?.xp ?? 0
  await settle({ ...row, status: 'won' }, [CORRECT])
  const lb2   = await getLbRows(profileId)
  const xp2   = lb2.find(r => r.period === 'all_time')?.xp ?? 0
  check(xp2 === xp1, 'leaderboard unchanged after 3rd duplicate', 'leaderboard grew on dup', `${xp1} → ${xp2}`)
}

async function suiteFailureCases() {
  console.log('\n── Suite 5: Failure & edge cases ────────────────────────────')

  // Non-existent key → 0 pending rows (route returns success, winners=0)
  const noPending = await dbSelect('wc_predictions', {
    'prediction_key': 'eq.nonexistent-key-xyz',
    'status':         'eq.pending',
    'select':         'id',
  })
  check(noPending.length === 0, 'nonexistent key has 0 pending rows', 'unexpected rows', noPending.length)

  // Won row no longer shows as pending (route filters status=pending)
  const wonPending = await dbSelect('wc_predictions', {
    'wallet_address': `eq.${TEST_WALLET}`,
    'prediction_key': `eq.${TEST_KEY_WIN}`,
    'status':         'eq.pending',
    'select':         'id',
  })
  check(wonPending.length === 0, 'won row not visible as pending', 'won row shows as pending')

  // Lost row not pending
  const lostPending = await dbSelect('wc_predictions', {
    'wallet_address': `eq.${TEST_WALLET}`,
    'prediction_key': `eq.${TEST_KEY_LOSE}`,
    'status':         'eq.pending',
    'select':         'id',
  })
  check(lostPending.length === 0, 'lost row not visible as pending', 'lost row shows as pending')

  // Edge cases — correctness function guards
  check(!isCorrect(['Brazil'], []),      'empty correctValues → false',       'empty CV passed')
  check(!isCorrect([], ['Brazil']),      'empty selection → false',           'empty sel passed')
  check(!isCorrect(['Br azil'], ['Brazil']), 'internal-space mismatch fails', 'internal-space passed')
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('══════════════════════════════════════════════════════════════')
  console.log('  PrediXI — World Cup Settlement E2E Verification')
  console.log('══════════════════════════════════════════════════════════════')
  console.log(`  Supabase : ${SUPABASE_URL}`)
  console.log(`  Proxy    : ${PROXY_URL ?? 'none'}`)

  let profileId
  try {
    profileId = await ensureTestProfile()
    console.log(`  wallet   : ${TEST_WALLET}`)
    console.log(`  profile  : ${profileId}`)
  } catch (e) {
    console.error('❌  Cannot create test profile:', e.message)
    process.exit(1)
  }

  try {
    suiteCorrectnessLogic()
    await suiteWinnerPipeline(profileId)
    await suiteLoserPipeline()
    await suiteDuplicateSafety(profileId)
    await suiteFailureCases()
  } finally {
    await cleanup()
  }

  console.log('\n══════════════════════════════════════════════════════════════')
  console.log(`  ${passed + failed} assertions · ${passed} passed · ${failed} failed`)
  if (failures.length) {
    console.log('\n  Failed:')
    failures.forEach(f => console.log(`    ✗ ${f}`))
  }
  console.log('══════════════════════════════════════════════════════════════')
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error('Fatal:', e.message ?? e); process.exit(1) })
