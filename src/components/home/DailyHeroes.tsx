"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shuffle, Wallet, ChevronRight, RotateCcw, HelpCircle, X,
} from "lucide-react";
import { useAccount } from "wagmi";
import { cn } from "@/lib/utils";
import {
  XI_POSITIONS,
  loadTodayXI,
  saveTodayXI,
  clearTodayXI,
  getPositionPool,
  fetchDailyXIRemote,
  fetchDailyXIEntryMeta,
  saveDailyXIRemote,
  type DailyXIPlayer,
  type DailyXIEntryMeta,
} from "@/lib/daily-xi";
import { DailyXIPitch } from "@/components/home/DailyXIPitch";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SPIN_TICKS = 20;   // total ticks before settling
const TICK_MS   = 90;    // ms per tick — 90ms is more reliable across React render cycles
const OFFSETS   = [-2, -1, 0, 1, 2] as const;

type CardSize = "xs" | "sm" | "lg";
const SIZES: CardSize[]  = ["xs", "sm", "lg", "sm", "xs"];
const OPACITIES          = [0.18, 0.52, 1.0,  0.52, 0.18];
const SCALES             = [0.72, 0.85, 1.0,  0.85, 0.72];

// ─────────────────────────────────────────────────────────────────────────────
// Build stable carousel pool: finalPlayer is placed at index 0, pool padded ≥5
// startIdx is computed so (startIdx + SPIN_TICKS) % poolLen = 0 → lands on finalPlayer
// ─────────────────────────────────────────────────────────────────────────────

function buildStablePool(rawPool: DailyXIPlayer[], finalPlayer: DailyXIPlayer): {
  pool: DailyXIPlayer[];
  startIdx: number;
} {
  // Others = pool minus finalPlayer (shuffled for visual variety)
  const others = rawPool
    .filter(p => p.id !== finalPlayer.id)
    .sort(() => Math.random() - 0.5);

  // Arrange: finalPlayer at index 0, then others, padded to ≥ 5
  const base = [finalPlayer, ...others];
  const pool = base.length >= 5
    ? base
    : [...base, ...base, ...base].slice(0, 5);

  const n = pool.length;
  // After SPIN_TICKS increments from startIdx we want to be at index 0
  const startIdx = ((0 - (SPIN_TICKS % n)) % n + n) % n;
  return { pool, startIdx };
}

// ─────────────────────────────────────────────────────────────────────────────
// PlayerAvatar
// ─────────────────────────────────────────────────────────────────────────────

const CIRCLE: Record<CardSize, string> = {
  xs: "w-11 h-11",
  sm: "w-16 h-16",
  lg: "w-24 h-24",
};

// Bare image with fallback — used inside custom containers in carousel
function PlayerImg({ player }: { player: DailyXIPlayer }) {
  const [err, setErr] = useState(false);
  return err ? (
    <div className="w-full h-full bg-gradient-to-br from-primary/25 to-[#060a1e] flex items-center justify-center">
      <span className="text-white/50 font-black text-xs">{player.name.charAt(0)}</span>
    </div>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={player.image} alt={player.name} className="w-full h-full object-cover" onError={() => setErr(true)} />
  );
}

function PlayerAvatar({
  player, size, glow,
}: {
  player: DailyXIPlayer; size: CardSize; glow?: boolean;
}) {
  const [err, setErr] = useState(false);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={cn(
        CIRCLE[size], "rounded-full overflow-hidden flex-shrink-0",
        glow
          ? "border-[3px] border-primary shadow-[0_0_22px_rgba(22,82,240,0.75),0_0_44px_rgba(22,82,240,0.35)]"
          : "border-2 border-white/[0.12]",
      )}>
        {!err ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={player.image} alt={player.name}
               className="w-full h-full object-cover"
               onError={() => setErr(true)} />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/25 to-[#060a1e] flex items-center justify-center">
            <span className="text-white/50 font-black text-sm">{player.name.charAt(0)}</span>
          </div>
        )}
      </div>
      {size === "lg" && (
        <div className="text-center max-w-[88px] space-y-0.5">
          <p className="text-[10px] font-bold text-white/85 truncate leading-tight">{player.name}</p>
          <p className="text-[9px] text-white/35 font-mono">{player.teamShort}</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Carousel — 5 cards, horizontal slide per tick
// pool and tickerIdx are stable during spin (held in refs)
// ─────────────────────────────────────────────────────────────────────────────

function Carousel({
  pool, tickerIdx, spinning, justPicked,
}: {
  pool: DailyXIPlayer[]; tickerIdx: number; spinning: boolean; justPicked: DailyXIPlayer | null;
}) {
  const n = pool.length;
  if (n === 0) return null;

  return (
    <div className="relative flex items-center justify-center gap-5 sm:gap-6 py-3 overflow-hidden">
      {/* Edge fade masks */}
      <div className="absolute left-0 top-0 h-full w-10 bg-gradient-to-r from-[#07101f] to-transparent pointer-events-none z-10" />
      <div className="absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-[#07101f] to-transparent pointer-events-none z-10" />

      {OFFSETS.map((offset, i) => {
        const idx      = ((tickerIdx + offset) % n + n) % n;
        const isCenter = offset === 0;
        const player   = (isCenter && !spinning && justPicked) ? justPicked : pool[idx];

        if (isCenter) {
          // Outer frame (fixed, does NOT move) wraps a smaller animated inner card
          return (
            <div key={i} className="flex-shrink-0 relative w-24 h-24 flex items-center justify-center">
              {/* ONE glowing outer ring — the only selector indicator */}
              <div className={cn(
                "absolute inset-0 rounded-full border-2 pointer-events-none transition-all duration-300",
                spinning
                  ? "border-primary/40 shadow-[0_0_14px_rgba(22,82,240,0.3)]"
                  : "border-primary shadow-[0_0_22px_rgba(22,82,240,0.6)]",
              )} />
              {/* Inner animated card — smaller than outer ring, no extra border */}
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${player.id}-${tickerIdx}-c`}
                  initial={{ x: spinning ? 20 : 0, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -20, opacity: 0 }}
                  transition={{ duration: 0.07, ease: "easeOut" }}
                  className="flex flex-col items-center gap-1"
                >
                  <div className="w-14 h-14 rounded-full overflow-hidden border border-white/[0.10]">
                    <PlayerImg player={player} />
                  </div>
                  <p className="text-[9px] font-bold text-white/80 max-w-[64px] truncate text-center leading-none">
                    {player.name.split(" ").pop()}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          );
        }

        // Non-center cards — plain portrait, faded + scaled
        return (
          <div
            key={i}
            style={{ opacity: OPACITIES[i], transform: `scale(${SCALES[i]})` }}
            className="flex-shrink-0 transition-transform duration-150"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${player.id}-${tickerIdx}-${i}`}
                initial={{ x: spinning ? 20 : 0, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                transition={{ duration: 0.07, ease: "easeOut" }}
              >
                <div className={cn(CIRCLE[SIZES[i]], "rounded-full overflow-hidden border border-white/[0.08]")}>
                  <PlayerImg player={player} />
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Slot strip
// ─────────────────────────────────────────────────────────────────────────────

function SlotStrip({ slots, nextIdx }: { slots: (DailyXIPlayer | null)[]; nextIdx: number }) {
  return (
    <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-0.5">
      {XI_POSITIONS.map((pos, i) => {
        const filled = !!slots[i];
        const isNext = i === nextIdx;
        return (
          <div key={i} className={cn(
            "flex-shrink-0 flex flex-col items-center gap-1 px-2 py-2 rounded-xl border min-w-[52px] transition-all duration-250",
            filled  ? "bg-primary/15 border-primary/35"
            : isNext ? "bg-primary/8 border-primary/55 shadow-[0_0_10px_rgba(22,82,240,0.3)]"
            :          "bg-white/[0.03] border-white/[0.07]",
          )}>
            <span className={cn(
              "text-[8px] font-mono font-bold tracking-wider",
              filled ? "text-primary" : isNext ? "text-primary/70" : "text-white/20",
            )}>{pos}</span>
            {filled && slots[i] ? (
              <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-primary/40 shadow-[0_0_8px_rgba(22,82,240,0.35)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={slots[i]!.image} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
              </div>
            ) : (
              <div className={cn(
                "w-9 h-9 rounded-full border",
                isNext ? "border-primary/45 bg-primary/10" : "border-white/[0.08]",
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export function DailyHeroes({ isConnected }: { isConnected: boolean }) {
  const { address } = useAccount();

  const [slots,     setSlots]     = useState<(DailyXIPlayer | null)[]>(() => Array(11).fill(null));
  const [entryMeta, setEntryMeta] = useState<DailyXIEntryMeta | null>(null);
  const [hydrated,  setHydrated]  = useState(false);
  const [spinning,  setSpinning]  = useState(false);
  const [tickerIdx, setTickerIdx] = useState(0);
  const [carouselPool, setCarouselPool] = useState<DailyXIPlayer[]>([]);
  const [poolErr,  setPoolErr]  = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  // Holds the just-selected player so center card stays correct after rebuildDisplay fires
  const [justPicked, setJustPicked] = useState<DailyXIPlayer | null>(null);
  // Increments on every spin — forces Framer Motion key change so animation always fires
  const [spinRunId, setSpinRunId]   = useState(0);

  // Stable refs — these never go stale inside the interval closure
  const stablePoolRef  = useRef<DailyXIPlayer[]>([]);
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step 1 — hydrate from localStorage immediately
  useEffect(() => {
    const saved = loadTodayXI();
    setSlots(saved);
    setHydrated(true);
  }, []);

  // Step 2 — if wallet connected, hydrate from API and merge (API wins)
  useEffect(() => {
    if (!isConnected || !address) return;
    fetchDailyXIRemote(address).then(remote => {
      if (!remote) return;
      saveTodayXI(remote);
      setSlots(remote);
    }).catch(() => {/* silent */});
    fetchDailyXIEntryMeta(address).then(meta => {
      if (meta) setEntryMeta(meta);
    }).catch(() => {/* silent */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address]);

  const nextIdx    = slots.findIndex(s => s === null);
  const allFilled  = nextIdx === -1;
  const filled     = slots.filter(Boolean).length;
  const currentPos = allFilled ? null : XI_POSITIONS[nextIdx];

  // Rebuild carousel pool whenever the current slot changes (not during spin)
  const rebuildDisplay = useCallback(() => {
    // Block rebuild while justPicked is active — prevents overwriting center display
    if (allFilled || !currentPos || spinning || justPicked) return;
    const taken = slots.filter(Boolean).map(p => p!.id);
    const raw   = getPositionPool(currentPos, taken);
    if (raw.length === 0) { setPoolErr(true); setCarouselPool([]); return; }
    setPoolErr(false);
    const display = [...raw].sort(() => Math.random() - 0.5);
    const padded  = display.length >= 5 ? display
      : [...display, ...display, ...display].slice(0, 5);
    setCarouselPool(padded);
    setTickerIdx(0);
  }, [allFilled, currentPos, spinning, slots, justPicked]);

  useEffect(() => { rebuildDisplay(); }, [rebuildDisplay]);

  // Cleanup
  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const handleSpin = () => {
    // Hard guard: reject if any interval is still alive or already spinning
    if (intervalRef.current || spinning || allFilled || !isConnected || !currentPos) return;

    setJustPicked(null);

    const taken   = slots.filter(Boolean).map(p => p!.id);
    const rawPool = getPositionPool(currentPos, taken);
    if (rawPool.length === 0) { setPoolErr(true); return; }

    const finalPlayer  = rawPool[Math.floor(Math.random() * rawPool.length)];
    const { pool, startIdx } = buildStablePool(rawPool, finalPlayer);

    stablePoolRef.current = pool;
    const capturedNextIdx = nextIdx;
    const nextRunId = spinRunId + 1;

    // Flush all state together before starting the interval
    setCarouselPool(pool);
    setTickerIdx(startIdx);
    setSpinRunId(nextRunId);
    setSpinning(true);

    // Small delay so React commits the above state (avoids first-tick animation skip)
    setTimeout(() => {
      // Double-check no interval crept in during the delay
      if (intervalRef.current) clearInterval(intervalRef.current);

      let ticks = 0;
      intervalRef.current = setInterval(() => {
        ticks++;
        setTickerIdx(prev => (prev + 1) % stablePoolRef.current.length);

        if (ticks >= SPIN_TICKS) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          setJustPicked(finalPlayer);
          setSlots(prev => {
            const next = [...prev];
            next[capturedNextIdx] = finalPlayer;
            // Always save to localStorage first
            saveTodayXI(next);
            // If wallet connected, fire remote save (non-blocking)
            if (address) {
              saveDailyXIRemote(address, next).catch(() => {/* silent */});
            }
            return next;
          });
          setSpinning(false);
        }
      }, TICK_MS);
    }, 32); // one double-rAF gap — enough for React to paint first frame
  };

  const handleReset = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    clearTodayXI();
    setSlots(Array(11).fill(null));
    setSpinning(false);
    setTickerIdx(0);
  };

  if (!hydrated) return null;

  return (
    <div className={cn(
      "relative overflow-hidden rounded-3xl border",
      "border-primary/25 bg-gradient-to-br from-[#07101f] via-[#060b1c] to-[#040810]",
    )}>
      {/* Cinematic Daily XI background */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/backgrounds/daily-xi-bg.webp" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none" style={{ opacity: 0.18 }} loading="lazy" decoding="async" />
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full bg-primary opacity-[0.08] blur-3xl pointer-events-none" />
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

      <div className="p-6 sm:p-7 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">🃏</span>
              <h2 className="text-sm font-black text-white tracking-tight">Pick Today's XI Heroes</h2>
            </div>
            <p className="text-[11px] text-white/35 font-mono">
              Spin through player cards and build your daily squad.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[9px] font-mono font-bold text-amber-400 whitespace-nowrap">
              On-chain soon
            </span>
            <button type="button" onClick={() => setShowHelp(v => !v)}
              className="w-6 h-6 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-white/30 hover:text-primary transition-colors">
              {showHelp ? <X size={11} /> : <HelpCircle size={11} />}
            </button>
          </div>
        </div>

        {/* Help */}
        <AnimatePresence>
          {showHelp && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="px-3 py-2.5 rounded-xl bg-primary/8 border border-primary/20 text-[10px] text-white/45 font-mono leading-relaxed">
                Spin 11 times to fill each position (GK · RB · CB · CB · LB · RM · CM · CM · LM · ST · ST).
                Only players matching the required position appear. The center card is who gets added.
                Your XI saves locally for today.
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Wallet gate */}
        {!isConnected ? (
          <div className="relative overflow-hidden flex items-center gap-3 px-4 py-4 rounded-2xl border border-white/[0.07] bg-white/[0.02]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/backgrounds/wallet-connect-bg.webp" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none" style={{ opacity: 0.25 }} loading="lazy" decoding="async" />
            <div className="absolute inset-0 bg-black/20 pointer-events-none" />
            <Wallet size={16} className="text-white/25 flex-shrink-0 relative z-10" />
            <div className="relative z-10">
              <p className="text-xs font-bold text-white/40">Connect wallet to unlock Daily XI</p>
              <p className="text-[9px] text-white/20 font-mono mt-0.5">Submit on-chain when Base entry opens</p>
            </div>
          </div>
        ) : allFilled ? (
          <DailyXIPitch
            slots={slots}
            onReset={handleReset}
            earnedXp={entryMeta?.earnedXp}
            status={entryMeta?.status}
          />
        ) : (
          <div className="space-y-3">

            {/* Slot strip */}
            <SlotStrip slots={slots} nextIdx={nextIdx} />

            {/* Carousel */}
            {poolErr ? (
              <div className="py-4 text-center text-xs text-danger/60 font-mono">
                No players left for {currentPos}
              </div>
            ) : (
              <Carousel pool={carouselPool} tickerIdx={tickerIdx} spinning={spinning} justPicked={justPicked} />
            )}

            {/* Position + progress */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono text-white/30">Selecting</span>
                <span className="px-2 py-0.5 rounded-md bg-primary/15 border border-primary/30 text-[9px] font-mono font-bold text-primary">
                  {currentPos}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1 rounded-full bg-white/[0.07] overflow-hidden">
                  <motion.div className="h-full rounded-full bg-primary"
                    animate={{ width: `${(filled / 11) * 100}%` }}
                    transition={{ duration: 0.35, ease: "easeOut" }} />
                </div>
                <span className="text-[9px] font-mono text-white/30 tabular-nums">{filled}/11</span>
              </div>
            </div>

            {/* Spin button */}
            <button type="button" onClick={handleSpin}
              disabled={spinning || poolErr}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black tracking-wide",
                "transition-all duration-150 active:scale-[0.97]",
                spinning || poolErr
                  ? "bg-primary/15 border border-primary/25 text-primary/40 cursor-wait"
                  : "bg-primary text-white shadow-[0_4px_28px_rgba(22,82,240,0.48)] hover:opacity-90",
              )}>
              <Shuffle size={15} className={cn(spinning && "animate-spin")} />
              {spinning ? "Spinning…" : "Spin Next Hero"}
            </button>

            {/* Selected XI list — enlarged */}
            {filled > 0 && (
              <div className="space-y-1.5 pt-1">
                {slots.map((p, i) => p && (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gradient-to-r from-primary/10 to-transparent border border-primary/20">
                    <span className="text-[9px] font-mono font-bold text-primary/70 w-7 flex-shrink-0 text-center">{XI_POSITIONS[i]}</span>
                    <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-primary/35 flex-shrink-0 shadow-[0_0_10px_rgba(22,82,240,0.35)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.image} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white/80 truncate leading-tight">{p.name}</p>
                      <p className="text-[9px] text-white/35 font-mono">{p.teamShort}</p>
                    </div>
                    <span className="text-[9px] font-mono text-white/20 flex-shrink-0 hidden sm:block">{p.styleTag}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t border-white/[0.05]">
          <div className="flex items-center gap-1.5">
            <ChevronRight size={9} className="text-white/15" />
            <p className="text-[9px] text-white/15 font-mono">{isConnected && address ? "Saved · Synced to account" : "Local · Connect wallet to sync"}</p>
          </div>
          {filled > 0 && !spinning && (
            <button type="button" onClick={handleReset}
              className="flex items-center gap-1 text-[9px] font-mono text-white/20 hover:text-danger/60 transition-colors">
              <RotateCcw size={9} /> Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
