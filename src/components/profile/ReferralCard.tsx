"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Copy, CheckCheck, Zap, Link2, UserPlus } from "lucide-react";
import { useSignMessage } from "wagmi";
import { buildPredixiAuthMessage, generateNonce } from "@/lib/auth/wallet-signature";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ReferralData = {
  referralCode:  string | null;
  referralLink:  string | null;
  referralCount: number;
  referralXp:    number;
};

// ─────────────────────────────────────────────────────────────────────────────
// ReferralCard
// ─────────────────────────────────────────────────────────────────────────────

export function ReferralCard({ walletAddress }: { walletAddress?: string }) {
  const [data,          setData]          = useState<ReferralData | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [copied,        setCopied]        = useState(false);
  const [enteredCode,   setEnteredCode]   = useState("");
  const [registering,   setRegistering]   = useState(false);
  const [registerMsg,   setRegisterMsg]   = useState<{ ok: boolean; text: string } | null>(null);
  const { signMessageAsync } = useSignMessage();

  // Prefer window.location.origin for the link so it works on any deploy
  // (dev, staging, production). Falls back to API-provided link if window
  // is not available (SSR edge case — component is client-only but guard anyway).
  function buildLink(code: string): string {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://predixi-base.vercel.app";
    return `${origin}/?ref=${code}`;
  }

  useEffect(() => {
    if (!walletAddress) return;
    setLoading(true);
    fetch(`/api/referrals/me?wallet=${walletAddress}`)
      .then(r => r.json())
      .then((d: { ok: boolean } & Partial<ReferralData>) => {
        if (d.ok) {
          setData({
            referralCode:  d.referralCode  ?? null,
            referralLink:  d.referralLink  ?? null,
            referralCount: d.referralCount ?? 0,
            referralXp:    d.referralXp    ?? 0,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [walletAddress]);

  const handleRegister = useCallback(async () => {
    if (!walletAddress || !enteredCode.trim() || registering) return;
    setRegistering(true);
    setRegisterMsg(null);
    try {
      const code    = enteredCode.trim().toUpperCase();
      const nonce   = generateNonce();
      const message = buildPredixiAuthMessage(walletAddress, "referral-register", nonce);
      const signature = await signMessageAsync({ message });
      const res = await fetch("/api/referrals/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-message": encodeURIComponent(message),
          "x-wallet-signature": signature,
        },
        body: JSON.stringify({ referralCode: code }),
      });
      const json = await res.json() as { ok?: boolean; status?: string; error?: string };
      if (json.ok) {
        setRegisterMsg({ ok: true, text: json.status === "already_registered" ? "Already registered." : "Referral registered! +200 XP awarded to referrer." });
        setEnteredCode("");
      } else {
        const errorMap: Record<string, string> = {
          SELF_REFERRAL_NOT_ALLOWED:         "You can't use your own referral code.",
          ALREADY_REFERRED_BY_ANOTHER_USER:  "You're already referred by someone else.",
          ALREADY_ACTIVE_USER_CANNOT_BE_REFERRED: "Your account is too active to apply a referral code.",
          REFERRAL_CODE_NOT_FOUND:           "Referral code not found.",
          INVALID_REFERRAL_CODE:             "Invalid referral code format.",
        };
        setRegisterMsg({ ok: false, text: errorMap[json.error ?? ""] ?? (json.error ?? "Something went wrong.") });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("User rejected") || msg.includes("user rejected")) {
        setRegisterMsg({ ok: false, text: "Signature cancelled." });
      } else {
        setRegisterMsg({ ok: false, text: "Failed to register. Try again." });
      }
    } finally {
      setRegistering(false);
    }
  }, [walletAddress, enteredCode, registering, signMessageAsync]);

  const handleCopy = useCallback(() => {
    if (!data?.referralCode || copied) return;
    const link = buildLink(data.referralCode);
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Clipboard API not available (rare in Base App webview — try fallback)
      try {
        const el = document.createElement("textarea");
        el.value = link;
        el.style.position = "fixed";
        el.style.opacity  = "0";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch { /* silent */ }
    });
  }, [data, copied]);

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={cn(
        "relative overflow-hidden rounded-xl border px-4 py-4",
        "border-primary/15 bg-gradient-to-r from-primary/[0.06] to-transparent",
        "animate-pulse",
      )}>
        <div className="h-3 w-32 rounded bg-white/[0.07] mb-3" />
        <div className="h-8 w-full rounded-lg bg-white/[0.05] mb-3" />
        <div className="h-3 w-48 rounded bg-white/[0.04]" />
      </div>
    );
  }

  // ── No wallet / no data ────────────────────────────────────────────────────
  if (!walletAddress || !data) return null;

  const code = data.referralCode;
  const link = code ? buildLink(code) : null;

  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl border px-4 py-4 space-y-4",
      "border-primary/15 bg-gradient-to-r from-primary/[0.06] to-transparent",
    )}>
      {/* Top shimmer line */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users size={12} className="text-primary flex-shrink-0" />
          <p className="text-xs font-bold text-white/70">Referral Program</p>
        </div>
        {/* Stats chips */}
        {(data.referralCount > 0 || data.referralXp > 0) && (
          <div className="flex items-center gap-2">
            {data.referralCount > 0 && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                <Users size={8} className="text-primary/60" />
                <span className="text-[9px] font-mono text-primary/70 font-bold">
                  {data.referralCount} joined
                </span>
              </div>
            )}
            {data.referralXp > 0 && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                <Zap size={8} className="text-primary/60" />
                <span className="text-[9px] font-mono text-primary/70 font-bold">
                  +{data.referralXp} XP
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Referral link block ───────────────────────────────────────────── */}
      {code && link ? (
        <div className="space-y-2">
          {/* Code pill */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-white/30 uppercase tracking-widest">
              Your code
            </span>
            <span className="px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.09] text-xs font-mono font-black text-primary tracking-widest">
              {code}
            </span>
          </div>

          {/* Link row with copy button */}
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex-1 min-w-0 flex items-center gap-1.5 px-3 py-2 rounded-xl",
              "bg-white/[0.04] border border-white/[0.07]",
            )}>
              <Link2 size={10} className="text-white/25 flex-shrink-0" />
              <span className="text-[10px] font-mono text-white/40 truncate select-all">
                {link}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy referral link"
              className={cn(
                "flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl",
                "text-[10px] font-black tracking-wide transition-all duration-150",
                copied
                  ? "bg-green-500/15 border border-green-500/25 text-green-400"
                  : "bg-primary text-white shadow-[0_4px_14px_rgba(59,130,246,0.3)] hover:bg-primary/90 active:scale-95",
              )}
            >
              {copied ? (
                <><CheckCheck size={11} />Copied</>
              ) : (
                <><Copy size={11} />Copy</>
              )}
            </button>
          </div>
        </div>
      ) : (
        // Fallback when referral_code is null (profile not yet backfilled)
        <p className="text-[11px] font-mono text-white/30 py-1">
          Referral code is being prepared.
        </p>
      )}

      {/* ── Enter a referral code ─────────────────────────────────────────── */}
      {!data?.referralXp && (
        <div className="space-y-2 border-t border-white/[0.05] pt-3">
          <div className="flex items-center gap-1.5">
            <UserPlus size={11} className="text-white/40 flex-shrink-0" />
            <p className="text-[11px] text-white/40">Enter a friend&apos;s referral code</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={enteredCode}
              onChange={e => { setEnteredCode(e.target.value.toUpperCase()); setRegisterMsg(null); }}
              placeholder="XXXXXXXX"
              maxLength={10}
              className={cn(
                "flex-1 min-w-0 px-3 py-2 rounded-xl text-xs font-mono tracking-widest uppercase",
                "bg-white/[0.04] border border-white/[0.09] text-white placeholder:text-white/20",
                "focus:outline-none focus:border-primary/40 focus:bg-primary/[0.05]",
                "transition-colors duration-150",
              )}
            />
            <button
              type="button"
              onClick={handleRegister}
              disabled={!enteredCode.trim() || registering}
              className={cn(
                "flex-shrink-0 px-3 py-2 rounded-xl text-[10px] font-black tracking-wide transition-all duration-150",
                !enteredCode.trim() || registering
                  ? "bg-white/[0.05] border border-white/[0.07] text-white/20 cursor-not-allowed"
                  : "bg-primary text-white shadow-[0_4px_14px_rgba(59,130,246,0.3)] hover:bg-primary/90 active:scale-95",
              )}
            >
              {registering ? "…" : "Apply"}
            </button>
          </div>
          {registerMsg && (
            <p className={cn(
              "text-[10px] font-mono leading-tight",
              registerMsg.ok ? "text-green-400" : "text-red-400/80",
            )}>
              {registerMsg.text}
            </p>
          )}
        </div>
      )}

      {/* ── Explanation ───────────────────────────────────────────────────── */}
      <div className="space-y-1.5 pt-0.5 border-t border-white/[0.05]">
        <p className="text-[11px] text-white/50 leading-relaxed">
          Invite friends and earn{" "}
          <span className="text-primary font-bold">200 XP</span>{" "}
          when they join. You&apos;ll also receive{" "}
          <span className="text-primary font-bold">10%</span>{" "}
          of their future XP.
        </p>
        <p className="text-[9px] font-mono text-white/20 leading-relaxed">
          XP is a non-financial in-app score. It is not money, a token, or an airdrop promise.
        </p>
      </div>
    </div>
  );
}
