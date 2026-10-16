import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#141715',
        black: '#0E100F',
        paper: '#FFFFFF',
        grey: '#F4F5F3',
        line: '#E4E6E3',
        muted: '#6B726E',
        /** Accent primaire, actions sur fond clair uniquement */
        forest: '#1B4332',
        forestSoft: '#2D6A4F',
        /** Actif sidebar / touches sur fond noir */
        lime: '#C8E6C0',
        limeDeep: '#A8D5A2',
        /** Badges / statuts secondaires */
        sage: '#8FBC8F',
        sageSoft: '#E8F2E8',
        success: '#2D6A4F',
        danger: '#C45C4A',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '14px',
        block: '16px',
        canvas: '28px',
        shell: '24px',
      },
      boxShadow: {
        soft: '0 4px 16px -4px rgba(20, 23, 21, 0.08), 0 1px 3px rgba(20, 23, 21, 0.04)',
        card: '0 8px 28px -8px rgba(20, 23, 21, 0.12), 0 2px 6px rgba(20, 23, 21, 0.04)',
        map: '0 12px 40px -12px rgba(20, 23, 21, 0.18)',
        live: '0 24px 48px -24px rgba(0, 0, 0, 0.55)',
      },
      transitionTimingFunction: {
        brand: 'cubic-bezier(.2,.8,.2,1)',
      },
    },
  },
  plugins: [],
} satisfies Config;
