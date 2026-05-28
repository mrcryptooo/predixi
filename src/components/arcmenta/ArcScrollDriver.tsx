"use client";

// ArcScrollDriver — pure behavior component (renders null).
// Owns all GSAP ScrollTrigger + Lenis initialization for the ArcMenta homepage.
// Targets DOM elements by ID so scene components remain decoupled.
//
// SCROLL MATH (spacer = 400svh, each scene = 100svh = 0.25 of total):
//   Timeline position 0→1 : Scene 1  (Neural Birth)
//   Timeline position 1→2 : Scene 2  (Hemisphere Split)
//   Timeline position 2→3 : Scene 3  (Choose Your Side)
//   Timeline position 3→4 : Transition (cinema dissolve → Scene 4)

import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { splitState } from "./brain/hemisphereGroupStore";

// Register once at module level (safe in "use client" — no window needed).
gsap.registerPlugin(ScrollTrigger);

interface Props {
  reduced: boolean;
}

export function ArcScrollDriver({ reduced }: Props) {
  useEffect(() => {
    // ── Reduced motion: skip cinema, show Scene 4 immediately ─────────────
    if (reduced) {
      const cinema = document.getElementById("arc-cinema-visual");
      if (cinema) {
        cinema.style.opacity = "0";
        cinema.style.pointerEvents = "none";
      }
      return;
    }

    // Reset split state (handles re-mount / HMR)
    splitState.progress = 0;

    // ── Lenis smooth scroll ───────────────────────────────────────────────
    const lenis = new Lenis({
      autoRaf: false,
      lerp: 0.10,
      smoothWheel: true,
      touchMultiplier: 2,
    });

    // Single RAF loop shared with GSAP — avoids two competing rAF calls.
    const onTick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);

    // Keep ScrollTrigger in sync with Lenis's virtual scroll position.
    const unsubScroll = lenis.on("scroll", () => ScrollTrigger.update());

    // ── Guard: spacer must exist before setting up triggers ───────────────
    const spacer = document.getElementById("arc-scroll-spacer");
    if (!spacer) {
      return () => {
        gsap.ticker.remove(onTick);
        unsubScroll();
        lenis.destroy();
        splitState.progress = 0;
      };
    }

    // ── Initial states — set before first paint to avoid flash ───────────
    gsap.set("#s1-headline", { opacity: 0, y: 20 });
    gsap.set(["#s2-left-hemi", "#s2-right-hemi"], { opacity: 0 });
    gsap.set(
      ["#s2-yes-label", "#s2-no-label", "#s2-yes-prob", "#s2-no-prob",
       "#s2-yes-floats", "#s2-no-floats"],
      { opacity: 0 },
    );
    gsap.set("#s3-headline", { opacity: 0, y: 28 });
    gsap.set(["#s3-sublabel", "#s3-cta"], { opacity: 0 });
    gsap.set("#s3-cta", { y: 12 });

    // ── Main scrub timeline ───────────────────────────────────────────────
    // Duration = 4 (one unit per scene). scrub: 1.2 → cinematic lag.
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: "#arc-scroll-spacer",
        start: "top top",
        end: "bottom top",
        scrub: 1.2,
        onUpdate: (self) => {
          const el = document.getElementById("arc-cinema-visual");
          if (!el) return;
          if (self.progress > 0.96) {
            if (el.style.pointerEvents !== "none") el.style.pointerEvents = "none";
          } else {
            if (el.style.pointerEvents === "none") el.style.pointerEvents = "";
          }
        },
      },
    });

    // ════════════════════════════════════════════════════════════════════════
    // SCENE 1 — Neural Birth  (timeline 0 → 1)
    // ════════════════════════════════════════════════════════════════════════

    // Headline fades in during the second half of Scene 1
    tl.fromTo(
      "#s1-headline",
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, ease: "power2.out", duration: 0.45 },
      0.55,
    );

    // ════════════════════════════════════════════════════════════════════════
    // SCENE 1 → SCENE 2 handoff  (timeline ~0.92 → 1.2)
    // CSS color-wash hemispheres materialize at low opacity (ambient glow only —
    // the Three.js brain does the real split now).
    // ════════════════════════════════════════════════════════════════════════

    tl.fromTo(
      "#s2-left-hemi",
      { opacity: 0 },
      { opacity: 0.40, ease: "power1.out", duration: 0.20 },
      0.92,
    );
    tl.fromTo(
      "#s2-right-hemi",
      { opacity: 0 },
      { opacity: 0.40, ease: "power1.out", duration: 0.20 },
      0.92,
    );

    // Headline exits as the split begins
    tl.to("#s1-headline", { opacity: 0, y: -10, ease: "power1.in", duration: 0.18 }, 1.0);

    // ════════════════════════════════════════════════════════════════════════
    // SCENE 2 — Hemisphere Split  (timeline 1 → 2)
    // ════════════════════════════════════════════════════════════════════════

    // Three.js brain split — GSAP animates splitState.progress, which
    // NeuralBrainScene reads in useFrame to drive group.position.x and
    // per-material color tinting.
    tl.to(splitState, { progress: 1, ease: "power2.inOut", duration: 1.0 }, 1.0);

    // CSS color-wash drifts apart in sync with the brain groups
    tl.to("#s2-left-hemi",  { x: -155, ease: "power2.inOut", duration: 1.0 }, 1.0);
    tl.to("#s2-right-hemi", { x:  155, ease: "power2.inOut", duration: 1.0 }, 1.0);

    // YES / NO labels + floating accents appear in the last 30% of Scene 2
    tl.fromTo(
      "#s2-yes-label",
      { opacity: 0, x: -8 },
      { opacity: 1, x: 0, ease: "power2.out", duration: 0.30 },
      1.70,
    );
    tl.fromTo(
      "#s2-no-label",
      { opacity: 0, x: 8 },
      { opacity: 1, x: 0, ease: "power2.out", duration: 0.30 },
      1.70,
    );
    tl.fromTo(
      "#s2-yes-floats",
      { opacity: 0 },
      { opacity: 1, ease: "power1.out", duration: 0.28 },
      1.70,
    );
    tl.fromTo(
      "#s2-no-floats",
      { opacity: 0 },
      { opacity: 1, ease: "power1.out", duration: 0.28 },
      1.70,
    );

    // Probability stats appear just after labels
    tl.fromTo(
      "#s2-yes-prob",
      { opacity: 0 },
      { opacity: 1, ease: "power1.out", duration: 0.18 },
      1.82,
    );
    tl.fromTo(
      "#s2-no-prob",
      { opacity: 0 },
      { opacity: 1, ease: "power1.out", duration: 0.18 },
      1.82,
    );

    // Brain canvas fades after the split is complete (2.0 → 2.28)
    tl.to("#s1-orb-container", { opacity: 0, ease: "power1.in", duration: 0.28 }, 2.0);

    // ════════════════════════════════════════════════════════════════════════
    // SCENE 2 → SCENE 3 handoff  (timeline 2.0 → 2.3)
    // ════════════════════════════════════════════════════════════════════════

    tl.to(
      ["#s2-yes-label", "#s2-no-label"],
      { opacity: 0, ease: "power1.in", duration: 0.22 },
      2.02,
    );
    tl.to(
      ["#s2-yes-prob", "#s2-no-prob", "#s2-yes-floats", "#s2-no-floats"],
      { opacity: 0, duration: 0.20 },
      2.02,
    );
    tl.to(["#s2-left-hemi", "#s2-right-hemi"], { opacity: 0, duration: 0.28 }, 2.0);

    // ════════════════════════════════════════════════════════════════════════
    // SCENE 3 — Choose Your Side  (timeline 2 → 3)
    // ════════════════════════════════════════════════════════════════════════

    tl.fromTo(
      "#s3-headline",
      { opacity: 0, y: 28 },
      { opacity: 1, y: 0, ease: "power3.out", duration: 0.50 },
      2.30,
    );
    tl.fromTo(
      "#s3-sublabel",
      { opacity: 0 },
      { opacity: 1, ease: "power1.out", duration: 0.28 },
      2.62,
    );
    tl.fromTo(
      "#s3-cta",
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, ease: "power2.out", duration: 0.28 },
      2.80,
    );

    // ════════════════════════════════════════════════════════════════════════
    // TRANSITION — Cinema dissolve  (timeline 3 → 4)
    // ════════════════════════════════════════════════════════════════════════

    tl.to("#s3-cta",      { opacity: 0, ease: "power1.in", duration: 0.25 }, 3.0);
    tl.to("#s3-headline", { opacity: 0, y: -12, ease: "power1.in", duration: 0.40 }, 3.10);
    tl.to("#s3-sublabel", { opacity: 0, duration: 0.30 }, 3.05);
    tl.to("#arc-cinema-visual", { opacity: 0, ease: "power2.in", duration: 1.0 }, 3.0);

    // ── Cleanup ──────────────────────────────────────────────────────────
    return () => {
      tl.kill();
      ScrollTrigger.getAll().forEach((t) => t.kill());
      gsap.ticker.remove(onTick);
      unsubScroll();
      lenis.destroy();
      splitState.progress = 0;
    };
  }, [reduced]);

  return null;
}
