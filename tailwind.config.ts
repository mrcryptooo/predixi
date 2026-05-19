import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // ── Brand ──────────────────────────────────────────────────────────
        primary: "#1652F0",          // PrediXI Blue / Blue Ribbon
        white:   "#FFFFFF",          // explicit brand white
        cyan:    "#00C2FF",
        purple:  "#7C3AED",
        // ── Semantic ───────────────────────────────────────────────────────
        success: "#22C55E",
        danger:  "#EF4444",
        warning: "#F59E0B",
        // ── Surfaces — blue-tinted dark glass ──────────────────────────────
        bg:            "#060810",    // deepest background
        surface:       "#0C0E1A",    // primary card surface, blue-tinted
        elevated:      "#131628",    // raised surface
        border:        "#1C2040",    // default border
        "border-bright":"#2A3060",  // hover/active border
        // ── Text ──────────────────────────────────────────────────────────
        "text-primary":   "#F0F0FF",
        "text-secondary": "#8B8FA8",
        "text-muted":     "#4A4D65",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      keyframes: {
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.8s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
