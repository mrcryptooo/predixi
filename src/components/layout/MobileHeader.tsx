"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ConnectWallet } from "@/components/wallet/ConnectWallet";
import { NotificationBell } from "@/components/notifications/NotificationBell";

// ─────────────────────────────────────────────────────────────────────────────
// Compact top header for mobile — shown on md:hidden
// Rendered via PageWrapper, hidden on desktop (md:hidden).
// ─────────────────────────────────────────────────────────────────────────────

interface MobileHeaderProps {
  className?: string;
}

export function MobileHeader({ className }: MobileHeaderProps) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <header
      className={cn("md:hidden fixed top-0 inset-x-0 z-40 border-b border-white/[0.07]", className)}
      style={{ background: "rgba(6,8,18,0.90)", backdropFilter: "saturate(180%) blur(20px)", WebkitBackdropFilter: "saturate(180%) blur(20px)" }}
    >
      {/* Bottom edge glow */}
      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent pointer-events-none" />
      {/* Status-bar safe-area spacer — fills the notch/dynamic island area
          in Base App / Coinbase Wallet embedded webview on notched iPhones.
          Zero height on non-notched devices and desktop. */}
      <div className="h-safe-top" />

      {/* Actual header bar — always 56px (h-14) tall */}
      <div className="flex items-center h-14 px-4 gap-3">

      {/* Logo */}
      <div className={cn(
        "w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 brand-glow",
        imgFailed && "bg-gradient-to-br from-primary to-[#0e3fb5]"
      )}>
        {imgFailed ? (
          <span className="text-white font-black text-sm select-none">P</span>
        ) : (
          <Image
            src="/brand/predixi-logo.png"
            alt="PrediXI"
            width={32}
            height={32}
            className="w-full h-full object-cover"
            onError={() => setImgFailed(true)}
            priority
          />
        )}
      </div>

      {/* Wordmark */}
      <span className="font-black text-base text-white tracking-tight leading-none">
        Predi<span className="text-gradient-brand">XI</span>
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Notifications */}
      <NotificationBell />

      {/* Wallet connect — compact */}
      <ConnectWallet compact />


      </div>{/* end header content row */}
    </header>
  );
}
