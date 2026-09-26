/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Taken from the logo: brand-900 is the wordmark navy, accent-500 the
        // teal of the arrow. Use these instead of Tailwind's stock blue so the
        // interface matches the brand.
        brand: {
          50: '#f1f5fb',
          100: '#e2eaf6',
          200: '#c5d4ec',
          300: '#9cb5dc',
          400: '#6b8cc6',
          500: '#4468ae',
          600: '#2d4f93',
          700: '#1f3d7a',
          800: '#172f61',
          900: '#0e2250',
          950: '#081636',
        },
        accent: {
          50: '#edfcfb',
          100: '#d0f6f4',
          200: '#a4ece9',
          300: '#6ddbd9',
          400: '#33c2c3',
          500: '#0ea5a8',
          600: '#0a8589',
          700: '#0d6a6e',
          800: '#115559',
          900: '#12474a',
          950: '#042a2d',
        },
        // Warm off-white for alternating page sections.
        paper: '#f7f6f2',
      },
      fontFamily: {
        // Headings only. Self-hosted (no request to Google Fonts), and body text
        // stays on system fonts so reading text never waits for a download.
        display: ['"Bricolage Grotesque Variable"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
