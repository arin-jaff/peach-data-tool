/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        seat: {
          1: '#EF4444',
          2: '#F97316',
          3: '#EAB308',
          4: '#22C55E',
          5: '#06B6D4',
          6: '#3B82F6',
          7: '#8B5CF6',
          8: '#EC4899',
        },
        crew: '#6B7280',
      },
    },
  },
  plugins: [],
}
