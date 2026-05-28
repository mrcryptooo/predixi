import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Privacy Policy — PrediXI",
  description: "PrediXI privacy policy. Learn what data we collect and how we use it.",
};

export default function PrivacyPage() {
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
              <Shield size={22} className="text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Privacy Policy</h1>
              <p className="text-xs text-white/35 font-mono mt-0.5">Last updated: May 2026 · Beta</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-6 text-sm text-white/60 leading-relaxed">

          <Section title="About PrediXI">
            <p>
              PrediXI is a beta-stage Web3 football prediction platform built for Base App and Coinbase Smart Wallet.
              By using PrediXI you agree to the terms described in this policy.
              As a beta product, this policy may be updated as the app evolves.
            </p>
          </Section>

          <Section title="What We Collect">
            <p>We collect and store the following data when you use PrediXI:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Your wallet address (used as your user identity — no username or email required)</li>
              <li>Predictions you submit (match ID, predicted outcome, timestamp)</li>
              <li>XP events associated with your wallet (points earned, source, timestamp)</li>
              <li>Prediction commitment hashes (tamper-evident fingerprints of your predictions)</li>
              <li>Activity metadata (streak count, total predictions, accuracy)</li>
            </ul>
          </Section>

          <Section title="What We Do Not Collect">
            <ul className="list-disc pl-5 space-y-1">
              <li>We do not collect your name, email address, phone number, or any personal identifiers</li>
              <li>We do not collect or store your private key, seed phrase, or wallet credentials — ever</li>
              <li>We do not request access to your wallet beyond signing prediction messages</li>
              <li>We do not collect payment card details or banking information</li>
              <li>We do not use advertising trackers or third-party analytics SDKs</li>
            </ul>
          </Section>

          <Section title="How We Use Your Data">
            <ul className="list-disc pl-5 space-y-1">
              <li>To record and display your predictions and activity history</li>
              <li>To calculate your XP balance and leaderboard position</li>
              <li>To verify prediction authenticity via wallet signatures</li>
              <li>To operate the platform and detect abuse</li>
            </ul>
          </Section>

          <Section title="Wallet Signatures">
            <p>
              When you submit a prediction, PrediXI asks your wallet to sign a message.
              This signature proves you own the wallet without exposing your private key.
              The signed message contains only: your wallet address, the match ID, your predicted outcome,
              and a timestamp. We verify this server-side on Base mainnet.
            </p>
          </Section>

          <Section title="Data Storage">
            <p>
              Your data is stored in Supabase (a managed PostgreSQL database) with server-side access controls.
              Your wallet address is the only identifier linking your activity to you.
              We do not sell, rent, or share your data with third parties.
            </p>
          </Section>

          <Section title="Beta Disclaimer">
            <p>
              PrediXI is in beta. Data may be reset, migrated, or deleted as part of development.
              We make no guarantee of permanent data retention during the beta period.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about this policy? Contact us at{" "}
              <span className="text-primary font-mono">support@predixi.app</span> or
              visit <a href="/support" className="text-primary underline underline-offset-2">/support</a>.
            </p>
          </Section>

        </div>

        {/* Footer */}
        <p className="text-[10px] text-white/15 font-mono text-center pb-6 tracking-[0.12em] uppercase">
          PrediXI · Privacy Policy · Beta
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
