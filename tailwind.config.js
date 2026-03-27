/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'rgb(var(--theme-app-bg-rgb) / <alpha-value>)',
        panel: 'rgb(var(--theme-surface-rgb) / <alpha-value>)',
        panelSoft: 'rgb(var(--theme-surface-soft-rgb) / <alpha-value>)',
        line: 'rgb(var(--theme-border-subtle-rgb) / <alpha-value>)',
        mist: 'rgb(var(--theme-text-muted-rgb) / <alpha-value>)',
        glow: 'rgb(var(--theme-accent-rgb) / <alpha-value>)',
        rose: 'rgb(var(--theme-negative-rgb) / <alpha-value>)',
        sand: 'rgb(var(--theme-warning-rgb) / <alpha-value>)',
        sky: 'rgb(var(--theme-text-primary-rgb) / <alpha-value>)',
        amberMuted: 'rgb(var(--theme-warning-rgb) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['"Manrope"', 'ui-sans-serif', 'system-ui'],
      },
      boxShadow: {
        panel: '0 22px 50px rgba(0, 0, 0, 0.35)',
      },
      backgroundImage: {
        aurora:
          'linear-gradient(180deg, rgba(10,10,10,1), rgba(8,8,8,1))',
      },
    },
  },
  plugins: [],
}
