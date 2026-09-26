import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const list = (path) => readdir(new URL(`../${path}`, import.meta.url));

const LEGAL_PAGES = {
  '/privacy': 'src/pages/legal/PrivacyPolicyPage.tsx',
  '/terms': 'src/pages/legal/TermsPage.tsx',
  '/cookies': 'src/pages/legal/CookiePolicyPage.tsx',
  '/refunds': 'src/pages/legal/RefundPolicyPage.tsx',
  '/contact': 'src/pages/legal/ContactPage.tsx',
};

// ---------------------------------------------------------------------------
// Business identity
// ---------------------------------------------------------------------------

test('BEFORE LAUNCH: every business and legal detail is filled in', async () => {
  const config = await read('src/config/legal.ts');

  const unfilled = [...config.matchAll(/^\s*(\w+):\s*'(TODO_[A-Z_]+)'/gm)].map((m) => m[1]);

  assert.deepEqual(
    unfilled,
    [],
    `\n\n  These fields in src/config/legal.ts are still placeholders:\n` +
      unfilled.map((f) => `    - ${f}`).join('\n') +
      `\n\n  They are rendered publicly on the Contact, Privacy, Terms, Refund and\n` +
      `  Cookie pages. Razorpay merchant activation, the Consumer Protection\n` +
      `  (E-Commerce) Rules 2020, and DPDPA s.5/s.13 all require real values.\n` +
      `  Fill them in before the site goes live.\n`
  );
});

// ---------------------------------------------------------------------------
// Policy pages exist and are publicly routed
// ---------------------------------------------------------------------------

test('every policy page exists and is routed without authentication', async () => {
  const app = await read('src/App.tsx');

  for (const [route, file] of Object.entries(LEGAL_PAGES)) {
    const source = await read(file);
    assert.ok(source.length > 2000, `${file} looks too short to be a real policy`);

    assert.match(
      app,
      new RegExp(`path="${route}"`),
      `${route} is not routed in App.tsx`
    );
  }

  // Policy routes must sit outside ProtectedRoute / AdminRoute wrappers.
  const publicBlock = app.slice(
    app.indexOf('{/* Legal & policy routes'),
    app.indexOf('{/* Auth routes */}')
  );
  assert.doesNotMatch(publicBlock, /ProtectedRoute|AdminRoute|OnboardingRoute/);
});

test('policy links are reachable from the public site, auth pages, and the dashboard', async () => {
  const [footer, authLayout, dashboardLayout, landing, pricing] = await Promise.all([
    read('src/components/SiteFooter.tsx'),
    read('src/pages/auth/AuthLayout.tsx'),
    read('src/pages/dashboard/DashboardLayout.tsx'),
    read('src/pages/LandingPage.tsx'),
    read('src/pages/PricingPage.tsx'),
  ]);

  for (const route of Object.keys(LEGAL_PAGES)) {
    assert.match(footer, new RegExp(`'${route}'`), `SiteFooter is missing ${route}`);
  }

  for (const [name, source] of [
    ['AuthLayout', authLayout],
    ['DashboardLayout', dashboardLayout],
  ]) {
    assert.match(source, /'\/terms'/, `${name} must link to the Terms`);
    assert.match(source, /'\/privacy'/, `${name} must link to the Privacy Policy`);
    assert.match(source, /'\/refunds'/, `${name} must link to the Refund Policy`);
  }

  assert.match(landing, /SiteFooter/);
  assert.match(pricing, /SiteFooter/);
});

// ---------------------------------------------------------------------------
// Consent (DPDPA s.5 notice, s.6 clear affirmative action)
// ---------------------------------------------------------------------------

test('consent is never pre-ticked anywhere', async () => {
  const consent = await read('src/components/ConsentCheckbox.tsx');
  assert.match(consent, /type="checkbox"/);
  assert.doesNotMatch(consent, /defaultChecked/);

  for (const file of ['src/pages/auth/SignupPage.tsx', 'src/pages/customer/CustomerReviewPage.tsx']) {
    const source = await read(file);
    assert.match(
      source,
      /useState\(false\)/,
      `${file} must initialise its consent state to false`
    );
    assert.doesNotMatch(
      source,
      /const \[(acceptedTerms|consented), set\w+\] = useState\(true\)/,
      `${file} must not pre-tick consent`
    );
  }
});

test('the customer review flow shows a notice and records the consent version', async () => {
  const page = await read('src/pages/customer/CustomerReviewPage.tsx');

  // The notice must appear before any personal data is collected, i.e. on the
  // welcome step, and must be gated behind the consent box.
  assert.match(page, /privacy-notice-heading/);
  assert.match(page, /ConsentCheckbox/);
  assert.match(page, /if \(!consented\)/);

  // The version agreed to is written to the session so it can be evidenced.
  assert.match(page, /record_review_consent/);
  assert.match(page, /p_consent_version: legal\.consentVersion/);

  // Private feedback carries the same version.
  assert.match(page, /submit_private_feedback[\s\S]{0,400}p_consent_version/);
});

test('signup requires accepting the Terms and records which version', async () => {
  const [signup, authContext] = await Promise.all([
    read('src/pages/auth/SignupPage.tsx'),
    read('src/lib/auth-context.tsx'),
  ]);

  assert.match(signup, /if \(!acceptedTerms\)/);
  assert.match(signup, /legal\.consentVersion/);
  assert.match(authContext, /terms_consent_version: termsConsentVersion/);
});

test('the database stores consent and can purge, export, and erase', async () => {
  const files = await list('supabase/migrations');
  const consentMigration = files.find((f) => f.includes('consent_retention_and_erasure'));
  assert.ok(consentMigration, 'the consent/retention migration is missing');

  const sql = await read(`supabase/migrations/${consentMigration}`);

  assert.match(sql, /ADD COLUMN IF NOT EXISTS consent_version text/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION record_review_consent/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION purge_expired_personal_data/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION export_my_data/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION preserve_financial_records_for_erasure/);

  // Rights functions must never be callable by an anonymous visitor.
  assert.match(sql, /GRANT EXECUTE ON FUNCTION export_my_data\(\) TO authenticated/);
  assert.doesNotMatch(sql, /GRANT EXECUTE ON FUNCTION export_my_data\(\) TO anon/);
  assert.match(
    sql,
    /GRANT EXECUTE ON FUNCTION preserve_financial_records_for_erasure\(uuid\) TO service_role/
  );
});

test('account holders can export and erase their data from the product itself', async () => {
  const [settings, rights, card, fn] = await Promise.all([
    read('src/pages/dashboard/SettingsPage.tsx'),
    read('src/lib/data-rights.ts'),
    read('src/components/dashboard/DataRightsCard.tsx'),
    read('supabase/functions/delete-account/index.ts'),
  ]);

  assert.match(settings, /DataRightsCard/);
  assert.match(rights, /export_my_data/);
  assert.match(rights, /DELETE MY ACCOUNT/);
  assert.match(card, /Download my data/);

  // Erasure must resolve the user from their own token, never from the body.
  assert.match(fn, /admin\.auth\.getUser\(accessToken\)/);
  assert.doesNotMatch(fn, /body\.user_id|body\.userId/);
  assert.match(fn, /preserve_financial_records_for_erasure/);
});

// ---------------------------------------------------------------------------
// Cookies and third-party embeds
// ---------------------------------------------------------------------------

test('no analytics, advertising, or tracking third parties are embedded', async () => {
  const banned = [
    'googletagmanager',
    'google-analytics',
    'gtag(',
    'connect.facebook.net',
    'fbq(',
    'hotjar',
    'clarity.ms',
    'mixpanel',
    'segment.com/analytics',
    'posthog',
    'fullstory',
    'doubleclick',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
  ];

  const sources = ['index.html'];
  async function walk(dir) {
    for (const entry of await list(dir)) {
      if (entry === 'node_modules') continue;
      if (/\.(tsx?|html|css)$/.test(entry)) {
        sources.push(`${dir}/${entry}`);
      } else if (!entry.includes('.')) {
        await walk(`${dir}/${entry}`);
      }
    }
  }
  await walk('src');

  for (const file of sources) {
    const source = await read(file);
    for (const needle of banned) {
      assert.ok(
        !source.includes(needle),
        `${file} references "${needle}". The Cookie Policy states that Reviyo uses no ` +
          `analytics, advertising, or third-party tracking, and no externally hosted fonts. ` +
          `Adding one means that page is now wrong, and a real consent banner is required.`
      );
    }
  }
});

test('the only third-party script is Razorpay, loaded on demand at checkout', async () => {
  const razorpay = await read('src/lib/razorpay.ts');

  assert.match(razorpay, /checkout\.razorpay\.com\/v1\/checkout\.js/);
  // Loaded from a function, not a module-level side effect or an index.html tag.
  assert.match(razorpay, /export function loadRazorpayScript/);

  // The checkout must not be a tag in the shell, which would load it on every
  // page including the anonymous review page. Prose in a comment is fine.
  const html = await read('index.html');
  const markup = html.replace(/<!--[\s\S]*?-->/g, '');
  assert.doesNotMatch(markup, /razorpay/i, 'Razorpay must not be loaded on every page');
  assert.doesNotMatch(markup, /<script\b(?![^>]*src="\/src\/main\.tsx")/i);
});

test('the cookie policy explains why there is no consent banner', async () => {
  const cookies = await read('src/pages/legal/CookiePolicyPage.tsx');

  assert.match(cookies, /why-no-banner/);
  assert.match(cookies, /ePrivacy/);
  assert.match(cookies, /strictly necessary/i);
});

// ---------------------------------------------------------------------------
// Advertising claims
// ---------------------------------------------------------------------------

test('no unsupported or absolute claims in customer-facing copy', async () => {
  const forbidden = [
    [/100%\s+Secure/i, 'absolute security claim'],
    [/256-bit SSL/i, 'unverifiable security badge'],
    [/RBI-compliant/i, 'Razorpay is RBI-authorised, not "RBI-compliant"'],
    [/Priority support/i, 'no priority support tier exists'],
    [/Dynamic\s*&?\s*printable QR/i, 'the QR code is static, not dynamic'],
    [/AI business insights/i, 'the insights are arithmetic, not AI'],
    [/guarantee/i, 'no outcome is guaranteed'],
    [/#1\b|best in class|world.?class/i, 'unsubstantiated superlative'],
  ];

  const pages = [
    'src/pages/LandingPage.tsx',
    'src/pages/PricingPage.tsx',
    'src/pages/dashboard/BillingPage.tsx',
    'src/pages/auth/SignupPage.tsx',
  ];

  for (const file of pages) {
    const source = await read(file);
    for (const [pattern, why] of forbidden) {
      assert.doesNotMatch(source, pattern, `${file}: ${why}`);
    }
  }
});

test('no fabricated testimonials, review counts, or star averages', async () => {
  for (const file of ['src/pages/LandingPage.tsx', 'src/pages/PricingPage.tsx']) {
    const source = await read(file);
    assert.doesNotMatch(source, /testimonial/i);
    assert.doesNotMatch(source, /trusted by \d/i);
    assert.doesNotMatch(source, /\d[\d,]*\+? (happy )?(customers|businesses|reviews) /i);
    assert.doesNotMatch(source, /rated \d\.\d/i);
  }
});

test('review requests never speak only to happy customers', async () => {
  // Google forbids "selectively soliciting positive reviews". Wording such as
  // "Enjoyed your visit?" on a counter card, or "help happy customers leave a
  // review" in advice to owners, asks only the satisfied ones. Explaining the
  // rule ("asking only happy customers breaks...") is fine.
  const files = [
    'src/pages/dashboard/QRManagementPage.tsx',
    'src/components/dashboard/WhatsAppRequest.tsx',
    'src/components/ProductPreview.tsx',
    'src/pages/LandingPage.tsx',
    'src/config/industries.ts',
    'src/config/faq.ts',
    'src/config/seo.ts',
  ];
  for (const file of files) {
    const source = await read(file);
    assert.doesNotMatch(source, /Enjoyed your visit|Loved (it|your visit)|Happy with (us|your visit)/i, `${file}: positive-only prompt`);
    assert.doesNotMatch(
      source,
      /(?<!only )\b(happy|satisfied|delighted) (customers|clients|patients|shoppers|diners|guests|students|members)\b/i,
      `${file}: speaks only to satisfied customers`,
    );
  }
});

test('the rules against incentivised and gated reviews are stated in the Terms', async () => {
  const terms = await read('src/pages/legal/TermsPage.tsx');

  assert.match(terms, /incentive/i);
  assert.match(terms, /Gate or filter reviews/i);
  assert.match(terms, /Consumer Protection Act, 2019/);
  assert.match(terms, /IS 19000:2022/);
});

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

test('customers are not asked for a star rating twice, and topic chips are accessible', async () => {
  const [page, fn] = await Promise.all([
    read('src/pages/customer/CustomerReviewPage.tsx'),
    read('supabase/functions/generate-review/index.ts'),
  ]);

  // Stars are chosen on Google, where the review is posted. Asking here too
  // only added a step.
  assert.doesNotMatch(page, /out of 5 stars|p_rating|submitRating/);
  assert.doesNotMatch(fn, /request\.rating|session\.rating/);
  // The AI is still told to keep negative comments negative.
  assert.match(fn, /never make the review more positive than their input/);
  assert.match(page, /aria-pressed=\{selected\}/, 'topic chips must expose selected state');
});

test('every image carries an alt attribute', async () => {
  const files = [];
  async function walk(dir) {
    for (const entry of await list(dir)) {
      if (/\.tsx$/.test(entry)) files.push(`${dir}/${entry}`);
      else if (!entry.includes('.')) await walk(`${dir}/${entry}`);
    }
  }
  await walk('src');

  for (const file of files) {
    const source = await read(file);
    for (const match of source.matchAll(/<img\b[\s\S]*?\/>/g)) {
      assert.match(
        match[0],
        /\balt=/,
        `${file} has an <img> with no alt attribute:\n${match[0].slice(0, 200)}`
      );
    }
  }
});

test('every browser storage key the app sets is listed in the Cookie Policy', async () => {
  // The Cookie Policy promises its table is "the complete list".
  const files = [];
  async function walk(dir) {
    for (const entry of await list(dir)) {
      if (/\.tsx?$/.test(entry)) files.push(`${dir}/${entry}`);
      else if (!entry.includes('.')) await walk(`${dir}/${entry}`);
    }
  }
  await walk('src');

  const policy = await read('src/pages/legal/CookiePolicyPage.tsx');
  for (const file of files) {
    const source = await read(file);
    if (!/(localStorage|sessionStorage)\.setItem/.test(source)) continue;
    const prefixes = [...source.matchAll(/`(reviyo:[a-z-]+:)\$\{/g)].map((m) => m[1]);
    assert.ok(prefixes.length > 0, `${file} writes browser storage under a key the policy test cannot see`);
    for (const prefix of prefixes) {
      assert.ok(policy.includes(prefix), `${file} stores "${prefix}…" but the Cookie Policy does not list it`);
    }
  }
});

test('reduced motion and visible keyboard focus are handled globally', async () => {
  const css = await read('src/index.css');

  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /:focus-visible/);
});

test('a skip link is present on every top-level layout', async () => {
  for (const file of [
    'src/pages/LandingPage.tsx',
    'src/pages/PricingPage.tsx',
    'src/pages/auth/AuthLayout.tsx',
    'src/pages/dashboard/DashboardLayout.tsx',
    'src/components/legal/LegalPage.tsx',
  ]) {
    const source = await read(file);
    assert.match(source, /SkipLink/, `${file} is missing the skip link`);
    assert.match(source, /id="main-content"/, `${file} is missing the skip link target`);
  }
});

test('low-contrast grey is not used for body text', async () => {
  // gray-400 (#9ca3af) on white is 2.5:1 and gray-300 is 1.9:1 — both well
  // under the 4.5:1 WCAG AA threshold for normal-sized text. They remain
  // acceptable for borders, fills, and decorative icons.
  const files = [];
  async function walk(dir) {
    for (const entry of await list(dir)) {
      if (/\.tsx$/.test(entry)) files.push(`${dir}/${entry}`);
      else if (!entry.includes('.')) await walk(`${dir}/${entry}`);
    }
  }
  await walk('src');

  // An element explicitly marked aria-hidden is decorative and conveys nothing
  // a sighted user needs to read, so the text-contrast rule does not apply.
  // Scan back to the opening of the enclosing JSX tag. A bare "<" is not enough:
  // these class names sit inside template literals that contain comparisons like
  // `star <= rating`, and stopping at that "<" would miss the real tag.
  const isDecorative = (source, index) => {
    let start = index;
    while (start > 0) {
      start = source.lastIndexOf('<', start - 1);
      if (start === -1) return false;
      if (/[A-Za-z/]/.test(source[start + 1] ?? '')) break;
    }
    if (start <= 0) return false;

    const end = source.indexOf('>', index);
    const element = source.slice(start, end === -1 ? source.length : end);
    return element.includes('aria-hidden');
  };

  const offenders = [];
  for (const file of files) {
    const source = await read(file);
    for (const match of source.matchAll(/text-gray-(300|400)\b/g)) {
      if (isDecorative(source, match.index)) continue;
      const line = source.slice(0, match.index).split('\n').length;
      offenders.push(`${file}:${line}`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `text-gray-300/400 fails WCAG AA contrast for text. Use text-gray-600 or darker:\n  ` +
      offenders.join('\n  ')
  );
});

// ---------------------------------------------------------------------------
// Owner-supplied URLs
// ---------------------------------------------------------------------------

test('owner-supplied URLs are scheme-checked in the browser and in the database', async () => {
  const [safety, page, settings, onboarding] = await Promise.all([
    read('src/lib/url-safety.ts'),
    read('src/pages/customer/CustomerReviewPage.tsx'),
    read('src/pages/dashboard/SettingsPage.tsx'),
    read('src/pages/onboarding/OnboardingPage.tsx'),
  ]);

  assert.match(safety, /SAFE_PROTOCOLS = new Set\(\['http:', 'https:'\]\)/);

  // The public review page must never render an unchecked owner URL.
  assert.match(page, /safeExternalUrl/);
  assert.doesNotMatch(
    page,
    /href=\{bizInfo\.business_google_review_url\}/,
    'the review page must render the checked URL, not the raw column'
  );

  assert.match(settings, /validateGoogleReviewUrl/);
  assert.match(onboarding, /validateGoogleReviewUrl/);

  const files = await list('supabase/migrations');
  const urlMigration = files.find((f) => f.includes('restrict_owner_supplied_urls'));
  assert.ok(urlMigration, 'the URL scheme constraint migration is missing');

  const sql = await read(`supabase/migrations/${urlMigration}`);
  assert.match(sql, /businesses_google_review_url_scheme/);
  assert.match(sql, /businesses_logo_url_scheme/);

  // SVG is the one image format that can carry markup, so it must not appear in
  // the allowed data-URL types. Check the constraints, not the prose above them.
  const constraints = sql.slice(sql.indexOf('ALTER TABLE businesses'));
  assert.doesNotMatch(
    constraints,
    /svg/i,
    'SVG data URLs must not be allowed for logos'
  );
});

// ---------------------------------------------------------------------------
// Data minimisation
// ---------------------------------------------------------------------------

test('the customer flow collects no identifiers beyond the session', async () => {
  const schema = await read('supabase/migrations/20260916130757_create_core_schema.sql');

  const sessionsTable = schema.slice(
    schema.indexOf('CREATE TABLE IF NOT EXISTS review_sessions'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS review_session_topics')
  );

  for (const column of ['ip_address', 'user_agent', 'device_id', 'email', 'phone', 'name']) {
    assert.ok(
      !sessionsTable.includes(column),
      `review_sessions must not store "${column}" — the Privacy Policy states the ` +
        `review flow is anonymous and collects no identifiers.`
    );
  }
});

test('the review page warns customers not to enter personal details', async () => {
  const page = await read('src/pages/customer/CustomerReviewPage.tsx');

  assert.match(page, /comment-privacy-hint/);
  assert.match(page, /don&apos;t include names, phone numbers/i);
});

test('retention periods in the policy match the ones the purge job uses', async () => {
  const [config, privacy] = await Promise.all([
    read('src/config/legal.ts'),
    read('src/pages/legal/PrivacyPolicyPage.tsx'),
  ]);

  // The policy must render the configured numbers rather than hardcode its own,
  // so the published promise cannot drift from the scheduled job.
  assert.match(privacy, /legal\.sessionRetentionDays/);
  assert.match(privacy, /legal\.feedbackRetentionDays/);
  assert.match(privacy, /legal\.analyticsRetentionDays/);

  assert.match(config, /sessionRetentionDays: \d+/);
  assert.match(config, /feedbackRetentionDays: \d+/);
  assert.match(config, /analyticsRetentionDays: \d+/);
});
