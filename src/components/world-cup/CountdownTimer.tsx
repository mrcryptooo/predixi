"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Globe, MapPin } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// World Cup 2026 Final — 19 July 2026 18:00 UTC
// ─────────────────────────────────────────────────────────────────────────────
const WC_FINAL = new Date("2026-07-19T18:00:00Z").getTime();

interface TimeLeft {
  days:    number;
  hours:   number;
  minutes: number;
  seconds: number;
}

function calc(): TimeLeft {
  const diff = Math.max(0, WC_FINAL - Date.now());
  return {
    days:    Math.floor(diff / 86_400_000),
    hours:   Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000)  /    60_000),
    seconds: Math.floor((diff %    60_000)  /     1_000),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Flip tile
// ─────────────────────────────────────────────────────────────────────────────

interface TileProps {
  value:      number;
  label:      string;
  accentClass: string;
}

function FlipTile({ value, label, accentClass }: TileProps) {
  const display = String(value).padStart(2, "0");

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Card */}
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-elevated border border-border overflow-hidden shadow-lg">
        {/* Top half accent line */}
        <div className={`absolute top-0 inset-x-0 h-0.5 ${accentClass}`} />
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none" />
        {/* Mid divider */}
        <div className="absolute top-1/2 inset-x-0 h-px bg-black/30" />

        <AnimatePresence mode="popLayout">
          <motion.span
            key={display}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute inset-0 flex items-center justify-center font-mono font-black text-3xl sm:text-4xl tabular-nums text-text-primary leading-none"
          >
            {display}
          </motion.span>
        </AnimatePresence>
      </div>
      {/* Label */}
      <span className="text-[10px] sm:text-[11px] font-mono font-semibold text-text-muted uppercase tracking-widest">
        {label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Separator
// ─────────────────────────────────────────────────────────────────────────────

function Sep() {
  return (
    <span className="font-mono font-black text-3xl sm:text-4xl text-text-muted mb-8 select-none">:</span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface CountdownTimerProps {
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export function CountdownTimer({ className }: CountdownTimerProps) {
  const [t, setT] = useState<TimeLeft>(calc);

  useEffect(() => {
    const id = setInterval(() => setT(calc()), 1000);
    return () => clearInterval(id);
  }, []);

  const tiles: TileProps[] = [
    { value: t.days,    label: "Days",    accentClass: "bg-primary" },
    { value: t.hours,   label: "Hours",   accentClass: "bg-primary" },
    { value: t.minutes, label: "Minutes", accentClass: "bg-cyan"    },
    { value: t.seconds, label: "Seconds", accentClass: "bg-warning" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={className}
    >
      <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-[#070b22] to-[#060810] p-6 sm:p-8">
        {/* Glow blobs */}
        <div className="absolute -left-12 -top-12 w-48 h-48 rounded-full bg-primary opacity-10 blur-3xl pointer-events-none" />
        <div className="absolute -right-12 -bottom-12 w-48 h-48 rounded-full bg-primary opacity-8 blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-[#4d7ef7] flex items-center justify-center flex-shrink-0 shadow-lg">
              <Trophy size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary leading-tight">
                FIFA World Cup 2026™
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <MapPin size={10} className="text-text-muted" />
                <p className="text-[11px] text-text-muted font-mono">
                  USA · Canada · Mexico
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-mono font-bold bg-success/15 text-success border border-success/25 px-2 py-1 rounded-lg">
              LIVE
            </span>
          </div>
        </div>

        {/* Countdown tiles */}
        <div className="relative z-10 flex items-center justify-center gap-2 sm:gap-4 mb-8">
          <FlipTile {...tiles[0]} />
          <Sep />
          <FlipTile {...tiles[1]} />
          <Sep />
          <FlipTile {...tiles[2]} />
          <Sep />
          <FlipTile {...tiles[3]} />
        </div>

        {/* Footer meta */}
        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] font-mono text-text-muted">
            <Globe size={11} className="text-primary flex-shrink-0" />
            <span>12 Groups · 48 Teams · 104 Matches</span>
          </div>
          <div className="flex gap-1.5 flex-wrap justify-center">
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
      </div>
    </motion.div>
  );
}
