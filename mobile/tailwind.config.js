/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        cream: '#FAF7F2',
        charcoal: '#2A2A2A',
        terracotta: '#C65D3F',
        terracottaDark: '#A84A30',
        muted: '#7A7268',
        border: '#E8E0D5',
        accent: '#D4A574',
      },
      fontFamily: {
        serif: ['Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};