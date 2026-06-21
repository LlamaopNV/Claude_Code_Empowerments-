/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        anvil: {
          bg: '#0b0f17',
          panel: '#141a26',
          border: '#243049',
          accent: '#5b9dff',
          good: '#3fb950',
          bad: '#f85149',
          warn: '#d29922',
          muted: '#8b97ab',
        },
      },
    },
  },
  plugins: [],
};
