// Build step: turns every public page into static HTML, and writes the SPA
// shell, sitemap.xml, and robots.txt.
//
//   vite build                     -> dist/ (browser bundle + index.html template)
//   vite build --ssr ...           -> dist-ssr/entry-server.js
//   node scripts/prerender.mjs     -> dist/<page>/index.html, dist/app.html, ...
//
// Search engines and link previews then get real content and per-page <head>
// tags on first load instead of an empty <div id="root">.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const dist = resolve('dist');
const ssrDir = resolve('dist-ssr');
const { render, publicPages, getPageMeta, renderHeadTags, SITE_URL } = await import(
  pathToFileURL(join(ssrDir, 'entry-server.js')).href
);

const template = await readFile(join(dist, 'index.html'), 'utf8');
const HEAD_BLOCK = /<!-- seo:start -->[\s\S]*?<!-- seo:end -->/;
const ROOT = '<div id="root"></div>';
if (!HEAD_BLOCK.test(template) || !template.includes(ROOT)) {
  throw new Error('index.html is missing the seo:start/seo:end markers or an empty #root');
}

const withHead = (html, meta) => html.replace(HEAD_BLOCK, `<!-- seo:start -->\n    ${renderHeadTags(meta)}\n    <!-- seo:end -->`);
const escapeAttr = (value) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

// 1. The SPA shell for every non-public URL (dashboard, sign-in, /r/:slug,
//    unknown paths). Never indexed. Hosting rewrites point at it (see
//    public/_redirects and vercel.json).
await writeFile(
  join(dist, 'app.html'),
  withHead(template, { ...getPageMeta('/__app'), title: 'Reviyo', path: '/app.html' }),
);

// 2. Prerendered public pages.
const pages = publicPages();
for (const page of pages) {
  const body = render(page.path);
  if (!body.includes('<h1')) {
    throw new Error(`Prerendered ${page.path} has no <h1>; it probably rendered a loader or redirect.`);
  }
  const html = withHead(template, page).replace(
    ROOT,
    `<div id="root" data-prerendered-path="${escapeAttr(page.path)}">${body}</div>`,
  );
  // /pricing -> pricing.html, /for/salons -> for/salons.html. Vercel (cleanUrls),
  // Netlify, and Cloudflare Pages all serve these at the clean URL, whereas a
  // directory index (pricing/index.html) is not found for /pricing everywhere.
  const file = page.path === '/' ? join(dist, 'index.html') : join(dist, `${page.path.slice(1)}.html`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, html);
}

// 3. sitemap.xml and robots.txt.
const today = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .filter((page) => !page.noindex)
  .map(
    (page) => `  <url>
    <loc>${SITE_URL}${page.path === '/' ? '/' : page.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq ?? 'monthly'}</changefreq>
    <priority>${(page.priority ?? 0.5).toFixed(1)}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`;
await writeFile(join(dist, 'sitemap.xml'), sitemap);

await writeFile(
  join(dist, 'robots.txt'),
  `User-agent: *
Allow: /
# Private areas and per-business customer review pages are never for search.
Disallow: /dashboard
Disallow: /admin
Disallow: /onboarding
Disallow: /r/
Disallow: /app.html

Sitemap: ${SITE_URL}/sitemap.xml
`,
);

await rm(ssrDir, { recursive: true, force: true });
console.log(`prerendered ${pages.length} pages, app.html, sitemap.xml, robots.txt`);
