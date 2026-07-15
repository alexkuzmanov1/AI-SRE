import type { Config } from "tailwindcss";

/**
 * Design tokens from the Responder mockup. Colors are exposed both as CSS
 * variables (see app/globals.css) and as Tailwind theme colors so classes like
 * `bg-panel`, `text-muted`, `text-accent` resolve to the exact hex values.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--color-bg-rgb) / <alpha-value>)",
        panel: "rgb(var(--color-panel-rgb) / <alpha-value>)",
        border: {
          DEFAULT: "rgb(var(--color-border-rgb) / <alpha-value>)",
          subtle: "rgb(var(--color-border-subtle-rgb) / <alpha-value>)",
        },
        text: {
          DEFAULT: "rgb(var(--color-text-rgb) / <alpha-value>)",
          secondary: "rgb(var(--color-text-secondary-rgb) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "rgb(var(--color-muted-rgb) / <alpha-value>)",
          soft: "rgb(var(--color-muted-soft-rgb) / <alpha-value>)",
          faint: "rgb(var(--color-muted-faint-rgb) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--color-accent-rgb) / <alpha-value>)",
          hover: "rgb(var(--color-accent-hover-rgb) / <alpha-value>)",
        },
        success: {
          DEFAULT: "rgb(var(--color-success-rgb) / <alpha-value>)",
          hover: "rgb(var(--color-success-hover-rgb) / <alpha-value>)",
        },
        danger: "rgb(var(--color-danger-rgb) / <alpha-value>)",
        warning: "rgb(var(--color-warning-rgb) / <alpha-value>)",
        purple: "rgb(var(--color-purple-rgb) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-plex-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      keyframes: {
        pulseDot: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.45", transform: "scale(0.82)" },
        },
        pulseRing: {
          "0%": { boxShadow: "0 0 0 0 rgba(248,81,73,0.55)" },
          "70%": { boxShadow: "0 0 0 6px rgba(248,81,73,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(248,81,73,0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "pulse-dot": "pulseDot 1.6s ease-in-out infinite",
        "pulse-ring": "pulseRing 1.8s ease-out infinite",
        shimmer: "shimmer 1.6s linear infinite",
        "fade-in-up": "fadeInUp 0.28s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
