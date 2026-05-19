"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, X, CheckCheck, Trash2, Zap, Trophy, Star, Info, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  clearNotifications,
  type NotificationItem,
  type NotificationType,
} from "@/lib/notifications";

// ── Icon map per notification type ───────────────────────────────────────────

function NotifIcon({ type, className }: { type: NotificationType; className?: string }) {
  const base = cn("flex-shrink-0", className);
  switch (type) {
    case "xp_awarded":          return <Zap        size={13} className={cn(base, "text-primary")} />;
    case "prediction_settled":  return <Trophy     size={13} className={cn(base, "text-yellow-400")} />;
    case "daily_xi_scored":     return <CalendarDays size={13} className={cn(base, "text-emerald-400")} />;
    case "rank_up":             return <Star       size={13} className={cn(base, "text-amber-400")} />;
    case "system":              return <Info       size={13} className={cn(base, "text-text-muted")} />;
  }
}

// ── Relative time helper ──────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── NotificationRow ───────────────────────────────────────────────────────────

function NotificationRow({
  notif,
  onRead,
}: {
  notif: NotificationItem;
  onRead: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onRead(notif.id)}
      className={cn(
        "w-full text-left px-3 py-2.5 rounded-lg transition-colors duration-100",
        "flex items-start gap-2.5",
        notif.read
          ? "opacity-50 hover:opacity-70"
          : "bg-primary/5 hover:bg-primary/10 border border-primary/10",
      )}
    >
      {/* Unread dot */}
      <div className="flex-shrink-0 mt-1">
        {!notif.read && (
          <span className="block w-1.5 h-1.5 rounded-full bg-primary mt-0.5" />
        )}
        {notif.read && (
          <span className="block w-1.5 h-1.5" />
        )}
      </div>

      {/* Icon */}
      <NotifIcon type={notif.type} className="mt-0.5" />

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className={cn(
          "text-[11px] font-semibold leading-tight truncate",
          notif.read ? "text-text-secondary" : "text-white",
        )}>
          {notif.title}
        </p>
        <p className="text-[10px] text-text-muted leading-snug mt-0.5 line-clamp-2">
          {notif.message}
        </p>
        <p className="text-[9px] font-mono text-white/20 mt-1">
          {relativeTime(notif.createdAt)}
        </p>
      </div>
    </button>
  );
}

// ── NotificationBell ──────────────────────────────────────────────────────────

interface NotificationBellProps {
  /** Additional className on the trigger button */
  className?: string;
}

export function NotificationBell({ className }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [open, setOpen]                   = useState(false);
  const panelRef                          = useRef<HTMLDivElement>(null);
  const buttonRef                         = useRef<HTMLButtonElement>(null);

  // Load from localStorage (client only)
  const reload = useCallback(() => {
    setNotifications(getNotifications());
  }, []);

  useEffect(() => {
    reload();
    // Refresh when tab regains focus (another tab may have written)
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, [reload]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (
        panelRef.current  && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const unread = notifications.filter(n => !n.read).length;

  function handleRead(id: string) {
    markNotificationRead(id);
    reload();
  }

  function handleMarkAllRead() {
    markAllNotificationsRead();
    reload();
  }

  function handleClear() {
    clearNotifications();
    reload();
    setOpen(false);
  }

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={buttonRef}
        onClick={() => setOpen(o => !o)}
        aria-label={`Notifications${unread > 0 ? ` — ${unread} unread` : ""}`}
        className={cn(
          "relative flex items-center justify-center w-8 h-8 rounded-lg",
          "text-text-muted hover:text-white hover:bg-white/5",
          "transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
          open && "text-white bg-white/5",
          className,
        )}
      >
        <Bell size={16} strokeWidth={2} />

        {/* Unread badge */}
        {unread > 0 && (
          <span className={cn(
            "absolute -top-0.5 -right-0.5",
            "flex items-center justify-center",
            "min-w-[14px] h-[14px] px-0.5 rounded-full",
            "bg-primary text-white text-[9px] font-bold leading-none",
          )}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          className={cn(
            "absolute z-50 mt-2",
            // Desktop: anchor to right edge of bell
            // On sidebar (left side): open to the right
            "left-0 md:left-auto md:right-0",
            "w-72 max-h-[420px] flex flex-col",
            "rounded-xl border border-border glass-nav shadow-xl",
            "overflow-hidden",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <Bell size={12} className="text-text-muted" />
              <span className="text-[11px] font-bold text-white/70">Notifications</span>
              {unread > 0 && (
                <span className="text-[9px] font-mono text-primary">
                  {unread} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  title="Mark all read"
                  className="p-1 rounded-md text-text-muted hover:text-white hover:bg-white/5 transition-colors"
                >
                  <CheckCheck size={12} />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={handleClear}
                  title="Clear all"
                  className="p-1 rounded-md text-text-muted hover:text-red-400 hover:bg-red-400/5 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                title="Close"
                className="p-1 rounded-md text-text-muted hover:text-white hover:bg-white/5 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1 p-2 space-y-1">
            {notifications.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Bell size={22} className="text-white/10" />
                <p className="text-[11px] text-text-muted text-center">
                  No notifications yet
                </p>
                <p className="text-[10px] text-white/20 text-center">
                  XP events and rank updates will appear here
                </p>
              </div>
            ) : (
              notifications.map(notif => (
                <NotificationRow
                  key={notif.id}
                  notif={notif}
                  onRead={handleRead}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
