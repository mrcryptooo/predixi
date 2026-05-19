"use client";

import { useState } from "react";
import { Shield, RefreshCw, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type SyncResult = {
  success: boolean;
  totalFetched?: number;
  totalInserted?: number;
  totalUpdated?: number;
  fetched?: number;
  inserted?: number;
  updated?: number;
  errors?: string[];
  error?: string;
};

type SettleResult = {
  success: boolean;
  settled?: number;
  correct?: number;
  xpAwarded?: number;
  alreadySettled?: boolean;
  error?: string;
  errors?: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Small UI helpers
// ─────────────────────────────────────────────────────────────────────────────

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      "rounded-2xl border p-5 space-y-4",
      "bg-gradient-to-br from-primary/8 via-[#070b22] to-bg border-primary/15",
      className
    )}>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-mono text-white/40 uppercase tracking-wider mb-1">{children}</label>;
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full h-10 px-3 rounded-xl border text-sm font-mono text-white bg-white/[0.04] border-white/[0.10]",
        "focus:outline-none focus:border-primary/50 placeholder:text-white/20",
        props.className
      )}
    />
  );
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "w-full h-10 px-3 rounded-xl border text-sm font-mono text-white bg-[#0a1030] border-white/[0.10]",
        "focus:outline-none focus:border-primary/50",
        props.className
      )}
    >
      {children}
    </select>
  );
}

function Btn({
  children, loading, variant = "primary", ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; variant?: "primary" | "success" }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cn(
        "h-10 px-5 rounded-xl border text-sm font-bold transition-all duration-150 flex items-center gap-2",
        variant === "primary"
          ? "bg-primary/20 border-primary/40 text-white hover:bg-primary/30 disabled:opacity-40"
          : "bg-emerald-500/15 border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-40",
        props.className
      )}
    >
      {loading && <RefreshCw size={13} className="animate-spin" />}
      {children}
    </button>
  );
}

function ResultBox({ data, type }: { data: SyncResult | SettleResult | null; type: "sync" | "settle" }) {
  if (!data) return null;
  const ok = data.success;
  return (
    <div className={cn(
      "rounded-xl border px-4 py-3 text-xs font-mono space-y-1",
      ok ? "bg-emerald-500/8 border-emerald-500/25 text-emerald-300" : "bg-danger/8 border-danger/25 text-danger/80"
    )}>
      <div className="flex items-center gap-2 font-bold mb-2">
        {ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
        {ok ? "Success" : "Error"}
      </div>
      {type === "sync" && (() => {
        const d = data as SyncResult;
        const fetched  = d.totalFetched  ?? d.fetched  ?? 0;
        const inserted = d.totalInserted ?? d.inserted ?? 0;
        const updated  = d.totalUpdated  ?? d.updated  ?? 0;
        return <>
          <div>Fetched: {fetched}</div>
          <div>Inserted: {inserted}</div>
          <div>Updated: {updated}</div>
        </>;
      })()}
      {type === "settle" && (() => {
        const d = data as SettleResult;
        if (d.alreadySettled) return <div>Already settled — no changes made.</div>;
        return <>
          {d.settled !== undefined && <div>Settled predictions: {d.settled}</div>}
          {d.correct  !== undefined && <div>Correct: {d.correct}</div>}
          {d.xpAwarded !== undefined && <div>XP awarded: {d.xpAwarded}</div>}
        </>;
      })()}
      {data.error && <div className="mt-1 text-danger/70">{data.error}</div>}
      {data.errors?.map((e, i) => <div key={i} className="text-danger/70">{e}</div>)}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  // Secret — in-memory only
  const [secret, setSecret] = useState("");

  // Sync state
  const [competition, setCompetition] = useState("PL");
  const [dateFrom,    setDateFrom]    = useState("2026-05-13");
  const [dateTo,      setDateTo]      = useState("2026-05-19");
  const [syncing,     setSyncing]     = useState(false);
  const [syncResult,  setSyncResult]  = useState<SyncResult | null>(null);

  // Settle state
  const [matchId,       setMatchId]       = useState("");
  const [actualOutcome, setActualOutcome] = useState("H");
  const [settling,      setSettling]      = useState(false);
  const [settleResult,  setSettleResult]  = useState<SettleResult | null>(null);

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/football-data/sync-matches", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ competition, dateFrom, dateTo }),
      });
      const data = await res.json() as SyncResult;
      setSyncResult(data);
    } catch {
      setSyncResult({ success: false, error: "Request failed." });
    } finally {
      setSyncing(false);
    }
  }

  async function handleSettle() {
    setSettling(true);
    setSettleResult(null);
    try {
      const res = await fetch("/api/settle-match", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ matchId, actualOutcome }),
      });
      const data = await res.json() as SettleResult;
      if (res.status === 409) setSettleResult({ ...data, success: false, alreadySettled: true });
      else setSettleResult(data);
    } catch {
      setSettleResult({ success: false, error: "Request failed." });
    } finally {
      setSettling(false);
    }
  }

  return (
    <main className="min-h-screen bg-bg text-text-primary font-sans">
      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-primary/15 border border-primary/25 flex-shrink-0">
            <Shield size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">PrediXI Admin</h1>
            <p className="text-[11px] text-white/30 font-mono mt-0.5">Local / admin use only</p>
          </div>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/20">
          <AlertTriangle size={12} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-300/70 font-mono leading-relaxed">
            Do not share your admin secret. Do not use on public networks.
          </p>
        </div>

        {/* Section 1: Admin Secret */}
        <Card>
          <div className="flex items-center gap-2 text-[11px] font-mono font-semibold text-white/50 uppercase tracking-wider">
            <Shield size={11} /> Admin Secret
          </div>
          <div>
            <Label>Secret (kept in memory only)</Label>
            <Input
              type="password"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              placeholder="Enter admin secret…"
              autoComplete="off"
            />
          </div>
        </Card>

        {/* Section 2: Sync Matches */}
        <Card>
          <div className="flex items-center gap-2 text-[11px] font-mono font-semibold text-white/50 uppercase tracking-wider">
            <RefreshCw size={11} /> Sync Matches
          </div>

          <div>
            <Label>Competition</Label>
            <Select value={competition} onChange={e => setCompetition(e.target.value)}>
              {["PL","PD","BL1","SA","FL1","WC"].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date From</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label>Date To</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </div>

          <Btn loading={syncing} disabled={!secret} onClick={handleSync}>
            Sync Matches
          </Btn>

          <ResultBox data={syncResult} type="sync" />
        </Card>

        {/* Section 3: Settle Match */}
        <Card>
          <div className="flex items-center gap-2 text-[11px] font-mono font-semibold text-white/50 uppercase tracking-wider">
            <CheckCircle2 size={11} /> Settle Match
          </div>

          <div>
            <Label>Match ID</Label>
            <Input
              type="text"
              value={matchId}
              onChange={e => setMatchId(e.target.value)}
              placeholder="e.g. fd-538091"
            />
          </div>

          <div>
            <Label>Actual Outcome</Label>
            <Select value={actualOutcome} onChange={e => setActualOutcome(e.target.value)}>
              <option value="H">H — Home Win</option>
              <option value="D">D — Draw</option>
              <option value="A">A — Away Win</option>
            </Select>
          </div>

          <Btn loading={settling} disabled={!secret || !matchId} variant="success" onClick={handleSettle}>
            Settle Match
          </Btn>

          <ResultBox data={settleResult} type="settle" />
        </Card>

        {/* Section 4: Safety Notes */}
        <Card>
          <div className="flex items-center gap-2 text-[11px] font-mono font-semibold text-white/50 uppercase tracking-wider">
            <Info size={11} /> Safety Notes
          </div>
          <ul className="space-y-1.5 text-[11px] font-mono text-white/35 leading-relaxed">
            <li>· Sync only fetches match data — it does not settle games.</li>
            <li>· Settlement awards XP and cannot double-award the same match.</li>
            <li>· Use the correct final result before settling.</li>
            <li>· Admin secret is never stored — it lives in memory only.</li>
          </ul>
        </Card>

        <footer className="text-center pb-6">
          <p className="text-[10px] text-white/15 font-mono tracking-[0.14em] uppercase">
            PrediXI · Admin · Internal Only
          </p>
        </footer>

      </div>
    </main>
  );
}
