/**
 * Server-side rate limiting via Upstash Redis.
 *
 * Requires environment variables:
 *   UPSTASH_REDIS_REST_URL   — REST endpoint for the Upstash Redis database
 *   UPSTASH_REDIS_REST_TOKEN — read-write token for the database
 *
 * If either variable is absent (e.g. local dev without Redis provisioned),
 * all rate-limit checks return { limited: false } — traffic is allowed through
 * with a console warning.  Set the vars in Vercel before production deployment.
 *
 * Behaviour:
 *   - Sliding window algorithm: the window resets relative to the first request
 *     in each window, not on a fixed clock boundary.  This avoids the "double
 *     burst at boundary" problem of fixed windows.
 *   - All keys are prefixed with "rl:" to avoid collisions with other Redis keys.
 *   - Each call creates a new Ratelimit instance but reuses the single Redis
 *     connection (the Redis client is a module-level singleton).
 */

import { Redis }     from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

// ── Redis singleton ────────────────────────────────────────────────────────────

function buildRedis(): Redis | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

const redis = buildRedis()

if (!redis) {
  console.warn(
    '[ratelimit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set — ' +
    'rate limiting is DISABLED.  Set these env vars before production deployment.',
  )
}

// ── Rate-limit result ─────────────────────────────────────────────────────────

export type RateLimitResult = { limited: boolean; remaining?: number }

// ── Limiter factory ───────────────────────────────────────────────────────────

/**
 * Check a rate-limit window for the given identifier.
 * Returns { limited: false } when Redis is not configured.
 *
 * @param prefix   Short label used in the Redis key (e.g. "spin:prepare:ip").
 * @param id       The value being rate-limited (IP address, wallet address, etc.).
 * @param limit    Max requests allowed in the window.
 * @param window   Window duration as an Upstash duration string (e.g. "1 m", "1 h").
 */
export async function checkRateLimit(
  prefix: string,
  id:     string,
  limit:  number,
  window: `${number} ${'s' | 'm' | 'h' | 'd'}`,
): Promise<RateLimitResult> {
  if (!redis) return { limited: false }

  const limiter = new Ratelimit({
    redis,
    limiter:   Ratelimit.slidingWindow(limit, window),
    prefix:    `rl:${prefix}`,
    analytics: false,
  })

  const { success, remaining } = await limiter.limit(id)
  return { limited: !success, remaining }
}
