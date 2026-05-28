// Scene 4 — Live Prediction Markets
// First section after the cinematic sequence dissolves.
// Phase 1: structural skeleton with shimmer placeholders.
// Phase 2: replace skeleton cards with real MatchCard components + live data.

const SKELETON_CARDS = [
  { id: 1, opacity: 1.00, yesW: 62 },
  { id: 2, opacity: 0.85, yesW: 48 },
  { id: 3, opacity: 0.70, yesW: 71 },
  { id: 4, opacity: 0.55, yesW: 33 },
] as const;

export function Scene4Markets() {
  return (
    <div id="arc-scene4" className="min-h-screen relative" style={{ background: "#06080F" }}>

      {/* Subtle neural grid — same pattern as blueprint */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(22,82,240,1) 1px, transparent 1px), linear-gradient(90deg, rgba(22,82,240,1) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          opacity: 0.035,
        }}
      />

      {/* Top threshold — the visible seam where cinema ends and product begins */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[rgba(22,82,240,0.55)] to-transparent" />

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-16 space-y-10">

        {/* ── Brand bar ── */}
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0"
            style={{
              background: "rgba(22,82,240,0.10)",
              border: "1px solid rgba(22,82,240,0.32)",
              boxShadow: "0 0 16px rgba(22,82,240,0.18)",
            }}
          >
            {/* Phase 2: real logo */}
            <span className="text-[#1652F0] font-black text-sm select-none">A</span>
          </div>
          <div>
            <p className="font-black text-white leading-none" style={{ fontSize: 15, letterSpacing: "-0.02em" }}>
              ArcMenta
            </p>
            <p
              className="font-mono uppercase mt-0.5"
              style={{ fontSize: 9, letterSpacing: "0.15em", color: "rgba(240,240,255,0.28)" }}
            >
              Neural Prediction Markets
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
            <span className="font-mono" style={{ fontSize: 10, color: "rgba(240,240,255,0.28)" }}>
              Base Mainnet
            </span>
          </div>
        </div>

        {/* ── Section header ── */}
        <div className="flex items-center gap-3">
          <span
            className="flex-shrink-0 rounded-full"
            style={{ width: 3, height: 20, background: "#1652F0" }}
          />
          <span
            className="font-bold uppercase"
            style={{ fontSize: 11, letterSpacing: "0.14em", color: "rgba(240,240,255,0.45)" }}
          >
            Live Prediction Markets
          </span>
        </div>

        {/* ── Prediction market skeleton cards ──
            Phase 2: each card becomes a full MatchCard with live data + neural probability bar */}
        <div className="space-y-3">
          {SKELETON_CARDS.map((card) => (
            <div
              key={card.id}
              className="overflow-hidden transition-colors duration-200"
              style={{
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.07)",
                background: "linear-gradient(180deg, #0b0f2a 0%, #060810 100%)",
                opacity: card.opacity,
              }}
            >
              <div className="flex items-center gap-3 px-4 py-3.5">
                {/* Home team logo placeholder */}
                <div
                  className="flex-shrink-0 rounded-lg"
                  style={{ width: 32, height: 32, background: "rgba(255,255,255,0.05)" }}
                />
                {/* Match info */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div
                    className="rounded-full"
                    style={{ height: 10, width: "38%", background: "rgba(255,255,255,0.08)" }}
                  />
                  <div
                    className="rounded-full"
                    style={{ height: 8, width: "22%", background: "rgba(255,255,255,0.04)" }}
                  />
                </div>
                {/* Score / time placeholder */}
                <div className="flex-shrink-0 text-center space-y-1" style={{ width: 64 }}>
                  <div
                    className="rounded-md"
                    style={{ height: 20, background: "rgba(255,255,255,0.07)" }}
                  />
                </div>
                {/* Away team logo placeholder */}
                <div
                  className="flex-shrink-0 rounded-lg"
                  style={{ width: 32, height: 32, background: "rgba(255,255,255,0.05)" }}
                />
              </div>

              {/* Neural probability bar — YES (violet) vs NO (amber) */}
              <div className="h-[3px] flex">
                <div
                  style={{
                    width: `${card.yesW}%`,
                    background: "rgba(107,79,232,0.55)",
                    transition: "width 0.6s ease",
                  }}
                />
                <div
                  style={{
                    flex: 1,
                    background: "rgba(245,158,11,0.40)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <p
          className="text-center font-mono uppercase"
          style={{ fontSize: 9, letterSpacing: "0.15em", color: "rgba(240,240,255,0.10)", paddingTop: 16 }}
        >
          ArcMenta · Scene 4 · Phase 1 Scaffold
        </p>

      </div>
    </div>
  );
}
