/**
 * curate-featured-players.cjs
 *
 * Selects "featured_daily_xi" star players from the WC 2026 squad database.
 * Outputs:
 *   - SQL UPDATE statements to set featured_daily_xi = true
 *   - Summary per team
 *
 * Selection logic (per team):
 *   • 1 GK  (lowest shirt number = #1 starter)
 *   • 4 DEF (lowest 4 shirt numbers)
 *   • 4 MID (lowest 4 shirt numbers)
 *   • 3 ATT (lowest 3 shirt numbers)
 *   = 12 per team
 *
 * For teams with known star players, their names are priority-matched first.
 *
 * Run AFTER applying the migration: supabase/add-featured-daily-xi.sql
 *
 * Usage:
 *   node scripts/curate-featured-players.cjs
 */

const https  = require('https')
const fs     = require('fs')
const path   = require('path')

// ── Load env vars from .env.local ──────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  const lines   = fs.readFileSync(envPath, 'utf8').split('\n')
  const env     = {}
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m) env[m[1]] = m[2].trim()
  }
  return env
}

// ── HTTP helper ────────────────────────────────────────────────────────────
function get(url, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const options = { hostname: u.hostname, path: u.pathname + u.search, headers }
    const req = https.get(options, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { resolve(data) }
      })
    })
    req.on('error', reject)
  })
}

function patch(url, headers, body) {
  return new Promise((resolve, reject) => {
    const u    = new URL(url)
    const json = JSON.stringify(body)
    const opts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) }
    }
    const req = https.request(opts, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    })
    req.on('error', reject)
    req.write(json)
    req.end()
  })
}

// ── Target counts per position ─────────────────────────────────────────────
const TARGETS = { Goalkeeper: 1, Defender: 4, Midfielder: 4, Attacker: 3 }

// ── Priority name fragments (case-insensitive) for major nations ───────────
// Used to boost known stars above squad-number order
const PRIORITY_NAMES = [
  // Argentina
  'Messi','Di Maria','Lautaro','Mac Allister','de Paul','Molina','Romero','Dybala','Almada',
  // Brazil
  'Vinicius','Raphinha','Rodrygo','Paqueta','Casemiro','Marquinhos','Militao','Alisson','Endrick',
  // France
  'Mbappe','Griezmann','Dembele','Camavinga','Kante','Varane','Kounde','Maignan','Saliba','Tchouameni',
  // England
  'Bellingham','Saka','Foden','Kane','Walker','Stones','Trippier','Rice','Pickford','Mainoo','Trent',
  // Portugal
  'Ronaldo','Bernardo','Vitinha','Cancelo','Dias','Felix','Leao','Trincao',
  // Germany
  'Musiala','Wirtz','Kimmich','Kroos','Gundogan','Sane','Havertz','Gnabry','Neuer','Rudiger','Schlotterbeck',
  // Spain
  'Pedri','Gavi','Yamal','Olmo','Morata','Williams','Unai Simon','Laporte','Carvajal',
  // Netherlands
  'Van Dijk','Dumfries','Gakpo','Depay','Reijnders','De Ligt','Verbruggen','Xavi Simons',
  // Belgium
  'De Bruyne','Lukaku','Thibaut','Vertonghen','Tielemans','Doku','Openda',
  // Croatia
  'Modric','Brozovic','Kovacic','Kramaric','Perisic','Gvardiol',
  // Senegal
  'Mane','Diatta','Mendy','Ndour','Diedhiou','Boulaye Dia',
  // Morocco
  'Ziyech','Hakimi','En-Nesyri','Aguerd','Amrabat','Ounahi','Hamdallah',
  // Japan
  'Kubo','Minamino','Doan','Ito','Tanaka','Endo','Yoshida','Maeda',
  // USA
  'Pulisic','Adams','Turner','Zimmermann','Weah','Reyna','McKennie',
  // Mexico
  'Jimenez','Vega','Sanchez G','Herrera','Alvarez','Moreno',
  // Colombia
  'James','Cuadrado','Falcao','Ospina','Luis Diaz','Borja',
  // Uruguay
  'Valverde','Nunez','Bentancur','Forlan','Gimenez','de Arrascaeta',
  // Egypt
  'Salah','Trezeguet','Hamdi','Marmoush',
  // Ivory Coast
  'Pepe','Zaha','Sangare','Seri',
  // Ghana
  'Kudus','Thomas','Partey','Jordan Ayew','Andre Ayew',
  // Australia
  'Leckie','Maty Ryan','Hrustic','Irvine','Atkinson',
  // Norway
  'Haaland','Odegaard','King','Thorstvedt',
  // Switzerland
  'Xhaka','Shaqiri','Sommer','Akanji','Embolo',
]

// ── Select featured players for a team ────────────────────────────────────
function selectFeatured(teamPlayers) {
  const featured = new Set()

  // Sort by squad number (number=0 treated as high)
  const sorted = [...teamPlayers].sort((a, b) => {
    const na = a.number > 0 ? a.number : 99
    const nb = b.number > 0 ? b.number : 99
    return na - nb
  })

  // Priority boost: known stars go first regardless of position quota
  for (const p of sorted) {
    for (const frag of PRIORITY_NAMES) {
      if (p.name.toLowerCase().includes(frag.toLowerCase())) {
        featured.add(p.apf_player_id)
        break
      }
    }
  }

  // Fill up to target per position from squad-number order
  const countByPos = {}
  for (const p of sorted) {
    const pos    = p.position
    const target = TARGETS[pos] ?? 0
    const count  = countByPos[pos] ?? 0
    if (count < target) {
      featured.add(p.apf_player_id)
      countByPos[pos] = count + 1
    }
  }

  // Cap at 15
  return [...featured].slice(0, 15)
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const env        = loadEnv()
  const BASE_URL   = env['NEXT_PUBLIC_SUPABASE_URL']
  const SERVICE_KEY = env['SUPABASE_SERVICE_ROLE_KEY']

  const headers = {
    apikey:        SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
  }

  console.log('Fetching all WC 2026 players...')
  let allPlayers = []
  let offset     = 0
  while (true) {
    const page = await get(
      `${BASE_URL}/rest/v1/players?select=apf_player_id,player_id,name,position,number,team_name&world_cup_year=eq.2026&order=team_name.asc,position.asc,number.asc&limit=1000&offset=${offset}`,
      headers
    )
    if (!Array.isArray(page) || page.length === 0) break
    allPlayers = allPlayers.concat(page)
    offset += page.length
    if (page.length < 1000) break
  }
  console.log(`Loaded ${allPlayers.length} players`)

  // Group by team
  const byTeam = {}
  for (const p of allPlayers) {
    if (!byTeam[p.team_name]) byTeam[p.team_name] = []
    byTeam[p.team_name].push(p)
  }

  const featuredIds = []
  const summary     = []

  for (const [team, players] of Object.entries(byTeam).sort()) {
    const ids = selectFeatured(players)
    featuredIds.push(...ids)

    // Position breakdown
    const picked  = players.filter(p => ids.includes(p.apf_player_id))
    const byPos   = {}
    for (const p of picked) {
      byPos[p.position] = (byPos[p.position] ?? 0) + 1
    }
    summary.push({ team, total: ids.length, ...byPos })
  }

  console.log('\n=== Curation Summary ===')
  console.log(`Total featured: ${featuredIds.length} / ${allPlayers.length}`)
  console.log('')
  for (const s of summary) {
    console.log(
      `${s.team.padEnd(30)} ${String(s.total).padStart(2)}  ` +
      `GK:${s.Goalkeeper??0} DEF:${s.Defender??0} MID:${s.Midfielder??0} ATT:${s.Attacker??0}`
    )
  }

  // Write the featured IDs to a JSON file for the SQL script
  const outPath = path.join(__dirname, '..', 'supabase', 'featured-player-ids.json')
  fs.writeFileSync(outPath, JSON.stringify(featuredIds, null, 2))
  console.log(`\nWrote ${featuredIds.length} IDs to supabase/featured-player-ids.json`)

  // ── Apply featured flags via REST API PATCH ────────────────────────────
  // This requires the featured_daily_xi column to already exist.
  // If the column doesn't exist, this step will fail with a 400 error.
  const DRY_RUN = process.argv.includes('--dry-run')

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Skipping DB writes. Run without --dry-run after applying migration.')
    return { featuredIds, summary }
  }

  console.log('\nApplying featured_daily_xi = true...')

  // Reset all to false first
  const resetRes = await patch(
    `${BASE_URL}/rest/v1/players?world_cup_year=eq.2026`,
    { ...headers, Prefer: 'return=minimal' },
    { featured_daily_xi: false }
  )
  console.log(`Reset all to false: HTTP ${resetRes.status}`)

  // Set featured = true in batches of 100
  let updated = 0
  for (let i = 0; i < featuredIds.length; i += 100) {
    const batch = featuredIds.slice(i, i + 100)
    const ids   = batch.join(',')
    const res   = await patch(
      `${BASE_URL}/rest/v1/players?apf_player_id=in.(${ids})&world_cup_year=eq.2026`,
      { ...headers, Prefer: 'return=minimal' },
      { featured_daily_xi: true }
    )
    if (res.status < 300) {
      updated += batch.length
    } else {
      console.error(`Batch ${i}–${i + batch.length} failed: ${res.status} ${res.body}`)
    }
    process.stdout.write(`\r  ${updated}/${featuredIds.length} updated`)
  }
  console.log(`\nDone. ${updated} players marked as featured.`)

  return { featuredIds, summary }
}

main().catch(e => { console.error(e); process.exit(1) })
