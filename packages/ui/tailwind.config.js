/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        anvil: {
          // Near-black layered surfaces (Linear/Vercel-grade dark).
          bg: '#0a0b0e',
          panel: '#101218', // card surface
          panel2: '#161a22', // elevated / hover surface
          border: '#1e222b', // hairline
          border2: '#2b313d', // stronger divider / control border
          // Text ramp.
          fg: '#e7e9ee', // primary
          muted: '#8b919e', // secondary
          faint: '#5b616e', // tertiary / disabled
          // Single locked accent (blue, not purple — LILA rule).
          accent: '#5b9dff',
          accent2: '#7fb0ff',
          // Semantic.
          good: '#3fb950',
          bad: '#f85149',
          warn: '#d6a73a',
        },
      },
      fontFamily: {
        sans: ['"Geist Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono Variable"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        lg: '0.625rem', // 10px — the locked card/control radius
        xl: '0.875rem', // 14px — large containers
      },
      boxShadow: {
        // Soft, background-tinted elevation (no pure-black drop shadows).
        card: '0 1px 0 0 rgba(255,255,255,0.02) inset, 0 1px 2px rgba(0,0,0,0.5), 0 12px 32px -16px rgba(0,0,0,0.7)',
        glow: '0 0 0 1px rgba(91,157,255,0.35), 0 6px 24px -8px rgba(91,157,255,0.45)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s cubic-bezier(0.16,1,0.3,1) both',
        shimmer: 'shimmer 1.5s infinite',
      },
    },
  },
  plugins: [],
};
