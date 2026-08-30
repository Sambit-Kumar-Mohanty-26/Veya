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
          /* Figma's Text/Primary and Text/Secondary Default - the body copy
             pair, distinct from the near-black used for headings. */
          primary: "#303030",
          secondary: "#5E5E5E",
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
        /* The sidebar is lit from the left, so it throws sideways onto the
           page as well as down - a purely vertical shadow leaves its right
           edge reading as a hard cut. */
        rail: "6px 0 24px rgba(16, 16, 16, 0.08), 0 4px 16px rgba(16, 16, 16, 0.05)",
        pop: "0 8px 30px rgba(16, 16, 16, 0.12)",
        /* The question-number discs lift off the list rather than sitting flat
           on it, and the selected one throws a warm glow rather than a grey. */
        badge: "0 4px 16px rgba(67, 67, 67, 0.1), 0 8px 8.8px rgba(134, 134, 134, 0.1)",
        "badge-brand": "0 8px 8.8px rgba(255, 121, 80, 0.1)"
      },
      fontFamily: {
        sans: ["var(--font-bricolage)", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      /* The loading heading's ramp travels across the word. Its gradient ends
         on the same grey it starts on, so a background twice the box width
         shifted by exactly one tile loops with no visible seam. */
      keyframes: {
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "0% 0" }
        },
        /* Scale only - the loader's stars carry their own opacities from the
           export, and animating opacity here would flatten them all to one. */
        twinkle: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(0.84)" }
        }
      },
      animation: {
        shimmer: "shimmer 3s linear infinite",
        twinkle: "twinkle 2.4s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
