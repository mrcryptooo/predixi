/**
 * Daily XI Scoring — end-to-end pipeline test
 *
 * Tests the full scoring pipeline directly (no HTTP server required):
 *   seed → calculate → DB writes (entry+xp_events+leaderboard) → verify → idempotency → cleanup
 *
 * Run:
 *   node test-daily-xi-e2e.mjs
 */

import { createClient }  from '@supabase/supabase-js'
import { ProxyAgent, Agent, fetch as undiciF } from 'undici'
import { readFileSync }  from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// ── Load .env.local ───────────────────────────────────────────────────────────

const __dir  = dirname(fileURLToPath(import.meta.url))
const envRaw = readFileSync(join(__dir, '.env.local'), 'utf8')
const env    = Object.fromEntries(
  envRaw.split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => [l.split('=')[0].trim(), l.slice(l.indexOf('=') + 1).trim()])
    .filter(([k]) => k)
)

const SUPABASE_URL     = env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_ROLE_KEY = env['SUPABASE_SERVICE_ROLE_KEY']
const HTTPS_PROXY      = env['HTTPS_PROXY']
const ADMIN_KEY        = env['ADMIN_SETTLEMENT_KEY']

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌  Missing SUPABASE env vars in .env.local')
  process.exit(1)
}

// ── Supabase client ───────────────────────────────────────────────────────────

const proxyDispatcher = HTTPS_PROXY ? new ProxyAgent(HTTPS_PROXY) : new Agent()

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: {
    fetch: (input, init) => undiciF(input, { ...init, dispatcher: proxyDispatcher }),
  },
})

// ── Scoring logic (replicated from src/lib/daily-xi-scoring.ts) ───────────────

function calculatePlayerScore(stats) {
  const breakdown = {
    played:      stats.played ? 1 : 0,
    goals:       stats.goals * 3,
    assists:     stats.assists * 2,
    cleanSheet:  stats.cleanSheet ? 2 : 0,
    rating:      stats.rating >= 8 ? 2 : stats.rating >= 7 ? 1 : 0,
    yellowCards: stats.yellowCards * -1,
    redCards:    stats.redCards * -3,
  }
  const raw = Object.values(breakdown).reduce((s, v) => s + v, 0)
  const xp  = Math.max(0, raw)
  return { playerId: stats.playerId, xp, breakdown }
}

function calculateDailyXIScore(players) {
  const playerBreakdown = players.map(calculatePlayerScore)
  const totalXp         = playerBreakdown.reduce((s, p) => s + p.xp, 0)
  return { totalXp, playerBreakdown }
}

// ── Leaderboard XP increment (replicated from route) ─────────────────────────

async function incrementLeaderboardXP(profileId, xpDelta) {
  for (const period of ['all_time', 'weekly']) {
    const { data: existing } = await supabase
      .from('leaderboard_stats')
      .select('id, xp, weekly_xp')
      .eq('profile_id', profileId)
      .eq('period', period)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('leaderboard_stats')
        .update({
          xp:          (existing.xp ?? 0) + xpDelta,
          weekly_xp:   period === 'weekly' ? (existing.weekly_xp ?? 0) + xpDelta : (existing.weekly_xp ?? 0),
          computed_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('leaderboard_stats')
        .insert({
          profile_id:          profileId,
          period,
          xp:                  xpDelta,
          weekly_xp:           period === 'weekly' ? xpDelta : 0,
          total_predictions:   0,
          correct_predictions: 0,
          accuracy:            0,
          position:            null,
          computed_at:         new Date().toISOString(),
        })
    }
  }
}

// ── Test constants ────────────────────────────────────────────────────────────

const TEST_WALLET = '0x0000000000000000000000000000000000099901'
const TODAY       = new Date().toISOString().slice(0, 10)

const PLAYER_STATS = [
  // p1: goals×3 + assist×2 + rating≥8×2 + played×1 = 6+2+2+1 = 11
  { playerId: 'e2e-p1',  goals: 2, assists: 1, rating: 8.5, played: true,  cleanSheet: false, yellowCards: 0, redCards: 0 },
  // p2: goal×3 + rating≥7×1 + played×1 - yellow×1 = 3+1+1-1 = 4
  { playerId: 'e2e-p2',  goals: 1, assists: 0, rating: 7.2, played: true,  cleanSheet: false, yellowCards: 1, redCards: 0 },
  // p3: assists×4 + rating≥7×1 + played×1 = 4+1+1 = 6
  { playerId: 'e2e-p3',  goals: 0, assists: 2, rating: 7.5, played: true,  cleanSheet: false, yellowCards: 0, redCards: 0 },
  // p4: assist×2 + played×1 = 2+1 = 3
  { playerId: 'e2e-p4',  goals: 0, assists: 1, rating: 6.8, played: true,  cleanSheet: false, yellowCards: 0, redCards: 0 },
  // p5: cleanSheet×2 + rating≥8×2 + played×1 = 2+2+1 = 5
  { playerId: 'e2e-p5',  goals: 0, assists: 0, rating: 8.0, played: true,  cleanSheet: true,  yellowCards: 0, redCards: 0 },
  // p6: cleanSheet×2 + played×1 = 2+1 = 3
  { playerId: 'e2e-p6',  goals: 0, assists: 0, rating: 6.5, played: true,  cleanSheet: true,  yellowCards: 0, redCards: 0 },
  // p7: rating≥7×1 + played×1 = 1+1 = 2
  { playerId: 'e2e-p7',  goals: 0, assists: 0, rating: 7.0, played: true,  cleanSheet: false, yellowCards: 0, redCards: 0 },
  // p8: goal×3 + rating≥7×1 + played×1 = 3+1+1 = 5
  { playerId: 'e2e-p8',  goals: 1, assists: 0, rating: 7.8, played: true,  cleanSheet: false, yellowCards: 0, redCards: 0 },
  // p9: played×1 - yellow×1 = 0 (floored)
  { playerId: 'e2e-p9',  goals: 0, assists: 0, rating: 6.0, played: true,  cleanSheet: false, yellowCards: 1, redCards: 0 },
  // p10: not played → 0
  { playerId: 'e2e-p10', goals: 0, assists: 0, rating: 5.0, played: false, cleanSheet: false, yellowCards: 0, redCards: 0 },
  // p11: cleanSheet×2 + rating≥8×2 + played×1 = 2+2+1 = 5
  { playerId: 'e2e-p11', goals: 0, assists: 0, rating: 8.2, played: true,  cleanSheet: true,  yellowCards: 0, redCards: 0 },
]
// p1=11 p2=4 p3=6 p4=3 p5=5 p6=3 p7=2 p8=5 p9=0 p10=0 p11=5 = 44
const EXPECTED_XP = 44

// ── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅  ${label}`)
    passed++
  } else {
    console.log(`  ❌  ${label}${detail ? ` — ${detail}` : ''}`)
    failed++
  }
}

// ── Full pipeline (mirrors src/app/api/admin/score-daily-xi/route.ts) ─────────

async function runScorePipeline(wallet, date, playerStats) {
  // 1. Fetch entry
  const { data: entry, error: fetchErr } = await supabase
    .from('daily_xi_entries')
    .select('id, status, earned_xp, projected_max_xp')
    .eq('wallet_address', wallet)
    .eq('entry_date', date)
    .maybeSingle()

  if (fetchErr) return { success: false, error: `DB error: ${fetchErr.message}` }
  if (!entry)   return { success: false, error: `No entry found for ${wallet} on ${date}`, notFound: true }

  // 2. Idempotent check
  if (entry.status === 'scored') {
    return { success: true, alreadyScored: true, entryId: entry.id, earnedXp: entry.earned_xp }
  }

  // 3. Score
  const { totalXp, playerBreakdown } = calculateDailyXIScore(playerStats)

  // 4. Update entry
  const { error: updateErr } = await supabase
    .from('daily_xi_entries')
    .update({ status: 'scored', earned_xp: totalXp })
    .eq('id', entry.id)

  if (updateErr) return { success: false, error: `Update failed: ${updateErr.message}` }

  // 5. Insert xp_events
  let xpDuplicate = false
  if (totalXp > 0) {
    const { error: xpErr } = await supabase
      .from('xp_events')
      .insert({
        wallet_address: wallet,
        source_type:    'daily_xi',
        source_id:      entry.id,
        xp_amount:      totalXp,
        reason:         'daily_xi_scored',
        metadata:       { entry_date: date, breakdown: playerBreakdown },
      })
    if (xpErr) {
      if (xpErr.code === '23505') xpDuplicate = true
      else console.error('[xp_events insert]', xpErr.message)
    }
  }

  // 6. leaderboard_stats XP
  if (totalXp > 0 && !xpDuplicate) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('wallet_address', wallet)
      .maybeSingle()
    if (profile?.id) {
      await incrementLeaderboardXP(profile.id, totalXp)
    }
  }

  return { success: true, alreadyScored: false, entryId: entry.id, earnedXp: totalXp, xpDuplicate, playerBreakdown }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

async function step1_seed() {
  console.log('\n📦  Step 1 — Seed test daily_xi_entries row')

  await supabase.from('daily_xi_entries').delete()
    .eq('wallet_address', TEST_WALLET).eq('entry_date', TODAY)
  await supabase.from('xp_events').delete()
    .eq('wallet_address', TEST_WALLET).eq('source_type', 'daily_xi')

  const fakePlayers = PLAYER_STATS.map((p, i) => ({
    id: p.playerId, name: `Test Player ${i + 1}`, team: 'Test FC',
    position: ['GK','CB','CB','LB','RB','CM','CM','AM','LW','RW','ST'][i],
    image: 'https://example.com/player.png',
  }))

  const { data: entry, error } = await supabase
    .from('daily_xi_entries')
    .insert({ wallet_address: TEST_WALLET, entry_date: TODAY, players: fakePlayers, status: 'locked', projected_max_xp: 20 })
    .select('id, status, earned_xp')
    .single()

  if (error) { console.error('  ❌  Seed failed:', error.message); process.exit(1) }

  assert('Entry seeded with status=locked', entry.status === 'locked')
  assert('Entry earned_xp is null/0', !entry.earned_xp)
  console.log(`  ℹ️   Entry ID: ${entry.id}`)
  return entry.id
}

async function step2_score() {
  console.log('\n🎯  Step 2 — Score via pipeline')

  const result = await runScorePipeline(TEST_WALLET, TODAY, PLAYER_STATS)

  assert('success=true', result.success === true, JSON.stringify(result))
  assert('alreadyScored=false', result.alreadyScored === false)
  assert(`earnedXp=${EXPECTED_XP}`, result.earnedXp === EXPECTED_XP, `got ${result.earnedXp}`)
  assert('playerBreakdown has 11 entries', Array.isArray(result.playerBreakdown) && result.playerBreakdown.length === 11)
  assert('xpDuplicate=false (first run)', result.xpDuplicate === false)

  if (result.playerBreakdown) {
    const p1 = result.playerBreakdown.find(p => p.playerId === 'e2e-p1')
    assert('p1 XP = 11', p1?.xp === 11, `got ${p1?.xp}`)
    const p9 = result.playerBreakdown.find(p => p.playerId === 'e2e-p9')
    assert('p9 XP = 0 (floored, played-yellow=0)', p9?.xp === 0, `got ${p9?.xp}`)
    const p10 = result.playerBreakdown.find(p => p.playerId === 'e2e-p10')
    assert('p10 XP = 0 (not played)', p10?.xp === 0, `got ${p10?.xp}`)
  }
  return result.entryId
}

async function step3_verifyDB(entryId) {
  console.log('\n🔍  Step 3 — Verify DB pipeline')

  const { data: entry } = await supabase
    .from('daily_xi_entries').select('status, earned_xp').eq('id', entryId).single()

  assert("entry.status = 'scored'", entry?.status === 'scored', `got ${entry?.status}`)
  assert(`entry.earned_xp = ${EXPECTED_XP}`, entry?.earned_xp === EXPECTED_XP, `got ${entry?.earned_xp}`)

  const { data: xpEvent } = await supabase
    .from('xp_events').select('xp_amount, source_type, reason')
    .eq('wallet_address', TEST_WALLET).eq('source_type', 'daily_xi').eq('source_id', entryId)
    .maybeSingle()

  assert('xp_events row created', xpEvent !== null)
  assert(`xp_events.xp_amount = ${EXPECTED_XP}`, xpEvent?.xp_amount === EXPECTED_XP, `got ${xpEvent?.xp_amount}`)
  assert("xp_events.reason = 'daily_xi_scored'", xpEvent?.reason === 'daily_xi_scored')

  const { data: profile } = await supabase
    .from('profiles').select('id').eq('wallet_address', TEST_WALLET).maybeSingle()

  if (profile) {
    const { data: lb } = await supabase
      .from('leaderboard_stats').select('xp').eq('profile_id', profile.id).eq('period', 'all_time').maybeSingle()
    assert(`leaderboard_stats all_time xp ≥ ${EXPECTED_XP}`, (lb?.xp ?? 0) >= EXPECTED_XP, `got ${lb?.xp}`)
  } else {
    console.log(`  ℹ️   No profile for test wallet — leaderboard XP check skipped (expected)`)
  }
}

async function step4_idempotency(entryId) {
  console.log('\n🔁  Step 4 — Idempotency (re-run same pipeline)')

  const result = await runScorePipeline(TEST_WALLET, TODAY, PLAYER_STATS)

  assert('success=true on re-run', result.success === true)
  assert('alreadyScored=true on re-run', result.alreadyScored === true, JSON.stringify(result))
  assert(`earnedXp still ${EXPECTED_XP}`, result.earnedXp === EXPECTED_XP, `got ${result.earnedXp}`)
  assert('entryId unchanged', result.entryId === entryId)

  // Verify no duplicate xp_events
  const { data: rows } = await supabase
    .from('xp_events').select('id')
    .eq('wallet_address', TEST_WALLET).eq('source_type', 'daily_xi').eq('source_id', entryId)

  assert('Only 1 xp_events row (no duplicate)', rows?.length === 1, `got ${rows?.length}`)
}

async function step5_scoringMath() {
  console.log('\n🧮  Step 5 — Scoring math verification')

  const { totalXp, playerBreakdown } = calculateDailyXIScore(PLAYER_STATS)

  assert(`Total XP = ${EXPECTED_XP}`, totalXp === EXPECTED_XP, `got ${totalXp}`)

  // p1: 2goals×3 + 1assist×2 + rating≥8×2 + played×1 = 6+2+2+1 = 11
  const p1 = playerBreakdown.find(p => p.playerId === 'e2e-p1')
  assert('p1: 2g+1a+r8.5+played = 11', p1?.xp === 11, `got ${p1?.xp}`)
  assert('p1 breakdown: goals=6', p1?.breakdown.goals === 6)
  assert('p1 breakdown: assists=2', p1?.breakdown.assists === 2)
  assert('p1 breakdown: rating=2 (≥8)', p1?.breakdown.rating === 2)

  // p2: goal×3 + rating≥7×1 + played×1 - yellow×1 = 3+1+1-1 = 4
  const p2 = playerBreakdown.find(p => p.playerId === 'e2e-p2')
  assert('p2: 1g+y1+r7.2+played = 4', p2?.xp === 4, `got ${p2?.xp}`)

  // p9: played×1 - yellow×1 = 0 (raw=-0, floored to 0... wait, 1-1=0 exactly)
  const p9 = playerBreakdown.find(p => p.playerId === 'e2e-p9')
  assert('p9: played-yellow = 0 (floor)', p9?.xp === 0, `got ${p9?.xp}`)
  assert('p9 raw would be 0 without floor', p9?.breakdown.played === 1 && p9?.breakdown.yellowCards === -1)

  // p10: not played → all zeros → 0
  const p10 = playerBreakdown.find(p => p.playerId === 'e2e-p10')
  assert('p10: not played → 0', p10?.xp === 0)

  // Validate auth check code path (no HTTP, just logic)
  const isValidAddress = (addr) => typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/i.test(addr.trim())
  assert('Valid hex wallet passes', isValidAddress(TEST_WALLET))
  assert('Non-hex wallet rejected', !isValidAddress('0xtestdailyxiscoringwallet000000000000001'))
  assert('Too-short address rejected', !isValidAddress('0x000000099901'))

  const isValidDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())
  assert('Valid date passes', isValidDate(TODAY))
  assert('Wrong date format rejected', !isValidDate('17-05-2026'))
}

async function step6_cleanup(entryId) {
  console.log('\n🧹  Step 6 — Cleanup test data')

  const { error: xpErr } = await supabase
    .from('xp_events').delete()
    .eq('wallet_address', TEST_WALLET).eq('source_type', 'daily_xi').eq('source_id', entryId)
  assert('xp_events row deleted', !xpErr, xpErr?.message)

  const { error: entryErr } = await supabase
    .from('daily_xi_entries').delete()
    .eq('wallet_address', TEST_WALLET).eq('entry_date', TODAY)
  assert('daily_xi_entries row deleted', !entryErr, entryErr?.message)

  const { data: gone } = await supabase
    .from('daily_xi_entries').select('id')
    .eq('wallet_address', TEST_WALLET).eq('entry_date', TODAY).maybeSingle()
  assert('Entry no longer in DB', gone === null)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════')
  console.log('  Daily XI Scoring — Pipeline E2E Test')
  console.log(`  Wallet : ${TEST_WALLET}`)
  console.log(`  Date   : ${TODAY}`)
  console.log(`  Key    : ${ADMIN_KEY}`)
  console.log('═══════════════════════════════════════════════')

  let entryId
  try {
    entryId  = await step1_seed()
    await step2_score()
    await step3_verifyDB(entryId)
    await step4_idempotency(entryId)
    await step5_scoringMath()
    await step6_cleanup(entryId)
  } catch (e) {
    console.error('\n💥  Unexpected error:', e)
    failed++
  }

  console.log('\n═══════════════════════════════════════════════')
  console.log(`  Results: ${passed} passed, ${failed} failed`)
  console.log('═══════════════════════════════════════════════\n')
  process.exit(failed > 0 ? 1 : 0)
}

main()
