/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        body: ['Outfit', 'sans-serif'],
      },
      colors: {
        bg: {
          base: '#07090F',
          panel: '#0D1017',
          card: '#111520',
          hover: '#161B28',
          border: '#1E2537',
        },
        mint: {
          DEFAULT: '#4ADE80',
          dim: '#22543D',
          glow: 'rgba(74,222,128,0.15)',
        },
        danger: {
          DEFAULT: '#F87171',
          dim: '#7F1D1D',
          glow: 'rgba(248,113,113,0.15)',
        },
        warn: {
          DEFAULT: '#FBBF24',
          dim: '#78350F',
        },
        info: {
          DEFAULT: '#60A5FA',
          dim: '#1E3A5F',
        },
        violet: {
          DEFAULT: '#C084FC',
          dim: '#4C1D95',
        },
        text: {
          primary: '#F1F5F9',
          secondary: '#94A3B8',
          muted: '#475569',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-up': 'fadeUp 0.4s ease forwards',
        'count-up': 'countUp 0.8s ease forwards',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
