/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Anek Latin, by the Indian foundry Ek Type. The same family covers
        // Devanagari, Telugu, and other Indian scripts, so localised pages
        // can keep one voice. Self-hosted: no request leaves our domain.
        sans: [
          '"Anek Latin Variable"',
          'system-ui',
          '-apple-system',
          '"Segoe UI"',
          'Roboto',
          '"Noto Sans"',
          'sans-serif',
        ],
      },
      colors: {
        // Printed-navy ink for headings and body on the public site.
        ink: '#12213F',
        // Cool paper grey for page backgrounds (deliberately not cream).
        paper: '#F4F6F9',
        muted: '#5A6882',
        line: '#DCE2EA',
        // Only ever used for review stars, where it carries meaning.
        star: '#F4A51C',
      },
    },
  },
  plugins: [],
};
