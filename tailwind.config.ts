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
        display: ['var(--font-display)', 'ui-serif', 'Georgia', 'serif'],
      },
      colors: {
        // Pulse brand palette
        cream: {
          DEFAULT: '#ead8c5',
          lt: '#f4ede4',
          dk: '#d9c4ac',
        },
        green: {
          deep: '#27452b',
          mid: '#4d6d4f',
          light: '#6e9973',
        },
        amber: {
          DEFAULT: '#e89e50',
          mid: '#e89e50',
          light: '#efbb8e',
          deep: '#c96f1f',
        },
        rust: {
          100: '#c69777',
          200: '#af764b',
          300: '#c97029',
        },
        charcoal: '#2a2a28',

        // Status colors that stay tonally consistent with the brand
        ok: '#4d6d4f',          // green-mid
        warn: '#c96f1f',        // amber-deep
        bad: '#a03030',         // earthy red
        info: '#27452b',        // green-deep
      },
      boxShadow: {
        sm: '0 1px 3px rgba(0, 0, 0, 0.04)',
        card: '0 4px 12px rgba(39, 69, 43, 0.06)',
        lift: '0 12px 40px rgba(39, 69, 43, 0.10), 0 4px 12px rgba(39, 69, 43, 0.06)',
        xl: '0 16px 48px rgba(39, 69, 43, 0.10), 0 6px 16px rgba(39, 69, 43, 0.06)',
        glowAmber: '0 0 60px rgba(232, 158, 80, 0.12), 0 0 120px rgba(232, 158, 80, 0.06)',
        glowGreen: '0 0 60px rgba(39, 69, 43, 0.15), 0 0 120px rgba(39, 69, 43, 0.08)',
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      },
      letterSpacing: {
        display: '-0.02em',
        eyebrow: '0.14em',
        label: '0.08em',
        micro: '0.10em',
      },
      lineHeight: {
        display: '0.95',
        tight: '1.15',
        body: '1.6',
        loose: '1.8',
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
        '4xl': ['38px', { lineHeight: '44px' }],
        '5xl': ['52px', { lineHeight: '54px' }],
        '6xl': ['72px', { lineHeight: '72px' }],
      },
      transitionTimingFunction: {
        pulse: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      transitionDuration: {
        fast: '300ms',
        base: '400ms',
        slow: '600ms',
        hero: '800ms',
      },
    },
  },
  plugins: [],
} satisfies Config;
