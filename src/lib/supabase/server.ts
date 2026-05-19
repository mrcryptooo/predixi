/**
 * SERVER-ONLY — Supabase client using the service role key.
 *
 * ⚠️  NEVER import this file from client components, pages, or layouts.
 *     Only API routes (src/app/api/**) may import this module.
 *
 * The SUPABASE_SERVICE_ROLE_KEY env var has NO `NEXT_PUBLIC_` prefix, so
 * Next.js will never include it in the browser bundle. If this file were
 * mistakenly imported client-side, `getServerSupabaseClient()` would throw
 * because the key would be `undefined` — a deliberate fail-safe.
 *
 * Required env vars (server-only, set in .env.local + Vercel):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional env vars (local dev behind a proxy only):
 *   HTTPS_PROXY  or  HTTP_PROXY  (e.g. http://127.0.0.1:2080)
 *   When set, all server-side Supabase requests are routed through the proxy.
 *   On Vercel (no proxy env set) this code path is never entered.
 *
 * Note: The client is intentionally untyped (no Database generic) because
 * the service role is used exclusively in API routes where response shapes
 * are validated and typed explicitly. This avoids complex hand-written
 * generics that conflict with supabase-js's internal type inference.
 */

import { createClient } from '@supabase/supabase-js'
import { ProxyAgent, fetch as undiciF } from 'undici'

// ─────────────────────────────────────────────────────────────────────────────
// Proxy-aware fetch
// Reads the proxy URL from standard env vars (same ones used by curl, wget,
// npm, etc.).  When no proxy env var is present the behaviour is identical to
// the default global fetch — Vercel and any non-proxy environment are unaffected.
// ─────────────────────────────────────────────────────────────────────────────

function buildFetch(): typeof fetch {
  const proxyUrl =
    process.env.HTTPS_PROXY ??
    process.env.https_proxy ??
    process.env.HTTP_PROXY ??
    process.env.http_proxy

  if (!proxyUrl) {
    // No proxy configured — use the runtime's native fetch unchanged.
    return fetch
  }

  const dispatcher = new ProxyAgent(proxyUrl)

  // Return a wrapper that injects the undici dispatcher into every request.
  // undici's Response type does not perfectly overlap with the DOM Response
  // type (missing [Symbol.dispose] on iterator).  Double-casting through
  // unknown is the correct escape hatch — the runtime shapes are compatible.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proxyFetch: typeof fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
    undiciF(input as string | URL, {
      ...init,
      dispatcher,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any) as unknown as Promise<Response>
  return proxyFetch
}

// Build once per module load (cheap — just reads env vars and maybe creates
// one ProxyAgent object).
const customFetch = buildFetch()

// ─────────────────────────────────────────────────────────────────────────────
// Supabase client factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns an untyped Supabase client authenticated with the service role key.
 * Throws a descriptive error if env vars are missing — never returns null
 * (unlike the public client) because API routes must fail loudly.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getServerSupabaseClient(): ReturnType<typeof createClient<any>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || url.trim() === '') {
    throw new Error(
      '[server] NEXT_PUBLIC_SUPABASE_URL is not set. Add it to .env.local.',
    )
  }
  if (!key || key.trim() === '') {
    throw new Error(
      '[server] SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local.',
    )
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: customFetch,
    },
  })
}
