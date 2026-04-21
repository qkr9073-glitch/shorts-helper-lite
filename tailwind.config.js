/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#f5f6fa",
          field: "#ffffff",
          statusbar: "#f0f2f8",
          tip: "#fff8e1",
          mega: "#fff4d6",
        },
        borderc: {
          base: "#e4e7ef",
          gold: "#c8860a",
        },
        gold: {
          DEFAULT: "#c8860a",
          bright: "#e8a928",
          mega: "#c8760a",
          tip: "#8a6500",
        },
        ink: "#1f2540",
        "ink-muted": "#5a6380",
        "ink-soft": "#8a92aa",
      },
      fontFamily: {
        sans: ['"Pretendard Variable"', "Pretendard", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 4px 24px rgba(30, 41, 90, 0.06)",
      },
    },
  },
  plugins: [],
};
