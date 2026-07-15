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
      // 'spring' approximates iOS's default UISpring curve (overshoot then
      // settle) — the shared timing function behind every "tactile" press/
      // reveal interaction introduced for the Feed redesign, so motion
      // reads as one consistent physical system rather than a per-component
      // guess at an easing curve.
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'reaction-pop': 'reactionPop 0.35s ease-out',
        'reaction-float': 'reactionFloat 0.6s ease-out forwards',
        'page-enter': 'pageEnter 0.22s ease-out',
        'unlock-reveal': 'unlockReveal 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'slide-in-left': 'slideInLeft 0.2s ease-out',
        'aurora-shift': 'auroraShift 14s ease-in-out infinite',
        'shimmer-sweep': 'shimmerSweep 3.2s ease-in-out infinite',
        'capsule-crack': 'capsuleCrack 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'pill-pulse': 'pillPulse 1.6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        slideInLeft: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(0)' } },
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
        // Slow drift of a large background-gradient behind a locked drop's
        // sealed-capsule teaser — never resolves into a real image (there
        // is none to show, the server withholds locked content entirely),
        // just an ambient living color that invites curiosity.
        auroraShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        // A diagonal light streak sweeping across the frosted glass pane,
        // like a reflection catching the light — reinforces "sealed under
        // glass" without needing any real content underneath.
        shimmerSweep: {
          '0%': { transform: 'translateX(-150%) rotate(8deg)' },
          '55%, 100%': { transform: 'translateX(150%) rotate(8deg)' },
        },
        // The unlock moment: a quick anticipatory compress, then an
        // overshoot burst outward as the capsule "cracks open," settling
        // back to rest — a tactile, physical alternative to a plain fade.
        capsuleCrack: {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '30%': { transform: 'scale(0.94)', opacity: '1' },
          '70%': { transform: 'scale(1.08)', opacity: '0.4' },
          '100%': { transform: 'scale(1.18)', opacity: '0' },
        },
        pillPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(147,51,234,0.35)' },
          '50%': { boxShadow: '0 0 0 6px rgba(147,51,234,0)' },
        },
      },
    },
  },
  plugins: [],
}

