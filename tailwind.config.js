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
            dark: '#000000',       // 保持纯黑，比主区域更深形成分层
          },
          bg: {
            light: '#ffffff',
            dark: '#0a0a0b',       // P2-1: 从 #000000 改为极深灰，与 sidebar 形成分层
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
          // P2-1: Aurora 品牌紫蓝色，用于渐变和强调
          violet: {
            DEFAULT: '#818cf8',
            dark: '#818cf8',
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
        // P2-1: 入场动画改为 translateY + opacity，0.2s
        'fade-in': 'fadeInUp 0.2s ease-out',
        // P2-1: streaming 光标闪烁动画
        'typing-cursor': 'typingBlink 1s step-end infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        typingBlink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}
