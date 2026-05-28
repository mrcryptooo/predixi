"use client";

// ArcHomePage — root orchestrator for the ArcMenta cinematic homepage.
//
// DOM structure (explained):
//
//   ┌─────────────────────────────────────────────────────┐
//   │  #arc-cinema-visual  (position:fixed, z:100)        │  ← always full-viewport
//   │   Scene1, Scene2, Scene3 visuals                    │  ← absolute inside
//   │   pointer-events:none (CTA child overrides to auto) │
//   └─────────────────────────────────────────────────────┘
//   ┌─────────────────────────────────────────────────────┐
//   │  #arc-scroll-spacer  (height: 400svh)               │  ← in normal flow
//   │   provides the scroll distance GSAP scrubs against  │
//   └─────────────────────────────────────────────────────┘
//   ┌─────────────────────────────────────────────────────┐
//   │  Scene4Markets  (normal flow, below spacer)         │  ← real product section
//   └─────────────────────────────────────────────────────┘
//
// The cinema layer is fixed and always covers the full viewport (z:100 > sidebar z:40).
// It dissolves away when scroll reaches the bottom of the spacer, revealing Scene 4.

import dynamic from "next/dynamic";
import { useReducedMotion } from "./hooks/useReducedMotion";
import { Scene1NeuralBirth } from "./scenes/Scene1NeuralBirth";
import { Scene2HemisphereSplit } from "./scenes/Scene2HemisphereSplit";
import { Scene3ChooseYourSide } from "./scenes/Scene3ChooseYourSide";
import { Scene4Markets } from "./scenes/Scene4Markets";

// ArcScrollDriver imports gsap/lenis — dynamically imported with ssr:false
// so GSAP's window access never runs server-side.
const ArcScrollDriver = dynamic(
  () => import("./ArcScrollDriver").then((m) => ({ default: m.ArcScrollDriver })),
  { ssr: false },
);

export function ArcHomePage() {
  const reduced = useReducedMotion();

  return (
    // arc-page-root: negates PageWrapper's pt-safe-header on mobile so the
    // cinema starts flush with the real viewport top (see globals.css).
    <div id="arc-root" className="arc-page-root relative">

      {/* ────────────────────────────────────────────────────────────────────
          Cinema visual layer — fixed overlay, always full-screen.
          z-index 100 sits above Sidebar (z:40) and MobileHeader (z:40).
          pointer-events:none lets scroll events pass through to the body
          so the scroll spacer below can accumulate scroll position.
          CTA inside Scene3 overrides to pointer-events:auto independently.
         ─────────────────────────────────────────────────────────────────── */}
      <div
        id="arc-cinema-visual"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          pointerEvents: "none",
          background: "#06080F",
          // willChange kept off by default — GSAP sets it before animating opacity.
        }}
      >
        {/* Void ambient — single top-edge glow line, locked during entire cinema */}
        <div
          style={{
            position: "absolute",
            top: 0, left: 0, right: 0,
            height: 1,
            background: "linear-gradient(90deg, transparent, rgba(22,82,240,0.65), transparent)",
          }}
        />

        {/* Deep space ambient particle field — static CSS dots, very low opacity */}
        <AmbientVoid />

        {/* Scene layers — all absolutely positioned, stacked in z-order */}
        <Scene1NeuralBirth reduced={reduced} />
        <Scene2HemisphereSplit />
        <Scene3ChooseYourSide />
      </div>

      {/* ────────────────────────────────────────────────────────────────────
          Scroll spacer — invisible, provides 400svh of scrollable height.
          GSAP's ScrollTrigger uses "top top" → "bottom top" of this element
          as the full scrub range for all three scenes + transition.
         ─────────────────────────────────────────────────────────────────── */}
      <div
        id="arc-scroll-spacer"
        aria-hidden="true"
        style={{ height: "400svh", width: "100%" }}
      />

      {/* ────────────────────────────────────────────────────────────────────
          Scene 4 — live prediction markets.
          Appears in normal document flow below the spacer.
          Becomes visible as the cinema dissolves at scroll progress ~0.75→1.0.
         ─────────────────────────────────────────────────────────────────── */}
      <Scene4Markets />

      {/* ── Behavior component (renders null) ── */}
      <ArcScrollDriver reduced={reduced} />

    </div>
  );
}

// ── Ambient void — static micro-dot starfield, pure CSS ──────────────────────
// Deterministic positions so SSR and hydration produce identical HTML.
const VOID_DOTS = [
  { l: "8%",  t: "12%", s: 1.0, o: 0.06 },
  { l: "23%", t: "7%",  s: 0.8, o: 0.04 },
  { l: "41%", t: "15%", s: 1.2, o: 0.05 },
  { l: "67%", t: "9%",  s: 0.9, o: 0.07 },
  { l: "88%", t: "18%", s: 1.1, o: 0.04 },
  { l: "5%",  t: "38%", s: 0.7, o: 0.05 },
  { l: "18%", t: "55%", s: 1.0, o: 0.06 },
  { l: "76%", t: "44%", s: 0.8, o: 0.05 },
  { l: "93%", t: "62%", s: 1.2, o: 0.04 },
  { l: "32%", t: "78%", s: 0.9, o: 0.06 },
  { l: "55%", t: "85%", s: 1.1, o: 0.05 },
  { l: "84%", t: "79%", s: 0.8, o: 0.04 },
] as const;

function AmbientVoid() {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {VOID_DOTS.map((d, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: d.l, top: d.t,
            width: d.s, height: d.s,
            background: "#F0F0FF",
            opacity: d.o,
          }}
        />
      ))}
    </div>
  );
}
