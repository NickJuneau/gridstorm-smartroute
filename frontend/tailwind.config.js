/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#0b6f7c",
        danger: "#ff4757",
        warn: "#ffb857",
        ok: "#2ecc71"
      }
    }
  },
  plugins: []
};
