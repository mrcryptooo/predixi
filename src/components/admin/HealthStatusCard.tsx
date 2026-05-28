"use client";

/**
 * HealthStatusCard — read-only pipeline health monitor.
 *
 * Fetches GET /api/admin/health with the provided adminKey.
 * Displays structured status for all health checks.
 *
 * Safety: read-only only. No writes, no mutations, no execute buttons.
 * Env vars are shown as ✓ / ✗ booleans — no values ever displayed.
 */

import { useState } from "react";
import {
  Activity,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Database,
  Calendar,
  Clock,
  Zap,
  Shield,
  Settings,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types mirroring API response
// ─────────────────────────────────────────────────────────────────────────────

type HealthState = "healthy" | "warning" | "error" | "unknown";

type CronJobStatus = {
  route:      string;
  lastRanAt:  string | null;
  status:     string | null;
  ageMinutes: number | null;
  stale:      boolean;
};

type HealthChecks = {
  database: {
    state: HealthState; reachable: boolean; latencyMs?: number; error?: string;
  };
  fixtures: {
    state: HealthState; upcomingCount: number;
    latestKickoff?: string | null; lastSyncedAt?: string | null; error?: string;
  };
  cron: {
    state: HealthState; jobs: CronJobStatus[]; error?: string;
  };
  xpPipeline: {
    state: HealthState; latestEventAt?: string | null;
    totalEventCount?: number; leaderboardRows?: number; error?: string;
  };
  proofPipeline: {
    state: HealthState; recentWithHash?: number; recentWithoutHash?: number;
    wcWithHash?: number; dailyXiWithHash?: number; error?: string;
  };
  env: {
    state: HealthState;
    FOOTBALL_DATA_TOKEN: boolean; CRON_SECRET: boolean;
    ADMIN_SETTLEMENT_KEY: boolean; NEXT_PUBLIC_SUPABASE_URL: boolean;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: boolean; SUPABASE_SERVICE_ROLE_KEY: boolean;
  };
};

type HealthResponse = {
  success: boolean;
  generatedAt: string;
  checks: HealthChecks;
  error?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

function StatePill({ state }: { state: HealthState }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-mono font-bold uppercase tracking-wider flex-shrink-0",
      state === "healthy" && "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
      state === "warning" && "bg-amber-400/12 text-amber-400 border border-amber-400/20",
      state === "error"   && "bg-red-500/12 text-red-400 border border-red-500/20",
      state === "unknown" && "bg-white/[0.06] text-white/30 border border-white/[0.08]",
    )}>
      {state === "healthy" && <CheckCircle2 size={7} />}
      {state === "warning" && <AlertTriangle size={7} />}
      {state === "error"   && <XCircle       size={7} />}
      {state === "unknown" && <HelpCircle    size={7} />}
      {state}
    </span>
  );
}

function SectionHeader({
  icon,
  label,
  state,
  open,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  state: HealthState;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between gap-2 py-2 text-left"
    >
      <div className="flex items-center gap-2">
        <span className="text-white/30">{icon}</span>
        <span className="text-[10px] font-mono font-semibold text-white/55 uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <StatePill state={state} />
        <span className="text-white/20">
          {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </span>
      </div>
    </button>
  );
}

function Row({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-0.5">
      <span className="text-[9px] font-mono text-white/30 min-w-0 flex-shrink-0">{label}</span>
      <span className={cn("text-[9px] font-mono text-right min-w-0 break-all", accent ?? "text-white/55")}>
        {value}
      </span>
    </div>
  );
}

function BoolChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[9px] font-mono text-white/30 truncate">{label}</span>
      <span className={cn(
        "text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border flex-shrink-0",
        ok
          ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
          : "text-red-400 bg-red-500/10 border-red-500/20",
      )}>
        {ok ? "✓ SET" : "✗ MISSING"}
      </span>
    </div>
  );
}

function formatAge(minutes: number | null): string {
  if (minutes === null) return "never run";
  if (minutes < 1)    return "< 1 min ago";
  if (minutes < 60)   return `${minutes}m ago`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
}

function formatTs(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

const DIVIDER = <div className="h-px bg-white/[0.05] my-1" />;

// ─────────────────────────────────────────────────────────────────────────────
// Section panels
// ─────────────────────────────────────────────────────────────────────────────

function DatabasePanel({ check }: { check: HealthChecks["database"] }) {
  return (
    <div className="space-y-0.5 pt-1 pb-2">
      <Row label="Reachable"  value={check.reachable ? "yes" : "no"} accent={check.reachable ? "text-emerald-400" : "text-red-400"} />
      {check.latencyMs !== undefined && (
        <Row label="Latency" value={`${check.latencyMs} ms`} accent={check.latencyMs > 1000 ? "text-amber-400" : "text-white/55"} />
      )}
      {check.error && <Row label="Error" value={check.error} accent="text-red-400/70" />}
    </div>
  );
}

function FixturesPanel({ check }: { check: HealthChecks["fixtures"] }) {
  return (
    <div className="space-y-0.5 pt-1 pb-2">
      <Row label="Upcoming matches" value={String(check.upcomingCount)} accent={check.upcomingCount === 0 ? "text-amber-400" : "text-white/55"} />
      <Row label="Next kickoff"     value={formatTs(check.latestKickoff)} />
      <Row label="Last sync"        value={formatTs(check.lastSyncedAt)} />
      {check.error && <Row label="Error" value={check.error} accent="text-red-400/70" />}
    </div>
  );
}

function CronPanel({ check }: { check: HealthChecks["cron"] }) {
  return (
    <div className="space-y-1.5 pt-1 pb-2">
      {check.jobs.map(job => {
        const short = job.route.replace("/api/cron/", "");
        const isErr = job.status === "error";
        return (
          <div key={job.route} className={cn(
            "rounded-lg border px-2.5 py-2 space-y-0.5",
            isErr    ? "border-red-500/20 bg-red-500/[0.04]" :
            job.stale ? "border-amber-400/15 bg-amber-400/[0.03]" :
            "border-white/[0.06] bg-white/[0.02]",
          )}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-mono font-semibold text-white/60">{short}</span>
              <div className="flex items-center gap-1.5">
                {job.stale && <span className="text-[8px] font-mono text-amber-400/70">stale</span>}
                {job.status && (
                  <span className={cn(
                    "text-[8px] font-mono font-bold",
                    job.status === "success" ? "text-emerald-400" :
                    job.status === "error"   ? "text-red-400"     : "text-white/30",
                  )}>{job.status}</span>
                )}
              </div>
            </div>
            <div className="text-[8px] font-mono text-white/25">
              {job.lastRanAt ? `${formatAge(job.ageMinutes)} · ${formatTs(job.lastRanAt)}` : "never run"}
            </div>
          </div>
        );
      })}
      {check.error && <p className="text-[9px] font-mono text-red-400/70">{check.error}</p>}
    </div>
  );
}

function XpPanel({ check }: { check: HealthChecks["xpPipeline"] }) {
  return (
    <div className="space-y-0.5 pt-1 pb-2">
      <Row label="Total XP events"    value={String(check.totalEventCount ?? 0)} />
      <Row label="Latest event"        value={formatTs(check.latestEventAt)} />
      <Row label="Leaderboard rows"    value={String(check.leaderboardRows ?? 0)} />
      {check.error && <Row label="Error" value={check.error} accent="text-red-400/70" />}
    </div>
  );
}

function ProofPanel({ check }: { check: HealthChecks["proofPipeline"] }) {
  const total = (check.recentWithHash ?? 0) + (check.recentWithoutHash ?? 0);
  return (
    <div className="space-y-0.5 pt-1 pb-2">
      <Row
        label="Recent predictions with hash"
        value={total > 0 ? `${check.recentWithHash ?? 0} / ${total}` : "0"}
        accent={(check.recentWithHash ?? 0) > 0 ? "text-emerald-400" : "text-white/30"}
      />
      <Row label="WC picks with hash"       value={String(check.wcWithHash    ?? 0)} accent={(check.wcWithHash    ?? 0) > 0 ? "text-emerald-400" : "text-white/30"} />
      <Row label="Daily XI with hash"       value={String(check.dailyXiWithHash ?? 0)} accent={(check.dailyXiWithHash ?? 0) > 0 ? "text-emerald-400" : "text-white/30"} />
      {(check.recentWithoutHash ?? 0) > 0 && (
        <Row
          label="Recent without hash"
          value={String(check.recentWithoutHash)}
          accent="text-amber-400"
        />
      )}
      {check.error && <Row label="Error" value={check.error} accent="text-red-400/70" />}
    </div>
  );
}

function EnvPanel({ check }: { check: HealthChecks["env"] }) {
  return (
    <div className="space-y-1 pt-1 pb-2">
      <BoolChip ok={check.NEXT_PUBLIC_SUPABASE_URL}      label="NEXT_PUBLIC_SUPABASE_URL"      />
      <BoolChip ok={check.NEXT_PUBLIC_SUPABASE_ANON_KEY} label="NEXT_PUBLIC_SUPABASE_ANON_KEY" />
      <BoolChip ok={check.SUPABASE_SERVICE_ROLE_KEY}     label="SUPABASE_SERVICE_ROLE_KEY"     />
      <BoolChip ok={check.FOOTBALL_DATA_TOKEN}           label="FOOTBALL_DATA_TOKEN"           />
      <BoolChip ok={check.CRON_SECRET}                   label="CRON_SECRET"                   />
      <BoolChip ok={check.ADMIN_SETTLEMENT_KEY}          label="ADMIN_SETTLEMENT_KEY"          />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function HealthStatusCard({ adminKey }: { adminKey: string }) {
  const [data,    setData]    = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  // Section collapse state
  const [open, setOpen] = useState<Record<string, boolean>>({
    database: true, fixtures: true, cron: true,
    xpPipeline: true, proofPipeline: true, env: true,
  });
  const toggle = (k: string) => setOpen(p => ({ ...p, [k]: !p[k] }));

  async function fetchHealth() {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/admin/health", {
        headers: { "x-admin-key": adminKey },
      });
      const json = await res.json() as HealthResponse;
      if (!json.success) {
        setError(json.error ?? "Health check failed.");
        setData(null);
      } else {
        setData(json);
      }
    } catch {
      setError("Network error — could not reach server.");
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }

  // Overall system state
  const overallState: HealthState = !data ? "unknown" : (() => {
    const states = Object.values(data.checks).map(c => c.state);
    if (states.includes("error"))   return "error";
    if (states.includes("warning")) return "warning";
    return "healthy";
  })();

  return (
    <div className={cn(
      "rounded-2xl border p-5 space-y-4",
      "bg-gradient-to-br from-primary/8 via-[#070b22] to-bg border-primary/15",
    )}>
      {/* Card header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-[11px] font-mono font-semibold text-white/50 uppercase tracking-wider">
          <Activity size={11} /> Pipeline Health
        </div>
        <div className="flex items-center gap-2">
          {data && <StatePill state={overallState} />}
          <button
            type="button"
            onClick={fetchHealth}
            disabled={loading}
            className={cn(
              "h-7 px-2.5 rounded-lg border text-[10px] font-mono font-semibold flex items-center gap-1.5",
              "bg-white/[0.04] border-white/[0.10] text-white/45",
              "hover:border-primary/30 hover:text-white/70 transition-colors",
              "disabled:opacity-40",
            )}
          >
            <RefreshCw size={9} className={loading ? "animate-spin" : undefined} />
            {loading ? "Checking…" : fetched ? "Refresh" : "Run checks"}
          </button>
        </div>
      </div>

      {/* Read-only notice */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
        <Shield size={9} className="text-primary/40 flex-shrink-0" />
        <p className="text-[9px] font-mono text-white/25">Read-only — no writes, no cron execution.</p>
      </div>

      {/* Pre-load state */}
      {!fetched && !loading && (
        <div className="py-6 flex flex-col items-center gap-2 text-center">
          <Activity size={18} className="text-white/15" />
          <p className="text-[10px] font-mono text-white/25">
            Press <span className="text-primary/50 font-bold">Run checks</span> to inspect all pipeline systems.
          </p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="py-4 flex flex-col items-center gap-2">
          <RefreshCw size={14} className="text-primary/30 animate-spin" />
          <p className="text-[10px] font-mono text-white/25 animate-pulse">Running health checks…</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/8 border border-red-500/20">
          <AlertTriangle size={11} className="text-red-400/70 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] font-mono text-red-400/70">{error}</p>
        </div>
      )}

      {/* Results */}
      {data && !loading && (
        <div className="space-y-0">

          {/* Generated at */}
          <p className="text-[9px] font-mono text-white/20 pb-1">
            Generated {formatTs(data.generatedAt)}
          </p>

          {DIVIDER}

          {/* Database */}
          <SectionHeader icon={<Database size={10} />} label="Database" state={data.checks.database.state} open={open.database} onToggle={() => toggle("database")} />
          {open.database && <DatabasePanel check={data.checks.database} />}
          {DIVIDER}

          {/* Fixtures */}
          <SectionHeader icon={<Calendar size={10} />} label="Fixtures" state={data.checks.fixtures.state} open={open.fixtures} onToggle={() => toggle("fixtures")} />
          {open.fixtures && <FixturesPanel check={data.checks.fixtures} />}
          {DIVIDER}

          {/* Cron */}
          <SectionHeader icon={<Clock size={10} />} label="Cron Jobs" state={data.checks.cron.state} open={open.cron} onToggle={() => toggle("cron")} />
          {open.cron && <CronPanel check={data.checks.cron} />}
          {DIVIDER}

          {/* XP Pipeline */}
          <SectionHeader icon={<Zap size={10} />} label="XP Pipeline" state={data.checks.xpPipeline.state} open={open.xpPipeline} onToggle={() => toggle("xpPipeline")} />
          {open.xpPipeline && <XpPanel check={data.checks.xpPipeline} />}
          {DIVIDER}

          {/* Proof Pipeline */}
          <SectionHeader icon={<Shield size={10} />} label="Proof Pipeline" state={data.checks.proofPipeline.state} open={open.proofPipeline} onToggle={() => toggle("proofPipeline")} />
          {open.proofPipeline && <ProofPanel check={data.checks.proofPipeline} />}
          {DIVIDER}

          {/* Env */}
          <SectionHeader icon={<Settings size={10} />} label="Env Readiness" state={data.checks.env.state} open={open.env} onToggle={() => toggle("env")} />
          {open.env && <EnvPanel check={data.checks.env} />}
        </div>
      )}
    </div>
  );
}
