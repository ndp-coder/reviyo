import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('every public page is prerendered at build time and hydrated, not re-rendered', async () => {
  const [pkg, main, app, prerender, template] = await Promise.all([
    read('package.json'), read('src/main.tsx'), read('src/App.tsx'), read('scripts/prerender.mjs'), read('index.html'),
  ]);
  assert.match(JSON.parse(pkg).scripts.build, /vite build --ssr src\/entry-server\.tsx .*node scripts\/prerender\.mjs/);
  assert.match(main, /hydrateRoot\(root, app\)/);
  assert.match(template, /<!-- seo:start -->[\s\S]*<!-- seo:end -->/);
  // A lazy page cannot be prerendered (the static renderer would emit the spinner).
  for (const page of ['LandingPage', 'PricingPage', 'PrivacyPolicyPage', 'TermsPage', 'IndustryPage', 'ReviewLinkGeneratorPage']) {
    assert.match(app, new RegExp(`^import \{ ${page} \}`, 'm'), `${page} must be imported eagerly`);
  }
  assert.match(prerender, /has no <h1>/, 'the build must fail if a page prerenders without content');
  assert.match(prerender, /sitemap\.xml/);
  assert.match(prerender, /Disallow: \/dashboard[\s\S]*Disallow: \/r\//);
});

test('private and customer pages are never indexed', async () => {
  const seo = await read('src/config/seo.ts');
  assert.match(seo, /noindex: true/);
  for (const path of ['dashboard', 'onboarding', 'admin', 'login', 'signup', 'r\\/']) {
    assert.ok(seo.includes(`[/^\\/${path}`), `${path} needs a noindex title rule`);
  }
});

test('structured data never claims ratings or review counts', async () => {
  const seo = await read('src/config/seo.ts');
  assert.doesNotMatch(seo, /aggregateRating|reviewCount|ratingValue|"Review"|'Review'/);
});

test('social previews use a real 1200x630 image with an absolute URL', async () => {
  const [seo, image] = await Promise.all([read('src/config/seo.ts'), readFile(new URL('../public/og/reviyo-og.png', import.meta.url))]);
  assert.match(seo, /DEFAULT_OG_IMAGE = `\$\{SITE_URL\}\/og\/reviyo-og\.png`/);
  assert.equal(image.readUInt32BE(16), 1200);
  assert.equal(image.readUInt32BE(20), 630);
});

test('new marketing copy follows the same claim rules as the landing page', async () => {
  const files = await Promise.all([
    'src/config/industries.ts', 'src/config/faq.ts', 'src/config/seo.ts',
    'src/pages/marketing/IndustryPage.tsx', 'src/pages/marketing/IndustriesPage.tsx',
    'src/pages/marketing/ReviewLinkGeneratorPage.tsx',
  ].map(read));
  for (const source of files) {
    assert.doesNotMatch(source, /guarantee|#1\b|best in class|world.?class|100%\s+Secure/i);
    assert.doesNotMatch(source, /testimonial|trusted by \d|rated \d\.\d/i);
  }
});

test('hosting rewrites send non-public paths to the noindex app shell', async () => {
  const [redirects, vercel] = await Promise.all([read('public/_redirects'), read('vercel.json')]);
  assert.match(redirects, /^\/\*\s+\/app\.html\s+200$/m);
  const config = JSON.parse(vercel);
  assert.equal(config.cleanUrls, true);
  // Vercel cleanUrls removes .html from rewrite destinations.
  assert.equal(config.rewrites[0].destination, '/app');
});
