"use client";

import { useState, useEffect }                from "react";
import { motion }                             from "framer-motion";
import { CheckCircle2, XCircle, Clock, Zap, Trophy, CalendarDays } from "lucide-react";
import { cn }                                 from "@/lib/utils";
import { ProofBadge }                         from "@/components/proof/ProofBadge";
import {
  fetchUnifiedActivity,
  type ActivityItem,
  type MatchMetaEntry,
} from "@/lib/activity";

// ─────────────────────────────────────────────────────────────────────────────
// Icon per activity type / result
// ─────────────────────────────────────────────────────────────────────────────

function ActivityIcon({
  type,
  result,
}: {
  type:    ActivityItem["type"];
  result?: ActivityItem["result"];
}) {
  if (type === "match_prediction") {
    if (result === "correct")   return <CheckCircle2 size={14} className="text-success/80" />;
    if (result === "incorrect") return <XCircle      size={14} className="text-danger/70"  />;
    return <Clock size={14} className="text-white/25" />;
  }
  if (type === "wc_prediction") return <span className="text-sm leading-none">⚽</span>;
  if (type === "daily_xi")      return <Trophy size={14} className="text-primary/60" />;
  return <Zap size={14} className="text-primary/60" />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Row
// ─────────────────────────────────────────────────────────────────────────────

function ActivityRow({ item, delay }: { item: ActivityItem; delay: number }) {
  const dateLabel = new Date(item.timestamp).toLocaleDateString("en-GB", {
    day:   "numeric",
    month: "short",
  });

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: "easeOut", delay }}
      className="flex items-start gap-3 py-3 border-b border-white/[0.05] last:border-0"
    >
      {/* Type icon */}
      <div className="flex-shrink-0 w-6 flex justify-center pt-0.5">
        <ActivityIcon type={item.type} result={item.result} />
      </div>

      {/* Title + subtitle + optional proof badge */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white/80 truncate leading-tight">
          {item.title}
        </p>
        <p className="text-[10px] font-mono text-white/30 mt-0.5 truncate">
          {item.subtitle}
        </p>
        {item.proofHash && (
          <div className="mt-1.5">
            <ProofBadge
              commitmentHash={item.proofHash}
              submittedOnchain={item.submittedOnchain}
              txHash={item.txHash}
            />
          </div>
        )}
      </div>

      {/* XP delta + date */}
      <div className="flex-shrink-0 text-right">
        {item.xpDelta !== 0 && (
          <div className="flex items-center gap-0.5 justify-end">
            <Zap size={9} className="text-primary/60" />
            <span className={cn(
              "text-[10px] font-mono font-bold tabular-nums",
              item.xpDelta > 0 ? "text-primary" : "text-white/30",
            )}>
              {item.xpDelta > 0 ? `+${item.xpDelta}` : item.xpDelta}
            </span>
          </div>
        )}
        <p className="text-[10px] font-mono text-white/20 mt-0.5">{dateLabel}</p>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ActivityFeed
// ─────────────────────────────────────────────────────────────────────────────

interface ActivityFeedProps {
  walletAddress: string;
  matchMeta?:    Record<string, MatchMetaEntry>;
}

export function ActivityFeed({ walletAddress, matchMeta }: ActivityFeedProps) {
  const [items,   setItems]   = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchUnifiedActivity(walletAddress, matchMeta)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
    // matchMeta is stable after profile page mount — omit from deps to prevent re-fetch loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]);

  if (loading) {
    return (
      <p className="text-[10px] font-mono text-white/25 animate-pulse py-4 pl-1">
        Loading activity…
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <div className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center",
          "bg-gradient-to-br from-primary/12 to-bg",
          "border border-primary/18",
        )}>
          <CalendarDays size={24} className="text-primary/40" />
        </div>
        <p className="text-sm text-white/30 font-mono">No activity yet.</p>
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-2xl border border-white/[0.07]",
      "bg-gradient-to-b from-[#0b0f28] to-[#060810]",
      "px-4",
    )}>
      {items.map((item, i) => (
        <ActivityRow key={item.id} item={item} delay={Math.min(i * 0.04, 0.20)} />
      ))}
    </div>
  );
}
