/**
 * Notification System — localStorage-only, client-side only.
 *
 * No push API. No service worker. No backend table. No SSR dependency.
 * Safe to import anywhere — all localStorage access is guarded by
 * `typeof window !== 'undefined'` checks.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'xp_awarded'
  | 'prediction_settled'
  | 'daily_xi_scored'
  | 'rank_up'
  | 'system'

export type NotificationItem = {
  id:        string          // unique — used as dedup key
  type:      NotificationType
  title:     string
  message:   string
  read:      boolean
  createdAt: string          // ISO timestamp
  sourceId?: string          // e.g. xp_event id — for dedup
  xpAmount?: number          // optional — shown in UI
}

// ── Storage key ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'predixi_notifications'
const MAX_STORED  = 50   // cap to avoid unbounded localStorage growth

// ── createNotification ────────────────────────────────────────────────────────

export type CreateNotificationInput = {
  type:      NotificationType
  title:     string
  message:   string
  sourceId?: string
  xpAmount?: number
}

/** Creates a new NotificationItem (not yet saved — caller must call addNotification). */
export function createNotification(input: CreateNotificationInput): NotificationItem {
  return {
    id:        `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type:      input.type,
    title:     input.title,
    message:   input.message,
    read:      false,
    createdAt: new Date().toISOString(),
    sourceId:  input.sourceId,
    xpAmount:  input.xpAmount,
  }
}

// ── formatNotificationMessage ─────────────────────────────────────────────────

type FormatInput =
  | { type: 'xp_awarded';          xpAmount: number; reason?: string }
  | { type: 'prediction_settled';  isCorrect: boolean; matchLabel?: string }
  | { type: 'daily_xi_scored';     xpAmount: number; date?: string }
  | { type: 'rank_up';             newRank: string }
  | { type: 'system';              message: string }

/** Returns a { title, message } pair for a given notification event. */
export function formatNotificationMessage(input: FormatInput): { title: string; message: string } {
  switch (input.type) {
    case 'xp_awarded':
      return {
        title:   `+${input.xpAmount} XP Earned`,
        message: input.reason
          ? `You earned ${input.xpAmount} XP — ${input.reason}`
          : `You earned ${input.xpAmount} XP`,
      }

    case 'prediction_settled':
      return input.isCorrect
        ? {
            title:   'Prediction Correct ✅',
            message: input.matchLabel
              ? `Your prediction for ${input.matchLabel} was correct!`
              : 'Your prediction was correct!',
          }
        : {
            title:   'Prediction Settled',
            message: input.matchLabel
              ? `${input.matchLabel} settled — better luck next time.`
              : 'Your prediction has been settled.',
          }

    case 'daily_xi_scored':
      return {
        title:   'Daily XI Scored',
        message: input.date
          ? `Your Daily XI for ${input.date} earned ${input.xpAmount} XP.`
          : `Your Daily XI earned ${input.xpAmount} XP.`,
      }

    case 'rank_up':
      return {
        title:   `Rank Up! 🎉`,
        message: `You've reached ${input.newRank} rank. Keep predicting!`,
      }

    case 'system':
      return {
        title:   'PrediXI',
        message: input.message,
      }
  }
}

// ── localStorage helpers ──────────────────────────────────────────────────────

/** Returns all stored notifications, newest first. Returns [] on SSR or parse error. */
export function getNotifications(): NotificationItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as NotificationItem[]) : []
  } catch {
    return []
  }
}

/**
 * Adds a notification to localStorage.
 * Deduplicates by sourceId — if a notification with the same sourceId
 * already exists, it is NOT added again.
 * Caps total stored at MAX_STORED (oldest dropped).
 */
export function addNotification(notif: NotificationItem): boolean {
  if (typeof window === 'undefined') return false
  try {
    const existing = getNotifications()

    // Dedup by sourceId
    if (notif.sourceId && existing.some(n => n.sourceId === notif.sourceId)) {
      return false
    }

    // Dedup by id (should never happen but be safe)
    if (existing.some(n => n.id === notif.id)) {
      return false
    }

    const updated = [notif, ...existing].slice(0, MAX_STORED)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    return true
  } catch {
    return false
  }
}

/** Marks a single notification as read by id. */
export function markNotificationRead(id: string): void {
  if (typeof window === 'undefined') return
  try {
    const existing = getNotifications()
    const updated  = existing.map(n => n.id === id ? { ...n, read: true } : n)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // swallow
  }
}

/** Marks all notifications as read. */
export function markAllNotificationsRead(): void {
  if (typeof window === 'undefined') return
  try {
    const existing = getNotifications()
    const updated  = existing.map(n => ({ ...n, read: true }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // swallow
  }
}

/** Removes all stored notifications. */
export function clearNotifications(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // swallow
  }
}

/** Returns count of unread notifications. */
export function getUnreadCount(): number {
  return getNotifications().filter(n => !n.read).length
}
