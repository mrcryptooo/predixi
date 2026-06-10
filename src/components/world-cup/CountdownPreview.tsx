"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Globe, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// World Cup 2026 opens June 11 2026 (UTC)
// ─────────────────────────────────────────────────────────────────────────────
const WC_FINAL = new Date("2026-07-19T18:00:00Z").getTime();

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function getTimeLeft(): TimeLeft {
  const diff = Math.max(0, WC_FINAL - Date.now());
  const days    = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours   = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return { days, hours, minutes, seconds };
}

// ─────────────────────────────────────────────────────────────────────────────
// Flip tile
// ─────────────────────────────────────────────────────────────────────────────

interface TileProps {
  value: number;
  label: string;
}

function CountdownTile({ value, label }: TileProps) {
  const display = String(value).padStart(2, "0");
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-14 h-14 rounded-xl bg-elevated border border-border flex items-center justify-center overflow-hidden">
        {/* subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />
        <span className="font-mono font-black text-2xl tabular-nums text-text-primary leading-none">
          {display}
        </span>
      </div>
      <span className="text-[9px] font-mono font-semibold text-text-muted uppercase tracking-widest">
        {label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

interface CountdownPreviewProps {
  className?: string;
}

export function CountdownPreview({ className }: CountdownPreviewProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(getTimeLeft);

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  const tiles = [
    { value: timeLeft.days,    label: "Days"    },
    { value: timeLeft.hours,   label: "Hours"   },
    { value: timeLeft.minutes, label: "Mins"    },
    { value: timeLeft.seconds, label: "Secs"    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-primary/25 bg-primary/8 p-5",
        className
      )}
    >
      {/* Glow */}
      <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-primary opacity-10 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
            <Trophy size={16} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-text-primary leading-tight">
              FIFA World Cup 2026
            </p>
            <p className="text-[10px] text-text-muted font-mono mt-0.5">
              USA · Canada · Mexico
            </p>
          </div>
        </div>

        <span className="flex-shrink-0 text-[9px] font-mono font-bold bg-success/15 text-success border border-success/25 px-2 py-0.5 rounded-md">
          LIVE
        </span>
      </div>

      {/* Countdown tiles */}
      <div className="flex items-center justify-center gap-2 mb-5">
        {tiles.map((tile, i) => (
          <div key={tile.label} className="flex items-center gap-2">
            <CountdownTile value={tile.value} label={tile.label} />
            {i < tiles.length - 1 && (
              <span className="font-mono font-black text-xl text-text-muted mb-4 select-none">
                :
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Groups info */}
      <div className="rounded-xl border border-border bg-surface/60 px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Globe size={11} className="text-primary flex-shrink-0" />
          <span className="text-[10px] font-mono font-semibold text-text-secondary uppercase tracking-wider">
            12 Groups · 48 Teams · 104 Matches
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {["A","B","C","D","E","F","G","H","I","J","K","L"].map((g) => (
            <span
              key={g}
              className="text-[10px] font-mono font-bold w-5 h-5 rounded-md bg-primary/15 text-primary flex items-center justify-center border border-primary/20"
            >
              {g}
            </span>
          ))}
        </div>
      </div>

      {/* Teaser */}
      <p className="text-[10px] text-text-muted font-mono mt-3 text-center">
        Full group-stage predictions unlock before the tournament.
      </p>
    </motion.div>
  );
}
