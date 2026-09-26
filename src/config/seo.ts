import { legal, isPlaceholder } from '@/config/legal';
import { branding } from '@/config/branding';
import { PLANS, PLAN_ORDER, formatRupees } from '@/config/plans';
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
/** Describes public/og/reviyo-og.png for people who cannot see it. Update both together. */
const OG_IMAGE_ALT =
  'Reviyo logo, the words “Your customers would review you on Google. Reviyo helps them write it.”, and a counter card with a QR code';
const LOGO_URL = `${SITE_URL}/brand/reviyo-logo.png`;

type JsonLd = Record<string, unknown>;

/**
 * A business detail only once it has been filled in. Unfinished `TODO_` values
 * from config/legal.ts are dropped (JSON.stringify omits undefined), so search
 * engines never see placeholder text. The release build refuses to run while
 * any remain, so a published site always has them all.
 */
const real = (value: string | null | undefined) => (value && !isPlaceholder(value) ? value : undefined);

const cheapestPlan = PLANS[PLAN_ORDER[0]];
const planSummary = PLAN_ORDER.map((id) => `${formatRupees(PLANS[id].price)} for ${PLANS[id].months} months`).join(' or ');

/** One step in a breadcrumb trail. Home is always first and is not listed. */
export interface Crumb {
  name: string;
  path: string;
}

export interface PageMeta {
  path: string;
  /** Breadcrumbs after Home: shown on the page (<Breadcrumbs />) and sent as BreadcrumbList data. */
  trail?: Crumb[];
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
  email: real(legal.supportEmail),
  telephone: real(legal.supportPhone),
  founder: { '@type': 'Person', name: legal.grievanceOfficerName },
  address: {
    '@type': 'PostalAddress',
    streetAddress: real(legal.address),
    addressLocality: legal.jurisdictionCity,
    addressRegion: 'Andhra Pradesh',
    addressCountry: 'IN',
  },
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    email: real(legal.supportEmail),
    telephone: real(legal.supportPhone),
    areaServed: 'IN',
    availableLanguage: ['en'],
  },
};

/**
 * The business behind Reviyo, as a LocalBusiness: its registered address in
 * Vijayawada, contact details, and hours. It serves customers across India
 * online, which areaServed says, rather than claiming a shopfront.
 */
const localBusiness: JsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': `${SITE_URL}/#business`,
  name: SITE_NAME,
  legalName: legal.legalName,
  description:
    'Reviyo helps local businesses in India get more genuine Google reviews with a QR code and AI-assisted review writing.',
  url: `${SITE_URL}/`,
  logo: LOGO_URL,
  image: DEFAULT_OG_IMAGE,
  email: real(legal.supportEmail),
  telephone: real(legal.supportPhone),
  priceRange: `${formatRupees(cheapestPlan.price)}–${formatRupees(Math.max(...PLAN_ORDER.map((id) => PLANS[id].price)))}`,
  currenciesAccepted: 'INR',
  address: {
    '@type': 'PostalAddress',
    streetAddress: real(legal.address),
    addressLocality: legal.jurisdictionCity,
    addressRegion: 'Andhra Pradesh',
    addressCountry: 'IN',
  },
  areaServed: { '@type': 'Country', name: 'India' },
  // The support hours stated in config/legal.ts (supportHours).
  openingHoursSpecification: {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    opens: '10:00',
    closes: '18:00',
  },
  parentOrganization: { '@id': `${SITE_URL}/#organization` },
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
  offers: PLAN_ORDER.map((id) => ({
    '@type': 'Offer',
    name: PLANS[id].label,
    price: String(PLANS[id].price),
    priceCurrency: 'INR',
    url: `${SITE_URL}/pricing`,
    availability: 'https://schema.org/InStock',
  })),
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

function breadcrumbs(trail: Crumb[]): JsonLd {
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
  const trail = [
    { name: 'Industries', path: '/for' },
    { name: industry.plural.replace(/^\w/, (c) => c.toUpperCase()), path },
  ];
  return {
    path,
    trail,
    title: industry.metaTitle,
    description: industry.metaDescription,
    changefreq: 'monthly',
    priority: 0.8,
    jsonLd: [breadcrumbs(trail), faqPage(industry.faqs)],
  };
}

const legalPage = (path: string, title: string, description: string): PageMeta => ({
  path,
  trail: [{ name: title, path }],
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
      description: `Get more genuine Google reviews: customers scan your QR code and AI helps them write in their own words. For local businesses in India. ${legal.trialDays}-day free trial.`,
      changefreq: 'weekly',
      priority: 1,
      jsonLd: [organization, localBusiness, website, softwareApplication, faqPage(landingFaqs)],
    },
    {
      path: '/pricing',
      title: `Pricing: Google Review QR Code & AI Tool from ${formatRupees(cheapestPlan.price)} | Reviyo`,
      description: `Pricing for one business: ${planSummary}, taxes included. ${legal.trialDays}-day free trial with a ₹1 AutoPay check, refunded. Cancel anytime.`,
      changefreq: 'monthly',
      priority: 0.9,
      trail: [{ name: 'Pricing', path: '/pricing' }],
      jsonLd: [softwareApplication, breadcrumbs([{ name: 'Pricing', path: '/pricing' }])],
    },
    {
      path: TOOL_PATH,
      trail: [{ name: 'Google Review Link Generator', path: TOOL_PATH }],
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
      trail: [{ name: 'Industries', path: '/for' }],
      jsonLd: [breadcrumbs([{ name: 'Industries', path: '/for' }])],
    },
    ...industries.map(industryPage),
    { ...legalPage('/contact', 'Contact Us', 'Contact Reviyo: support email, phone, business address, and our grievance officer.'),
      jsonLd: [localBusiness, breadcrumbs([{ name: 'Contact Us', path: '/contact' }])] },
    legalPage('/privacy', 'Privacy Policy', 'What personal data Reviyo collects, why, how long we keep it, and your rights under India’s DPDP Act, 2023.'),
    legalPage('/terms', 'Terms & Conditions', 'The terms for using Reviyo, including trials, AutoPay, and the rules against fake, incentivised, or gated reviews.'),
    legalPage('/refunds', 'Refund & Cancellation Policy', 'How the Reviyo free trial, AutoPay, cancellation, and refunds work, in plain language.'),
    legalPage('/cookies', 'Cookie Policy', 'Reviyo uses only essential browser storage: your sign-in, and two dashboard tools that remember what you typed. No tracking or advertising cookies.'),
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
    `<meta property="og:image:alt" content="${OG_IMAGE_ALT}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeAttr(meta.title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(meta.description)}" />`,
    `<meta name="twitter:image" content="${escapeAttr(image)}" />`,
    `<meta name="twitter:image:alt" content="${OG_IMAGE_ALT}" />`,
  );
  for (const data of meta.jsonLd ?? []) {
    tags.push(`<script type="application/ld+json" data-route-meta>${jsonLdText(data)}</script>`);
  }
  return tags.join('\n    ');
}

// ---------------------------------------------------------------------------
// llms.txt for the prerender step
// ---------------------------------------------------------------------------

/**
 * /llms.txt (llmstxt.org): a plain-language summary of the site for AI
 * assistants, built from the same page list as sitemap.xml so it cannot drift.
 */
export function renderLlmsTxt(): string {
  const pages = publicPages();
  const line = (page: PageMeta) =>
    `- [${page.title.replace(/ \| Reviyo$/, '')}](${canonicalUrl(page)}): ${page.description}`;
  const product = pages.filter((p) => ['/', '/pricing', TOOL_PATH, '/for'].includes(p.path));
  const trades = pages.filter((p) => p.path.startsWith('/for/'));
  const policies = pages.filter((p) => p.changefreq === 'yearly');

  return [
    `# ${SITE_NAME}`,
    '',
    `> ${SITE_NAME} helps local businesses in India get more genuine Google reviews. Customers scan the business's QR code, tap what they liked, and AI drafts a review from their own input, which they check, edit, and post on Google themselves.`,
    '',
    `- Pricing: ${planSummary}, taxes included, for one business at one location. ${legal.trialDays}-day free trial.`,
    `- ${SITE_NAME} never filters who is asked for a review, never offers anything in return for one, and never posts on a customer's behalf.`,
    '- The AI uses only what the customer entered. It does not invent experiences, staff names, or prices.',
    `- ${SITE_NAME} is an independent product, not affiliated with or endorsed by Google.`,
    '',
    '## Product',
    '',
    ...product.map(line),
    '',
    '## Industries',
    '',
    ...trades.map(line),
    '',
    '## Policies',
    '',
    ...policies.map(line),
    '',
  ].join('\n');
}
