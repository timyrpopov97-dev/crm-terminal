/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./lib/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        term: {
          bg: "#060a08",
          panel: "#0c1310",
          border: "#1d3226",
          borderBright: "#254a34",
          accent: "#00ff6a",
          accentSoft: "#0e2318",
          cyan: "#39fff0",
          danger: "#ff4757",
          text: "#c9ffdd",
          muted: "#5c8a71",
        },
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
