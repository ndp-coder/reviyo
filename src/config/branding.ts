export const branding = {
  name: 'Reviyo',
  tagline: 'Turn customer experiences into better reviews.',
  /** Full-size originals: structured data, social cards, and payment checkout. */
  logo: '/brand/reviyo-logo.png',
  icon: '/brand/reviyo-icon.png',
  /** Right-sized for on-page display (2x the largest rendered size). */
  logoSmall: '/brand/reviyo-logo-sm.png',
  iconSmall: '/brand/reviyo-icon-192.png',
  /** Brand blue, used to theme the Razorpay checkout. The UI itself uses Tailwind's blue-600. */
  colors: {
    primary: '#2563eb',
  },
} as const;
