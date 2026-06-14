/**
 * logCronRun — fire-and-forget write to the cron_runs table.
 *
 * Never throws. Errors are console.warn'd so they don't silence cron failures.
 * Call at the end of every cron route handler, after the response is built.
 *
 * cron_runs schema: id (uuid), route (text), status (text),
 *                   summary (jsonb), error (text), ran_at (timestamptz)
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type CronRunStatus = 'success' | 'error' | 'skipped'

export interface CronRunPayload {
  supabase: SupabaseClient
  route:    string
  status:   CronRunStatus
  summary?: Record<string, unknown>
  error?:   string | null
}

export async function logCronRun({
  supabase,
  route,
  status,
  summary = {},
  error   = null,
}: CronRunPayload): Promise<void> {
  try {
    const { error: insertErr } = await supabase
      .from('cron_runs')
      .insert({
        route,
        status,
        summary,
        error:  error ?? null,
        ran_at: new Date().toISOString(),
      })

    if (insertErr) {
      console.warn(`[logCronRun] failed to write cron_runs for ${route}:`, insertErr.message)
    }
  } catch (e) {
    console.warn(`[logCronRun] unexpected error for ${route}:`, e)
  }
}
