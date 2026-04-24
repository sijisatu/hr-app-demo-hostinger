import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        surface: "var(--surface)",
        panel: "var(--panel)",
        panelAlt: "var(--panel-alt)",
        border: "var(--border)",
        text: "var(--text)",
        muted: "var(--muted)",
        primary: "var(--primary)",
        primarySoft: "var(--primary-soft)",
        accent: "var(--accent)",
        success: "var(--success)",
        danger: "var(--danger)",
        warning: "var(--warning)"
      },
      boxShadow: {
        soft: "0 24px 70px rgba(23, 44, 94, 0.12)"
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "sans-serif"],
        display: ["var(--font-sora)", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
