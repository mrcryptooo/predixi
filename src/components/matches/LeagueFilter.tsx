"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import { LeagueLogo } from "@/components/ui/LeagueLogo";
import type { League } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type LeagueFilterId = string | "all";

interface LeagueFilterProps {
  leagues:  League[];
  selected: LeagueFilterId;
  onChange: (id: LeagueFilterId) => void;
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function LeagueFilter({ leagues, selected, onChange, className }: LeagueFilterProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const tabs = [
    { id: "all" as const, logo: "🌐", shortName: "All" },
    ...leagues.map((l) => ({ id: l.id, logo: l.logo, shortName: l.shortName })),
  ];

  return (
    <div
      ref={scrollRef}
      className={cn(
        "flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1",
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === selected;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex-shrink-0 flex items-center gap-1.5 h-9 px-3.5 rounded-xl border text-xs font-semibold",
              "transition-all duration-150 whitespace-nowrap",
              isActive
                ? "bg-primary/15 border-primary/40 text-white shadow-[0_0_12px_rgba(22,82,240,0.14)]"
                : "bg-white/[0.04] border-white/[0.08] text-white/35 hover:border-primary/25 hover:text-white/60"
            )}
          >
            {tab.id === "all"
              ? <span className="text-sm leading-none">🌐</span>
              : <LeagueLogo leagueId={tab.id} size="xs" />
            }
            <span>{tab.shortName}</span>
          </button>
        );
      })}
    </div>
  );
}
