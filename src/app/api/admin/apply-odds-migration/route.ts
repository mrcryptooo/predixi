/**
 * POST /api/admin/apply-odds-migration
 *
 * ONE-TIME endpoint — runs the add-odds-columns DDL migration.
 * REMOVE THIS FILE after migration is confirmed applied.
 *
 * Uses pg (postgres driver) with Supabase Transaction Pooler.
 * Connection string built from env vars at runtime — DB password
 * must be provided via SUPABASE_DB_PASSWORD env var OR as JSON body { password }.
 *
 * Auth: x-admin-key header vs ADMIN_SETTLEMENT_KEY
 */

import { type NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const adminKey = process.env.ADMIN_SETTLEMENT_KEY
  if (!adminKey) return NextResponse.json({ ok: false, error: 'not configured' }, { status: 500 })
  if (req.headers.get('x-admin-key') !== adminKey)
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  // Get DB password — either from env or request body
  let dbPassword = process.env.SUPABASE_DB_PASSWORD ?? ''
  if (!dbPassword) {
    try {
      const body = await req.json() as { password?: string }
      dbPassword = body.password ?? ''
    } catch { /* no body */ }
  }

  if (!dbPassword) {
    return NextResponse.json({
      ok: false,
      error: 'DB password required — set SUPABASE_DB_PASSWORD env var or pass { password } in body',
      sql: `
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS odds_home       NUMERIC(6,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS odds_draw       NUMERIC(6,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS odds_away       NUMERIC(6,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS odds_bookmaker  SMALLINT     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS odds_fetched_at TIMESTAMPTZ  DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_matches_odds_sync
  ON matches (kickoff, status)
  WHERE api_source = 'apf' AND odds_fetched_at IS NULL;
      `.trim(),
    }, { status: 400 })
  }

  try {
    const { default: pkg } = await import('pg')
    const Client = pkg.Client

    const projectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').match(/https:\/\/([^.]+)\./)?.[1] ?? ''
    if (!projectRef) return NextResponse.json({ ok: false, error: 'cannot determine project ref' }, { status: 500 })

    const client = new Client({
      host:     `aws-0-us-east-1.pooler.supabase.com`,
      port:     6543,
      database: 'postgres',
      user:     `postgres.${projectRef}`,
      password: dbPassword,
      ssl:      { rejectUnauthorized: false },
      connectionTimeoutMillis: 10_000,
    })

    await client.connect()

    await client.query(`
      ALTER TABLE matches
        ADD COLUMN IF NOT EXISTS odds_home       NUMERIC(6,2) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS odds_draw       NUMERIC(6,2) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS odds_away       NUMERIC(6,2) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS odds_bookmaker  SMALLINT     DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS odds_fetched_at TIMESTAMPTZ  DEFAULT NULL
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_matches_odds_sync
        ON matches (kickoff, status)
        WHERE api_source = 'apf' AND odds_fetched_at IS NULL
    `)

    const verify = await client.query(`
      SELECT column_name, data_type, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_name = 'matches' AND column_name LIKE 'odds_%'
      ORDER BY column_name
    `)

    await client.end()

    return NextResponse.json({ ok: true, columns: verify.rows })
  } catch (e) {
    return NextResponse.json({
      ok:    false,
      error: e instanceof Error ? e.message : String(e),
    }, { status: 500 })
  }
}
