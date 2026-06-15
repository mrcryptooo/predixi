// ─────────────────────────────────────────────────────────────────────────────
// XP Ledger — client-side helpers for /api/xp-events
// Source of truth for all XP: match predictions, WC predictions, Daily XI,
// badges, missions, and admin adjustments.
// ─────────────────────────────────────────────────────────────────────────────

export const XP_SOURCE_TYPES = [
  'match_prediction',
  'wc_prediction',
  'daily_xi',
  'badge',
  'mission',
  'admin_adjustment',
  'spin',
  'daily_streak',
  'referral_bonus',
  'referral_reward',
] as const;

export type XPSourceType = typeof XP_SOURCE_TYPES[number];

export type XPEvent = {
  id:         string;
  sourceType: XPSourceType;
  sourceId:   string;
  xpAmount:   number;
  reason:     string;
  metadata:   Record<string, unknown>;
  createdAt:  string;
};

export type XPLedgerSummary = {
  totalXp:      number;
  eventCount:   number;
  bySourceType: Record<string, { totalXp: number; count: number }>;
  events:       XPEvent[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Fetch
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all XP events for a wallet from the ledger API.
 * Returns null on any error — caller handles fallback/empty state.
 */
export async function fetchXPEvents(walletAddress: string): Promise<XPLedgerSummary | null> {
  try {
    const res = await fetch(
      `/api/xp-events?wallet=${encodeURIComponent(walletAddress)}`,
    );
    if (!res.ok) return null;
    const data = await res.json() as {
      success:      boolean;
      totalXp?:     number;
      eventCount?:  number;
      bySourceType?: Record<string, { totalXp: number; count: number }>;
      events?:      XPEvent[];
    };
    if (!data.success) return null;
    return {
      totalXp:      data.totalXp      ?? 0,
      eventCount:   data.eventCount   ?? 0,
      bySourceType: data.bySourceType ?? {},
      events:       data.events       ?? [],
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────────────────────

export type CreateXPEventInput = {
  walletAddress: string;
  sourceType:    XPSourceType;
  sourceId:      string;
  xpAmount:      number;
  reason:        string;
  metadata?:     Record<string, unknown>;
};

/**
 * Record a new XP event via the ledger API.
 * Duplicate-safe — returns { success, duplicate } without throwing.
 */
export async function createXPEvent(
  input: CreateXPEventInput,
): Promise<{ success: boolean; duplicate: boolean }> {
  try {
    const res = await fetch('/api/xp-events', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(input),
    });
    if (!res.ok) return { success: false, duplicate: false };
    const data = await res.json() as { success: boolean; duplicate?: boolean };
    return { success: data.success, duplicate: data.duplicate ?? false };
  } catch {
    return { success: false, duplicate: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers (no network)
// ─────────────────────────────────────────────────────────────────────────────

/** Sum all xpAmount values from an events array. */
export function calculateTotalXP(events: XPEvent[]): number {
  return events.reduce((sum, e) => sum + e.xpAmount, 0);
}

/** Group events by sourceType, returning totalXp and count per type. */
export function groupXPBySource(
  events: XPEvent[],
): Record<string, { totalXp: number; count: number }> {
  const result: Record<string, { totalXp: number; count: number }> = {};
  for (const e of events) {
    const entry = result[e.sourceType] ?? { totalXp: 0, count: 0 };
    entry.totalXp += e.xpAmount;
    entry.count   += 1;
    result[e.sourceType] = entry;
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Display label map (UI utility)
// ─────────────────────────────────────────────────────────────────────────────

export const XP_SOURCE_LABELS: Record<XPSourceType, string> = {
  match_prediction: 'Match Predictions',
  wc_prediction:    'World Cup Picks',
  daily_xi:         'Daily XI',
  badge:            'Badges',
  mission:          'Missions',
  admin_adjustment: 'Adjustments',
  spin:             'Daily Spin',
  daily_streak:     'Daily Streak',
  referral_bonus:   'Referral Bonus',
  referral_reward:  'Referral Reward',
};
