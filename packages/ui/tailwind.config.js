/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        anvil: {
          bg: '#090d15',
          panel: '#121826',
          // Slightly elevated surface for hover / nested cards.
          panel2: '#172033',
          border: '#222c42',
          accent: '#5b9dff',
          // Secondary accent for gradients / variety.
          accent2: '#a78bfa',
          good: '#3fb950',
          bad: '#f85149',
          warn: '#d29922',
          muted: '#8b97ab',
        },
      },
      boxShadow: {
        // Soft elevation for panels and the sticky header.
        card: '0 1px 2px rgba(0,0,0,0.4), 0 8px 24px -12px rgba(0,0,0,0.6)',
        glow: '0 0 0 1px rgba(91,157,255,0.25), 0 8px 30px -10px rgba(91,157,255,0.25)',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out both',
      },
    },
  },
  plugins: [],
};
