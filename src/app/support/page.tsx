import { LifeBuoy, Bug, MessageSquare, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Support — PrediXI",
  description: "Get help with PrediXI. Report bugs, ask questions, and contact the team.",
};

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-bg text-text-primary font-sans">
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16 space-y-6">

        {/* Header */}
        <div className={cn(
          "relative overflow-hidden rounded-3xl p-6 sm:p-8",
          "border border-primary/20",
          "bg-gradient-to-br from-primary/10 via-[#070b22] to-bg",
        )}>
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
              <LifeBuoy size={22} className="text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Support</h1>
              <p className="text-xs text-white/35 font-mono mt-0.5">
                PrediXI Beta · <a href="https://predixi.xyz" className="text-primary/60 hover:text-primary transition-colors">predixi.xyz</a>
              </p>
            </div>
          </div>
        </div>

        {/* Cards */}
        <div className="grid gap-4 sm:grid-cols-2">

          {/* Bug reports */}
          <SupportCard
            icon={<Bug size={18} className="text-danger/70" />}
            title="Report a Bug"
            description="Found something broken? Let us know and we'll investigate."
            action="Email us"
            href="mailto:support@predixi.app?subject=Bug Report — PrediXI"
          />

          {/* General contact */}
          <SupportCard
            icon={<MessageSquare size={18} className="text-primary" />}
            title="General Questions"
            description="Questions about predictions, XP, wallets, or the leaderboard?"
            action="Contact support"
            href="mailto:support@predixi.app?subject=PrediXI Support"
          />

        </div>

        {/* FAQ */}
        <div className={cn(
          "rounded-2xl border border-white/[0.07]",
          "bg-gradient-to-b from-[#0b0f28] to-[#060810]",
          "p-5 sm:p-6 space-y-5",
        )}>
          <h2 className="text-sm font-bold text-white/80 tracking-wide">Frequently Asked Questions</h2>

          <div className="space-y-4">
            <FAQ
              q="How do I submit a prediction?"
              a="Connect your wallet on the Matches page, select a match before kickoff, choose your predicted outcome (Home / Draw / Away), and sign the message with your wallet. Your prediction is locked once kickoff passes."
            />
            <FAQ
              q="What is XP?"
              a="XP (experience points) are earned for correct predictions. XP determines your leaderboard rank and streak. XP has no monetary value — it is purely an in-app score."
            />
            <FAQ
              q="Why do I need to sign a message?"
              a="Wallet signatures prove you own the wallet address making the prediction. No private key is ever shared — only a signed message. This is standard EIP-191 signing, the same mechanism used across Web3 apps."
            />
            <FAQ
              q="My prediction shows as pending — is that normal?"
              a="Yes. Predictions stay pending until the match result is settled by the admin. Settlement happens after the final whistle. Check back after the match ends."
            />
            <FAQ
              q="Which wallets are supported?"
              a="Coinbase Smart Wallet, Base Account (ERC-6492), and any standard EOA wallet (MetaMask, Rainbow, etc.) on Base mainnet."
            />
            <FAQ
              q="Is PrediXI available on mobile?"
              a="Yes. PrediXI is optimised for mobile and works inside Base App and Coinbase Wallet's in-app browser. Add it to your home screen for the best experience."
            />
            <FAQ
              q="Is this a gambling app?"
              a="No. PrediXI is a sports prediction game. No real money is wagered or won. All rewards are XP points for in-app leaderboard ranking only."
            />
          </div>
        </div>

        {/* Links */}
        <div className={cn(
          "rounded-2xl border border-white/[0.07]",
          "bg-gradient-to-b from-[#0b0f28] to-[#060810]",
          "p-5 space-y-3",
        )}>
          <h2 className="text-sm font-bold text-white/80 tracking-wide">Links</h2>
          <div className="flex flex-wrap gap-3">
            <LegalLink href="/privacy" label="Privacy Policy" />
            <LegalLink href="/terms" label="Terms of Use" />
            <LegalLink href="https://predixi.xyz" label="App" external />
          </div>
        </div>

        <p className="text-[10px] text-white/15 font-mono text-center pb-6 tracking-[0.12em] uppercase">
          PrediXI · Support · Beta
        </p>

      </div>
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SupportCard({
  icon, title, description, action, href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className={cn(
        "block rounded-2xl border border-white/[0.07] p-5",
        "bg-gradient-to-b from-[#0b0f28] to-[#060810]",
        "hover:border-primary/30 transition-colors duration-150",
        "space-y-3",
      )}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-semibold text-white/80">{title}</span>
      </div>
      <p className="text-xs text-white/40 leading-relaxed">{description}</p>
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
        {action} <ExternalLink size={11} />
      </span>
    </a>
  );
}

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <div className="space-y-1 border-b border-white/[0.05] pb-4 last:border-0 last:pb-0">
      <p className="text-xs font-semibold text-white/70">{q}</p>
      <p className="text-xs text-white/40 leading-relaxed">{a}</p>
    </div>
  );
}

function LegalLink({ href, label, external }: { href: string; label: string; external?: boolean }) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className={cn(
        "inline-flex items-center gap-1",
        "text-xs font-mono text-white/35 hover:text-primary transition-colors duration-150",
        "px-3 py-1.5 rounded-lg border border-white/[0.07] hover:border-primary/25",
      )}
    >
      {label}
      {external && <ExternalLink size={10} />}
    </a>
  );
}
