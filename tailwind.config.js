/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        aurora: {
          sidebar: {
            light: '#f7f7f8',
            dark: '#000000',
          },
          bg: {
            light: '#ffffff',
            dark: '#000000',
          },
          surface: {
            light: '#f7f7f8',
            dark: '#202123',
          },
          border: {
            light: '#e5e5e5',
            dark: '#343541',
          },
          text: {
            primary: '#000000',
            secondary: '#6e6e80',
            'dark-primary': '#ffffff',
            'dark-secondary': '#8e8ea0',
          },
          accent: {
            DEFAULT: '#000000',
            hover: '#202020',
            dark: '#ffffff',
            'dark-hover': '#e5e5e5',
          },
          muted: {
            light: '#f5f5f5',
            dark: '#2a2b32',
          },
          user: {
            bubble: {
              light: '#f7f7f8',
              dark: '#343541',
            },
          },
        },
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '18px',
      },
      animation: {
        'fade-in': 'fadeIn 0.1s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
