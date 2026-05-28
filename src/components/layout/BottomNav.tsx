"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, Trophy, Globe, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/",            label: "Home",     icon: Home         },
  { href: "/matches",     label: "Matches",  icon: CalendarDays },
  { href: "/leaderboard", label: "Board",    icon: Trophy       },
  { href: "/world-cup",   label: "WC 2026",  icon: Globe        },
  { href: "/profile",     label: "Profile",  icon: User         },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className={cn(
      "md:hidden fixed bottom-0 inset-x-0 z-40",
      "glass-nav border-t border-border"
    )}>
      {/* Mobile nav background */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/backgrounds/mobile-nav-bg.webp" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover object-bottom pointer-events-none" style={{ opacity: 0.45 }} loading="lazy" decoding="async" />
      <div className="flex items-stretch h-[60px] relative">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex-1 flex flex-col items-center justify-center gap-0.5",
                "transition-all duration-150 select-none",
                active ? "text-primary" : "text-text-muted hover:text-text-secondary"
              )}
            >
              {/* Active glow pill at top of item */}
              {active && (
                <span className="absolute top-0 inset-x-3 h-0.5 rounded-b-full bg-primary shadow-[0_0_8px_rgba(22,82,240,0.6)]" />
              )}

              <Icon
                size={20}
                strokeWidth={active ? 2.5 : 1.75}
                className={cn(
                  "transition-transform duration-150",
                  active && "-translate-y-px"
                )}
              />

              <span className={cn(
                "text-[10px] font-medium leading-none transition-colors duration-150",
                active ? "text-primary" : "text-text-muted"
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
