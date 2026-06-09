/**
 * API Route — /api/daily-xi
 *
 * GET   ?wallet=0x...&date=YYYY-MM-DD  → Daily XI entry for wallet/date (defaults today)
 * POST                                 → Upsert entry (wallet + date = unique)
 * PATCH                                → Mark entry as anchored on Base after confirmed TX
 *
 * Server-only. Uses service role key.
 * No XP settlement. No blockchain writes.
 */

import { type NextRequest, NextResponse }    from 'next/server'
import { createPublicClient, custom, decodeEventLog } from 'viem'
import { base }                             from 'viem/chains'
import { ProxyAgent, fetch as undiciF }     from 'undici'
import { getServerSupabaseClient }          from '@/lib/supabase/server'
import { verifyBaseWalletAuth }             from '@/lib/auth/verify-base-wallet'
import { createDailyXICommitment }         from '@/lib/onchain/commitment'
import { DAILY_XI_ANCHOR_MAX_AGE_MS }      from '@/lib/daily-xi-anchor-message'
import {
  COMMITMENT_REGISTRY_ABI,
  getCommitmentContractAddress,
}                                           from '@/lib/onchain/contracts'

// ─────────────────────────────────────────────────────────────────────────────
// Base public client — proxy-aware (same pattern as /api/badges, /api/predictions)
// Used by PATCH handler to verify submitCommitment() transactions on-chain.
// ─────────────────────────────────────────────────────────────────────────────

function buildCommitmentClient() {
  const proxyUrl =
    process.env.HTTPS_PROXY ??
    process.env.https_proxy ??
    process.env.HTTP_PROXY  ??
    process.env.http_proxy

  const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined

  const rpcFetch = dispatcher
    ? (url: string, init?: RequestInit) =>
        undiciF(url, { ...init, dispatcher } as Parameters<typeof undiciF>[1]) as unknown as Promise<Response>
    : fetch

  const rpcProvider = {
    async request({ method, params }: { method: string; params?: unknown[] }) {
      const res  = await rpcFetch('https://mainnet.base.org', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
      })
      const json = await res.json() as {
        result?: unknown
        error?:  { code: number; message: string }
      }
      if (json.error) throw new Error(`RPC ${json.error.code}: ${json.error.message}`)
      return json.result
    },
  }

  return createPublicClient({ chain: base, transport: custom(rpcProvider) })
}

const commitmentPublicClient = buildCommitmentClient()

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isValidAddress(addr: unknown): addr is string {
  return typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/i.test(addr.trim())
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

function isValidDate(d: unknown): d is string {
  return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())
}

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/daily-xi?wallet=0x...&date=YYYY-MM-DD
// Returns the Daily XI entry for the given wallet and date (defaults to today).
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const wallet = req.nextUrl.searchParams.get('wallet')
    const date   = req.nextUrl.searchParams.get('date') ?? todayUTC()

    if (!wallet)                 return err('wallet query parameter is required', 400)
    if (!isValidAddress(wallet)) return err('Invalid wallet address', 400)
    if (!isValidDate(date))      return err('Invalid date format — use YYYY-MM-DD', 400)

    const supabase = getServerSupabaseClient()

    const { data, error } = await supabase
      .from('daily_xi_entries')
      .select('players, status, projected_max_xp, earned_xp, submitted_onchain, commitment_hash, tx_hash, created_at, updated_at')
      .eq('wallet_address', wallet.toLowerCase())
      .eq('entry_date', date)
      .maybeSingle()

    if (error) {
      console.error('[GET /api/daily-xi]', error)
      return err('Failed to fetch Daily XI entry', 500)
    }

    if (!data) {
      return NextResponse.json({ success: true, entry: null })
    }

    return NextResponse.json({
      success: true,
      entry: {
        players:          data.players,
        status:           data.status,
        projectedMaxXp:   data.projected_max_xp,
        earnedXp:         data.earned_xp,
        submittedOnchain: data.submitted_onchain,
        commitmentHash:   data.commitment_hash ?? null,
        txHash:           data.tx_hash         ?? null,
        createdAt:        data.created_at,
        updatedAt:        data.updated_at,
      },
    })
  } catch (e) {
    console.error('[GET /api/daily-xi] unhandled:', e)
    return err('Internal server error', 500)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/daily-xi
// Body: { walletAddress, entryDate?, players, projectedMaxXp? }
// Upserts on (wallet_address, entry_date). status stays 'pending'. earned_xp stays 0.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return err('Invalid JSON body', 400)

    const {
      walletAddress,
      entryDate,
      players,
      projectedMaxXp,
    } = body as Record<string, unknown>

    // ── Validation ────────────────────────────────────────────────────────────
    if (!isValidAddress(walletAddress)) {
      return err('Invalid walletAddress — must be a 0x Ethereum address', 400)
    }
    if (!Array.isArray(players)) {
      return err('players must be an array', 400)
    }

    const date  = isValidDate(entryDate) ? (entryDate as string).trim() : todayUTC()
    const maxXp = typeof projectedMaxXp === 'number' && projectedMaxXp >= 0 ? projectedMaxXp : 20

    const normalizedWallet = (walletAddress as string).toLowerCase()

    // ── Wallet auth — smart-wallet-compatible ────────────────────────────────
    // Uses publicClient.verifyMessage() which supports EOA, ERC-1271, and
    // ERC-6492 (Base Account / Coinbase Smart Wallet).  The EOA-only standalone
    // verifyMessage() always fails for Base App wallets — do not use it here.
    const walletAuth = await verifyBaseWalletAuth(req, normalizedWallet, 'daily-xi')
    if (!walletAuth.verified) {
      const reason = walletAuth.reason ?? 'missing'
      console.warn('[POST /api/daily-xi] auth failed:', reason, 'wallet:', normalizedWallet)
      return NextResponse.json(
        {
          success:    false,
          error:      reason === 'missing-headers'
            ? 'Wallet signature required — please sign the message in your wallet'
            : reason === 'wallet-mismatch' || reason === 'action-mismatch'
            ? 'Invalid signature — message does not match this wallet or action'
            : 'Signature verification failed — please try again',
          walletAuth: { checked: walletAuth.checked, verified: false, reason },
        },
        { status: 401 },
      )
    }

    // ── Compute commitment hash before upsert — stored atomically with row ──
    const playerIds = (players as Array<Record<string, unknown>>)
      .map(p => String(p.id ?? p.playerId ?? ''))
      .filter(Boolean)
    const { commitmentHash } = createDailyXICommitment({
      walletAddress:  normalizedWallet,
      entryDate:      date,
      playerIds,
      projectedMaxXp: maxXp,
    })

    // ── DB client ────────────────────────────────────────────────────────────
    const supabase = getServerSupabaseClient()

    // ── Guard: reject if today's entry is already scored ─────────────────────
    // Without this guard, a POST on a scored entry resets status → 'pending'
    // because the upsert always writes status:'pending'. The cron would then
    // re-score the next day, awarding duplicate XP if the unique constraint
    // weren't present — confusing and messy. Block it cleanly at the API layer.
    {
      const { data: existing, error: existingErr } = await supabase
        .from('daily_xi_entries')
        .select('status')
        .eq('wallet_address', normalizedWallet)
        .eq('entry_date', date)
        .maybeSingle()

      if (existingErr) {
        console.error('[POST /api/daily-xi] scored-entry check:', existingErr)
        return err('Failed to verify entry status', 500)
      }

      if ((existing as { status: string } | null)?.status === 'scored') {
        return NextResponse.json(
          {
            success:       false,
            error:         "Today's Daily XI has already been scored. Your XP has been awarded — come back tomorrow to build a new XI.",
            alreadyScored: true,
          },
          { status: 409 },
        )
      }
    }

    // ── Upsert ───────────────────────────────────────────────────────────────
    const { data, error } = await supabase
      .from('daily_xi_entries')
      .upsert(
        {
          wallet_address:   normalizedWallet,
          entry_date:       date,
          players:          players,
          status:           'pending',
          projected_max_xp: maxXp,
          commitment_hash:  commitmentHash,
          updated_at:       new Date().toISOString(),
        },
        { onConflict: 'wallet_address,entry_date' },
      )
      .select('entry_date, status, updated_at')
      .single()

    if (error) {
      console.error('[POST /api/daily-xi]', error)
      return err('Failed to save Daily XI entry', 500)
    }

    return NextResponse.json({
      success: true,
      commitmentHash,
      entry: {
        entryDate:  data.entry_date,
        status:     data.status,
        updatedAt:  data.updated_at,
      },
      walletAuth,
    })
  } catch (e) {
    console.error('[POST /api/daily-xi] unhandled:', e)
    return err('Internal server error', 500)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/daily-xi
//
// Marks a Daily XI entry as anchored on Base Mainnet after the client has
// broadcast and confirmed a submitCommitment tx on PredixiCommitmentRegistry.
//
// This endpoint only records the TX result — it does NOT send any onchain tx.
//
// Request headers (required):
//   x-wallet-message   — URL-encoded EIP-191 message (buildDailyXIAnchorMessage output)
//   x-wallet-signature — 0x-prefixed hex signature from the connected wallet
//
// Request body:
//   { walletAddress: string, txHash: string, entryDate?: string }
//
// Security model:
//   1. verifyBaseWalletAuth checks the signed message contains:
//        Wallet: <walletAddress>
//        Action: Anchor daily xi on Base
//      and that the cryptographic signature is valid (ERC-6492 / smart-wallet safe).
//   2. A 10-minute freshness window prevents stale-signature replay.
//   3. The signed message also binds entryDate and txHash — a valid signature
//      cannot be replayed for a different day's entry or a different tx.
//   4. The DB lookup uses (wallet_address, entry_date) so walletAddress in the
//      body can never touch another user's row.
//
// Idempotency:
//   - Same txHash already stored → 200 ok (safe to retry after network hiccup).
//   - Different txHash already stored → 409 (prevents overwriting anchored tx).
// ─────────────────────────────────────────────────────────────────────────────

const TX_HASH_RE_PATCH  = /^0x[0-9a-fA-F]{64}$/
const DATE_RE_PATCH     = /^\d{4}-\d{2}-\d{2}$/
const TIMESTAMP_LINE_RE = /Timestamp: (.+)/

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return err('Invalid JSON body', 400)

    const { walletAddress, txHash, entryDate } = body as Record<string, unknown>

    // ── Input validation ───────────────────────────────────────────────────────
    if (!isValidAddress(walletAddress)) {
      return err('walletAddress must be a valid 0x Ethereum address', 400)
    }
    if (!txHash || typeof txHash !== 'string' || !TX_HASH_RE_PATCH.test(txHash as string)) {
      return err('txHash must be a 0x-prefixed 64-hex transaction hash', 400)
    }

    const normalizedWallet  = (walletAddress as string).toLowerCase()
    const normalizedTxHash  = (txHash as string).toLowerCase()

    // Accept client-provided entryDate (allows anchoring past-day entries from
    // profile page); fall back to today if absent or malformed.
    const date: string =
      typeof entryDate === 'string' && DATE_RE_PATCH.test((entryDate as string).trim())
        ? (entryDate as string).trim()
        : todayUTC()

    // ── Auth: verify wallet owns this request ──────────────────────────────────
    // Checks: Wallet: <normalizedWallet>, Action: Anchor daily xi on Base, crypto sig.
    const walletAuth = await verifyBaseWalletAuth(req, normalizedWallet, 'Anchor daily xi on Base')
    if (!walletAuth.verified) {
      const reason = walletAuth.reason ?? 'unknown'
      console.warn('[PATCH /api/daily-xi] auth failed:', reason, 'wallet:', normalizedWallet)
      return NextResponse.json(
        { success: false, error: 'Authentication failed — please re-sign and retry' },
        { status: 401 },
      )
    }

    // ── Freshness + binding checks ─────────────────────────────────────────────
    // Decode the already-verified message to extract timestamp and verify
    // the message also binds entryDate and txHash (anti-replay).
    const rawMsgHeader = req.headers.get('x-wallet-message')
    if (!rawMsgHeader) return err('Missing x-wallet-message header', 401)

    let msgDecoded: string
    try {
      msgDecoded = decodeURIComponent(rawMsgHeader)
    } catch {
      return err('Could not decode anchor message', 400)
    }

    // Timestamp freshness — 10-minute window
    const tsMatch = msgDecoded.match(TIMESTAMP_LINE_RE)
    if (!tsMatch) return err('Missing Timestamp in anchor message', 400)
    const signedAtMs = new Date(tsMatch[1].trim()).getTime()
    if (isNaN(signedAtMs) || Date.now() - signedAtMs > DAILY_XI_ANCHOR_MAX_AGE_MS) {
      return err('Anchor signature has expired — please anchor again', 401)
    }

    // Entry date binding — message must name the same date as the request body
    if (!msgDecoded.includes(`Entry Date: ${date}`)) {
      return err('Anchor message entry date does not match request', 400)
    }

    // Tx hash binding — message must name the same transaction hash
    if (!msgDecoded.includes(`Tx Hash: ${normalizedTxHash}`)) {
      return err('Anchor message tx hash does not match request', 400)
    }

    // ── DB: look up the entry ──────────────────────────────────────────────────
    const supabase = getServerSupabaseClient()

    const { data: entry, error: fetchErr } = await supabase
      .from('daily_xi_entries')
      .select('id, submitted_onchain, tx_hash, commitment_hash')
      .eq('wallet_address', normalizedWallet)
      .eq('entry_date', date)
      .maybeSingle()

    if (fetchErr) {
      console.error('[PATCH /api/daily-xi] entry lookup:', fetchErr)
      return err('Failed to look up Daily XI entry', 500)
    }
    if (!entry) {
      return err(`No Daily XI entry found for ${normalizedWallet} on ${date}`, 404)
    }

    // ── Idempotency ────────────────────────────────────────────────────────────
    if ((entry as { submitted_onchain: boolean }).submitted_onchain) {
      const storedTx = (entry as { tx_hash: string | null }).tx_hash
      if (storedTx === normalizedTxHash) {
        // Already recorded with the same tx — safe to return 200 on retry
        return NextResponse.json({ success: true, alreadyAnchored: true })
      }
      return NextResponse.json(
        { success: false, error: 'Entry already anchored with a different transaction' },
        { status: 409 },
      )
    }

    // ── On-chain TX verification ───────────────────────────────────────────────
    // Fetch the Base Mainnet receipt and decode CommitmentSubmitted from
    // PredixiCommitmentRegistry. This prevents an attacker from supplying
    // an arbitrary txHash to get submitted_onchain=true recorded without
    // actually having called submitCommitment with the correct hash.
    const contractAddress = getCommitmentContractAddress()
    if (!contractAddress) {
      console.error('[PATCH /api/daily-xi] NEXT_PUBLIC_PREDIXI_COMMITMENT_CONTRACT not configured')
      return err('Commitment contract not configured — cannot verify transaction', 503)
    }

    const storedCommitmentHash = (entry as { commitment_hash: string | null }).commitment_hash
    if (!storedCommitmentHash) {
      return err('No commitment hash stored for this entry — re-submit your Daily XI first', 400)
    }

    let receipt: Awaited<ReturnType<typeof commitmentPublicClient.getTransactionReceipt>>
    try {
      receipt = await commitmentPublicClient.getTransactionReceipt({
        hash: normalizedTxHash as `0x${string}`,
      })
    } catch (rpcErr) {
      console.error('[PATCH /api/daily-xi] receipt fetch:', rpcErr)
      return err('Could not fetch transaction receipt from Base — please retry', 500)
    }

    if (receipt.status !== 'success') {
      return err('Transaction reverted on Base — submitCommitment did not succeed', 400)
    }

    // Filter logs emitted by the commitment registry contract and decode
    // the CommitmentSubmitted event. Smart wallet txs route through the
    // EntryPoint so we cannot rely on receipt.to — log address is the
    // ground truth.
    const contractAddrLower = contractAddress.toLowerCase()
    const registryLogs = receipt.logs.filter(
      log => log.address.toLowerCase() === contractAddrLower,
    )

    let commitmentLog: { user: string; commitmentHash: string } | null = null
    for (const log of registryLogs) {
      try {
        const decoded = decodeEventLog({
          abi:       COMMITMENT_REGISTRY_ABI,
          data:      log.data,
          topics:    log.topics,
          eventName: 'CommitmentSubmitted',
        })
        commitmentLog = {
          user:           (decoded.args.user as string).toLowerCase(),
          commitmentHash: (decoded.args.commitmentHash as string).toLowerCase(),
        }
        break
      } catch {
        // Not a CommitmentSubmitted log — skip
      }
    }

    if (!commitmentLog) {
      return err(
        'Transaction did not emit a CommitmentSubmitted event from the registry contract',
        400,
      )
    }
    if (commitmentLog.user !== normalizedWallet) {
      return err('On-chain event submitter does not match walletAddress', 400)
    }
    if (commitmentLog.commitmentHash !== storedCommitmentHash.toLowerCase()) {
      return err('On-chain commitment hash does not match stored Daily XI commitment', 400)
    }

    // ── Update: mark as anchored on Base ───────────────────────────────────────
    const { error: updateErr } = await supabase
      .from('daily_xi_entries')
      .update({
        submitted_onchain: true,
        tx_hash:           normalizedTxHash,
        updated_at:        new Date().toISOString(),
      })
      .eq('id', (entry as { id: string }).id)

    if (updateErr) {
      console.error('[PATCH /api/daily-xi] update:', updateErr)
      return err('Failed to record anchor', 500)
    }

    console.log(
      `[PATCH /api/daily-xi] anchored wallet=${normalizedWallet}` +
      ` date=${date} tx=${normalizedTxHash}`,
    )

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[PATCH /api/daily-xi] unhandled:', e)
    return err('Internal server error', 500)
  }
}
