"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence }           from "framer-motion";
import { Flame, Wallet, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { useAccount, useSignMessage }        from "wagmi";
import { buildPredixiAuthMessage, generateNonce } from "@/lib/auth/wallet-signature";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type StreakData = {
  currentStreak:  number;
  longestStreak:  number;
  lastClaimDate:  string | null;
  canClaimToday:  boolean;
  xpReward:       number;
};

// ─────────────────────────────────────────────────────────────────────────────
// DailyStreak
// ─────────────────────────────────────────────────────────────────────────────

export function DailyStreak({ isConnected }: { isConnected: boolean }) {
  const { address }          = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [streak,    setStreak]    = useState<StreakData | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [claiming,  setClaiming]  = useState(false);
  const [justClaimed, setJustClaimed] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // Fetch streak data when wallet connects
  useEffect(() => {
    if (!isConnected || !address) { setStreak(null); return; }
    setLoading(true);
    fetch(`/api/daily-streak?wallet=${address}`)
      .then(r => r.json())
      .then((d: StreakData & { success: boolean }) => {
        if (d.success) setStreak(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isConnected, address]);

  const handleClaim = useCallback(async () => {
    if (!address || !streak?.canClaimToday || claiming) return;
    setClaiming(true);
    setError(null);
    try {
      const nonce     = generateNonce();
      const message   = buildPredixiAuthMessage(address, 'daily-streak', nonce);
      const signature = await signMessageAsync({ message });

      const res = await fetch('/api/daily-streak', {
        method:  'POST',
        headers: {
          'Content-Type':       'application/json',
          'x-wallet-message':   encodeURIComponent(message),
          'x-wallet-signature': signature,
        },
        body: JSON.stringify({ walletAddress: address }),
      });

      const data = await res.json() as {
        success: boolean;
        claimed?: boolean;
        alreadyClaimed?: boolean;
        currentStreak?: number;
        longestStreak?: number;
        lastClaimDate?: string;
        xpReward?: number;
        message?: string;
        error?: string;
      };

      if (!res.ok || !data.success) {
        throw new Error(data.error ?? `Error ${res.status}`);
      }

      if (data.alreadyClaimed) {
        // Already claimed — refresh state
        setStreak(prev => prev ? { ...prev, canClaimToday: false } : prev);
        return;
      }

      // Successful claim
      setStreak(prev => ({
        currentStreak: data.currentStreak ?? (prev?.currentStreak ?? 0) + 1,
        longestStreak: data.longestStreak ?? prev?.longestStreak ?? 0,
        lastClaimDate: data.lastClaimDate ?? null,
        canClaimToday: false,
        xpReward:      data.xpReward ?? 5,
      }));
      setJustClaimed(true);
      setTimeout(() => setJustClaimed(false), 3500);
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Claim failed — please try again';
      const isCancelled = /rejected|denied|cancelled|cancel/i.test(raw);
      if (!isCancelled) setError(raw);
    } finally {
      setClaiming(false);
    }
  }, [address, streak, claiming, signMessageAsync]);

  // ── Wallet not connected ─────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className={cn(
        "relative overflow-hidden flex items-center gap-3 px-4 py-4 rounded-2xl border",
        "border-white/[0.07] bg-gradient-to-br from-[#07101f] via-[#060b1c] to-[#040810]",
      )}>
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
          <Flame size={16} className="text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white/40">Daily Streak</p>
          <p className="text-[9px] text-white/20 font-mono mt-0.5">+5 XP per day</p>
        </div>
        <div className="flex items-center gap-1.5 text-white/20 flex-shrink-0">
          <Wallet size={12} />
          <span className="text-[10px] font-mono">Connect to claim</span>
        </div>
      </div>
    );
  }

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={cn(
        "rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[#07101f] via-[#060b1c] to-[#040810]",
        "px-4 py-4 flex items-center gap-3 animate-pulse",
      )}>
        <div className="w-9 h-9 rounded-xl bg-white/[0.05]" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-24 rounded bg-white/[0.06]" />
          <div className="h-2 w-16 rounded bg-white/[0.04]" />
        </div>
        <div className="h-8 w-24 rounded-xl bg-white/[0.05]" />
      </div>
    );
  }

  const current = streak?.currentStreak ?? 0;
  const longest = streak?.longestStreak ?? 0;
  const canClaim = streak?.canClaimToday ?? true;

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl border transition-all duration-300",
      canClaim
        ? "border-amber-500/30 bg-gradient-to-br from-amber-500/[0.06] via-[#07101f] to-[#040810]"
        : "border-white/[0.07] bg-gradient-to-br from-[#07101f] via-[#060b1c] to-[#040810]",
    )}>
      {canClaim && (
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
      )}

      <div className="px-4 py-4 flex items-center gap-3">

        {/* Flame icon */}
        <div className={cn(
          "w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 transition-all duration-300",
          canClaim
            ? "bg-amber-500/15 border-amber-500/30 shadow-[0_0_16px_rgba(245,158,11,0.2)]"
            : "bg-white/[0.04] border-white/[0.08]",
        )}>
          <Flame size={16} className={canClaim ? "text-amber-400" : "text-white/25"} />
        </div>

        {/* Streak info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-white leading-none">
              Daily Streak
            </span>
            <span className={cn(
              "px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold",
              canClaim
                ? "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                : "bg-white/[0.05] text-white/30 border border-white/[0.08]",
            )}>
              +5 XP
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] font-mono text-white/50">
              <span className="text-amber-400 font-bold">{current}</span>
              <span className="text-white/25"> day{current !== 1 ? "s" : ""}</span>
            </span>
            {longest > 0 && (
              <span className="text-[9px] font-mono text-white/25">
                Best: {longest}
              </span>
            )}
          </div>
        </div>

        {/* Claim button / Claimed state */}
        <AnimatePresence mode="wait">
          {justClaimed ? (
            <motion.div
              key="claimed-flash"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-500/15 border border-green-500/25"
            >
              <CheckCircle2 size={13} className="text-green-400" />
              <span className="text-[10px] font-mono font-bold text-green-400">+5 XP</span>
            </motion.div>
          ) : canClaim ? (
            <motion.button
              key="claim-btn"
              type="button"
              onClick={handleClaim}
              disabled={claiming}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black tracking-wide transition-all duration-150",
                "bg-amber-500 text-black shadow-[0_4px_16px_rgba(245,158,11,0.35)]",
                claiming && "opacity-60 cursor-wait",
              )}
            >
              {claiming ? (
                <><Loader2 size={11} className="animate-spin" /> Signing…</>
              ) : (
                <><Flame size={11} /> Claim</>
              )}
            </motion.button>
          ) : (
            <motion.div
              key="done"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.07]"
            >
              <CheckCircle2 size={11} className="text-white/25" />
              <span className="text-[10px] font-mono text-white/25">Claimed</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 flex items-center gap-2">
              <AlertCircle size={11} className="text-red-400/70 flex-shrink-0" />
              <p className="text-[10px] font-mono text-red-400/70 leading-snug">{error}</p>
              <button
                type="button"
                onClick={() => setError(null)}
                className="ml-auto text-[9px] font-mono text-white/20 hover:text-white/50 transition-colors flex-shrink-0"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
