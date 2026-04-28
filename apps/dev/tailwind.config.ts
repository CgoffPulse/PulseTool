import type { Config } from 'tailwindcss';

export default {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        body: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // Dev Hub palette — deliberately distinct from the social tool's
        // cream/green so the two tools are visually unmistakable.
        ink: {
          DEFAULT: '#0a0e1a',
          deep: '#050811',
          mid: '#1a2034',
          soft: '#2a3148',
        },
        slate: {
          50: '#f1f3f8',
          100: '#dde2ed',
          200: '#b8c1d6',
          300: '#8590ad',
          400: '#5a6685',
          500: '#3d4862',
        },
        indigo: {
          DEFAULT: '#6366f1',
          deep: '#4338ca',
          soft: '#a5b4fc',
          ghost: '#312e81',
        },
        sky: {
          DEFAULT: '#38bdf8',
          deep: '#0284c7',
          soft: '#bae6fd',
        },
        // Project state colors (semantic)
        idea: '#8b5cf6',
        active: '#22c55e',
        paused: '#f59e0b',
        shipped: '#0ea5e9',
        archived: '#6b7280',
        // Task status
        ok: '#22c55e',
        warn: '#f59e0b',
        bad: '#ef4444',
        info: '#38bdf8',
      },
      boxShadow: {
        card: '0 1px 3px rgba(10, 14, 26, 0.5), 0 4px 12px rgba(10, 14, 26, 0.3)',
        lift: '0 12px 40px rgba(99, 102, 241, 0.12), 0 4px 12px rgba(10, 14, 26, 0.4)',
        glow: '0 0 60px rgba(99, 102, 241, 0.15), 0 0 120px rgba(56, 189, 248, 0.08)',
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      letterSpacing: {
        eyebrow: '0.14em',
        label: '0.08em',
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px' }],
        xs: ['12px', { lineHeight: '18px' }],
        sm: ['13px', { lineHeight: '20px' }],
        base: ['15px', { lineHeight: '24px' }],
        lg: ['17px', { lineHeight: '26px' }],
        xl: ['20px', { lineHeight: '30px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        '3xl': ['30px', { lineHeight: '36px' }],
      },
      transitionDuration: {
        fast: '150ms',
        base: '250ms',
      },
    },
  },
  plugins: [],
} satisfies Config;
