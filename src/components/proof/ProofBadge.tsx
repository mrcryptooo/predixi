"use client";

/**
 * ProofBadge — compact proof-of-commitment indicator.
 *
 * States:
 *   commitmentHash only → "Proof ready" glass chip with shortened hash + copy
 *   submittedOnchain + txHash → "Onchain" green chip with tx hash + copy
 *   nothing → renders null (no layout shift)
 *
 * Read-only. No transaction sending. No contract calls.
 */

import { useState } from "react";
import { Shield, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function shorten(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

async function copyToClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
    // Fallback for embedded webviews
    const el = document.createElement("textarea");
    el.value = value;
    el.style.cssText = "position:absolute;left:-9999px;top:-9999px";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface ProofBadgeProps {
  commitmentHash?:   string | null;
  submittedOnchain?: boolean;
  txHash?:           string | null;
  className?:        string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function ProofBadge({
  commitmentHash,
  submittedOnchain = false,
  txHash,
  className,
}: ProofBadgeProps) {
  const [copied, setCopied] = useState(false);

  // Nothing to show — no layout shift
  if (!commitmentHash) return null;

  const handleCopy = async (value: string) => {
    const ok = await copyToClipboard(value);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  // ── Onchain state ───────────────────────────────────────────────────────────
  if (submittedOnchain && txHash) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg",
          "bg-emerald-500/10 border border-emerald-500/25",
          className,
        )}
      >
        <Shield size={9} className="text-emerald-400 flex-shrink-0" />
        <span className="text-[9px] font-mono font-bold text-emerald-400">
          Onchain
        </span>
        <span className="text-[9px] font-mono text-emerald-400/50">
          {shorten(txHash)}
        </span>
        <button
          type="button"
          title={`Copy tx hash: ${txHash}`}
          onClick={() => handleCopy(txHash)}
          className="text-emerald-400/50 hover:text-emerald-400 transition-colors flex-shrink-0"
          aria-label="Copy transaction hash"
        >
          {copied
            ? <Check size={9} className="text-emerald-400" />
            : <Copy  size={9} />}
        </button>
      </div>
    );
  }

  // ── Proof ready (pending onchain) ───────────────────────────────────────────
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg",
        "bg-primary/8 border border-primary/18",
        className,
      )}
    >
      <Shield size={9} className="text-primary/50 flex-shrink-0" />
      <span className="text-[9px] font-mono text-white/35">
        {shorten(commitmentHash)}
      </span>
      <button
        type="button"
        title={`Copy commitment hash: ${commitmentHash}`}
        onClick={() => handleCopy(commitmentHash)}
        className="text-white/25 hover:text-primary/70 transition-colors flex-shrink-0"
        aria-label="Copy commitment hash"
      >
        {copied
          ? <Check size={9} className="text-success" />
          : <Copy  size={9} />}
      </button>
    </div>
  );
}
