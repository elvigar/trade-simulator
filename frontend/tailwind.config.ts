import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: '#ecad0a',
        brand: {
          blue: '#209dd7',
          purple: '#753991',
        },
        base: {
          DEFAULT: '#0d1117',
          panel: '#121821',
          alt: '#1a1a2e',
          raised: '#171d28',
        },
        line: '#242b38',
        ink: {
          DEFAULT: '#e6e8eb',
          muted: '#8891a0',
          faint: '#5c6472',
        },
        up: '#2fbf71',
        down: '#ef4a5f',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      keyframes: {
        'flash-up': {
          '0%': { backgroundColor: 'rgba(47,191,113,0.35)' },
          '100%': { backgroundColor: 'transparent' },
        },
        'flash-down': {
          '0%': { backgroundColor: 'rgba(239,74,95,0.35)' },
          '100%': { backgroundColor: 'transparent' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
      animation: {
        'flash-up': 'flash-up 550ms ease-out',
        'flash-down': 'flash-down 550ms ease-out',
        'pulse-soft': 'pulse-soft 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

export default config
