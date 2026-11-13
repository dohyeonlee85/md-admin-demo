/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sidebar: '#17191F',
        bg: '#F7F8FA',
        surface: '#FFFFFF',
        primary: { DEFAULT: '#5B67D8', dark: '#4954BF', soft: '#EEF0FC' },
        success: { DEFAULT: '#21966B', soft: '#E6F5EF' },
        warning: { DEFAULT: '#D99A36', soft: '#FBF2E1' },
        danger: { DEFAULT: '#D9535D', soft: '#FBEAEC' },
        line: '#E6E8EC',
        ink: { DEFAULT: '#1B1E26', sub: '#5E6470', mute: '#9197A3' },
      },
      fontFamily: {
        sans: ['Pretendard', 'Inter', 'system-ui', 'sans-serif'],
        num: ['Inter', 'Pretendard', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
