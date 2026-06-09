"use client";

import { useState, useEffect } from "react";
import { Trophy } from "lucide-react";
import { useAccount } from "wagmi";
import { cn } from "@/lib/utils";
import { XI_POSITIONS, loadTodayXI, saveTodayXI, fetchDailyXIRemote, fetchDailyXIEntryMeta, type DailyXIPlayer, type DailyXIEntryMeta } from "@/lib/daily-xi";
import { ProofBadge } from "@/components/proof/ProofBadge";
import { AnchorDailyXIButton } from "@/components/onchain/AnchorDailyXIButton";

// ─────────────────────────────────────────────────────────────────────────────
// Single player token in the strip
// ─────────────────────────────────────────────────────────────────────────────

function StripPlayer({ player, pos }: { player: DailyXIPlayer; pos: string }) {
  const [err, setErr] = useState(false);

  return (
    <div className="flex flex-col items-center gap-1 flex-shrink-0 w-12">
      <div className={cn(
        "w-10 h-10 rounded-full overflow-hidden",
        "border border-primary/45 shadow-[0_0_8px_rgba(22,82,240,0.35)]",
        "bg-[#060a1e]",
      )}>
        {!err ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={player.image}
            alt={player.name}
            className="w-full h-full object-cover"
            onError={() => setErr(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/25 to-[#060a1e] flex items-center justify-center">
            <span className="text-white/55 font-black text-xs">
              {player.name.charAt(0)}
            </span>
          </div>
        )}
      </div>
      <span className="text-[6px] font-mono font-bold text-primary/65 leading-none">{pos}</span>
      <p className="text-[7px] font-semibold text-white/55 w-full truncate text-center leading-none">
        {player.name.split(" ").pop()}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile card
// ─────────────────────────────────────────────────────────────────────────────

export function DailyXIProfileCard() {
  const { address, isConnected } = useAccount();
  const [slots,     setSlots]     = useState<(DailyXIPlayer | null)[]>(() => Array(11).fill(null));
  const [entryMeta, setEntryMeta] = useState<DailyXIEntryMeta | null>(null);
  const [hydrated,  setHydrated]  = useState(false);

  // Step 1 — load localStorage immediately
  useEffect(() => {
    setSlots(loadTodayXI());
    setHydrated(true);
  }, []);

  // Step 2 — if wallet connected, fetch from API and use it if available
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

  const filled = hydrated ? slots.filter(Boolean).length : 0;
  const hasXI  = filled === 11;

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl border",
      "border-primary/20 bg-gradient-to-br from-[#07101f] via-[#060b1c] to-[#040810]",
    )}>
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-48 h-20 rounded-full bg-primary opacity-[0.06] blur-2xl pointer-events-none" />

      <div className="p-4 space-y-3">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">🃏</span>
            <span className="text-xs font-black text-white/80 tracking-tight">My Daily XI</span>
          </div>
          {hydrated && (
            <span className={cn(
              "text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border",
              hasXI
                ? "text-success/80 bg-success/10 border-success/25"
                : filled > 0
                  ? "text-amber-400/70 bg-amber-400/10 border-amber-400/20"
                  : "text-white/25 bg-white/[0.04] border-white/[0.08]",
            )}>
              {hasXI ? "Locked ✓" : filled > 0 ? `${filled}/11` : "Not picked"}
            </span>
          )}
        </div>

        {/* Content */}
        {!hydrated ? (
          <div className="h-14 flex items-center justify-center">
            <span className="text-[10px] text-white/20 font-mono animate-pulse">Loading…</span>
          </div>
        ) : hasXI ? (
          /* ── Complete: horizontal scrollable strip ── */
          <div className="space-y-2">
            {/* Strip */}
            <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
              <div className="flex gap-1.5 pb-1">
                {slots.map((p, i) => p && (
                  <StripPlayer key={i} player={p} pos={XI_POSITIONS[i]} />
                ))}
              </div>
            </div>
            {/* Score hint + proof badge */}
            <div className="flex items-center justify-between px-0.5 gap-2 flex-wrap">
              {entryMeta?.status === 'scored' ? (
                <span className="text-[9px] font-mono text-emerald-400/70 font-bold">
                  Score: {entryMeta.earnedXp} XP ✓
                </span>
              ) : (
                <span className="text-[9px] font-mono text-white/20">Score: 0 XP</span>
              )}
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                <span className="text-[9px] font-mono text-white/15 hidden sm:block">
                  {entryMeta?.status === 'scored' ? 'Scored' : 'Max 20 XP · Scored after matches'}
                </span>
                {entryMeta?.commitmentHash && (
                  <>
                    <ProofBadge
                      commitmentHash={entryMeta.commitmentHash}
                      submittedOnchain={entryMeta.submittedOnchain}
                      txHash={entryMeta.txHash}
                    />
                    {/* Anchor on Base — only shows when not yet anchored and wallet is connected */}
                    {!entryMeta.submittedOnchain && (
                      <AnchorDailyXIButton
                        entryDate={new Date().toISOString().slice(0, 10)}
                        commitmentHash={entryMeta.commitmentHash}
                        submittedOnchain={false}
                        txHash={null}
                        onAnchorSuccess={(anchorTxHash) => {
                          setEntryMeta(prev => prev
                            ? { ...prev, submittedOnchain: true, txHash: anchorTxHash }
                            : null
                          );
                        }}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ) : filled > 0 ? (
          /* ── Partial: mini progress strip ── */
          <div className="space-y-2.5">
            <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-1">
              {slots.map((p, i) => (
                <div key={i} className={cn(
                  "flex-shrink-0 flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-lg border min-w-[34px]",
                  p ? "bg-primary/15 border-primary/30" : "bg-white/[0.02] border-white/[0.06]",
                )}>
                  <span className={cn(
                    "text-[6px] font-mono font-bold",
                    p ? "text-primary/70" : "text-white/15",
                  )}>
                    {XI_POSITIONS[i]}
                  </span>
                  {p ? (
                    <div className="w-5 h-5 rounded-full overflow-hidden border border-primary/30">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.image} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-white/[0.08]" />
                  )}
                </div>
              ))}
            </div>
            {/* Progress bar */}
            <div className="space-y-1">
              <div className="h-0.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${(filled / 11) * 100}%` }}
                />
              </div>
              <p className="text-[9px] text-white/25 font-mono">
                {11 - filled} positions remaining · Go to Home to continue
              </p>
            </div>
          </div>
        ) : (
          /* ── Empty ── */
          <div className="flex flex-col items-center gap-2.5 py-5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center">
              <Trophy size={18} className="text-primary/35" />
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-white/35">No XI picked yet</p>
              <p className="text-[10px] text-white/20 font-mono mt-0.5">
                Pick today's XI from Home
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
