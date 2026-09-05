import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#F7F8FC",
        surface: "#FFFFFF",
        ink: {
          DEFAULT: "#0B1226",
          soft: "#334155",
          muted: "#64748B",
          faint: "#94A3B8",
        },
        accent: {
          blue: "#2563EB",
          deep: "#1D4ED8",
          violet: "#7C3AED",
          purple: "#A855F7",
        },
        success: "#15803D",
        danger: "#DC2626",
        navy: {
          DEFAULT: "#0B1226",
          light: "#151D33",
        },
        lime: "#BEF264",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      borderRadius: {
        card: "16px",
        pill: "999px",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(11,18,38,0.05), 0 8px 24px -12px rgba(11,18,38,0.12)",
        lift: "0 2px 4px rgba(11,18,38,0.06), 0 16px 40px -16px rgba(11,18,38,0.22)",
      },
    },
  },
  plugins: [],
};
export default config;
