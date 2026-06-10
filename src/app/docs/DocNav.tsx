"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DocNavSection {
  id:    string;
  title: string;
  icon:  string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Desktop sticky sidebar nav
// ─────────────────────────────────────────────────────────────────────────────

export function DocsSidebarNav({ sections }: { sections: DocNavSection[] }) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? "");

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActive(id); },
        { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach(o => o.disconnect());
  }, [sections]);

  return (
    <nav className="sticky top-24 space-y-0.5">
      <p className="text-[9px] font-mono text-white/25 uppercase tracking-[0.14em] px-3 mb-3">
        Contents
      </p>
      {sections.map(({ id, title, icon }) => (
        <a
          key={id}
          href={`#${id}`}
          className={cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150",
            active === id
              ? "bg-primary/12 text-primary border border-primary/20"
              : "text-white/40 hover:text-white/70 hover:bg-white/[0.04] border border-transparent",
          )}
          onClick={() => setActive(id)}
        >
          <span className="text-sm leading-none">{icon}</span>
          {title}
        </a>
      ))}
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile collapsible TOC
// ─────────────────────────────────────────────────────────────────────────────

export function DocsMobileToc({ sections }: { sections: DocNavSection[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn(
      "lg:hidden mb-6 rounded-2xl border overflow-hidden",
      "border-white/[0.08] bg-gradient-to-b from-[#0b0f28] to-[#060810]",
    )}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3"
      >
        <span className="text-xs font-bold text-white/60 uppercase tracking-[0.12em]">
          Contents
        </span>
        {open ? (
          <ChevronUp size={14} className="text-white/30" />
        ) : (
          <ChevronDown size={14} className="text-white/30" />
        )}
      </button>

      {open && (
        <div className="px-3 pb-3 grid grid-cols-2 gap-1 border-t border-white/[0.06]">
          {sections.map(({ id, title, icon }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-white/45 hover:text-primary hover:bg-primary/8 transition-all duration-150"
            >
              <span className="text-sm leading-none">{icon}</span>
              {title}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
