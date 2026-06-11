/**
 * Global motion system — shared Framer Motion variants and transition presets.
 * Import from "@/lib/motion" in any page or component.
 */

import type { Variants, Transition } from "framer-motion";

// ─────────────────────────────────────────────────────────────────────────────
// Transition presets
// ─────────────────────────────────────────────────────────────────────────────

export const transSmooth: Transition = { duration: 0.32, ease: [0.25, 0.1, 0.25, 1] };
export const transSpring: Transition = { type: "spring", stiffness: 340, damping: 30 };
export const transFast:   Transition = { duration: 0.18, ease: "easeOut" };
export const transSlow:   Transition = { duration: 0.48, ease: "easeOut" };

// ─────────────────────────────────────────────────────────────────────────────
// Shared page/section entry variants
// ─────────────────────────────────────────────────────────────────────────────

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0, transition: transSmooth },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: transFast },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  show:   { opacity: 1, scale: 1, transition: transSpring },
};

// ─────────────────────────────────────────────────────────────────────────────
// Stagger container — wrap list items that should animate in sequence
// ─────────────────────────────────────────────────────────────────────────────

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.07,
      delayChildren:   0.05,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show:   { opacity: 1, y: 0, transition: transSmooth },
};

// ─────────────────────────────────────────────────────────────────────────────
// Page hero entrance (heavier, for full-width hero sections)
// ─────────────────────────────────────────────────────────────────────────────

export const heroEntrance: Variants = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: transSlow },
};

// ─────────────────────────────────────────────────────────────────────────────
// Card hover spring (use with whileHover prop)
// ─────────────────────────────────────────────────────────────────────────────

export const cardHover = { scale: 1.015, transition: transSpring };
export const buttonTap  = { scale: 0.97,  transition: transFast  };
