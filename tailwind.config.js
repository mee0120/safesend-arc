import { fileURLToPath } from 'node:url'

// Absolute paths so class scanning never depends on the directory Vite was started from.
const root = (p) => fileURLToPath(new URL(p, import.meta.url))

/** @type {import('tailwindcss').Config} */
export default {
  content: [root('./index.html'), root('./src/**/*.{js,ts,jsx,tsx}')],
  theme: {
    extend: {
      // Add your custom colors, fonts, etc. here
    },
  },
  plugins: [],
}
