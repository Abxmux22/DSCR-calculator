/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f3f7f8",
          100: "#d9e8eb",
          200: "#b4d2d8",
          300: "#82b3bf",
          400: "#5a95a6",
          500: "#3f7a8b",
          600: "#325f6f",
          700: "#294e5b",
          800: "#233f4a",
          900: "#20353e"
        }
      },
      boxShadow: {
        soft: "0 10px 30px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: []
};