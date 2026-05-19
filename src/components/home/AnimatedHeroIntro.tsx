"use client";

import { useState, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Zap, Trophy, Users, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Asset paths ───────────────────────────────────────────────────────────────
const ASSETS = {
  hero:       "/assets/intro/home-cinematic-hero.webp",
  silhouette: "/assets/intro/player-silhouette.webp",
  lights:     "/assets/intro/stadium-lights-overlay.webp",
  particles:  "/assets/intro/particles-overlay.webp",
  glow:       "/assets/intro/glass-glow-overlay.webp",
  grid:       "/assets/intro/pitch-grid-overlay.webp",
} as const;

// ─── Lazy image layer ──────────────────────────────────────────────────────────
function AssetLayer({ src, className, style }: {
  src: string; className?: string; style?: React.CSSProperties;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={cn("absolute inset-0 pointer-events-none", className)} style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src} alt="" aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: visible ? 1 : 0, transition: "opacity 1.2s ease" }}
        onLoad={() => setVisible(true)}
      />
    </div>
  );
}

// ─── Headline ──────────────────────────────────────────────────────────────────
const HEADLINE = ["Predict.", "Compete.", "Earn."];
function Headline({ reduced }: { reduced: boolean }) {
  return (
    <h1 className="text-[3.2rem] sm:text-6xl font-black tracking-tight leading-[1.0] text-white text-center">
      {HEADLINE.map((word, i) => (
        <motion.span
          key={word}
          initial={{ opacity: 0, y: 48, filter: "blur(16px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{
            duration: reduced ? 0 : 0.75,
            ease: [0.22, 1, 0.36, 1],
            delay: reduced ? 0 : 0.2 + i * 0.18,
          }}
          className={cn(
            "inline-block mr-3",
            i === 2 && "text-transparent bg-clip-text bg-gradient-to-r from-primary to-[#7ba8ff]",
          )}
        >
          {word}
        </motion.span>
      ))}
    </h1>
  );
}

// ─── CSS spotlight beam ────────────────────────────────────────────────────────
function SpotlightBeam({ delay, left, angle }: { delay: number; left: string; angle: number }) {
  return (
    <motion.div
      className="absolute top-0 pointer-events-none"
      style={{
        left,
        width: 2,
        height: "70%",
        background: "linear-gradient(180deg, rgba(22,82,240,0.55) 0%, rgba(22,82,240,0.12) 60%, transparent 100%)",
        transformOrigin: "top center",
        rotate: angle,
        filter: "blur(8px)",
      }}
      initial={{ opacity: 0, scaleY: 0 }}
      animate={{ opacity: [0, 0.8, 0.5, 0.8, 0], scaleY: [0, 1, 1, 1, 1] }}
      transition={{ duration: 3, ease: "easeOut", delay, repeat: Infinity, repeatDelay: 9 }}
    />
  );
}

// ─── Floating glass UI card ────────────────────────────────────────────────────
function FloatingCard({
  icon, label, sub, delay, floatOffset, className,
}: {
  icon: React.ReactNode; label: string; sub: string;
  delay: number; floatOffset: [number, number]; className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.88 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay }}
      className={cn("absolute pointer-events-none z-[9]", className)}
    >
      <motion.div
        animate={{ y: [0, floatOffset[0], 0], x: [0, floatOffset[1], 0] }}
        transition={{ duration: 5 + delay, ease: "easeInOut", repeat: Infinity, delay: delay + 1 }}
        className={cn(
          "flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl",
          "bg-white/[0.07] border border-primary/25 backdrop-blur-md",
          "shadow-[0_0_20px_rgba(22,82,240,0.18),inset_0_1px_0_rgba(255,255,255,0.08)]",
        )}
      >
        <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <p className="text-[11px] font-black text-white leading-none">{label}</p>
          <p className="text-[9px] font-mono text-white/40 leading-none mt-0.5">{sub}</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Shimmer sweep overlay (CSS keyframe via inline style) ─────────────────────
function ShimmerButton({ onClick, reduced }: { onClick: () => void; reduced: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: reduced ? 0 : 0.65, ease: [0.22, 1, 0.36, 1], delay: reduced ? 0 : 0.55 }}
      className="relative"
    >
      {/* Outer glow pulse */}
      <motion.div
        className="absolute inset-0 rounded-2xl bg-primary"
        animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.08, 1] }}
        transition={{ duration: 2.5, ease: "easeInOut", repeat: Infinity }}
        style={{ filter: "blur(16px)" }}
      />
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "relative flex items-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-black tracking-wide overflow-hidden",
          "bg-primary text-white",
          "shadow-[0_0_48px_rgba(22,82,240,0.60),0_4px_24px_rgba(22,82,240,0.45)]",
          "hover:opacity-90 active:scale-[0.97] transition-all duration-150",
        )}
      >
        {/* Shimmer sweep */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.22) 50%, transparent 70%)",
          }}
          animate={{ x: ["-100%", "200%"] }}
          transition={{ duration: 1.8, ease: "easeInOut", repeat: Infinity, repeatDelay: 3 }}
        />
        <Zap size={14} />
        Start Predicting
      </button>
    </motion.div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export function AnimatedHeroIntro() {
  const scrollToContent = useCallback(() => {
    document.getElementById("home-main")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const reduced = useReducedMotion() ?? false;

  return (
    <section
      className={cn(
        "relative w-full overflow-hidden",
        "min-h-[88vh] sm:min-h-screen",
        "flex flex-col items-center justify-center",
      )}
      aria-label="PrediXI cinematic hero"
    >
      {/* ── L0: Dark base ── */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#020818] via-[#040c1e] to-[#060a1a]" />

      {/* ── L0b: Ambient orbs ── */}
      <motion.div
        className="absolute -top-24 left-1/2 -translate-x-1/2 w-[700px] h-72 rounded-full bg-primary pointer-events-none"
        style={{ filter: "blur(90px)" }}
        animate={{ opacity: [0.08, 0.16, 0.08], scale: [1, 1.07, 1] }}
        transition={{ duration: 6, ease: "easeInOut", repeat: Infinity }}
      />
      <motion.div
        className="absolute bottom-0 left-1/4 w-96 h-56 rounded-full bg-[#4d7ef7] pointer-events-none"
        style={{ filter: "blur(70px)" }}
        animate={{ opacity: [0.05, 0.11, 0.05] }}
        transition={{ duration: 8, ease: "easeInOut", repeat: Infinity, delay: 1.5 }}
      />
      <motion.div
        className="absolute bottom-0 right-1/4 w-72 h-44 rounded-full bg-primary pointer-events-none"
        style={{ filter: "blur(60px)" }}
        animate={{ opacity: [0.04, 0.09, 0.04] }}
        transition={{ duration: 7, ease: "easeInOut", repeat: Infinity, delay: 3 }}
      />

      {/* ── L1: Hero image — Ken Burns + infinite drift ── */}
      <motion.div
        className="absolute inset-0 pointer-events-none z-[1]"
        initial={{ opacity: 0, scale: 1.14 }}
        animate={{ opacity: 1, scale: 1.02 }}
        transition={{ duration: 16, ease: [0.12, 0, 0.18, 1] }}
      >
        <motion.div
          className="absolute inset-0"
          animate={{ x: [0, -8, 5, 0], y: [0, 4, -3, 0] }}
          transition={{ duration: 24, ease: "easeInOut", repeat: Infinity }}
        >
          <AssetLayer src={ASSETS.hero} />
        </motion.div>
      </motion.div>

      {/* Deep vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#020818]/75 via-[#020818]/20 to-[#020818]/90 z-[2] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#020818]/60 via-transparent to-[#020818]/60 z-[2] pointer-events-none" />

      {/* ── L2: Pitch grid ── */}
      <motion.div
        className="absolute inset-0 z-[3] pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.28, 0.22, 0.28] }}
        transition={{ duration: 4, ease: "easeOut", times: [0, 0.3, 0.6, 1], delay: 0.4, repeat: Infinity, repeatDelay: 12 }}
      >
        <AssetLayer src={ASSETS.grid} />
      </motion.div>

      {/* ── L3: Stadium lights sweep on at 0.4s ── */}
      <motion.div
        className="absolute inset-0 z-[4] pointer-events-none"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 0.6, y: 0 }}
        transition={{ duration: 1.2, ease: "easeOut", delay: 0.4 }}
      >
        <motion.div
          className="absolute inset-0"
          animate={{ y: [0, 12, -5, 0], opacity: [0.6, 0.75, 0.6] }}
          transition={{ duration: 13, ease: "easeInOut", repeat: Infinity, delay: 2 }}
        >
          <AssetLayer src={ASSETS.lights} style={{ mixBlendMode: "screen" }} />
        </motion.div>
      </motion.div>

      {/* ── L4: Glow — horizontal light sweep ── */}
      <motion.div
        className="absolute inset-0 z-[5] pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5, delay: 0.6 }}
      >
        <motion.div
          className="absolute inset-0"
          animate={{ x: [-24, 24, -24], opacity: [0.35, 0.5, 0.35] }}
          transition={{ duration: 17, ease: "easeInOut", repeat: Infinity }}
        >
          <AssetLayer src={ASSETS.glow} style={{ mixBlendMode: "screen" }} />
        </motion.div>
      </motion.div>

      {/* ── CSS Spotlight beams ── */}
      <div className="absolute inset-0 z-[5] pointer-events-none overflow-hidden">
        <SpotlightBeam left="25%" angle={-8}  delay={0.5} />
        <SpotlightBeam left="50%" angle={0}   delay={1.0} />
        <SpotlightBeam left="75%" angle={8}   delay={1.5} />
      </div>

      {/* ── L5: Particles — rise from 0.8s ── */}
      <motion.div
        className="absolute inset-0 z-[6] pointer-events-none"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 0.6, y: 0 }}
        transition={{ duration: 1.4, ease: "easeOut", delay: 0.8 }}
      >
        <motion.div
          className="absolute inset-0"
          animate={{ y: [0, -36, 0], x: [0, 8, 0] }}
          transition={{ duration: 19, ease: "easeInOut", repeat: Infinity }}
        >
          <AssetLayer src={ASSETS.particles} style={{ mixBlendMode: "screen" }} />
        </motion.div>
      </motion.div>

      {/* ── L6: Player silhouette — rises at 1.1s ── */}
      <motion.div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm z-[7] pointer-events-none"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 0.92 }}
        transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1], delay: 1.1 }}
      >
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 5.5, ease: "easeInOut", repeat: Infinity, delay: 3 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ASSETS.silhouette}
            alt="" aria-hidden="true"
            className="w-full h-auto object-contain object-bottom"
            style={{ maxHeight: "65vh" }}
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </motion.div>
      </motion.div>

      {/* ── Floating glass cards — hidden on mobile ── */}
      <div className="hidden sm:block">
        <FloatingCard
          icon={<Trophy size={12} className="text-primary" />}
          label="World Cup Picks"
          sub="21 predictions · 1,420 XP max"
          delay={reduced ? 0 : 1.0}
          floatOffset={[-8, 4]}
          className="left-[4%] top-[28%]"
        />
        <FloatingCard
          icon={<Users size={12} className="text-primary" />}
          label="Daily XI"
          sub="Pick your squad · 20 XP/day"
          delay={reduced ? 0 : 1.15}
          floatOffset={[-6, -3]}
          className="right-[4%] top-[32%]"
        />
        <FloatingCard
          icon={<Globe size={12} className="text-primary" />}
          label="Live Fixtures"
          sub="104 WC 2026 matches"
          delay={reduced ? 0 : 1.3}
          floatOffset={[-10, 5]}
          className="left-[5%] bottom-[22%]"
        />
      </div>

      {/* Top neon edge — pulses on */}
      <motion.div
        className="absolute top-0 inset-x-0 h-px z-[8] pointer-events-none"
        style={{ background: "linear-gradient(90deg, transparent, rgba(22,82,240,0.9), transparent)" }}
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: [0, 1, 0.6, 1, 0.6], scaleX: 1 }}
        transition={{ duration: 2, ease: "easeOut", delay: 0.3, opacity: { repeat: Infinity, repeatDelay: 5, duration: 3 } }}
      />

      {/* Bottom fade */}
      <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-bg to-transparent z-[8] pointer-events-none" />

      {/* ── Content z-10 — staged reveal from mount ── */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center max-w-2xl mx-auto">

        {/* Badge — 0.3s */}
        <motion.div
          initial={{ opacity: 0, y: -16, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: reduced ? 0 : 0.55, ease: [0.22, 1, 0.36, 1], delay: reduced ? 0 : 0.3 }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30 backdrop-blur-sm"
        >
          <Zap size={10} className="text-primary" />
          <span className="text-[10px] font-mono font-bold text-primary/90 tracking-wider uppercase">
            On-chain football predictions · Base
          </span>
        </motion.div>

        {/* Headline — words stagger from 0.5s */}
        <Headline reduced={reduced} />

        {/* Tagline — 1.0s */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.6, ease: "easeOut", delay: reduced ? 0 : 1.0 }}
          className="text-base sm:text-lg text-white/45 font-medium leading-relaxed max-w-md"
        >
          Predict. Play. Win.
        </motion.p>

        {/* Stat chips — 1.2s, staggered */}
        <div className="flex items-center gap-3 flex-wrap justify-center">
          {[
            { label: "104 Matches",  sub: "World Cup 2026"      },
            { label: "21 WC Picks",  sub: "Special predictions"  },
            { label: "Daily XI",     sub: "Pick your squad"      },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, scale: 0.85, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{
                duration: reduced ? 0 : 0.5,
                ease: [0.22, 1, 0.36, 1],
                delay: reduced ? 0 : 1.2 + i * 0.1,
              }}
              className="px-3.5 py-2 rounded-xl bg-white/[0.07] border border-white/[0.12] backdrop-blur-sm"
            >
              <p className="text-xs font-black text-white leading-none">{item.label}</p>
              <p className="text-[9px] font-mono text-white/35 leading-none mt-0.5">{item.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* CTA — 0.55s */}
        <div className="flex flex-col items-center gap-3">
          <ShimmerButton onClick={scrollToContent} reduced={reduced} />
          <motion.button
            type="button"
            onClick={scrollToContent}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduced ? 0 : 0.5, delay: reduced ? 0 : 1.6 }}
            className="flex flex-col items-center gap-1 text-white/25 hover:text-white/55 transition-colors duration-200"
            aria-label="Scroll to content"
          >
            <span className="text-[10px] font-mono tracking-widest uppercase">Explore</span>
            <motion.div
              animate={{ y: [0, 7, 0] }}
              transition={{ duration: 1.6, ease: "easeInOut", repeat: Infinity }}
            >
              <ChevronDown size={16} />
            </motion.div>
          </motion.button>
        </div>

      </div>
    </section>
  );
}
