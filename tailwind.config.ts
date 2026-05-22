import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1d1f24",
        line: "#d9ded6",
        sage: "#6b7d68",
        berry: "#8f3152",
        amber: "#c5832b",
        mist: "#f4f6f1"
      },
      boxShadow: {
        panel: "0 18px 45px rgba(29, 31, 36, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
