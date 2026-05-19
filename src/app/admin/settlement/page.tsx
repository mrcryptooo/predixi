"use client";

/**
 * /admin/settlement — Manual match settlement tool
 *
 * Internal admin only. Uses POST /api/admin/settle-match with x-admin-key.
 * Not linked from public navigation.
 *
 * Gate: the settlement form is hidden until the admin key is verified.
 * Verification sends a deliberate validation-error request (empty matchId)
 * to the API — 400 = key accepted, 401 = key rejected. Nothing is settled.
 * The key stays in React state only — never stored anywhere.
 */

import { useState } from "react";
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Lock,
  Unlock,
  X,
  Zap,
  Activity,
  Star,
  Plus,
  Trash2,
  Eye,
  Wand2,
  ListChecks,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ActualResult = "home" | "draw" | "away";

type SettleResponse = {
  success:         boolean;
  matchId?:        string;
  result?:         string;
  dbOutcome?:      string;
  settled?:        number;
  correct?:        number;
  xpAwarded?:      number;
  duplicates?:     number;
  errors?:         string[];
  alreadySettled?: boolean;
  error?:          string;
  message?:        string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Additional types — auto-settle
// ─────────────────────────────────────────────────────────────────────────────

type AutoCandidate = {
  matchId:                  string;
  homeTeam:                 string;
  awayTeam:                 string;
  score:                    string;
  inferredResult:           string;
  unsettledPredictionCount: number;
};

type AutoSettleResponse = {
  success:          boolean;
  dryRun:           boolean;
  scanned?:         number;
  candidates?:      AutoCandidate[];
  settledMatches?:  number;
  totalPredictions?: number;
  totalCorrect?:    number;
  totalXPAwarded?:  number;
  errors?:          string[];
  error?:           string;
  message?:         string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI primitives
// ─────────────────────────────────────────────────────────────────────────────

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      "rounded-2xl border p-5 space-y-4",
      "bg-gradient-to-br from-primary/8 via-[#070b22] to-bg border-primary/15",
      className,
    )}>
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-mono text-white/40 uppercase tracking-wider mb-1">
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full h-10 px-3 rounded-xl border text-sm font-mono text-white",
        "bg-white/[0.04] border-white/[0.10]",
        "focus:outline-none focus:border-primary/50 placeholder:text-white/20",
        props.className,
      )}
    />
  );
}

function ActionBtn({
  children,
  loading,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  variant?: "primary" | "success" | "ghost" | "danger";
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cn(
        "h-10 px-5 rounded-xl border text-sm font-bold transition-all duration-150 flex items-center gap-2",
        variant === "primary" &&
          "bg-primary/20 border-primary/40 text-white hover:bg-primary/30 disabled:opacity-40",
        variant === "success" &&
          "bg-emerald-500/15 border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-40",
        variant === "ghost" &&
          "bg-white/[0.04] border-white/[0.10] text-white/40 hover:text-white/70 hover:border-white/20",
        variant === "danger" &&
          "bg-red-500/10 border-red-500/25 text-red-400/80 hover:bg-red-500/20 hover:text-red-300",
        props.className,
      )}
    >
      {loading && <RefreshCw size={13} className="animate-spin" />}
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Outcome picker
// ─────────────────────────────────────────────────────────────────────────────

const OUTCOMES: { value: ActualResult; label: string; short: string }[] = [
  { value: "home", label: "Home Win", short: "H" },
  { value: "draw", label: "Draw",     short: "D" },
  { value: "away", label: "Away Win", short: "A" },
];

function OutcomePicker({
  value,
  onChange,
}: {
  value: ActualResult;
  onChange: (v: ActualResult) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {OUTCOMES.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "h-12 rounded-xl border text-sm font-bold transition-all duration-150 flex flex-col items-center justify-center gap-0.5",
              active
                ? "bg-primary/25 border-primary/60 text-white"
                : "bg-white/[0.03] border-white/[0.08] text-white/35 hover:border-white/20 hover:text-white/60",
            )}
          >
            <span className="text-[15px] leading-none">{o.short}</span>
            <span className="text-[9px] font-mono uppercase tracking-wider opacity-70">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Result summary card
// ─────────────────────────────────────────────────────────────────────────────

function ResultCard({ data }: { data: SettleResponse }) {
  const [showRaw, setShowRaw] = useState(false);
  const ok = data.success && !data.alreadySettled;

  return (
    <div className={cn(
      "rounded-xl border text-xs font-mono space-y-2.5 p-4",
      ok
        ? "bg-emerald-500/8 border-emerald-500/25"
        : data.alreadySettled
        ? "bg-amber-500/8 border-amber-500/25"
        : "bg-red-500/8 border-red-500/25",
    )}>
      <div className={cn(
        "flex items-center gap-2 font-bold",
        ok ? "text-emerald-300" : data.alreadySettled ? "text-amber-300" : "text-red-400",
      )}>
        {ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
        {ok
          ? "Settlement complete"
          : data.alreadySettled
          ? "Already settled — no changes made"
          : `Error: ${data.error ?? "Settlement failed"}`}
      </div>

      {ok && data.settled !== undefined && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-white/60 pt-1">
          <div>Predictions settled</div>
          <div className="text-white font-semibold">{data.settled}</div>
          <div>Correct predictions</div>
          <div className="text-emerald-300 font-semibold">{data.correct ?? 0}</div>
          <div>Total XP awarded</div>
          <div className="text-primary font-semibold">{data.xpAwarded ?? 0} XP</div>
          {(data.duplicates ?? 0) > 0 && (
            <>
              <div>Duplicate (skipped)</div>
              <div className="text-amber-400 font-semibold">{data.duplicates}</div>
            </>
          )}
        </div>
      )}

      {ok && data.settled === 0 && (
        <p className="text-white/40 text-[11px]">No unsettled predictions found for this match.</p>
      )}

      {data.errors && data.errors.length > 0 && (
        <div className="space-y-1 pt-1">
          {data.errors.map((e, i) => (
            <div key={i} className="text-red-400/80">{e}</div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowRaw((p) => !p)}
        className="flex items-center gap-1 text-[10px] text-white/25 hover:text-white/50 transition-colors pt-1"
      >
        {showRaw ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        {showRaw ? "Hide raw response" : "Show raw response"}
      </button>

      {showRaw && (
        <pre className="mt-1 text-[10px] text-white/30 bg-black/20 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto Settlement result card
// ─────────────────────────────────────────────────────────────────────────────

function AutoResultCard({ data }: { data: AutoSettleResponse }) {
  const [showRaw, setShowRaw] = useState(false);

  // Dry-run candidate list
  if (data.dryRun) {
    const candidates = data.candidates ?? [];
    return (
      <div className="rounded-xl border text-xs font-mono space-y-3 p-4 bg-primary/5 border-primary/20">
        <div className="flex items-center gap-2 font-bold text-primary/80">
          <CheckCircle2 size={13} />
          Dry Run — {candidates.length === 0 ? "No matches ready" : `${candidates.length} match(es) ready to settle`}
        </div>

        {candidates.length === 0 ? (
          <p className="text-white/35">No finished matches with unsettled predictions found.</p>
        ) : (
          <div className="space-y-2">
            {candidates.map((c) => (
              <div key={c.matchId} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 space-y-0.5">
                <div className="text-white/70 font-semibold">{c.homeTeam} vs {c.awayTeam}</div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-white/35 text-[10px]">
                  <span>Score: <span className="text-white/60">{c.score}</span></span>
                  <span>Result: <span className="text-emerald-400/80 capitalize">{c.inferredResult}</span></span>
                  <span>Predictions: <span className="text-white/60">{c.unsettledPredictionCount}</span></span>
                </div>
                <div className="text-[9px] text-white/20 truncate">{c.matchId}</div>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowRaw((p) => !p)}
          className="flex items-center gap-1 text-[10px] text-white/20 hover:text-white/45 transition-colors"
        >
          {showRaw ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          {showRaw ? "Hide raw" : "Show raw"}
        </button>
        {showRaw && (
          <pre className="text-[10px] text-white/25 bg-black/20 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  // Real run summary
  const ok = data.success;
  return (
    <div className={cn(
      "rounded-xl border text-xs font-mono space-y-2.5 p-4",
      ok ? "bg-emerald-500/8 border-emerald-500/25" : "bg-red-500/8 border-red-500/25",
    )}>
      <div className={cn("flex items-center gap-2 font-bold", ok ? "text-emerald-300" : "text-red-400")}>
        {ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
        {ok ? "Auto settlement complete" : `Error: ${data.error ?? "Settlement failed"}`}
      </div>

      {ok && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-white/60 pt-1">
          <div>Matches scanned</div>
          <div className="text-white font-semibold">{data.scanned ?? 0}</div>
          <div>Matches settled</div>
          <div className="text-white font-semibold">{data.settledMatches ?? 0}</div>
          <div>Predictions settled</div>
          <div className="text-white font-semibold">{data.totalPredictions ?? 0}</div>
          <div>Correct predictions</div>
          <div className="text-emerald-300 font-semibold">{data.totalCorrect ?? 0}</div>
          <div>Total XP awarded</div>
          <div className="text-primary font-semibold">{data.totalXPAwarded ?? 0} XP</div>
        </div>
      )}

      {data.message && <p className="text-white/40 text-[11px]">{data.message}</p>}

      {data.errors && data.errors.length > 0 && (
        <div className="space-y-1 pt-1">
          {data.errors.map((e, i) => (
            <div key={i} className="text-red-400/80">{e}</div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowRaw((p) => !p)}
        className="flex items-center gap-1 text-[10px] text-white/25 hover:text-white/50 transition-colors pt-1"
      >
        {showRaw ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        {showRaw ? "Hide raw response" : "Show raw response"}
      </button>
      {showRaw && (
        <pre className="text-[10px] text-white/30 bg-black/20 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync Results types + components
// ─────────────────────────────────────────────────────────────────────────────

type SyncUpdatedMatch = {
  matchId:  string;
  homeTeam: string;
  awayTeam: string;
  status:   string;
  score:    string;
  outcome:  string | null;
};

type SyncResultsResponse = {
  success:        boolean;
  scanned?:       number;
  apiCallsUsed?:  number;
  updated?:       number;
  skipped?:       number;
  errors?:        string[];
  updatedMatches?: SyncUpdatedMatch[];
  error?:         string;
  message?:       string;
};

function SyncResultCard({ data }: { data: SyncResultsResponse }) {
  const [showRaw, setShowRaw] = useState(false);
  const ok = data.success;

  return (
    <div className={cn(
      "rounded-xl border text-xs font-mono space-y-2.5 p-4",
      ok ? "bg-sky-500/8 border-sky-500/25" : "bg-red-500/8 border-red-500/25",
    )}>
      <div className={cn("flex items-center gap-2 font-bold", ok ? "text-sky-300" : "text-red-400")}>
        {ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
        {ok ? "Sync complete" : `Error: ${data.error ?? "Sync failed"}`}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-white/60 pt-1">
        <div>Matches scanned</div>
        <div className="text-white font-semibold">{data.scanned ?? 0}</div>
        <div>API calls used</div>
        <div className="text-white font-semibold">{data.apiCallsUsed ?? 0}</div>
        <div>Updated</div>
        <div className="text-sky-300 font-semibold">{data.updated ?? 0}</div>
        <div>Skipped / no change</div>
        <div className="text-white/40 font-semibold">{data.skipped ?? 0}</div>
        {(data.errors?.length ?? 0) > 0 && (
          <>
            <div>Errors</div>
            <div className="text-red-400 font-semibold">{data.errors!.length}</div>
          </>
        )}
      </div>

      {data.updatedMatches && data.updatedMatches.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="text-[10px] text-white/30 uppercase tracking-wider">Updated matches</div>
          {data.updatedMatches.map((m) => (
            <div key={m.matchId} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 space-y-0.5">
              <div className="text-white/70 font-semibold">{m.homeTeam} vs {m.awayTeam}</div>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-white/35 text-[10px]">
                <span>Score: <span className="text-white/60">{m.score}</span></span>
                <span>Status: <span className={cn(
                  "capitalize",
                  m.status === "finished" ? "text-emerald-400/80" :
                  m.status === "live"     ? "text-amber-400/80"   : "text-white/50",
                )}>{m.status}</span></span>
                {m.outcome && (
                  <span>Outcome: <span className="text-sky-400/80">{m.outcome}</span></span>
                )}
              </div>
              <div className="text-[9px] text-white/20 truncate">{m.matchId}</div>
            </div>
          ))}
        </div>
      )}

      {data.errors && data.errors.length > 0 && (
        <div className="space-y-1 pt-1">
          {data.errors.map((e, i) => (
            <div key={i} className="text-red-400/80">{e}</div>
          ))}
        </div>
      )}

      {data.message && <p className="text-white/35 text-[11px]">{data.message}</p>}

      <button
        type="button"
        onClick={() => setShowRaw((p) => !p)}
        className="flex items-center gap-1 text-[10px] text-white/25 hover:text-white/50 transition-colors pt-1"
      >
        {showRaw ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        {showRaw ? "Hide raw response" : "Show raw response"}
      </button>
      {showRaw && (
        <pre className="text-[10px] text-white/30 bg-black/20 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

function SyncResultsForm({ adminKey }: { adminKey: string }) {
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<SyncResultsResponse | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/sync-results", {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      });
      const data = await res.json() as SyncResultsResponse;
      setResult(data);
    } catch {
      setResult({ success: false, error: "Network error — request failed." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2 text-[11px] font-mono font-semibold text-white/50 uppercase tracking-wider">
        <Activity size={11} /> Sync Results
      </div>

      {/* Safety note */}
      <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <AlertTriangle size={11} className="text-sky-400/70 flex-shrink-0 mt-0.5" />
        <p className="text-[10px] font-mono text-white/30 leading-relaxed">
          Sync Results only updates match scores and status. It does not award XP.
          Run Auto Settlement after syncing to process finished matches.
        </p>
      </div>

      <ActionBtn
        variant="primary"
        loading={loading}
        onClick={handleSync}
        className="w-full justify-center"
      >
        <RefreshCw size={13} />
        Sync Results
      </ActionBtn>

      {result && <SyncResultCard data={result} />}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto Settlement form
// ─────────────────────────────────────────────────────────────────────────────

function AutoSettleForm({ adminKey }: { adminKey: string }) {
  const [limit,   setLimit]   = useState(10);
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<AutoSettleResponse | null>(null);

  async function call(dryRun: boolean) {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/auto-settle", {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body:    JSON.stringify({ dryRun, limit: Math.max(1, Math.min(100, limit)) }),
      });
      const data = await res.json() as AutoSettleResponse;
      setResult(data);
    } catch {
      setResult({ success: false, dryRun, error: "Network error — request failed." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2 text-[11px] font-mono font-semibold text-white/50 uppercase tracking-wider">
        <Zap size={11} /> Auto Settlement
      </div>

      {/* Safety note */}
      <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <AlertTriangle size={11} className="text-amber-400/70 flex-shrink-0 mt-0.5" />
        <p className="text-[10px] font-mono text-white/30 leading-relaxed">
          Dry Run is safe — nothing is written.
          Real Auto Settlement writes XP and leaderboard stats for all finished matches with scores.
        </p>
      </div>

      {/* Limit */}
      <div>
        <FieldLabel>Match limit (1–100)</FieldLabel>
        <TextInput
          type="number"
          min={1}
          max={100}
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
        />
        <p className="mt-1 text-[10px] text-white/20 font-mono">
          Max finished matches to scan per run.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <ActionBtn
          variant="primary"
          loading={loading}
          onClick={() => call(true)}
          className="flex-1 justify-center"
        >
          <CheckCircle2 size={13} />
          Dry Run
        </ActionBtn>
        <ActionBtn
          variant="danger"
          loading={loading}
          onClick={() => call(false)}
          className="flex-1 justify-center"
        >
          <Zap size={13} />
          Run Auto Settlement
        </ActionBtn>
      </div>

      {result && <AutoResultCard data={result} />}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Daily XI Scoring types + components
// ─────────────────────────────────────────────────────────────────────────────

type PlayerStatRow = {
  playerId:    string;
  goals:       number;
  assists:     number;
  cleanSheet:  boolean;
  rating:      number;
  yellowCards: number;
  redCards:    number;
  played:      boolean;
};

type DailyXIPlayerBreakdown = {
  playerId:  string;
  xp:        number;
  breakdown: Record<string, number>;
};

type DailyXIScoreResponse = {
  success:         boolean;
  alreadyScored?:  boolean;
  entryId?:        string;
  earnedXp?:       number;
  xpDuplicate?:    boolean;
  playerBreakdown?: DailyXIPlayerBreakdown[];
  error?:          string;
  message?:        string;
};

type StatsPreviewResponse = {
  success:          boolean;
  entryId?:         string;
  entryStatus?:     string;
  providerName?:    string;
  stats?:           PlayerStatRow[];
  totalXp?:         number;
  playerBreakdown?: DailyXIPlayerBreakdown[];
  error?:           string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Daily XI Batch Score types + component
// ─────────────────────────────────────────────────────────────────────────────

type DailyXIBatchResponse = {
  success:        boolean;
  scanned?:       number;
  scoredEntries?: number;
  totalXPAwarded?: number;
  skipped?:       number;
  errors?:        string[];
  error?:         string;
  message?:       string;
};

function DailyXIBatchResultCard({ data }: { data: DailyXIBatchResponse }) {
  const [showRaw, setShowRaw] = useState(false);
  const ok = data.success;

  return (
    <div className={cn(
      "rounded-xl border text-xs font-mono space-y-2.5 p-4",
      ok ? "bg-emerald-500/8 border-emerald-500/25" : "bg-red-500/8 border-red-500/25",
    )}>
      <div className={cn("flex items-center gap-2 font-bold", ok ? "text-emerald-300" : "text-red-400")}>
        {ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
        {ok
          ? `Batch complete — ${data.scoredEntries ?? 0} scored · ${data.totalXPAwarded ?? 0} XP`
          : `Error: ${data.error ?? "Batch failed"}`}
      </div>

      {ok && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-white/60 pt-1">
          <div>Scanned</div>
          <div className="text-white font-semibold">{data.scanned ?? 0}</div>
          <div>Scored entries</div>
          <div className="text-emerald-300 font-semibold">{data.scoredEntries ?? 0}</div>
          <div>Total XP awarded</div>
          <div className="text-primary font-semibold">{data.totalXPAwarded ?? 0} XP</div>
          <div>Skipped</div>
          <div className="text-white/40 font-semibold">{data.skipped ?? 0}</div>
          {(data.errors?.length ?? 0) > 0 && (
            <>
              <div>Errors</div>
              <div className="text-red-400 font-semibold">{data.errors!.length}</div>
            </>
          )}
        </div>
      )}

      {data.message && <p className="text-white/35 text-[11px]">{data.message}</p>}

      {data.errors && data.errors.length > 0 && (
        <div className="space-y-1 pt-1">
          {data.errors.map((e, i) => (
            <div key={i} className="text-red-400/70 break-all">{e}</div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowRaw(p => !p)}
        className="flex items-center gap-1 text-[10px] text-white/25 hover:text-white/50 transition-colors pt-1"
      >
        {showRaw ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        {showRaw ? "Hide raw response" : "Show raw response"}
      </button>
      {showRaw && (
        <pre className="text-[10px] text-white/25 bg-black/20 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

function DailyXIBatchForm() {
  const [cronSecret, setCronSecret] = useState("");
  const [loading,    setLoading]    = useState(false);
  const [result,     setResult]     = useState<DailyXIBatchResponse | null>(null);

  const canRun = cronSecret.trim().length > 0 && !loading;

  async function handleBatch() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/cron/score-daily-xi", {
        method:  "GET",
        headers: { "Authorization": `Bearer ${cronSecret.trim()}` },
      });
      const data = await res.json() as DailyXIBatchResponse;
      setResult(data);
    } catch {
      setResult({ success: false, error: "Network error — request failed." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2 text-[11px] font-mono font-semibold text-white/50 uppercase tracking-wider">
        <ListChecks size={11} /> Daily XI Auto-Score Batch
      </div>

      {/* Warning */}
      <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <AlertTriangle size={11} className="text-amber-400/70 flex-shrink-0 mt-0.5" />
        <p className="text-[10px] font-mono text-white/30 leading-relaxed">
          This scores all pending Daily XI entries up to the batch limit.
          Uses mock provider stats. Idempotent — already-scored entries are skipped.
        </p>
      </div>

      {/* Cron secret */}
      <div>
        <FieldLabel>Cron secret</FieldLabel>
        <input
          type="password"
          value={cronSecret}
          onChange={e => { setCronSecret(e.target.value); setResult(null); }}
          placeholder="CRON_SECRET value…"
          autoComplete="off"
          className={cn(
            "w-full h-10 px-3 rounded-xl border text-sm font-mono text-white",
            "bg-white/[0.04] border-white/[0.10]",
            "focus:outline-none focus:border-primary/50 placeholder:text-white/20",
          )}
        />
        <p className="mt-1 text-[10px] text-white/20 font-mono">
          Sent as Authorization: Bearer header. Never stored.
        </p>
      </div>

      <ActionBtn
        variant="danger"
        loading={loading}
        disabled={!canRun}
        onClick={handleBatch}
        className="w-full justify-center"
      >
        <ListChecks size={13} />
        Run Daily XI Batch Score
      </ActionBtn>

      {result && <DailyXIBatchResultCard data={result} />}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// World Cup Settlement types + components
// ─────────────────────────────────────────────────────────────────────────────

type WCSettleResponse = {
  success:          boolean;
  predictionKey?:   string;
  correctValues?:   string[];
  totalPredictions?: number;
  winners?:         number;
  losers?:          number;
  totalXPAwarded?:  number;
  duplicates?:      number;
  errors?:          string[];
  error?:           string;
  message?:         string;
};

function WCSettleResultCard({ data }: { data: WCSettleResponse }) {
  const [showRaw, setShowRaw] = useState(false);
  const ok = data.success;

  return (
    <div className={cn(
      "rounded-xl border text-xs font-mono space-y-2.5 p-4",
      ok ? "bg-emerald-500/8 border-emerald-500/25" : "bg-red-500/8 border-red-500/25",
    )}>
      <div className={cn("flex items-center gap-2 font-bold", ok ? "text-emerald-300" : "text-red-400")}>
        {ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
        {ok
          ? `Settled — ${data.winners ?? 0} winner(s) · ${data.totalXPAwarded ?? 0} XP awarded`
          : `Error: ${data.error ?? "Settlement failed"}`}
      </div>

      {ok && (data.totalPredictions ?? 0) > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-white/60 pt-1">
          <div>Total predictions</div>
          <div className="text-white font-semibold">{data.totalPredictions}</div>
          <div>Winners</div>
          <div className="text-emerald-300 font-semibold">{data.winners ?? 0}</div>
          <div>Losers</div>
          <div className="text-white/40 font-semibold">{data.losers ?? 0}</div>
          <div>Total XP awarded</div>
          <div className="text-primary font-semibold">{data.totalXPAwarded ?? 0} XP</div>
          {(data.duplicates ?? 0) > 0 && (
            <>
              <div>Duplicates (skipped)</div>
              <div className="text-amber-400 font-semibold">{data.duplicates}</div>
            </>
          )}
        </div>
      )}

      {data.message && <p className="text-white/35 text-[11px]">{data.message}</p>}

      {data.errors && data.errors.length > 0 && (
        <div className="space-y-1 pt-1">
          {data.errors.map((e, i) => (
            <div key={i} className="text-red-400/70 break-all">{e}</div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowRaw(p => !p)}
        className="flex items-center gap-1 text-[10px] text-white/25 hover:text-white/50 transition-colors pt-1"
      >
        {showRaw ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        {showRaw ? "Hide raw response" : "Show raw response"}
      </button>
      {showRaw && (
        <pre className="text-[10px] text-white/25 bg-black/20 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

function WCSettlementForm({ adminKey }: { adminKey: string }) {
  const [predictionKey,    setPredictionKey]    = useState("");
  const [correctValuesRaw, setCorrectValuesRaw] = useState("");
  const [loading,          setLoading]          = useState(false);
  const [result,           setResult]           = useState<WCSettleResponse | null>(null);

  const correctValues = correctValuesRaw.split(",").map(s => s.trim()).filter(Boolean);
  const canSubmit     = predictionKey.trim().length > 0 && correctValues.length > 0 && !loading;

  async function handleSettle() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/settle-worldcup", {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body:    JSON.stringify({
          predictionKey:  predictionKey.trim(),
          correctValues,
        }),
      });
      const data = await res.json() as WCSettleResponse;
      setResult(data);
    } catch {
      setResult({ success: false, error: "Network error — request failed." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2 text-[11px] font-mono font-semibold text-white/50 uppercase tracking-wider">
        <Globe size={11} /> World Cup Settlement
      </div>

      {/* Warning */}
      <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <AlertTriangle size={11} className="text-amber-400/70 flex-shrink-0 mt-0.5" />
        <p className="text-[10px] font-mono text-white/30 leading-relaxed">
          This awards World Cup XP and updates leaderboard stats.
          Only pending predictions for the given key are processed. Idempotent.
        </p>
      </div>

      {/* Prediction Key */}
      <div>
        <FieldLabel>Prediction key</FieldLabel>
        <TextInput
          type="text"
          value={predictionKey}
          onChange={e => { setPredictionKey(e.target.value); setResult(null); }}
          placeholder="e.g. wc-champion"
          autoComplete="off"
        />
        <p className="mt-1 text-[10px] text-white/20 font-mono">
          Must match prediction_key stored in wc_predictions table.
        </p>
      </div>

      {/* Correct Values */}
      <div>
        <FieldLabel>Correct values (comma-separated)</FieldLabel>
        <TextInput
          type="text"
          value={correctValuesRaw}
          onChange={e => { setCorrectValuesRaw(e.target.value); setResult(null); }}
          placeholder="e.g. Brazil  or  Brazil, Argentina"
          autoComplete="off"
        />
        {correctValues.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {correctValues.map((v, i) => (
              <span key={i} className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-primary/15 border border-primary/25 text-primary/70">
                {v}
              </span>
            ))}
          </div>
        )}
      </div>

      <ActionBtn
        variant="danger"
        loading={loading}
        disabled={!canSubmit}
        onClick={handleSettle}
        className="w-full justify-center"
      >
        <Globe size={13} />
        Settle World Cup Prediction
      </ActionBtn>

      {result && <WCSettleResultCard data={result} />}
    </Card>
  );
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function DailyXIScoreResultCard({ data }: { data: DailyXIScoreResponse }) {
  const [showRaw, setShowRaw] = useState(false);

  if (data.alreadyScored) {
    return (
      <div className="rounded-xl border text-xs font-mono space-y-2 p-4 bg-amber-500/8 border-amber-500/25">
        <div className="flex items-center gap-2 font-bold text-amber-300">
          <AlertTriangle size={13} /> Already scored — {data.earnedXp ?? 0} XP · no changes made
        </div>
        <button type="button" onClick={() => setShowRaw(p => !p)}
          className="flex items-center gap-1 text-[10px] text-white/25 hover:text-white/50 transition-colors">
          {showRaw ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          {showRaw ? "Hide raw" : "Show raw"}
        </button>
        {showRaw && (
          <pre className="text-[10px] text-white/25 bg-black/20 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  const ok = data.success;
  return (
    <div className={cn(
      "rounded-xl border text-xs font-mono space-y-2.5 p-4",
      ok ? "bg-emerald-500/8 border-emerald-500/25" : "bg-red-500/8 border-red-500/25",
    )}>
      <div className={cn("flex items-center gap-2 font-bold", ok ? "text-emerald-300" : "text-red-400")}>
        {ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
        {ok ? `Scored — ${data.earnedXp ?? 0} XP awarded` : `Error: ${data.error ?? "Scoring failed"}`}
      </div>

      {ok && data.playerBreakdown && data.playerBreakdown.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="text-[10px] text-white/30 uppercase tracking-wider">Player breakdown</div>
          {data.playerBreakdown.map((p) => (
            <div key={p.playerId} className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
              <span className="text-white/50 truncate text-[10px]">{p.playerId}</span>
              <span className={cn("font-bold tabular-nums flex-shrink-0 text-[10px]", p.xp > 0 ? "text-primary" : "text-white/30")}>
                {p.xp > 0 ? `+${p.xp}` : p.xp} XP
              </span>
            </div>
          ))}
        </div>
      )}

      {data.xpDuplicate && (
        <p className="text-amber-400/70 text-[11px]">XP event already existed — leaderboard not double-incremented.</p>
      )}

      <button type="button" onClick={() => setShowRaw(p => !p)}
        className="flex items-center gap-1 text-[10px] text-white/25 hover:text-white/50 transition-colors pt-1">
        {showRaw ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        {showRaw ? "Hide raw response" : "Show raw response"}
      </button>
      {showRaw && (
        <pre className="text-[10px] text-white/30 bg-black/20 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

function DailyXIScoringForm({ adminKey }: { adminKey: string }) {
  const [wallet,         setWallet]         = useState("");
  const [date,           setDate]           = useState(todayISO());
  const [players,        setPlayers]        = useState<PlayerStatRow[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [result,         setResult]         = useState<DailyXIScoreResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewXp,      setPreviewXp]      = useState<number | null>(null);
  const [autoLoading,    setAutoLoading]    = useState(false);

  function addPlayer() {
    setPlayers(p => [...p, {
      playerId: "", goals: 0, assists: 0, cleanSheet: false,
      rating: 7.0, yellowCards: 0, redCards: 0, played: true,
    }]);
  }

  function removePlayer(i: number) {
    setPlayers(p => p.filter((_, idx) => idx !== i));
  }

  function updatePlayer<K extends keyof PlayerStatRow>(i: number, field: K, value: PlayerStatRow[K]) {
    setPlayers(p => p.map((row, idx) => idx === i ? { ...row, [field]: value } : row));
  }

  const hasWalletAndDate = wallet.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const anyBusy    = loading || previewLoading || autoLoading;
  const canSubmit  = hasWalletAndDate && players.length > 0 && !anyBusy;
  const canPreview = hasWalletAndDate && !anyBusy;
  const canAutoScore = hasWalletAndDate && !anyBusy;

  async function handleAutoScore() {
    setAutoLoading(true);
    setResult(null);
    setPreviewXp(null);
    try {
      // Step 1 — fetch mock stats for this entry
      const previewRes = await fetch("/api/admin/daily-xi-stats-preview", {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body:    JSON.stringify({ walletAddress: wallet.trim(), entryDate: date }),
      });
      const previewData = await previewRes.json() as StatsPreviewResponse;
      if (!previewData.success || !previewData.stats) {
        setResult({ success: false, error: previewData.error ?? "Preview step failed — no stats returned." });
        return;
      }

      // Populate rows so the user can see what was used
      const rows: PlayerStatRow[] = previewData.stats.map(s => ({
        playerId:    s.playerId,
        goals:       s.goals,
        assists:     s.assists,
        cleanSheet:  s.cleanSheet,
        rating:      s.rating,
        yellowCards: s.yellowCards,
        redCards:    s.redCards,
        played:      s.played,
      }));
      setPlayers(rows);
      setPreviewXp(previewData.totalXp ?? null);

      // Step 2 — score with those stats
      const scoreRes = await fetch("/api/admin/score-daily-xi", {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body:    JSON.stringify({ walletAddress: wallet.trim(), entryDate: date, playerStats: rows }),
      });
      const scoreData = await scoreRes.json() as DailyXIScoreResponse;
      setResult(scoreData);
    } catch {
      setResult({ success: false, error: "Network error — request failed." });
    } finally {
      setAutoLoading(false);
    }
  }

  async function handlePreview() {
    setPreviewLoading(true);
    setPreviewXp(null);
    try {
      const res = await fetch("/api/admin/daily-xi-stats-preview", {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body:    JSON.stringify({ walletAddress: wallet.trim(), entryDate: date }),
      });
      const data = await res.json() as StatsPreviewResponse;
      if (data.success && data.stats) {
        setPlayers(data.stats.map(s => ({
          playerId:    s.playerId,
          goals:       s.goals,
          assists:     s.assists,
          cleanSheet:  s.cleanSheet,
          rating:      s.rating,
          yellowCards: s.yellowCards,
          redCards:    s.redCards,
          played:      s.played,
        })));
        setPreviewXp(data.totalXp ?? null);
      } else {
        setPreviewXp(null);
      }
    } catch {
      setPreviewXp(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleScore() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/score-daily-xi", {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body:    JSON.stringify({ walletAddress: wallet.trim(), entryDate: date, playerStats: players }),
      });
      const data = await res.json() as DailyXIScoreResponse;
      setResult(data);
    } catch {
      setResult({ success: false, error: "Network error — request failed." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2 text-[11px] font-mono font-semibold text-white/50 uppercase tracking-wider">
        <Star size={11} /> Daily XI Scoring
      </div>

      {/* Warning */}
      <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <AlertTriangle size={11} className="text-amber-400/70 flex-shrink-0 mt-0.5" />
        <p className="text-[10px] font-mono text-white/30 leading-relaxed">
          This action awards Daily XI XP and updates leaderboard stats.
          Idempotent — re-running on a scored entry returns the existing result.
        </p>
      </div>

      {/* Wallet */}
      <div>
        <FieldLabel>Wallet address</FieldLabel>
        <TextInput
          type="text"
          value={wallet}
          onChange={e => setWallet(e.target.value)}
          placeholder="0x…"
          autoComplete="off"
        />
      </div>

      {/* Date */}
      <div>
        <FieldLabel>Entry date (YYYY-MM-DD)</FieldLabel>
        <TextInput
          type="text"
          value={date}
          onChange={e => setDate(e.target.value)}
          placeholder="2026-05-17"
          autoComplete="off"
        />
      </div>

      {/* Player stats editor */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <FieldLabel>Player stats ({players.length})</FieldLabel>
          <div className="flex items-center gap-1.5">
            <ActionBtn
              variant="ghost"
              loading={previewLoading}
              disabled={!canPreview}
              onClick={handlePreview}
              className="h-7 px-3 text-[10px]"
            >
              <Eye size={11} /> Preview Mock Stats
            </ActionBtn>
            <ActionBtn variant="ghost" onClick={addPlayer} className="h-7 px-3 text-[10px]">
              <Plus size={11} /> Add Player
            </ActionBtn>
          </div>
        </div>

        {players.length === 0 && (
          <p className="text-[10px] font-mono text-white/20 py-2">
            No players added. Click "Add Player" to begin.
          </p>
        )}

        <div className="space-y-2">
          {players.map((p, i) => (
            <div key={i} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 space-y-2">
              {/* Row header */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-mono text-white/30 uppercase tracking-wider">Player {i + 1}</span>
                <button type="button" onClick={() => removePlayer(i)}
                  className="text-white/20 hover:text-red-400/70 transition-colors">
                  <Trash2 size={11} />
                </button>
              </div>

              {/* playerId */}
              <div>
                <FieldLabel>Player ID</FieldLabel>
                <TextInput
                  type="text"
                  value={p.playerId}
                  onChange={e => updatePlayer(i, "playerId", e.target.value)}
                  placeholder="e.g. gk1, st3"
                  autoComplete="off"
                />
              </div>

              {/* Numeric stats grid */}
              <div className="grid grid-cols-3 gap-2">
                {(["goals", "assists", "yellowCards", "redCards"] as const).map(field => (
                  <div key={field}>
                    <FieldLabel>{field}</FieldLabel>
                    <TextInput
                      type="number"
                      min={0}
                      value={p[field] as number}
                      onChange={e => updatePlayer(i, field, Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="text-center"
                    />
                  </div>
                ))}
                <div>
                  <FieldLabel>rating</FieldLabel>
                  <TextInput
                    type="number"
                    min={0}
                    max={10}
                    step={0.1}
                    value={p.rating}
                    onChange={e => updatePlayer(i, "rating", parseFloat(e.target.value) || 0)}
                    className="text-center"
                  />
                </div>
              </div>

              {/* Checkboxes */}
              <div className="flex items-center gap-4">
                {(["played", "cleanSheet"] as const).map(field => (
                  <label key={field} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={p[field] as boolean}
                      onChange={e => updatePlayer(i, field, e.target.checked)}
                      className="accent-primary w-3.5 h-3.5"
                    />
                    <span className="text-[10px] font-mono text-white/40">{field}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Preview XP badge */}
      {previewXp !== null && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-500/8 border border-sky-500/20 text-[10px] font-mono text-sky-300/70">
          <Eye size={10} className="flex-shrink-0" />
          Mock preview: <span className="text-sky-200 font-bold">{previewXp} XP</span>
          <span className="text-white/20">· Edit rows to adjust · Score to confirm</span>
        </div>
      )}

      {/* Submit */}
      <ActionBtn
        variant="danger"
        loading={loading}
        disabled={!canSubmit}
        onClick={handleScore}
        className="w-full justify-center"
      >
        <Star size={13} />
        Score Daily XI
      </ActionBtn>

      {result && <DailyXIScoreResultCard data={result} />}

      {/* ── Auto-score divider ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2 pt-1">
        <div className="flex-1 h-px bg-white/[0.06]" />
        <span className="text-[9px] font-mono text-white/20 uppercase tracking-widest">one-click</span>
        <div className="flex-1 h-px bg-white/[0.06]" />
      </div>

      {/* Auto-score warning */}
      <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-red-500/[0.06] border border-red-500/20">
        <AlertTriangle size={11} className="text-red-400/70 flex-shrink-0 mt-0.5" />
        <p className="text-[10px] font-mono text-white/30 leading-relaxed">
          This will generate mock stats and immediately award Daily XI XP.
          Requires wallet + date. Player rows are populated after the preview step.
        </p>
      </div>

      {/* Preview + Score button */}
      <ActionBtn
        variant="danger"
        loading={autoLoading}
        disabled={!canAutoScore}
        onClick={handleAutoScore}
        className="w-full justify-center"
      >
        <Wand2 size={13} />
        Preview + Score Daily XI
      </ActionBtn>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Gate — shown until key is verified
// ─────────────────────────────────────────────────────────────────────────────

function KeyGate({
  onUnlocked,
}: {
  onUnlocked: (key: string) => void;
}) {
  const [keyInput,  setKeyInput]  = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    const key = keyInput.trim();
    if (!key) return;

    setVerifying(true);
    setError(null);

    try {
      // Deliberately send an invalid body (empty matchId) so validation fires
      // before any settlement logic. 400 = key accepted. 401 = key rejected.
      // Nothing is settled by this probe.
      const res = await fetch("/api/admin/settle-match", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key":  key,
        },
        body: JSON.stringify({}),   // intentionally empty — triggers 400 if auth passes
      });

      if (res.status === 401) {
        setError("Invalid admin key.");
        return;
      }

      // 400 (validation error) or any non-401 response = key was accepted by auth
      onUnlocked(key);
    } catch {
      setError("Network error — could not reach server.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2 text-[11px] font-mono font-semibold text-white/50 uppercase tracking-wider">
        <Lock size={11} /> Admin Key Required
      </div>

      <p className="text-[12px] text-white/40 font-mono leading-relaxed">
        Enter your settlement admin key to unlock this tool.
        The key is verified against the API and never stored.
      </p>

      <form onSubmit={handleUnlock} className="space-y-3">
        <div>
          <FieldLabel>Admin key</FieldLabel>
          <TextInput
            type="password"
            value={keyInput}
            onChange={(e) => { setKeyInput(e.target.value); setError(null); }}
            placeholder="Enter ADMIN_SETTLEMENT_KEY…"
            autoComplete="off"
            autoFocus
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-[11px] font-mono text-red-400/80">
            <AlertTriangle size={11} />
            {error}
          </div>
        )}

        <ActionBtn
          type="submit"
          variant="primary"
          loading={verifying}
          disabled={keyInput.trim().length === 0}
          className="w-full justify-center"
        >
          <Unlock size={13} />
          Unlock Admin Tool
        </ActionBtn>
      </form>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Settlement form — shown after key is verified
// ─────────────────────────────────────────────────────────────────────────────

function SettlementForm({
  adminKey,
  onLock,
}: {
  adminKey: string;
  onLock: () => void;
}) {
  const [matchId, setMatchId] = useState("");
  const [outcome, setOutcome] = useState<ActualResult>("home");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<SettleResponse | null>(null);

  const canSubmit = matchId.trim().length > 0 && !loading;

  async function handleSettle() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/settle-match", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key":  adminKey,
        },
        body: JSON.stringify({ matchId: matchId.trim(), actualResult: outcome }),
      });
      const data = await res.json() as SettleResponse;
      if (res.status === 409) setResult({ ...data, alreadySettled: true });
      else setResult(data);
    } catch {
      setResult({ success: false, error: "Network error — request failed." });
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setMatchId("");
    setOutcome("home");
    setResult(null);
  }

  return (
    <>
      {/* Unlocked status bar */}
      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
        <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-300/80">
          <Unlock size={11} />
          Admin tool unlocked
        </div>
        <button
          type="button"
          onClick={onLock}
          className="flex items-center gap-1.5 text-[11px] font-mono text-white/30 hover:text-red-400/80 transition-colors"
        >
          <Lock size={10} />
          Lock / clear key
        </button>
      </div>

      {/* Settlement form */}
      <Card>
        <div className="flex items-center gap-2 text-[11px] font-mono font-semibold text-white/50 uppercase tracking-wider">
          <CheckCircle2 size={11} /> Settle Match
        </div>

        <div>
          <FieldLabel>Match ID</FieldLabel>
          <TextInput
            type="text"
            value={matchId}
            onChange={(e) => setMatchId(e.target.value)}
            placeholder="e.g. fd-538091"
            autoComplete="off"
          />
          <p className="mt-1 text-[10px] text-white/20 font-mono">
            Must match a match ID in the matches table.
          </p>
        </div>

        <div>
          <FieldLabel>Actual result</FieldLabel>
          <OutcomePicker value={outcome} onChange={setOutcome} />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <ActionBtn
            variant="success"
            loading={loading}
            disabled={!canSubmit}
            onClick={handleSettle}
            className="flex-1 justify-center"
          >
            Settle Match
          </ActionBtn>
          <ActionBtn
            variant="ghost"
            onClick={handleReset}
            disabled={loading}
            title="Clear form"
          >
            <X size={14} />
          </ActionBtn>
        </div>

        {result && <ResultCard data={result} />}
      </Card>

      {/* Sync Results */}
      <SyncResultsForm adminKey={adminKey} />

      {/* Auto Settlement */}
      <AutoSettleForm adminKey={adminKey} />

      {/* Daily XI Scoring */}
      <DailyXIScoringForm adminKey={adminKey} />

      {/* Daily XI Auto-Score Batch */}
      <DailyXIBatchForm />

      {/* World Cup Settlement */}
      <WCSettlementForm adminKey={adminKey} />

      {/* Safety notes */}
      <Card>
        <div className="flex items-center gap-2 text-[11px] font-mono font-semibold text-white/50 uppercase tracking-wider">
          <Shield size={11} /> How it works
        </div>
        <ul className="space-y-1.5 text-[11px] font-mono text-white/35 leading-relaxed">
          <li>· Manual settle: one match at a time with explicit result.</li>
          <li>· Auto settle: scans finished matches, infers result from score.</li>
          <li>· Awards 25 XP per correct prediction to the user profile.</li>
          <li>· Writes one XP event per prediction to the ledger.</li>
          <li>· Updates leaderboard_stats (all-time + weekly).</li>
          <li>· Already-settled matches are skipped automatically.</li>
          <li>· Sync Results: fetches live scores from football API, updates DB only.</li>
          <li>· Run Sync Results first, then Auto Settlement to award XP.</li>
          <li>· Daily XI Scoring: awards XP based on player stats (goals, assists, etc.).</li>
          <li>· Daily XI Batch: manually triggers the nightly cron — scores all pending entries.</li>
          <li>· World Cup Settlement: settles all pending wc_predictions for a key, awards XP to winners.</li>
          <li>· Admin key lives in memory only — cleared on lock or page reload.</li>
        </ul>
      </Card>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function SettlementAdminPage() {
  // Verified admin key — in-memory only, never stored
  const [verifiedKey, setVerifiedKey] = useState<string | null>(null);

  function handleLock() {
    setVerifiedKey(null);
  }

  return (
    <main className="min-h-screen bg-bg text-text-primary font-sans">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-primary/15 border border-primary/25 flex-shrink-0">
            <Shield size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">Settlement Engine</h1>
            <p className="text-[11px] text-white/30 font-mono mt-0.5">Internal admin — do not share key</p>
          </div>
        </div>

        {/* Warning banner */}
        <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/20">
          <AlertTriangle size={12} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-300/70 font-mono leading-relaxed">
            Settlement awards XP and updates leaderboard stats. Use the correct final result.
            Settlement of the same match twice is blocked automatically.
          </p>
        </div>

        {/* Gate or form */}
        {verifiedKey === null ? (
          <KeyGate onUnlocked={setVerifiedKey} />
        ) : (
          <SettlementForm adminKey={verifiedKey} onLock={handleLock} />
        )}

        <footer className="text-center pb-6">
          <p className="text-[10px] text-white/15 font-mono tracking-[0.14em] uppercase">
            PrediXI · Admin · Internal Only
          </p>
        </footer>

      </div>
    </main>
  );
}
