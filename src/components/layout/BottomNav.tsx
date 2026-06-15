"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, Trophy, Globe, User, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/",            label: "Home",     icon: Home         },
  { href: "/matches",     label: "Matches",  icon: CalendarDays },
  { href: "/spin",        label: "Spin",     icon: Sparkles     },
  { href: "/leaderboard", label: "Board",    icon: Trophy       },
  { href: "/world-cup",   label: "WC 2026",  icon: Globe        },
  { href: "/profile",     label: "Profile",  icon: User         },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className={cn(
      "md:hidden fixed bottom-0 inset-x-0 z-40",
      "glass-nav border-t border-white/[0.07]",
    )}>
      {/* Mobile nav background */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/backgrounds/mobile-nav-bg.webp" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover object-bottom pointer-events-none" style={{ opacity: 0.35 }} loading="lazy" decoding="async" />
      {/* Subtle top gradient */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent pointer-events-none" />
      <div className="flex items-stretch h-[60px] relative">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex-1 flex flex-col items-center justify-center gap-[3px]",
                "transition-all duration-200 select-none",
                active ? "text-primary" : "text-white hover:text-white/80"
              )}
            >
              {/* Active glow pill at top of item */}
              {active && (
                <span className="absolute top-0 inset-x-3 h-[2.5px] rounded-b-full bg-gradient-to-r from-primary/60 via-primary to-primary/60 shadow-[0_0_12px_rgba(22,82,240,0.85),0_0_5px_rgba(22,82,240,0.60)]" />
              )}

              {/* Active background swatch */}
              {active && (
                <span className="absolute inset-x-1 inset-y-2 rounded-xl bg-primary/[0.10] pointer-events-none" />
              )}

              <Icon
                size={22}
                strokeWidth={active ? 2.5 : 2}
                className={cn(
                  "relative z-10 transition-all duration-200",
                  active ? "scale-[1.10] drop-shadow-[0_0_12px_rgba(22,82,240,0.95)]" : "",
                )}
              />

              <span className={cn(
                "relative z-10 text-[10px] leading-none font-medium transition-all duration-200",
                active ? "text-primary font-bold tracking-wide" : "",
              )}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* iOS safe area spacer */}
      <div className="h-safe-bottom" />
    </nav>
  );
}
