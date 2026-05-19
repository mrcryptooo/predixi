"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

const E = [0.22, 1, 0.36, 1] as const;

// Reliably show image — handles both cached (already complete) and fresh loads
function ImgReveal({
  src, className, style,
}: { src: string; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.complete && el.naturalWidth > 0) {
      el.style.opacity = "1";
    }
  }, []);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt="" aria-hidden="true"
      className={className}
      style={{ opacity: 0, transition: "opacity 0.7s ease", ...style }}
      onLoad={e  => { (e.target as HTMLImageElement).style.opacity = "1"; }}
      onError={e => { (e.target as HTMLImageElement).style.visibility = "hidden"; }}
    />
  );
}

// CSS football — white base + navy pentagon patches + blue glow
function Football({ size }: { size: number }) {
  return (
    <div style={{ width: size, height: size, filter: "drop-shadow(0 0 10px rgba(22,82,240,0.95)) drop-shadow(0 0 3px rgba(255,255,255,0.6))", flexShrink: 0 }}>
      <svg viewBox="0 0 40 40" width={size} height={size}>
        {/* Base */}
        <circle cx="20" cy="20" r="19" fill="#f0f4ff" />
        {/* Central pentagon */}
        <polygon points="20,11 25.9,15.5 23.6,22.5 16.4,22.5 14.1,15.5" fill="#0a1840" opacity="0.9" />
        {/* Top */}
        <polygon points="20,2 27,5.5 25.9,12.5 20,11 14.1,12.5 13,5.5" fill="#0a1840" opacity="0.75" />
        {/* Upper-right */}
        <polygon points="34,13 38,19 34,26 27.5,25 25.9,22.5 27,16.5" fill="#0a1840" opacity="0.75" />
        {/* Lower-right */}
        <polygon points="27.5,32 20,38 16,31.5 19,26.5 23.6,26.5 27,29" fill="#0a1840" opacity="0.75" />
        {/* Lower-left */}
        <polygon points="12.5,32 13,29 16.4,26.5 21,31.5 17,38" fill="#0a1840" opacity="0.75" />
        {/* Upper-left */}
        <polygon points="6,13 13,16.5 14.1,22.5 12.5,25 6,26 2,19" fill="#0a1840" opacity="0.75" />
        {/* Shine */}
        <ellipse cx="14" cy="13" rx="5" ry="3" fill="white" opacity="0.35" />
        {/* Rim */}
        <circle cx="20" cy="20" r="19" fill="none" stroke="rgba(22,82,240,0.35)" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

export function CinematicIntro() {
  function enter() {
    document.getElementById("home-main")?.scrollIntoView({ behavior: "smooth" });
  }

  // Ball size responsive to viewport
  const [ballSize, setBallSize] = useState(40);
  // How far above the slot the ball starts (off-screen)
  const [ballStartY, setBallStartY] = useState(-900);

  useEffect(() => {
    const update = () => {
      setBallSize(window.innerWidth >= 640 ? 56 : 38);
      setBallStartY(-(window.innerHeight + 100));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Ball fall delay: after title appears (2.2s) + small pause
  const ballDelay = 2.9;
  const ballDuration = 1.0;
  // Impact glow fires at ~75% of ball animation
  const glowDelay = ballDelay + ballDuration * 0.75;

  return (
    <section className="relative w-full min-h-[100dvh] overflow-hidden bg-black flex items-end justify-center">

      {/* ── Scene 1: Stadium ── */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0, scale: 1.08 }}
        animate={{ opacity: 1, scale: 1.02 }}
        transition={{ duration: 3, ease: [0.12, 0, 0.18, 1] }}
      >
        <ImgReveal
          src="/assets/cinematic-intro/stadium-background.webp"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
      </motion.div>

      {/* Vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/85 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/50 pointer-events-none" />

      {/* ── Fog overlay ── */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 0.55, x: 20 }}
        transition={{ duration: 6, ease: "easeInOut", delay: 0.5 }}
      >
        <ImgReveal
          src="/assets/cinematic-intro/fog-overlay.png"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ mixBlendMode: "screen" }}
        />
      </motion.div>

      {/* ── TOP BRAND TITLE ── */}
      <motion.div
        className="absolute top-0 inset-x-0 z-20 flex flex-col items-center pt-8 pointer-events-none"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: E, delay: 0.6 }}
      >
        <p
          className="text-[11px] sm:text-xs font-mono font-bold tracking-[0.35em] uppercase"
          style={{ color: "rgba(100,150,255,0.75)", textShadow: "0 0 20px rgba(22,82,240,0.6)" }}
        >
          PREDIXI · ONCHAIN FOOTBALL
        </p>
      </motion.div>

      {/* ── Scene 2: Player ── */}
      <motion.div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-xs sm:max-w-sm pointer-events-none"
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.4, ease: E, delay: 1.2 }}
      >
        {/* Blue rim glow */}
        <motion.div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-blue-500 pointer-events-none"
          style={{ filter: "blur(60px)" }}
          animate={{ opacity: [0.25, 0.5, 0.25], scale: [1, 1.1, 1] }}
          transition={{ duration: 3, ease: "easeInOut", repeat: Infinity, delay: 1.8 }}
        />
        {/* Breathing idle motion */}
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3.5, ease: "easeInOut", repeat: Infinity, delay: 2 }}
        >
          <ImgReveal
            src="/assets/cinematic-intro/anime-player-idle.png"
            className="relative z-10 w-full h-auto object-contain object-bottom"
            style={{
              maxHeight: "70dvh",
              filter: "drop-shadow(0 0 24px rgba(22,82,240,0.6))",
            }}
          />
        </motion.div>
      </motion.div>

      {/* ── PREDICT NOW + CTA ── */}
      <motion.div
        className="relative z-20 flex flex-col items-center gap-5 pb-14 px-6 text-center"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: E, delay: 2.2 }}
      >
        {/* Line 1 */}
        <h1
          className="text-5xl sm:text-7xl font-black tracking-tighter text-white leading-none"
          style={{ textShadow: "0 0 40px rgba(22,82,240,0.8), 0 0 80px rgba(22,82,240,0.4)" }}
        >
          PREDICT
        </h1>

        {/* Line 2: N [ball] W — inline flex so ball sits between letters */}
        <div
          className="flex items-center justify-center leading-none"
          style={{
            fontSize: "inherit",
            lineHeight: 1,
            // Match the h1 sizing
          }}
        >
          <span
            className="text-5xl sm:text-7xl font-black tracking-tighter text-white"
            style={{ textShadow: "0 0 40px rgba(22,82,240,0.8), 0 0 80px rgba(22,82,240,0.4)", lineHeight: 1 }}
          >
            N
          </span>

          {/* Ball slot — the "O" gap */}
          <span
            className="relative inline-flex items-center justify-center overflow-visible"
            style={{
              width: ballSize,
              height: ballSize,
              // Small horizontal margin to match letter-spacing feel
              marginInline: 2,
            }}
          >
            {/* Impact glow — flashes when ball lands */}
            <motion.span
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(22,82,240,0.9) 0%, transparent 70%)", filter: "blur(8px)" }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: [0, 1, 0], scale: [0.5, 1.6, 1] }}
              transition={{ duration: 0.5, delay: glowDelay, ease: "easeOut" }}
            />

            {/* Falling football — animates from off-screen into slot */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ y: ballStartY, opacity: 0 }}
              animate={{
                y: [ballStartY, 4, -3, 0],
                opacity: [0, 1, 1, 1],
              }}
              transition={{
                duration: ballDuration,
                delay: ballDelay,
                ease: "easeIn",
                times: [0, 0.75, 0.88, 1],
              }}
            >
              <Football size={ballSize} />
            </motion.div>
          </span>

          <span
            className="text-5xl sm:text-7xl font-black tracking-tighter text-white"
            style={{ textShadow: "0 0 40px rgba(22,82,240,0.8), 0 0 80px rgba(22,82,240,0.4)", lineHeight: 1 }}
          >
            W
          </span>
        </div>

        <motion.button
          type="button"
          onClick={enter}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          className="mt-2 px-8 py-3.5 rounded-2xl text-sm font-black tracking-widest uppercase text-white"
          style={{
            background: "linear-gradient(135deg, #1652F0, #2a6aff)",
            boxShadow: "0 0 40px rgba(22,82,240,0.6), 0 4px 20px rgba(22,82,240,0.4)",
          }}
        >
          Enter →
        </motion.button>
        <button
          type="button"
          onClick={enter}
          className="text-[10px] font-mono text-white/25 hover:text-white/50 transition-colors tracking-widest uppercase"
        >
          Skip
        </button>
      </motion.div>

    </section>
  );
}
