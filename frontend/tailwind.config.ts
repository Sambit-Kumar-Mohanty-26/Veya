import type { Config } from "tailwindcss";

/** Tokens sampled directly from the VedaAI Figma file. */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#FF5623",
          soft: "#FFE9E2",
          tint: "#F4E4DA",
          ring: "#FFB19A"
        },
        ink: {
          DEFAULT: "#1A1A1A",
          soft: "#3D3D3D",
          muted: "#8A8A8A",
          faint: "#ABABAB",
          badge: "#555555"
        },
        surface: {
          DEFAULT: "#FFFFFF",
          page: "#F2F1F1",
          panel: "#F4F4F4",
          sunken: "#F0F0F0",
          list: "#F5F5F5",
          viewer: "#303030",
          control: "#444444"
        },
        line: {
          DEFAULT: "#E7E7E7",
          strong: "#D6D6D6"
        },
        mark: {
          full: "#3F9E29",
          "full-bg": "#EDF8EA",
          part: "#E08A1E",
          "part-bg": "#FFF5E6",
          none: "#E5533D",
          "none-bg": "#FFE9E2"
        },
        highlight: {
          DEFAULT: "#5CBF3F",
          border: "#67C549"
        }
      },
      borderRadius: {
        card: "14px",
        panel: "18px"
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 16, 16, 0.04), 0 1px 3px rgba(16, 16, 16, 0.03)",
        raised: "0 4px 16px rgba(16, 16, 16, 0.07)",
        pop: "0 8px 30px rgba(16, 16, 16, 0.12)"
      },
      fontFamily: {
        sans: ["var(--font-bricolage)", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
