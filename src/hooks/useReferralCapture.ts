/**
 * useReferralCapture
 *
 * Two-phase hook for the PrediXI referral link → registration flow.
 *
 * Phase A — URL capture (runs once on mount):
 *   Reads ?ref=CODE from the current URL, validates the code format,
 *   and persists it to localStorage under PENDING_KEY.
 *   Only saves if no pending code already exists (first referrer wins).
 *
 * Phase B — Wallet registration (runs when wallet connects):
 *   If a pending code exists and the connected wallet hasn't been attempted
 *   this page session, prompts the user to sign an EIP-191 message
 *   (action: 'referral-register') and POSTs to /api/referrals/register.
 *   Uses the same encodeURIComponent(message) header pattern as DailyStreak.
 *
 * Repeat-prompt prevention:
 *   A module-level Set<string> (attemptedWallets) tracks which wallet addresses
 *   have already been attempted this page session. It is cleared on hard refresh.
 *   If the user rejects the signature popup, the pending code is kept in
 *   localStorage but the wallet is still marked attempted — no re-prompt until
 *   the next page load.
 *
 * localStorage keys:
 *   predixi_pending_referral_code — the pending referral code (cleared on success)
 */

'use client'

import { useEffect, useRef } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { buildPredixiAuthMessage, generateNonce } from '@/lib/auth/wallet-signature'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PENDING_KEY = 'predixi_pending_referral_code'
const CODE_REGEX  = /^[A-Z0-9]{4,16}$/

// Module-level: cleared on hard refresh, persists across SPA navigations.
// Guards against re-prompting the same wallet multiple times per session.
const attemptedWallets = new Set<string>()

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalizeCode(raw: string): string | null {
  const code = raw.trim().toUpperCase()
  return CODE_REGEX.test(code) ? code : null
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useReferralCapture(): void {
  const { address, isConnected } = useAccount()
  const { signMessageAsync }     = useSignMessage()

  // Keep a stable ref to signMessageAsync to avoid stale closures in the
  // async attempt function without adding it to the effect dep array.
  const signRef      = useRef(signMessageAsync)
  const attemptingRef = useRef(false)
  useEffect(() => { signRef.current = signMessageAsync })

  // ── Phase A: capture ?ref= from URL on first mount ───────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = new URLSearchParams(window.location.search).get('ref')
    if (!raw) return
    const code = normalizeCode(raw)
    if (!code) return
    // First-referrer wins: only write if nothing is pending yet
    if (!localStorage.getItem(PENDING_KEY)) {
      localStorage.setItem(PENDING_KEY, code)
      console.info('[PrediXI] Referral code captured:', code)
    }
  }, []) // once on mount

  // ── Phase B: attempt registration when wallet becomes available ───────────
  useEffect(() => {
    if (!isConnected || !address) return

    const pendingCode = localStorage.getItem(PENDING_KEY)
    if (!pendingCode) return

    const wallet = address.toLowerCase()
    if (attemptedWallets.has(wallet)) return // already tried this session
    if (attemptingRef.current) return        // in-flight guard

    async function attempt() {
      if (!address) return
      attemptedWallets.add(wallet)
      attemptingRef.current = true

      try {
        const nonce     = generateNonce()
        const message   = buildPredixiAuthMessage(address, 'referral-register', nonce)
        const signature = await signRef.current({ message })

        const res = await fetch('/api/referrals/register', {
          method:  'POST',
          headers: {
            'Content-Type':       'application/json',
            // Encode because the message contains \n which is illegal in headers
            'x-wallet-message':   encodeURIComponent(message),
            'x-wallet-signature': signature,
          },
          body: JSON.stringify({ referralCode: pendingCode }),
        })

        const data = await res.json() as {
          ok:      boolean
          status?: string
          error?:  string
        }

        if (data.ok) {
          // 'registered' or 'already_registered' — both are terminal states
          localStorage.removeItem(PENDING_KEY)
          if (data.status === 'registered') {
            window.dispatchEvent(new CustomEvent('predixi:referral-registered'))
            console.info('[PrediXI] Referral registered ✓')
          }
          return
        }

        // ── Handle specific error states ─────────────────────────────────
        switch (data.error) {
          case 'ALREADY_REFERRED_BY_ANOTHER_USER':
            // User was already referred by someone else — clear and move on
            localStorage.removeItem(PENDING_KEY)
            break

          case 'SELF_REFERRAL_NOT_ALLOWED':
            // Can't refer yourself — clear silently (cosmetic console only)
            localStorage.removeItem(PENDING_KEY)
            console.info('[PrediXI] Referral: own link used — cleared')
            break

          case 'REFERRAL_CODE_NOT_FOUND':
            // Invalid or expired code — clear so we don't keep retrying
            localStorage.removeItem(PENDING_KEY)
            console.warn('[PrediXI] Referral: code not found — cleared')
            break

          case 'ALREADY_ACTIVE_USER_CANNOT_BE_REFERRED':
            // User has existing activity and is past the grace window — clear permanently
            localStorage.removeItem(PENDING_KEY)
            break

          default:
            // REFERRAL_REGISTER_FAILED, INVALID_SIGNATURE, network error, etc.
            // Keep pending code so next page load can retry.
            // Remove from attemptedWallets so next load can attempt again.
            attemptedWallets.delete(wallet)
            console.warn('[PrediXI] Referral attempt failed:', data.error)
            break
        }
      } catch (e) {
        // Signature rejected by user, or network failure.
        // Keep pending code in localStorage (user can try again later).
        // Keep wallet in attemptedWallets to avoid re-prompting this session.
        const msg         = e instanceof Error ? e.message : ''
        const isRejection = /rejected|denied|cancelled|cancel/i.test(msg)
        if (!isRejection) {
          console.warn('[PrediXI] Referral attempt error:', msg)
        }
        // No localStorage.removeItem — user can retry on next page load
      } finally {
        attemptingRef.current = false
      }
    }

    attempt()
  }, [isConnected, address]) // signMessageAsync accessed via ref — intentionally excluded
}
