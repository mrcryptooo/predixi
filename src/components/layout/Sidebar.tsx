"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Home, CalendarDays, Trophy, Globe, User, Zap, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConnectWallet } from "@/components/wallet/ConnectWallet";
import { NotificationBell } from "@/components/notifications/NotificationBell";

// ─────────────────────────────────────────────────────────────────────────────
// Nav items
// ─────────────────────────────────────────────────────────────────────────────

const navItems = [
  { href: "/",            label: "Home",        icon: Home         },
  { href: "/matches",     label: "Matches",     icon: CalendarDays },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy       },
  { href: "/world-cup",   label: "World Cup",   icon: Globe        },
  { href: "/profile",     label: "Profile",     icon: User         },
];

// ─────────────────────────────────────────────────────────────────────────────
// Logo — uses real asset with CSS fallback if image fails
// ─────────────────────────────────────────────────────────────────────────────

function SidebarLogo() {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className={cn(
      "w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 brand-glow",
      imgFailed && "bg-gradient-to-br from-primary to-[#0e3fb5]"
    )}>
      {imgFailed ? (
        /* Fallback: bold P initial on brand gradient */
        <span className="text-white font-black text-sm select-none">P</span>
      ) : (
        <Image
          src="/brand/predixi-logo.png"
          alt="PrediXI"
          width={36}
          height={36}
          className="w-full h-full object-cover"
          onError={() => setImgFailed(true)}
          priority
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className={cn(
      "hidden md:flex flex-col fixed left-0 top-0 h-screen w-[220px] z-40",
      "glass-nav border-r border-white/[0.07]"
    )}>

      {/* ── Brand area ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/[0.07]">
        <SidebarLogo />
        <div className="min-w-0">
          <span className="font-black tracking-tight text-lg text-white leading-none block">
            Predi<span className="text-gradient-brand">XI</span>
          </span>
          <span className="text-[9px] font-mono text-text-muted tracking-widest uppercase leading-none">
            Base App
          </span>
        </div>
      </div>

      {/* ── Navigation ──────────────────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium",
                "transition-all duration-150",
                active
                  ? "bg-primary/[0.13] text-primary border border-primary/25 shadow-[0_0_16px_rgba(22,82,240,0.13)]"
                  : "text-white/45 hover:text-white/80 hover:bg-white/[0.05] border border-transparent"
              )}
            >
              {/* Active left accent bar */}
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full glow-accent-bar" />
              )}
              <Icon
                size={17}
                strokeWidth={active ? 2.5 : 2}
                className={cn(
                  "flex-shrink-0 transition-colors duration-150",
                  active ? "text-primary" : "text-text-muted"
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* ── Secondary nav ───────────────────────────────────────────────── */}
      <div className="px-3 pb-2 border-t border-white/[0.07] pt-3">
        <p className="text-[9px] font-mono text-white/30 uppercase tracking-[0.14em] px-3 mb-1.5">
          Resources
        </p>
        {[{ href: "/docs", label: "Docs", icon: BookOpen }].map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium",
                "transition-all duration-150",
                active
                  ? "bg-primary/[0.13] text-primary border border-primary/25"
                  : "text-white/45 hover:text-white/80 hover:bg-white/[0.05] border border-transparent"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full glow-accent-bar" />
              )}
              <Icon size={15} strokeWidth={active ? 2.5 : 2} className={cn("flex-shrink-0", active ? "text-primary" : "text-text-muted")} />
              {label}
            </Link>
          );
        })}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="px-4 py-4 border-t border-white/[0.07] space-y-3">
        {/* Wallet connect */}
        <ConnectWallet className="w-full justify-center" />

        {/* Notifications */}
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] text-text-muted font-mono">Notifications</span>
          <NotificationBell />
        </div>

        {/* Base App badge */}
        <div className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-xl",
          "bg-primary/8 border border-primary/20"
        )}>
          <Zap size={13} className="text-primary flex-shrink-0" />
          <div>
            <p className="text-[9px] font-mono text-text-muted leading-tight uppercase tracking-wider">Built for</p>
            <p className="text-[11px] font-bold text-primary leading-tight">Base App</p>
          </div>
        </div>
        {/* Network status */}
        <div className="flex items-center gap-1.5 px-1">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse flex-shrink-0" />
          <span className="text-[10px] text-text-muted font-mono">Base Mainnet</span>
        </div>
      </div>

    </aside>
  );
}
