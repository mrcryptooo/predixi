"use client";
import dynamic from "next/dynamic";

// NeuralBrainCanvas uses Three.js / R3F — dynamic import with ssr:false is mandatory.
const NeuralBrainCanvas = dynamic(
  () => import("../brain/NeuralBrainCanvas").then((m) => ({ default: m.NeuralBrainCanvas })),
  { ssr: false },
);

// Deterministic probability floats — no random so SSR/hydration stays clean.
const PROB_NODES = [
  { id: "p1", left: "14%",  top: "27%", value: "YES 67.4%",   opacity: 0.40, dur: 4.2, delay: 0.0 },
  { id: "p2", left: "74%",  top: "31%", value: "NO  32.6%",   opacity: 0.30, dur: 5.0, delay: 1.3 },
  { id: "p3", left: "81%",  top: "54%", value: "Δ 0.74",      opacity: 0.22, dur: 4.6, delay: 2.1 },
  { id: "p4", left: "11%",  top: "57%", value: "P(Y) 0.813",  opacity: 0.18, dur: 5.8, delay: 0.8 },
  { id: "p5", left: "60%",  top: "19%", value: "σ 0.22",      opacity: 0.15, dur: 4.8, delay: 3.0 },
] as const;

interface Props {
  reduced: boolean;
}

export function Scene1NeuralBirth({ reduced }: Props) {
  return (
    <div className="absolute inset-0" aria-hidden="true">

      {/* ── Logo area ── */}
      <div
        id="s1-logo"
        className="absolute left-1/2 z-20 flex flex-col items-center gap-2"
        style={{ top: "5vh", transform: "translateX(-50%)" }}
      >
        <div
          className="w-12 h-12 rounded-2xl overflow-hidden flex items-center justify-center select-none"
          style={{
            background: "rgba(22,82,240,0.10)",
            border: "1px solid rgba(22,82,240,0.35)",
            boxShadow: "0 0 24px rgba(22,82,240,0.25)",
          }}
        >
          <span className="text-[#1652F0] font-black text-xl">A</span>
        </div>
        <span
          className="font-mono uppercase select-none"
          style={{ fontSize: 9, letterSpacing: "0.28em", color: "rgba(240,240,255,0.20)" }}
        >
          ArcMenta
        </span>
      </div>

      {/* ── Neural brain canvas — full-screen, pointer-events:none ── */}
      {/* GSAP fades #s1-orb-container out during Scene 1→2 handoff */}
      <div
        id="s1-orb-container"
        className="absolute"
        style={{ inset: 0 }}
      >
        <NeuralBrainCanvas reduced={reduced} />
      </div>

      {/* ── Floating probability values ── */}
      <div id="s1-probs" className="absolute inset-0 pointer-events-none select-none">
        {PROB_NODES.map((node) => (
          <div
            key={node.id}
            className="absolute font-mono tabular-nums"
            style={{
              left: node.left, top: node.top,
              fontSize: 11,
              color: `rgba(0,194,255,${node.opacity})`,
              animation: reduced
                ? "none"
                : `arc-prob-float ${node.dur}s ease-in-out infinite ${node.delay}s`,
            }}
          >
            {node.value}
          </div>
        ))}
      </div>

      {/* ── Scene 1 headline — GSAP reveals via scroll (starts hidden) ── */}
      <div
        id="s1-headline"
        className="absolute left-0 right-0 text-center pointer-events-none"
        style={{ bottom: "18%", opacity: 0, transform: "translateY(20px)" }}
      >
        <p
          className="font-black text-white leading-tight"
          style={{
            fontSize: "clamp(1.6rem, 3.5vw, 3.2rem)",
            letterSpacing: "-0.04em",
            textShadow: "0 0 40px rgba(22,82,240,0.30)",
          }}
        >
          The Mind of the Market.
        </p>
        <p
          className="font-mono uppercase mt-2"
          style={{ fontSize: 11, letterSpacing: "0.18em", color: "rgba(240,240,255,0.22)" }}
        >
          Prediction Intelligence · On-Chain
        </p>
      </div>

    </div>
  );
}
