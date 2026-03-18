/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#080808',
        panel: '#171717',
        panelSoft: '#212121',
        line: '#2E2E2E',
        mist: '#A3A3A3',
        glow: '#17C964',
        rose: '#FF3B30',
        sand: '#FF9F0A',
        sky: '#F5F5F2',
        amberMuted: '#FF9F0A',
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
