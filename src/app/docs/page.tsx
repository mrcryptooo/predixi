import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen, Zap, Star, Trophy, Users, CalendarDays,
  Globe, HelpCircle, Shield, ScrollText, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DocsSidebarNav, DocsMobileToc } from "./DocNav";
import type { DocNavSection } from "./DocNav";

// ─────────────────────────────────────────────────────────────────────────────
// Metadata
// ─────────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Docs — PrediXI",
  description:
    "Learn how PrediXI works. Predictions, XP, badges, Daily XI, leaderboards, World Cup Hub, and more.",
  openGraph: {
    title: "PrediXI Docs",
    description: "Everything you need to know about PrediXI — predictions, XP, Daily XI, and more.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Section registry — single source of truth for nav + content order
// ─────────────────────────────────────────────────────────────────────────────

export const DOC_SECTIONS: DocNavSection[] = [
  { id: "what-is-predixi",    title: "What is PrediXI",       icon: "⚡" },
  { id: "predictions",        title: "How Predictions Work",  icon: "🎯" },
  { id: "xp-system",          title: "XP System",             icon: "✨" },
  { id: "badges",             title: "Badges",                icon: "🏅" },
  { id: "leaderboards",       title: "Leaderboards",          icon: "🏆" },
  { id: "daily-xi",           title: "Daily XI",              icon: "🃏" },
  { id: "world-cup-hub",      title: "World Cup Hub",         icon: "⚽" },
  { id: "faq",                title: "FAQ",                   icon: "❓" },
  { id: "privacy",            title: "Privacy",               icon: "🔒" },
  { id: "rules",              title: "Rules",                 icon: "📋" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Reusable section wrapper
// ─────────────────────────────────────────────────────────────────────────────

function DocSection({
  id, title, icon: Icon, children,
}: {
  id:       string;
  title:    string;
  icon:     React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4 pt-2 pb-10 border-b border-white/[0.06] last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/12 border border-primary/22 flex items-center justify-center flex-shrink-0">
          <Icon size={16} className="text-primary" />
        </div>
        <h2 className="text-lg font-black text-white tracking-tight">{title}</h2>
      </div>
      <div className="space-y-3 text-sm text-white/60 leading-relaxed pl-0">
        {children}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable content primitives
// ─────────────────────────────────────────────────────────────────────────────

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-white/60 leading-relaxed">{children}</p>;
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="text-white/85 font-semibold">{children}</strong>;
}

function InfoCard({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <div className={cn(
      "relative rounded-xl border px-4 py-3.5 text-sm text-white/55 leading-relaxed",
      accent
        ? "border-primary/22 bg-primary/[0.06]"
        : "border-white/[0.07] bg-white/[0.02]",
    )}>
      {accent && <div className="absolute top-0 inset-x-0 h-px rounded-t-xl bg-gradient-to-r from-transparent via-primary/35 to-transparent" />}
      {children}
    </div>
  );
}

function XpRow({ label, xp }: { label: string; xp: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-white/[0.05] last:border-0">
      <span className="text-sm text-white/60">{label}</span>
      <span className="text-xs font-mono font-black text-primary tabular-nums">{xp}</span>
    </div>
  );
}

function FaqItem({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5 space-y-1.5">
      <p className="text-sm font-bold text-white/80">{q}</p>
      <p className="text-sm text-white/50 leading-relaxed">{children}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-bg text-text-primary font-sans">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10">

        {/* ── Page hero ─────────────────────────────────────────────────── */}
        <div className={cn(
          "relative overflow-hidden rounded-3xl mb-8",
          "border border-primary/25",
          "bg-gradient-to-br from-primary/12 via-[#070b22] to-bg",
        )}>
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="absolute -right-14 -top-14 w-52 h-52 rounded-full bg-primary opacity-[0.07] blur-3xl pointer-events-none" />
          <div className="relative z-10 p-6 sm:p-8 flex items-start gap-5">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
              <BookOpen size={22} className="text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Documentation</h1>
              <p className="text-sm text-white/40 font-mono mt-1">
                Everything you need to understand and master PrediXI.
              </p>
              <div className="flex items-center gap-1.5 mt-3">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse flex-shrink-0" />
                <span className="text-[10px] font-mono text-white/30">
                  Beta · Updated June 2026
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Layout: sidebar + content ─────────────────────────────────── */}
        <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-12">

          {/* Desktop sidebar nav */}
          <aside className="hidden lg:block">
            <DocsSidebarNav sections={DOC_SECTIONS} />
          </aside>

          {/* Content */}
          <div className="space-y-0 min-w-0">

            {/* Mobile TOC */}
            <DocsMobileToc sections={DOC_SECTIONS} />

            {/* ─────────────────────────────────────────────────────────── */}
            <DocSection id="what-is-predixi" title="What is PrediXI" icon={Zap}>
              <P>
                <Strong>PrediXI</Strong> is a Web3 football prediction platform built on{" "}
                <Strong>Base</Strong>. You predict match outcomes, build your Daily XI, compete on
                the leaderboard, and earn XP and badges — all connected to your crypto wallet.
              </P>
              <P>
                PrediXI is free to play. There are no entry fees and no pay-to-win mechanics.
                XP and rank are earned through prediction accuracy, streaks, and Daily XI
                performance.
              </P>
              <InfoCard accent>
                PrediXI is registered as a{" "}
                <Strong>Base Mini App</Strong> — it runs natively inside the Base App and
                Farcaster. Connect your wallet and predictions are tied to your on-chain identity.
              </InfoCard>
            </DocSection>

            {/* ─────────────────────────────────────────────────────────── */}
            <DocSection id="predictions" title="How Predictions Work" icon={CalendarDays}>
              <P>
                Browse upcoming matches on the <Strong>Matches</Strong> page. For each match,
                predict the result: <Strong>Home win</Strong>, <Strong>Draw</Strong>, or{" "}
                <Strong>Away win</Strong>. Predictions lock at kickoff.
              </P>

              <div className="rounded-xl border border-white/[0.07] overflow-hidden">
                <div className="px-4 py-2 border-b border-white/[0.07] bg-white/[0.02]">
                  <span className="text-[10px] font-mono text-white/30 uppercase tracking-[0.12em]">
                    Prediction outcomes
                  </span>
                </div>
                <div className="divide-y divide-white/[0.05]">
                  {[
                    ["Correct prediction", "Earn XP based on difficulty"],
                    ["Incorrect prediction", "No XP awarded, streak resets"],
                    ["Pending prediction", "Locked in, awaiting result"],
                  ].map(([label, desc]) => (
                    <div key={label} className="flex items-start gap-3 px-4 py-3">
                      <ChevronRight size={13} className="text-primary/50 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-white/75">{label}</p>
                        <p className="text-xs text-white/35 font-mono">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <P>
                Results are settled automatically after match completion. XP is credited to
                your account and your leaderboard position updates in real time.
              </P>
            </DocSection>

            {/* ─────────────────────────────────────────────────────────── */}
            <DocSection id="xp-system" title="XP System" icon={Star}>
              <P>
                XP (<Strong>Experience Points</Strong>) is the core progression currency in
                PrediXI. Earn XP for correct predictions, Daily XI performance, streaks, and
                special events. Your XP determines your rank tier and leaderboard position.
              </P>

              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 divide-y divide-white/[0.05]">
                <XpRow label="Correct match prediction"     xp="+20–50 XP" />
                <XpRow label="Daily XI — submitted"         xp="+5 XP"     />
                <XpRow label="Daily XI — scored (per player)" xp="+1–3 XP" />
                <XpRow label="Prediction streak bonus"      xp="+5–25 XP"  />
                <XpRow label="First prediction of the day"  xp="+2 XP"     />
                <XpRow label="Referral — new user joins"    xp="+50 XP"    />
              </div>

              <P>
                XP values are approximate and may vary by match difficulty, competition, and
                platform events. Exact XP earned is always shown in your{" "}
                <Link href="/profile" className="text-primary hover:text-white transition-colors">
                  XP Ledger
                </Link>
                .
              </P>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { tier: "Bronze",   min: "0",      color: "text-[#CD7F32]" },
                  { tier: "Silver",   min: "500",     color: "text-[#C0C0C0]" },
                  { tier: "Gold",     min: "2,000",   color: "text-[#FFD700]" },
                  { tier: "Platinum", min: "5,000",   color: "text-[#E5E4E2]" },
                  { tier: "Diamond",  min: "10,000",  color: "text-[#B9F2FF]" },
                  { tier: "Legend",   min: "20,000+", color: "text-primary"   },
                ].map(({ tier, min, color }) => (
                  <div key={tier} className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 text-center">
                    <p className={cn("text-sm font-black", color)}>{tier}</p>
                    <p className="text-[9px] font-mono text-white/30 mt-0.5">{min} XP</p>
                  </div>
                ))}
              </div>
            </DocSection>

            {/* ─────────────────────────────────────────────────────────── */}
            <DocSection id="badges" title="Badges" icon={Trophy}>
              <P>
                Badges are <Strong>soulbound NFTs</Strong> on Base — earned by reaching
                milestones in predictions, streaks, and XP. Once earned, badges are permanently
                linked to your wallet. They cannot be transferred or purchased.
              </P>

              <InfoCard accent>
                Badges are minted via the <Strong>PrediXIBadges</Strong> ERC-1155 contract on
                Base Mainnet. Minting is free — you only pay the Base network gas fee
                (typically under $0.01).
              </InfoCard>

              <P>
                Examples of badge categories:
              </P>
              <div className="space-y-1.5">
                {[
                  ["🔥 Streak badges",    "Awarded for prediction streaks (5, 10, 25 correct in a row)"],
                  ["🎯 Accuracy badges",  "Awarded for sustained high prediction accuracy"],
                  ["📊 Volume badges",    "Awarded for reaching prediction count milestones"],
                  ["⚡ Early Adopter",    "Awarded to users who joined during the beta season"],
                  ["🏆 Season badges",    "Awarded at season end based on final leaderboard position"],
                ].map(([title, desc]) => (
                  <div key={title as string} className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white/80">{title}</p>
                      <p className="text-xs text-white/40 font-mono mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <P>
                View your earned and locked badges in your{" "}
                <Link href="/profile" className="text-primary hover:text-white transition-colors">
                  Profile → Badge Collection
                </Link>
                .
              </P>
            </DocSection>

            {/* ─────────────────────────────────────────────────────────── */}
            <DocSection id="leaderboards" title="Leaderboards" icon={Users}>
              <P>
                The <Strong>Leaderboard</Strong> ranks all PrediXI users by total XP.
                Two views are available: <Strong>All-Time</Strong> (career XP) and{" "}
                <Strong>This Week</Strong> (XP earned in the current 7-day window).
              </P>

              <InfoCard accent>
                <Strong>World Cup 2026 Prize:</Strong> The top 11 users on the leaderboard at
                the end of FIFA World Cup 2026 (19 July 2026) each receive the{" "}
                <Strong>football jersey of their choice</Strong>.
              </InfoCard>

              <P>
                Leaderboard positions update in real time after each match settlement. Your
                position is always shown even if you are outside the top ranks — connect your
                wallet to see your standing.
              </P>
            </DocSection>

            {/* ─────────────────────────────────────────────────────────── */}
            <DocSection id="daily-xi" title="Daily XI" icon={CalendarDays}>
              <P>
                Every day, build your <Strong>Daily XI</Strong> — an 11-player squad picked
                from a rotating pool of World Cup players. Spin through player cards to fill
                each position: GK, RB, CB, CB, LB, RM, CM, CM, LM, ST, ST.
              </P>

              <P>
                Once all 11 slots are filled, submit your XI. After the day&apos;s matches
                complete, your XI is scored based on how your players performed. Top XI earns
                maximum XP.
              </P>

              <div className="rounded-xl border border-white/[0.07] overflow-hidden">
                <div className="px-4 py-2 bg-white/[0.02] border-b border-white/[0.07]">
                  <span className="text-[10px] font-mono text-white/30 uppercase tracking-[0.12em]">Positions</span>
                </div>
                <div className="px-4 py-3 flex flex-wrap gap-2">
                  {["GK","RB","CB","CB","LB","RM","CM","CM","LM","ST","ST"].map((pos, i) => (
                    <span key={i} className="px-2 py-1 rounded-lg bg-primary/10 border border-primary/20 text-[10px] font-mono font-bold text-primary">
                      {pos}
                    </span>
                  ))}
                </div>
              </div>

              <P>
                Your Daily XI is saved locally and synced to your account when you submit.
                You can only submit once per day — choose wisely.
              </P>
            </DocSection>

            {/* ─────────────────────────────────────────────────────────── */}
            <DocSection id="world-cup-hub" title="World Cup Hub" icon={Globe}>
              <P>
                The <Strong>World Cup Hub</Strong> is PrediXI&apos;s dedicated section for
                FIFA World Cup 2026. Make tournament predictions: group stage results, knockout
                outcomes, Golden Boot winner, and special fun picks.
              </P>

              <P>
                World Cup predictions are stored on your account and can optionally be anchored
                on Base as permanent on-chain proof. The WC Hub updates in real time as the
                tournament progresses.
              </P>

              <InfoCard>
                FIFA World Cup 2026 runs from <Strong>11 June</Strong> to{" "}
                <Strong>19 July 2026</Strong>, hosted across USA, Canada, and Mexico.
                104 matches across 16 venues.
              </InfoCard>

              <div className="flex gap-2 flex-wrap">
                <Link
                  href="/world-cup"
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-primary text-white shadow-[0_4px_16px_rgba(22,82,240,0.35)] hover:opacity-90 transition-all active:scale-[0.97]"
                >
                  Open World Cup Hub
                </Link>
              </div>
            </DocSection>

            {/* ─────────────────────────────────────────────────────────── */}
            <DocSection id="faq" title="FAQ" icon={HelpCircle}>
              <div className="space-y-3">
                <FaqItem q="Is PrediXI free to play?">
                  Yes. All predictions are completely free. There are no entry fees, no in-app
                  purchases, and no pay-to-win mechanics. XP is earned through skill and
                  consistency.
                </FaqItem>
                <FaqItem q="Do I need a wallet to use PrediXI?">
                  You can browse matches and the leaderboard without a wallet. To place
                  predictions, submit a Daily XI, earn XP, and mint badges, you need to
                  connect a wallet.
                </FaqItem>
                <FaqItem q="Which wallets are supported?">
                  Any EVM-compatible wallet that supports Base mainnet — including Coinbase
                  Wallet, MetaMask, and any wallet supported by the Base App.
                </FaqItem>
                <FaqItem q="When are match results settled?">
                  Results are typically settled within 30–60 minutes of the final whistle. XP
                  is credited automatically once settlement runs. You can track this in your
                  XP Ledger.
                </FaqItem>
                <FaqItem q="How are Daily XI players scored?">
                  Players are scored based on their in-match performance stats: goals, assists,
                  clean sheets, and minutes played. Scoring runs after each matchday.
                </FaqItem>
                <FaqItem q="How do I earn the World Cup 2026 jersey prize?">
                  Finish in the top 11 on the All-Time leaderboard by the end of FIFA World Cup
                  2026 (19 July 2026). The top 11 players each receive the football jersey of
                  their choice. Contact details will be requested at the time of prize
                  distribution.
                </FaqItem>
              </div>
            </DocSection>

            {/* ─────────────────────────────────────────────────────────── */}
            <DocSection id="privacy" title="Privacy" icon={Shield}>
              <P>
                PrediXI collects only what is necessary: your wallet address (for predictions
                and XP tracking), prediction history, and basic usage analytics.
              </P>
              <P>
                No personal information is required. Your wallet address is your identity.
                We do not sell or share data with third parties.
              </P>
              <P>
                Full details are in the{" "}
                <Link href="/privacy" className="text-primary hover:text-white transition-colors">
                  Privacy Policy
                </Link>
                {" "}and{" "}
                <Link href="/terms" className="text-primary hover:text-white transition-colors">
                  Terms of Service
                </Link>
                .
              </P>
            </DocSection>

            {/* ─────────────────────────────────────────────────────────── */}
            <DocSection id="rules" title="Rules" icon={ScrollText}>
              <P>
                PrediXI is a skill-based prediction platform. The following rules apply to all
                users:
              </P>
              <div className="space-y-1.5">
                {[
                  "One prediction per match per wallet address.",
                  "Predictions lock at match kickoff. No changes after kickoff.",
                  "One Daily XI submission per day per wallet.",
                  "XP manipulation, bot activity, or exploiting bugs results in account disqualification.",
                  "The leaderboard prize requires a valid wallet address on Base mainnet.",
                  "PrediXI reserves the right to void predictions on postponed or abandoned matches.",
                  "Predictions on cancelled matches are refunded (no XP deducted).",
                  "PrediXI is in beta. Rules may evolve with advance notice.",
                ].map((rule, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm text-white/55">
                    <span className="text-[10px] font-mono text-primary/60 w-5 flex-shrink-0 mt-0.5 tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {rule}
                  </div>
                ))}
              </div>
              <P>
                By using PrediXI, you agree to the{" "}
                <Link href="/terms" className="text-primary hover:text-white transition-colors">
                  Terms of Service
                </Link>
                .
              </P>
            </DocSection>

          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <footer className="text-center pb-6 pt-10">
          <p className="text-[10px] text-white/15 font-mono tracking-[0.14em] uppercase">
            PrediXI Docs · Beta · Base App Standard
          </p>
        </footer>

      </div>
    </main>
  );
}
