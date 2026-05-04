/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        risk: {
          none: "#22c55e",
          low: "#eab308",
          medium: "#f97316",
          high: "#ef4444",
          critical: "#7c3aed",
        },
      },
    },
  },
  plugins: [],
}
