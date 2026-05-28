import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Terms of Use — PrediXI",
  description: "PrediXI terms of use. Beta product disclaimer, XP policy, and usage rules.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-bg text-text-primary font-sans">
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16 space-y-8">

        {/* Header */}
        <div className={cn(
          "relative overflow-hidden rounded-3xl p-6 sm:p-8",
          "border border-primary/20",
          "bg-gradient-to-br from-primary/10 via-[#070b22] to-bg",
        )}>
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
              <FileText size={22} className="text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Terms of Use</h1>
              <p className="text-xs text-white/35 font-mono mt-0.5">Last updated: May 2026 · Beta</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-6 text-sm text-white/60 leading-relaxed">

          <Section title="Beta Product Disclaimer">
            <p>
              PrediXI is a beta-stage product. Features, rewards, scoring rules, and availability may
              change without notice. By using PrediXI you acknowledge that it is provided as-is, without
              warranties of any kind, and that functionality may be interrupted, modified, or discontinued
              at any time.
            </p>
          </Section>

          <Section title="Not Financial Advice">
            <p>
              PrediXI is a sports prediction game. Nothing on this platform constitutes financial advice,
              investment advice, or a recommendation to buy or sell any asset.
              Predicting football match outcomes is entertainment, not investment.
            </p>
          </Section>

          <Section title="XP Has No Monetary Value">
            <p>
              XP (experience points) earned on PrediXI represent in-app status and leaderboard ranking only.
              XP has no monetary value, cannot be exchanged for currency or cryptocurrency, and
              does not represent any financial instrument, security, or claim against PrediXI.
              Future terms may describe additional uses of XP, but no such uses exist today.
            </p>
          </Section>

          <Section title="No Gambling">
            <p>
              PrediXI is not a gambling platform. No real money is wagered. No real money is won or lost.
              Users predict match outcomes to earn XP points for entertainment and competition purposes only.
            </p>
          </Section>

          <Section title="Wallet Responsibility">
            <p>
              You are solely responsible for the security of your wallet, private keys, and seed phrases.
              PrediXI never requests, stores, or handles your private key or seed phrase.
              Any action signed by your wallet is your responsibility.
              Do not connect a wallet you do not own or control.
            </p>
          </Section>

          <Section title="Prohibited Conduct">
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Attempt to exploit, abuse, or manipulate the XP or leaderboard systems</li>
              <li>Submit predictions on behalf of wallets you do not own</li>
              <li>Use automated scripts or bots to submit predictions</li>
              <li>Attempt to forge, replay, or fabricate wallet signatures</li>
              <li>Interfere with the platform's infrastructure or API endpoints</li>
            </ul>
            <p className="mt-2">
              We reserve the right to exclude any wallet from the platform for violations at our discretion.
            </p>
          </Section>

          <Section title="Intellectual Property">
            <p>
              PrediXI, its design, branding, and code are the property of the PrediXI team.
              Football league names, club names, and crests are the property of their respective owners
              and are used for identification purposes only.
            </p>
          </Section>

          <Section title="Limitation of Liability">
            <p>
              To the fullest extent permitted by law, PrediXI and its team are not liable for any
              damages arising from your use of the platform, including but not limited to:
              lost XP, missed predictions, data loss during beta, or wallet interactions.
            </p>
          </Section>

          <Section title="Changes to Terms">
            <p>
              These terms may be updated as the product evolves. Continued use of PrediXI after
              changes are published constitutes acceptance of the updated terms.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions? Contact us at{" "}
              <span className="text-primary font-mono">support@predixi.app</span> or
              visit <a href="/support" className="text-primary underline underline-offset-2">/support</a>.
            </p>
          </Section>

        </div>

        {/* Footer */}
        <p className="text-[10px] text-white/15 font-mono text-center pb-6 tracking-[0.12em] uppercase">
          PrediXI · Terms of Use · Beta
        </p>

      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-bold text-white/80 tracking-wide">{title}</h2>
      <div className="text-sm text-white/55 leading-relaxed space-y-1">{children}</div>
    </section>
  );
}
