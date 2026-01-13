/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e0f7f4',
          100: '#b3ebe3',
          200: '#80ded1',
          300: '#4dd1bf',
          400: '#26c7b1',
          500: '#00BFA5',
          600: '#00b399',
          700: '#00a389',
          800: '#009479',
          900: '#007a5f',
        },
        secondary: {
          50: '#e0f2f0',
          100: '#b3dfd9',
          200: '#80cac0',
          300: '#4db5a7',
          400: '#26a594',
          500: '#00897B',
          600: '#007d70',
          700: '#006e63',
          800: '#006056',
          900: '#00493e',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.2s ease-out',
        slideUp: 'slideUp 0.3s ease-out',
      },
    },
  },
  plugins: [],
}
