/**
 * Phase 4A — Supabase client factory
 *
 * Provides a safe, singleton Supabase client for client-side use.
 * The app will NOT crash if env vars are absent (e.g. during local dev
 * before a Supabase project is created). All callers must handle the
 * case where `getSupabaseClient()` returns null.
 *
 * Required environment variables (set in .env.local + Vercel):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Singleton — one client instance per browser session
// ─────────────────────────────────────────────────────────────────────────────

let _client: SupabaseClient<Database> | null = null

/**
 * Returns the Supabase client, or null if env vars are not configured.
 * Safe to call anywhere — will never throw due to missing config.
 */
export function getSupabaseClient(): SupabaseClient<Database> | null {
  if (_client) return _client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key || url.trim() === '' || key.trim() === '') {
    // Supabase not yet configured — Phase 4A foundation only
    return null
  }

  try {
    _client = createClient<Database>(url, key, {
      auth: {
        // Wallet-based auth — Supabase Auth session not used in Phase 4A
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
    return _client
  } catch {
    // Never throw — missing/malformed config must not crash the app
    return null
  }
}

/**
 * Returns true if the Supabase client is configured and available.
 * Use this as a feature flag before making any DB calls.
 */
export function isSupabaseConfigured(): boolean {
  return getSupabaseClient() !== null
}
