/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        emerald: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
          950: '#022C22',
        },
        gold: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
        },
        alabaster: '#F8FAF9',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        urdu: ['"Noto Nastaliq Urdu"', '"Noto Naskh Arabic"', 'serif'],
      },
      boxShadow: {
        glass: '0 8px 32px rgba(6, 78, 59, 0.08)',
        'glass-lg': '0 20px 50px rgba(6, 78, 59, 0.14)',
        gold: '0 8px 24px rgba(217, 119, 6, 0.22)',
      },
    },
  },
  plugins: [],
};
