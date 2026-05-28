/**
 * scripts/test-football-data-hardening.mjs
 *
 * Pure-logic tests for football data hardening (Step 12).
 * No DB, no network — verifies status normalization, fixture validation,
 * outcome inference, and sort order in plain Node.
 *
 * Run: node scripts/test-football-data-hardening.mjs
 */

// ─────────────────────────────────────────────────────────────────────────────
// Inline copies of the pure logic from src/lib/football/status.ts
// (avoids TypeScript transpilation in plain Node)
// ─────────────────────────────────────────────────────────────────────────────

const FD_FINISHED  = new Set(['FINISHED'])
const FD_LIVE      = new Set(['IN_PLAY', 'PAUSED', 'HALFTIME'])
const FD_POSTPONED = new Set(['POSTPONED', 'SUSPENDED'])
const FD_CANCELLED = new Set(['CANCELLED'])

function normalizeFdStatus(raw) {
  if (FD_FINISHED.has(raw))  return 'finished'
  if (FD_LIVE.has(raw))      return 'live'
  if (FD_POSTPONED.has(raw)) return 'postponed'
  if (FD_CANCELLED.has(raw)) return 'cancelled'
  return 'upcoming'
}

const APF_FINISHED  = new Set(['FT', 'AET', 'PEN'])
const APF_LIVE      = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'])
const APF_POSTPONED = new Set(['PST', 'ABD', 'WO', 'AWD', 'INT'])
const APF_CANCELLED = new Set(['CANC'])

function normalizeApfStatus(raw) {
  if (APF_FINISHED.has(raw))  return 'finished'
  if (APF_LIVE.has(raw))      return 'live'
  if (APF_POSTPONED.has(raw)) return 'postponed'
  if (APF_CANCELLED.has(raw)) return 'cancelled'
  return 'upcoming'
}

function inferOutcome(home, away, status) {
  if (status !== 'finished' || home === null || away === null) return null
  return home > away ? 'H' : away > home ? 'A' : 'D'
}

const MAX_FUTURE_MS = 5 * 365.25 * 24 * 3600 * 1000

function validateFixture(row) {
  if (!row.id || row.id.trim() === '') {
    return { valid: false, reason: 'missing match id' }
  }
  if (!row.kickoff || row.kickoff.trim() === '') {
    return { valid: false, reason: `[${row.id}] missing kickoff` }
  }
  const ms = Date.parse(row.kickoff)
  if (isNaN(ms)) {
    return { valid: false, reason: `[${row.id}] unparseable kickoff: "${row.kickoff}"` }
  }
  if (ms > Date.now() + MAX_FUTURE_MS) {
    return { valid: false, reason: `[${row.id}] kickoff too far in future: "${row.kickoff}"` }
  }
  if (!row.homeTeamName || row.homeTeamName.trim() === '') {
    return { valid: false, reason: `[${row.id}] missing home team name` }
  }
  if (!row.awayTeamName || row.awayTeamName.trim() === '') {
    return { valid: false, reason: `[${row.id}] missing away team name` }
  }
  if (!row.homeTeamId || row.homeTeamId.trim() === '') {
    return { valid: false, reason: `[${row.id}] missing home team id` }
  }
  if (!row.awayTeamId || row.awayTeamId.trim() === '') {
    return { valid: false, reason: `[${row.id}] missing away team id` }
  }
  return { valid: true }
}

const MATCH_STATUS_ORDER = {
  live:      0,
  upcoming:  1,
  postponed: 2,
  cancelled: 3,
  finished:  4,
}

// ─────────────────────────────────────────────────────────────────────────────
// Test harness
// ─────────────────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(label, actual, expected) {
  if (actual === expected) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.error(`  ✗ ${label}`)
    console.error(`    expected: ${JSON.stringify(expected)}`)
    console.error(`    actual:   ${JSON.stringify(actual)}`)
    failed++
  }
}

function assertValid(label, row) {
  const r = validateFixture(row)
  if (r.valid) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.error(`  ✗ ${label} — unexpectedly invalid: ${r.reason}`)
    failed++
  }
}

function assertInvalid(label, row, expectedReasonSubstr) {
  const r = validateFixture(row)
  if (!r.valid && r.reason.includes(expectedReasonSubstr)) {
    console.log(`  ✓ ${label}`)
    passed++
  } else if (!r.valid) {
    console.error(`  ✗ ${label} — invalid but wrong reason: ${r.reason}`)
    failed++
  } else {
    console.error(`  ✗ ${label} — expected invalid, got valid`)
    failed++
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1: football-data.org status normalization
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n[1] normalizeFdStatus')

assert('FINISHED → finished',   normalizeFdStatus('FINISHED'),  'finished')
assert('IN_PLAY → live',        normalizeFdStatus('IN_PLAY'),   'live')
assert('PAUSED → live',         normalizeFdStatus('PAUSED'),    'live')
assert('HALFTIME → live',       normalizeFdStatus('HALFTIME'),  'live')
assert('POSTPONED → postponed', normalizeFdStatus('POSTPONED'), 'postponed')
assert('SUSPENDED → postponed', normalizeFdStatus('SUSPENDED'), 'postponed')
assert('CANCELLED → cancelled', normalizeFdStatus('CANCELLED'), 'cancelled')
assert('SCHEDULED → upcoming',  normalizeFdStatus('SCHEDULED'), 'upcoming')
assert('TBD → upcoming',        normalizeFdStatus('TBD'),       'upcoming')
assert('AWARDED → upcoming',    normalizeFdStatus('AWARDED'),   'upcoming')
assert('unknown → upcoming',    normalizeFdStatus('FOOBAR'),    'upcoming')

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2: api-football status normalization
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n[2] normalizeApfStatus')

assert('FT → finished',   normalizeApfStatus('FT'),   'finished')
assert('AET → finished',  normalizeApfStatus('AET'),  'finished')
assert('PEN → finished',  normalizeApfStatus('PEN'),  'finished')
assert('1H → live',       normalizeApfStatus('1H'),   'live')
assert('2H → live',       normalizeApfStatus('2H'),   'live')
assert('HT → live',       normalizeApfStatus('HT'),   'live')
assert('ET → live',       normalizeApfStatus('ET'),   'live')
assert('BT → live',       normalizeApfStatus('BT'),   'live')
assert('P → live',        normalizeApfStatus('P'),    'live')
assert('LIVE → live',     normalizeApfStatus('LIVE'), 'live')
assert('PST → postponed', normalizeApfStatus('PST'),  'postponed')
assert('ABD → postponed', normalizeApfStatus('ABD'),  'postponed')
assert('WO → postponed',  normalizeApfStatus('WO'),   'postponed')
assert('AWD → postponed', normalizeApfStatus('AWD'),  'postponed')
assert('INT → postponed', normalizeApfStatus('INT'),  'postponed')
assert('CANC → cancelled',normalizeApfStatus('CANC'), 'cancelled')
assert('NS → upcoming',   normalizeApfStatus('NS'),   'upcoming')
assert('TBD → upcoming',  normalizeApfStatus('TBD'),  'upcoming')
assert('unknown → upcoming', normalizeApfStatus('FOOBAR'), 'upcoming')

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3: inferOutcome
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n[3] inferOutcome')

assert('home win',          inferOutcome(2, 1, 'finished'), 'H')
assert('away win',          inferOutcome(0, 1, 'finished'), 'A')
assert('draw',              inferOutcome(1, 1, 'finished'), 'D')
assert('live → null',       inferOutcome(1, 0, 'live'),     null)
assert('upcoming → null',   inferOutcome(null, null, 'upcoming'), null)
assert('null scores → null',inferOutcome(null, null, 'finished'), null)
assert('0-0 draw',          inferOutcome(0, 0, 'finished'), 'D')

// ─────────────────────────────────────────────────────────────────────────────
// Suite 4: validateFixture — valid cases
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n[4] validateFixture — valid')

const baseRow = {
  id:           'fd-12345',
  kickoff:      '2026-06-01T15:00:00Z',
  homeTeamId:   'fd-team-1',
  homeTeamName: 'Arsenal',
  awayTeamId:   'fd-team-2',
  awayTeamName: 'Chelsea',
}

assertValid('standard fixture', baseRow)
assertValid('future fixture (4.9yr)', {
  ...baseRow,
  kickoff: new Date(Date.now() + MAX_FUTURE_MS * 0.98).toISOString(),
})

// ─────────────────────────────────────────────────────────────────────────────
// Suite 5: validateFixture — invalid cases
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n[5] validateFixture — invalid')

assertInvalid('missing id',          { ...baseRow, id: '' },            'missing match id')
assertInvalid('null kickoff',        { ...baseRow, kickoff: null },     'missing kickoff')
assertInvalid('empty kickoff',       { ...baseRow, kickoff: '   ' },    'missing kickoff')
assertInvalid('unparseable kickoff', { ...baseRow, kickoff: 'not-a-date' }, 'unparseable kickoff')
assertInvalid('kickoff >5yr future', {
  ...baseRow,
  kickoff: new Date(Date.now() + MAX_FUTURE_MS * 1.1).toISOString(),
}, 'kickoff too far in future')
assertInvalid('empty home team name', { ...baseRow, homeTeamName: '' },   'missing home team name')
assertInvalid('empty away team name', { ...baseRow, awayTeamName: '  ' }, 'missing away team name')
assertInvalid('missing home team id', { ...baseRow, homeTeamId: '' },     'missing home team id')
assertInvalid('missing away team id', { ...baseRow, awayTeamId: null },   'missing away team id')

// ─────────────────────────────────────────────────────────────────────────────
// Suite 6: MATCH_STATUS_ORDER sort order
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n[6] MATCH_STATUS_ORDER sort order')

const statuses = ['finished', 'upcoming', 'cancelled', 'postponed', 'live']
const sorted = [...statuses].sort((a, b) =>
  (MATCH_STATUS_ORDER[a] ?? 9) - (MATCH_STATUS_ORDER[b] ?? 9)
)
assert('live first',      sorted[0], 'live')
assert('upcoming second', sorted[1], 'upcoming')
assert('postponed third', sorted[2], 'postponed')
assert('cancelled fourth',sorted[3], 'cancelled')
assert('finished last',   sorted[4], 'finished')
assert('unknown → 9',     MATCH_STATUS_ORDER['bogus'] ?? 9, 9)

// ─────────────────────────────────────────────────────────────────────────────
// Suite 7: Source ID stability (fd- vs apf- prefix convention)
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n[7] Source ID prefix stability')

function idPrefix(id) { return id.startsWith('fd-') ? 'fd' : id.startsWith('apf-') ? 'apf' : 'unknown' }

assert('fd match id prefix',  idPrefix('fd-12345'),  'fd')
assert('apf match id prefix', idPrefix('apf-98765'), 'apf')
assert('fd team id detects source', idPrefix('fd-team-999'), 'fd')
assert('apf team id detects source', idPrefix('apf-team-1'), 'apf')

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`)
console.log(`Results: ${passed} passed, ${failed} failed`)

if (failed > 0) {
  process.exit(1)
} else {
  console.log('All tests passed.')
}
