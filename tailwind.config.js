/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './**/*.{ts,tsx}',
    '!./node_modules/**',
    '!./dist/**',
    '!./src-tauri/**',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'neon-green': '#39FF14',
      },
    },
  },
  plugins: [],
};
