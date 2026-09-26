export const branding = {
  name: 'Reviyo',
  tagline: 'Turn customer experiences into better reviews.',
  /** Full-size originals: structured data, social cards, and payment checkout. */
  logo: '/brand/reviyo-logo.png',
  icon: '/brand/reviyo-icon.png',
  /** Right-sized for on-page display (2x the largest rendered size). */
  logoSmall: '/brand/reviyo-logo-sm.png',
  iconSmall: '/brand/reviyo-icon-192.png',
  colors: {
    primary: '#2563eb',
    primaryDark: '#1d4ed8',
    primaryLight: '#3b82f6',
    accent: '#0ea5e9',
    success: '#16a34a',
    warning: '#d97706',
    error: '#dc2626',
  },
} as const;

export type Branding = typeof branding;
