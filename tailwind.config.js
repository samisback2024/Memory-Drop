/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          purple: '#9333ea',
          blue: '#3b82f6',
        },
        // Every component uses stock Tailwind purple-*/blue-* classes.
        // Redefining those two families to read from CSS variables
        // (set in index.css, swapped via a data-color-theme attribute
        // on <html>) makes every existing bg-purple-600/dark:bg-purple-
        // 950/from-purple-600-to-blue-500/etc. class theme-aware with
        // zero changes to the ~110 files that already use them. See
        // index.css's own comment for why "purple"/"blue" no longer
        // describe the actual hue once a non-default theme is active.
        purple: Object.fromEntries(
          [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map(shade => [shade, `rgb(var(--color-purple-${shade}) / <alpha-value>)`])
        ),
        blue: Object.fromEntries(
          [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map(shade => [shade, `rgb(var(--color-blue-${shade}) / <alpha-value>)`])
        ),
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, rgb(var(--color-purple-600)) 0%, rgb(var(--color-blue-500)) 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'reaction-pop': 'reactionPop 0.35s ease-out',
        'reaction-float': 'reactionFloat 0.6s ease-out forwards',
        'page-enter': 'pageEnter 0.22s ease-out',
        'unlock-reveal': 'unlockReveal 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        pageEnter: { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        unlockReveal: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '60%': { opacity: '1', transform: 'scale(1.015)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        reactionPop: {
          '0%': { transform: 'scale(1)' },
          '40%': { transform: 'scale(1.4)' },
          '100%': { transform: 'scale(1)' },
        },
        reactionFloat: {
          '0%': { transform: 'translateY(0) scale(1)', opacity: '1' },
          '100%': { transform: 'translateY(-22px) scale(1.3)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}

