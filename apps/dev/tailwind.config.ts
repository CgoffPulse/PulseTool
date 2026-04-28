import type { Config } from 'tailwindcss';

/**
 * Pulse Dev Hub — design tokens.
 *
 * Same palette family as the social tool (cream / green-deep / amber-mid)
 * so the two tools read as siblings, with one twist: the dev hub leans
 * harder on green-deep as a *surface* color (not just inverse) — terminal-
 * adjacent, code-adjacent — and uses amber-mid + amber-deep as the only
 * accents. No off-brand indigo/sky here.
 */
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
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        cream: {
          DEFAULT: '#ead8c5',
          lt: '#f4ede4',
          dk: '#d9c4ac',
        },
        green: {
          deep: '#27452b',
          mid: '#4d6d4f',
          light: '#6e9973',
          bark: '#1c3220',
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

        // Project / task state — re-tinted to live within the brand family.
        idea: '#af764b',          // rust-200
        active: '#4d6d4f',        // green-mid
        paused: '#c96f1f',        // amber-deep
        shipped: '#27452b',       // green-deep
        archived: '#8a8580',

        ok: '#4d6d4f',
        warn: '#c96f1f',
        bad: '#a03030',
        info: '#27452b',
      },
      boxShadow: {
        sm: '0 1px 3px rgba(0, 0, 0, 0.04)',
        card: '0 4px 12px rgba(39, 69, 43, 0.06)',
        lift: '0 12px 40px rgba(39, 69, 43, 0.10), 0 4px 12px rgba(39, 69, 43, 0.06)',
        xl: '0 16px 48px rgba(39, 69, 43, 0.10), 0 6px 16px rgba(39, 69, 43, 0.06)',
        glowAmber: '0 0 60px rgba(232, 158, 80, 0.12), 0 0 120px rgba(232, 158, 80, 0.06)',
        glowGreen: '0 0 60px rgba(39, 69, 43, 0.15), 0 0 120px rgba(39, 69, 43, 0.08)',
        innerCream: 'inset 0 1px 0 rgba(255, 255, 255, 0.6)',
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
