import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17212b",
        muted: "#6b7280",
        panel: "#f7f5ef",
        line: "#d8ded6",
        sage: "#6f8b76",
        clay: "#b86d4b",
        gold: "#dcae45",
        sky: "#5a91c9"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(23, 33, 43, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
