/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sheryians: {
          orange: '#FF6B35',
          dark: '#0F0F1A',
          card: '#1A1A2E',
          border: '#2D2D4A',
          green: '#1D9E75',
          amber: '#BA7517',
          red: '#E24B4A',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}