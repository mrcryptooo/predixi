// Scene 2 — Hemisphere Split
// Background CSS color wash + YES/NO labels + floating probability accents.
// The actual brain split is driven by GSAP → splitState → NeuralBrainScene.useFrame.
// All elements start opacity:0 — GSAP reveals them during Scene 2 scroll.

// Deterministic float positions — no Math.random() so SSR/hydration is stable.
const YES_FLOATS = [
  { id: "yf1", left: "4%",  top: "32%", value: "63.4%",    color: "rgba(107,79,232,0.38)", dur: 3.8, delay: 0.3 },
  { id: "yf2", left: "6%",  top: "52%", value: "P(Y) 0.81", color: "rgba(107,79,232,0.24)", dur: 4.5, delay: 1.2 },
  { id: "yf3", left: "18%", top: "24%", value: "σ 0.18",    color: "rgba(196,181,253,0.18)", dur: 5.1, delay: 2.0 },
  { id: "yf4", left: "24%", top: "70%", value: "Δ +0.31",   color: "rgba(107,79,232,0.20)", dur: 4.2, delay: 0.7 },
] as const;

const NO_FLOATS = [
  { id: "nf1", right: "4%",  top: "32%", value: "36.6%",    color: "rgba(245,158,11,0.38)", dur: 4.1, delay: 0.5 },
  { id: "nf2", right: "6%",  top: "52%", value: "P(N) 0.19", color: "rgba(245,158,11,0.24)", dur: 4.7, delay: 1.5 },
  { id: "nf3", right: "18%", top: "24%", value: "σ 0.29",    color: "rgba(253,211,77,0.18)",  dur: 5.3, delay: 2.3 },
  { id: "nf4", right: "24%", top: "70%", value: "Δ -0.31",   color: "rgba(245,158,11,0.20)", dur: 3.9, delay: 1.0 },
] as const;

export function Scene2HemisphereSplit() {
  return (
    <div className="absolute inset-0" aria-hidden="true">

      {/* ── Left hemisphere color wash (violet) ──
          Ambient glow layer — low opacity. The Three.js brain does the real split. */}
      <div
        id="s2-left-hemi"
        className="absolute"
        style={{
          width: 280, height: 280,
          left: "50%", top: "50%",
          marginLeft: -140, marginTop: -140,
          borderRadius: "50%",
          clipPath: "polygon(0 0, 50% 0, 50% 100%, 0 100%)",
          background:
            "radial-gradient(ellipse at 65% 42%, rgba(107,79,232,0.55) 0%, rgba(22,82,240,0.20) 48%, transparent 78%)",
          boxShadow: "-20px 0 50px rgba(107,79,232,0.12)",
          opacity: 0,
        }}
      />

      {/* ── Right hemisphere color wash (amber) ── */}
      <div
        id="s2-right-hemi"
        className="absolute"
        style={{
          width: 280, height: 280,
          left: "50%", top: "50%",
          marginLeft: -140, marginTop: -140,
          borderRadius: "50%",
          clipPath: "polygon(50% 0, 100% 0, 100% 100%, 50% 100%)",
          background:
            "radial-gradient(ellipse at 35% 42%, rgba(245,158,11,0.55) 0%, rgba(22,82,240,0.20) 48%, transparent 78%)",
          boxShadow: "20px 0 50px rgba(245,158,11,0.08)",
          opacity: 0,
        }}
      />

      {/* ── YES label ── */}
      <div
        id="s2-yes-label"
        className="absolute pointer-events-none select-none font-black"
        style={{
          left: "8%", top: "50%", marginTop: -72,
          fontSize: "clamp(3rem, 7.5vw, 8rem)",
          letterSpacing: "-0.05em", lineHeight: 1,
          background: "linear-gradient(135deg, #6B4FE8 0%, #c4b5fd 60%, #F0F0FF 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          opacity: 0,
        }}
      >
        YES
      </div>

      {/* ── NO label ── */}
      <div
        id="s2-no-label"
        className="absolute pointer-events-none select-none font-black"
        style={{
          right: "8%", top: "50%", marginTop: -72,
          fontSize: "clamp(3rem, 7.5vw, 8rem)",
          letterSpacing: "-0.05em", lineHeight: 1,
          background: "linear-gradient(135deg, #F59E0B 0%, #fcd34d 60%, #F0F0FF 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          opacity: 0,
        }}
      >
        NO
      </div>

      {/* ── YES probability stats ── */}
      <div
        id="s2-yes-prob"
        className="absolute font-mono pointer-events-none select-none"
        style={{ left: "8%", top: "60%", opacity: 0 }}
      >
        <p className="font-bold" style={{ fontSize: 13, color: "rgba(107,79,232,0.75)" }}>
          63.4%
        </p>
        <p
          className="uppercase mt-0.5"
          style={{ fontSize: 9, letterSpacing: "0.12em", color: "rgba(240,240,255,0.18)" }}
        >
          HIGH CONFIDENCE
        </p>
      </div>

      {/* ── NO probability stats ── */}
      <div
        id="s2-no-prob"
        className="absolute font-mono pointer-events-none select-none text-right"
        style={{ right: "8%", top: "60%", opacity: 0 }}
      >
        <p className="font-bold text-right" style={{ fontSize: 13, color: "rgba(245,158,11,0.75)" }}>
          36.6%
        </p>
        <p
          className="uppercase mt-0.5"
          style={{ fontSize: 9, letterSpacing: "0.12em", color: "rgba(240,240,255,0.18)" }}
        >
          LOW CONFIDENCE
        </p>
      </div>

      {/* ── YES side floating probability accents ── */}
      <div
        id="s2-yes-floats"
        className="absolute inset-0 pointer-events-none select-none"
        style={{ opacity: 0 }}
      >
        {YES_FLOATS.map((f) => (
          <div
            key={f.id}
            className="absolute font-mono tabular-nums"
            style={{
              left: f.left, top: f.top,
              fontSize: 10,
              color: f.color,
              animation: `arc-prob-float ${f.dur}s ease-in-out infinite ${f.delay}s`,
            }}
          >
            {f.value}
          </div>
        ))}
      </div>

      {/* ── NO side floating probability accents ── */}
      <div
        id="s2-no-floats"
        className="absolute inset-0 pointer-events-none select-none"
        style={{ opacity: 0 }}
      >
        {NO_FLOATS.map((f) => (
          <div
            key={f.id}
            className="absolute font-mono tabular-nums"
            style={{
              right: f.right, top: f.top,
              fontSize: 10,
              color: f.color,
              animation: `arc-prob-float ${f.dur}s ease-in-out infinite ${f.delay}s`,
            }}
          >
            {f.value}
          </div>
        ))}
      </div>

    </div>
  );
}
