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

test('hosting sends app routes to the noindex shell and every other unknown URL to a real 404', async () => {
  const [redirects, vercel, prerender, app] = await Promise.all([
    read('public/_redirects'), read('vercel.json'), read('scripts/prerender.mjs'), read('src/App.tsx'),
  ]);

  // Every signed-in or customer route in the app must reach the app shell on
  // both hosts, or it would 404 on a refresh.
  // Derived from App.tsx, so a new app route cannot be added without hosting it.
  const PUBLIC = new Set(['', 'pricing', 'for', 'privacy', 'terms', 'cookies', 'refunds', 'contact']);
  const appRoutes = [...app.matchAll(/<Route path="\/([a-z-]*)/g)].map((m) => m[1]).filter((r) => !PUBLIC.has(r));
  assert.deepEqual(
    [...new Set(appRoutes)].sort(),
    ['admin', 'dashboard', 'forgot-password', 'login', 'onboarding', 'partners', 'r', 'reset-password', 'signup'],
  );
  const config = JSON.parse(vercel);
  assert.equal(config.cleanUrls, true);
  for (const rewrite of config.rewrites) assert.equal(rewrite.destination, '/app'); // cleanUrls drops .html
  const vercelSources = config.rewrites.map((r) => r.source).join(' ');
  for (const route of new Set(appRoutes)) {
    const netlifyPath = route === 'r' ? '/r/\\*' : `/${route}`;
    assert.match(redirects, new RegExp(`^${netlifyPath}\\s+/app\\.html\\s+200$`, 'm'), `_redirects is missing /${route}`);
    assert.ok(vercelSources.includes(route === 'r' ? '/r/:slug' : route), `vercel.json is missing /${route}`);
  }
  assert.match(redirects, /^\/dashboard\/\*\s+\/app\.html\s+200$/m);

  // No catch-all to the app shell: that answered every mistyped URL with 200.
  assert.doesNotMatch(redirects, /^\/\*\s/m);
  assert.ok(!config.rewrites.some((r) => r.source.includes('(?!')), 'vercel.json must not rewrite everything');

  // Unknown URLs render a real not-found page, prerendered as 404.html.
  assert.match(app, /<Route path="\*" element=\{<NotFoundPage \/>\} \/>/);
  assert.match(prerender, /'404\.html'/);
});

test('llms.txt, a favicon, and LocalBusiness data are published, from config and without placeholders', async () => {
  const [seo, prerender, html, entry] = await Promise.all([
    read('src/config/seo.ts'), read('scripts/prerender.mjs'), read('index.html'), read('src/entry-server.tsx'),
  ]);
  assert.match(prerender, /writeFile\(join\(dist, 'llms\.txt'\), renderLlmsTxt\(\)\)/);
  assert.match(entry, /renderLlmsTxt/);
  assert.match(seo, /'@type': 'LocalBusiness'/);
  // Unfinished TODO_ business details never reach structured data.
  assert.match(seo, /email: real\(legal\.supportEmail\)/);
  assert.match(seo, /streetAddress: real\(legal\.address\)/);
  // Prices and the trial length come from config, never typed into copy.
  assert.doesNotMatch(seo, /1,999|2,999|'1999'|'2999'|14-day/);
  assert.doesNotMatch(await read('src/config/industries.ts'), /'[^'\n]*14-day/);

  const ico = await readFile(new URL('../public/favicon.ico', import.meta.url));
  assert.equal(ico.readUInt16LE(2), 1, 'favicon.ico must be a real ICO file');
  assert.match(html, /<link rel="icon" href="\/favicon\.ico" sizes="any" \/>/);
});

test('visible breadcrumbs and BreadcrumbList data come from the same trail', async () => {
  const [crumbs, seo] = await Promise.all([read('src/components/Breadcrumbs.tsx'), read('src/config/seo.ts')]);
  assert.match(crumbs, /getPageMeta\(pathname\)\.trail/);
  assert.match(seo, /jsonLd: \[breadcrumbs\(trail\), faqPage\(industry\.faqs\)\]/);
  for (const page of ['PricingPage', 'marketing/IndustriesPage', 'marketing/IndustryPage', 'marketing/ReviewLinkGeneratorPage']) {
    assert.match(await read(`src/pages/${page}.tsx`), /<Breadcrumbs \/>/, `${page} shows breadcrumbs`);
  }
  assert.match(await read('src/components/legal/LegalPage.tsx'), /<Breadcrumbs /);
});
