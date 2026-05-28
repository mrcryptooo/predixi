"use client";

// Scene 3 — Choose Your Side
// GSAP targets: #s3-headline, #s3-sublabel, #s3-cta.
// Phase 2: replace headline entrance with character scramble (GSAP ScrambleText).
// CTA uses pointer-events-auto so it's clickable through the cinema overlay
// (the outer cinema shell has pointer-events:none).

export function Scene3ChooseYourSide() {
  function enterMarkets() {
    document.getElementById("arc-scene4")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-6"
      aria-hidden="true"
    >

      {/* ── Main headline ── */}
      <div
        id="s3-headline"
        className="text-center pointer-events-none select-none"
        style={{ opacity: 0, transform: "translateY(28px)" }}
      >
        <div
          className="font-black text-white"
          style={{
            fontSize: "clamp(2.8rem, 9vw, 10rem)",
            letterSpacing: "-0.04em",
            lineHeight: 0.92,
          }}
        >
          CHOOSE
        </div>
        <div
          className="font-black"
          style={{
            fontSize: "clamp(2.8rem, 9vw, 10rem)",
            letterSpacing: "-0.04em",
            lineHeight: 0.92,
            background: "linear-gradient(135deg, #1652F0 0%, #a8c0ff 55%, #F0F0FF 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          YOUR SIDE
        </div>
      </div>

      {/* ── Sub-label ── */}
      <div
        id="s3-sublabel"
        className="font-mono uppercase text-center pointer-events-none select-none"
        style={{
          fontSize: 10,
          letterSpacing: "0.22em",
          color: "rgba(240,240,255,0.25)",
          opacity: 0,
        }}
      >
        AI-Driven Prediction Markets
      </div>

      {/* ── CTA button ──
          pointer-events-auto so it fires even through the cinema overlay shell. */}
      <div
        id="s3-cta"
        style={{ opacity: 0, transform: "translateY(12px)" }}
      >
        <button
          type="button"
          className="pointer-events-auto flex items-center gap-2 font-semibold tracking-[0.08em] rounded-xl transition-[box-shadow,border-color,background] duration-300"
          style={{
            fontSize: 14,
            color: "rgba(240,240,255,0.92)",
            padding: "14px 32px",
            border: "1px solid rgba(22,82,240,0.45)",
            background: "transparent",
          }}
          onClick={enterMarkets}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.boxShadow = "0 0 28px rgba(22,82,240,0.28)";
            el.style.borderColor = "rgba(22,82,240,0.80)";
            el.style.background = "rgba(22,82,240,0.07)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.boxShadow = "none";
            el.style.borderColor = "rgba(22,82,240,0.45)";
            el.style.background = "transparent";
          }}
        >
          Enter the Market →
        </button>
      </div>

    </div>
  );
}
