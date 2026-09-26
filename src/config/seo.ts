import { legal } from '@/config/legal';
import { branding } from '@/config/branding';
import { industries, type Industry } from '@/config/industries';
import { landingFaqs, reviewLinkToolFaqs } from '@/config/faq';

/**
 * Search and social metadata for every URL, in one place.
 *
 * - The build prerenders each page in `publicPages()` to static HTML with these
 *   tags in <head> (scripts/prerender.mjs), and lists them in sitemap.xml.
 * - In the browser, <RouteMeta /> applies the same tags on navigation.
 * - Any other URL (dashboard, onboarding, sign-in, customer review pages)
 *   gets `noindex`: private or per-customer pages must never appear in search.
 *
 * Structured data states only verifiable facts. Never add ratings, review
 * counts, or customer quotes here — Google penalises self-serving or invented
 * review markup, and the site's own tests forbid fabricated social proof.
 */

export const SITE_URL = legal.siteUrl.replace(/\/$/, '');
export const SITE_NAME = branding.name;
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og/reviyo-og.png`;
const LOGO_URL = `${SITE_URL}/brand/reviyo-logo.png`;

type JsonLd = Record<string, unknown>;

export interface PageMeta {
  path: string;
  title: string;
  description: string;
  noindex?: boolean;
  ogType?: 'website' | 'article';
  ogImage?: string;
  jsonLd?: JsonLd[];
  /** Only for indexable pages: used in sitemap.xml. */
  changefreq?: 'weekly' | 'monthly' | 'yearly';
  priority?: number;
}

// ---------------------------------------------------------------------------
// Structured data
// ---------------------------------------------------------------------------

const organization: JsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  logo: LOGO_URL,
  email: legal.supportEmail,
  telephone: legal.supportPhone,
  founder: { '@type': 'Person', name: legal.grievanceOfficerName },
  address: {
    '@type': 'PostalAddress',
    addressLocality: legal.jurisdictionCity,
    addressRegion: 'Andhra Pradesh',
    addressCountry: 'IN',
  },
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    email: legal.supportEmail,
    telephone: legal.supportPhone,
    areaServed: 'IN',
  },
};

const website: JsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  inLanguage: 'en-IN',
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const softwareApplication: JsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web browser',
  description:
    'A QR code and AI-assisted review writing tool that helps local businesses in India get more genuine Google reviews from their customers.',
  publisher: { '@id': `${SITE_URL}/#organization` },
  offers: [
    {
      '@type': 'Offer',
      name: '6 months',
      price: '1999',
      priceCurrency: 'INR',
      url: `${SITE_URL}/pricing`,
      availability: 'https://schema.org/InStock',
    },
    {
      '@type': 'Offer',
      name: '12 months',
      price: '2999',
      priceCurrency: 'INR',
      url: `${SITE_URL}/pricing`,
      availability: 'https://schema.org/InStock',
    },
  ],
};

function faqPage(items: { q: string; a: string }[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

function breadcrumbs(trail: { name: string; path: string }[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Home', path: '/' }, ...trail].map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: `${SITE_URL}${crumb.path === '/' ? '/' : crumb.path}`,
    })),
  };
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export const TOOL_PATH = '/tools/google-review-link-generator';

function industryPage(industry: Industry): PageMeta {
  const path = `/for/${industry.slug}`;
  return {
    path,
    title: industry.metaTitle,
    description: industry.metaDescription,
    changefreq: 'monthly',
    priority: 0.8,
    jsonLd: [
      breadcrumbs([
        { name: 'Industries', path: '/for' },
        { name: industry.plural.replace(/^\w/, (c) => c.toUpperCase()), path },
      ]),
      faqPage(industry.faqs),
    ],
  };
}

const legalPage = (path: string, title: string, description: string): PageMeta => ({
  path,
  title: `${title} | ${SITE_NAME}`,
  description,
  changefreq: 'yearly',
  priority: 0.3,
  jsonLd: [breadcrumbs([{ name: title, path }])],
});

export function publicPages(): PageMeta[] {
  return [
    {
      path: '/',
      title: 'Get More Google Reviews with a QR Code & AI | Reviyo',
      description:
        'Get more genuine Google reviews: customers scan your QR code and AI helps them write in their own words. For local businesses in India. 14-day free trial.',
      changefreq: 'weekly',
      priority: 1,
      jsonLd: [organization, website, softwareApplication, faqPage(landingFaqs)],
    },
    {
      path: '/pricing',
      title: 'Pricing: Google Review QR Code & AI Tool from ₹1,999 | Reviyo',
      description:
        'Simple pricing for one business: ₹1,999 for 6 months or ₹2,999 for 12 months, taxes included. 14-day free trial with a ₹1 AutoPay check, refunded. Cancel anytime.',
      changefreq: 'monthly',
      priority: 0.9,
      jsonLd: [softwareApplication, breadcrumbs([{ name: 'Pricing', path: '/pricing' }])],
    },
    {
      path: TOOL_PATH,
      title: 'Free Google Review Link & QR Code Generator | Reviyo',
      description:
        'Create your Google review link and a printable review QR code in seconds, free. Find your Place ID, get the direct “write a review” link, and download the QR code.',
      changefreq: 'monthly',
      priority: 0.9,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'Google Review Link & QR Code Generator',
          url: `${SITE_URL}${TOOL_PATH}`,
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web browser',
          isAccessibleForFree: true,
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
          publisher: { '@id': `${SITE_URL}/#organization` },
        },
        breadcrumbs([{ name: 'Google Review Link Generator', path: TOOL_PATH }]),
        faqPage(reviewLinkToolFaqs),
      ],
    },
    {
      path: '/for',
      title: 'Google Review Tools for Clinics, Salons & Restaurants | Reviyo',
      description:
        'See how Reviyo helps dental clinics, salons, restaurants, cafés, gyms, hotels, and other local businesses in India collect more genuine Google reviews.',
      changefreq: 'monthly',
      priority: 0.7,
      jsonLd: [breadcrumbs([{ name: 'Industries', path: '/for' }])],
    },
    ...industries.map(industryPage),
    legalPage('/contact', 'Contact Us', 'Contact Reviyo: support email, phone, business address, and our grievance officer.'),
    legalPage('/privacy', 'Privacy Policy', 'What personal data Reviyo collects, why, how long we keep it, and your rights under India’s DPDP Act, 2023.'),
    legalPage('/terms', 'Terms & Conditions', 'The terms for using Reviyo, including trials, AutoPay, and the rules against fake, incentivised, or gated reviews.'),
    legalPage('/refunds', 'Refund & Cancellation Policy', 'How the Reviyo free trial, AutoPay, cancellation, and refunds work, in plain language.'),
    legalPage('/cookies', 'Cookie Policy', 'Reviyo uses only essential storage to keep you signed in. No tracking or advertising cookies.'),
  ];
}

const PRIVATE_TITLES: [RegExp, string][] = [
  [/^\/dashboard\/analytics/, 'Analytics'],
  [/^\/dashboard\/feedback/, 'Private Feedback'],
  [/^\/dashboard\/qr/, 'QR Code'],
  [/^\/dashboard\/settings/, 'Settings'],
  [/^\/dashboard\/billing/, 'Billing'],
  [/^\/dashboard/, 'Dashboard'],
  [/^\/onboarding/, 'Set up your business'],
  [/^\/admin/, 'Admin'],
  [/^\/login/, 'Sign in'],
  [/^\/signup/, 'Create your account'],
  [/^\/forgot-password/, 'Reset your password'],
  [/^\/reset-password/, 'Set a new password'],
  [/^\/r\//, 'Share your experience'],
];

/** Metadata for any path. Unknown and private paths are never indexed. */
export function getPageMeta(pathname: string): PageMeta {
  const path = pathname !== '/' ? pathname.replace(/\/+$/, '') : '/';
  const page = publicPages().find((p) => p.path === path);
  if (page) return page;

  const privateTitle = PRIVATE_TITLES.find(([pattern]) => pattern.test(path))?.[1];
  return {
    path,
    title: privateTitle ? `${privateTitle} | ${SITE_NAME}` : `Page not found | ${SITE_NAME}`,
    description: 'Reviyo helps local businesses get more genuine Google reviews.',
    noindex: true,
  };
}

export function canonicalUrl(meta: PageMeta): string {
  return `${SITE_URL}${meta.path === '/' ? '/' : meta.path}`;
}

// ---------------------------------------------------------------------------
// <head> rendering for the prerender step
// ---------------------------------------------------------------------------

const escapeAttr = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** JSON for a <script> tag: "<" is escaped so the content can never close the tag. */
export const jsonLdText = (data: JsonLd) => JSON.stringify(data).replace(/</g, '\\u003c');

export function renderHeadTags(meta: PageMeta): string {
  const image = meta.ogImage ?? DEFAULT_OG_IMAGE;
  const tags = [
    `<title>${escapeAttr(meta.title)}</title>`,
    `<meta name="description" content="${escapeAttr(meta.description)}" />`,
    meta.noindex
      ? '<meta name="robots" content="noindex, nofollow" />'
      : '<meta name="robots" content="index, follow, max-image-preview:large" />',
  ];
  if (!meta.noindex) {
    const url = canonicalUrl(meta);
    tags.push(
      `<link rel="canonical" href="${escapeAttr(url)}" />`,
      `<meta property="og:url" content="${escapeAttr(url)}" />`,
    );
  }
  tags.push(
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:locale" content="en_IN" />`,
    `<meta property="og:type" content="${meta.ogType ?? 'website'}" />`,
    `<meta property="og:title" content="${escapeAttr(meta.title)}" />`,
    `<meta property="og:description" content="${escapeAttr(meta.description)}" />`,
    `<meta property="og:image" content="${escapeAttr(image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="Reviyo: get more genuine Google reviews" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeAttr(meta.title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(meta.description)}" />`,
    `<meta name="twitter:image" content="${escapeAttr(image)}" />`,
  );
  for (const data of meta.jsonLd ?? []) {
    tags.push(`<script type="application/ld+json" data-route-meta>${jsonLdText(data)}</script>`);
  }
  return tags.join('\n    ');
}
