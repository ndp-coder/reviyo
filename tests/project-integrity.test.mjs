import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('the frontend has no Bolt-hosted metadata or deployment instructions', async () => {
  const [html, readme] = await Promise.all([read('index.html'), read('README.md')]);

  assert.doesNotMatch(html, /bolt\.new/i);
  assert.doesNotMatch(readme, /deploys automatically via Bolt/i);
});

test('production build refuses the wrong Supabase project and unfinished legal details', async () => {
  const [pkg, guard] = await Promise.all([
    read('package.json'),
    read('scripts/check-production-config.mjs'),
  ]);

  assert.match(JSON.parse(pkg).scripts.build, /^node scripts\/check-production-config\.mjs &&/);
  assert.match(guard, /yagchgwgbttxfihlyddm/);
  assert.match(guard, /VITE_SUPABASE_URL/);
  assert.match(guard, /VITE_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(guard, /legalPlaceholders\.length/);
  assert.match(guard, /process\.exitCode = 1/);
});

test('the landing page contains no fabricated metrics or dead footer links', async () => {
  const landing = await read('src/pages/LandingPage.tsx');

  assert.doesNotMatch(landing, /247|89 Reviews|62 Google|Avg Rating.*4\.6/);
  assert.doesNotMatch(landing, /href=["']#["']/);
});

test('Reviyo branding uses the supplied logo assets everywhere', async () => {
  const [branding, landing, authLayout, dashboard, onboarding, pricing, html] = await Promise.all([
    read('src/config/branding.ts'),
    read('src/pages/LandingPage.tsx'),
    read('src/pages/auth/AuthLayout.tsx'),
    read('src/pages/dashboard/DashboardLayout.tsx'),
    read('src/pages/onboarding/OnboardingPage.tsx'),
    read('src/pages/PricingPage.tsx'),
    read('index.html'),
  ]);

  assert.match(branding, /name: 'Reviyo'/);
  assert.match(branding, /reviyo-logo\.png/);
  assert.match(branding, /reviyo-icon\.png/);
  for (const page of [authLayout, dashboard, onboarding]) {
    assert.match(page, /BrandLogo/);
  }
  // The landing, pricing, and other marketing pages get the logo from the shared header.
  assert.match(landing, /<MarketingHeader/);
  assert.match(pricing, /<MarketingHeader \/>/);
  assert.match(await read('src/components/MarketingHeader.tsx'), /<BrandLogo/);
  assert.match(html, /reviyo-icon\.png/);
  // The logo for search results lives in the Organization structured data.
  assert.match(await read('src/config/seo.ts'), /brand\/reviyo-logo\.png/);
});

test('brand images reserve layout space and payment checkouts use the real logo', async () => {
  const [logo, oneTimePayment, autopay] = await Promise.all([
    read('src/components/BrandLogo.tsx'),
    read('src/lib/razorpay.ts'),
    read('src/lib/autopay.ts'),
  ]);

  // Width and height must match the displayed files so the browser reserves space.
  assert.match(logo, /width=\{variant === 'icon' \? 192 : 216\}/);
  assert.match(logo, /height=\{variant === 'icon' \? 192 : 89\}/);
  for (const checkout of [oneTimePayment, autopay]) {
    assert.match(checkout, /image: new URL\(branding\.icon, window\.location\.origin\)\.toString\(\)/);
  }
});

test('shared form fields programmatically connect labels and errors', async () => {
  const ui = await read('src/components/ui/index.tsx');

  assert.match(ui, /useId/);
  assert.match(ui, /htmlFor=\{inputId\}/);
  assert.match(ui, /htmlFor=\{textareaId\}/);
  assert.match(ui, /aria-invalid=\{error \? true : undefined\}/g);
  assert.match(ui, /role="alert"/g);
});

test('the app has a user-facing runtime crash boundary', async () => {
  const [boundary, entrypoint] = await Promise.all([
    read('src/components/AppErrorBoundary.tsx'),
    read('src/main.tsx'),
  ]);

  assert.match(boundary, /componentDidCatch/);
  assert.match(boundary, /role="alert"/);
  assert.match(entrypoint, /<AppErrorBoundary>/);
});

test('private route pages are lazy loaded behind an accessible fallback', async () => {
  const app = await read('src/App.tsx');

  assert.match(app, /lazy\(\(\) => import\(/);
  assert.match(app, /<Suspense fallback=\{<PageLoader \/>\}>/);
  assert.match(app, /role="status"/);
  // Signed-in and customer pages load on demand...
  for (const page of ['DashboardOverview', 'BillingPage', 'OnboardingPage', 'CustomerReviewPage', 'AdminPage']) {
    assert.doesNotMatch(app, new RegExp(`import \\{ ${page} \\} from`), `${page} should be lazy`);
  }
  // ...while public pages stay eager so they can be prerendered for search
  // (a lazy page would prerender as the loading spinner). See tests/seo.test.mjs.
  assert.match(app, /import \{ LandingPage \} from/);
});

test('AutoPay production scheduling and secrets are documented without real credentials', async () => {
  const [example, readme] = await Promise.all([
    read('supabase/.env.example'),
    read('README.md'),
  ]);

  assert.match(example, /^AUTOPAY_CRON_SECRET=$/m);
  assert.doesNotMatch(example, /rzp_(?:test|live)_[A-Za-z0-9]+/);
  assert.match(readme, /supabase functions deploy autopay-scheduler/);
  assert.match(readme, /x-cron-secret/);
  assert.match(readme, /token\.confirmed/);
  assert.match(readme, /payment\.failed/);
});

test('the repository documents the required public Supabase environment variables', async () => {
  const example = await read('.env.example');

  assert.match(example, /^VITE_SUPABASE_URL=$/m);
  assert.match(example, /^VITE_SUPABASE_PUBLISHABLE_KEY=$/m);
  assert.doesNotMatch(example, /supabase\.co|eyJ/i);
});

test('anonymous clients cannot select review session data directly', async () => {
  const migration = await read('supabase/migrations/20260917120000_secure_onboarding_and_public_data.sql');

  assert.match(migration, /DROP POLICY IF EXISTS "sessions_select_public" ON review_sessions/i);
  assert.match(migration, /DROP POLICY IF EXISTS "session_topics_select_public" ON review_session_topics/i);
  assert.match(migration, /CREATE OR REPLACE FUNCTION create_business_with_defaults/i);
});

test('onboarding uses the transactional setup function', async () => {
  const onboarding = await read('src/pages/onboarding/OnboardingPage.tsx');

  assert.match(onboarding, /\.rpc\(partnerDraft \? 'claim_partner_business' : 'create_business_with_defaults'/);
  const partnerSetup = await read('supabase/migrations/20261001160000_partner_business_setup.sql');
  assert.match(partnerSetup, /v_result := create_business_with_defaults\(/);
  assert.doesNotMatch(onboarding, /\.from\('subscriptions'\)\.insert/);
});

test('the browser invokes the public Edge Function with an API key, not a bearer API key', async () => {
  const aiClient = await read('src/lib/ai-client.ts');

  assert.match(aiClient, /apikey:\s*supabasePublicKey/);
  assert.doesNotMatch(aiClient, /Authorization:\s*`Bearer \$\{supabasePublicKey/);
});

test('Gemini generation uses the current model and documented API-key header', async () => {
  const edgeFunction = await read('supabase/functions/generate-review/index.ts');

  assert.match(edgeFunction, /"gemini-3\.8-flash"/);
  assert.match(edgeFunction, /"x-goog-api-key": apiKey/);
  assert.doesNotMatch(edgeFunction, /\?key=\$\{encodeURIComponent\(apiKey\)\}/);
});

test('AI drafts are not cut short by the token limit', async () => {
  const fn = await read('supabase/functions/generate-review/index.ts');

  // Gemini 3 thinking counts against maxOutputTokens; a 300 cap cut drafts short.
  assert.doesNotMatch(fn, /maxOutputTokens: 300|max_tokens: 300/);
  assert.match(fn, /thinkingConfig = \{ thinkingLevel: "LOW" \}/);
  // A draft that hits the limit is retried, never shown half-finished.
  assert.match(fn, /finishReason === "MAX_TOKENS"/);
  assert.match(fn, /finish_reason === "length"/);
});

test('the AI keeps the customer\'s topics and the business type, without keyword stuffing', async () => {
  const [fn, categories] = await Promise.all([
    read('supabase/functions/generate-review/index.ts'),
    read('src/config/categories.ts'),
  ]);

  assert.match(fn, /Mention every topic the customer picked/);
  assert.match(fn, /never add a city, area, or service the customer did not give/);
  // Every preset category reaches the AI as words, not a code like "dental_clinic".
  const presets = [...categories.matchAll(/value: '([a-z_]+)'/g)]
    .map((match) => match[1])
    .filter((value) => value !== 'other');
  assert.ok(presets.length > 0, 'no preset categories found');
  for (const value of presets) {
    assert.match(fn, new RegExp(`^\\s+${value}: "`, 'm'), `CATEGORY_WORDS is missing ${value}`);
  }
});

test('AI review quota is claimed atomically before calling the provider', async () => {
  const edgeFn = await read('supabase/functions/generate-review/index.ts');
  const migration = await read('supabase/migrations/20260925140000_atomic_ai_generation_quota.sql');

  assert.match(edgeFn, /claim_ai_generation/);
  assert.doesNotMatch(edgeFn, /check_ai_rate_limit/);
  assert.doesNotMatch(edgeFn, /log_ai_generation/);
  assert.match(migration, /pg_advisory_xact_lock/i);
  assert.match(migration, /INSERT INTO ai_generation_log/i);
  assert.match(migration, /REVOKE EXECUTE ON FUNCTION claim_ai_generation\(uuid\) FROM PUBLIC, anon, authenticated/i);
});

test('the old client-callable AI quota functions are dropped', async () => {
  // log_ai_generation was executable by anon, so anyone with a review-page
  // session token could fill a business's AI quota. claim_ai_generation replaced it.
  const migration = await read('supabase/migrations/20260926120000_drop_superseded_ai_quota_functions.sql');

  assert.match(migration, /DROP FUNCTION IF EXISTS log_ai_generation\(uuid\);/);
  assert.match(migration, /DROP FUNCTION IF EXISTS check_ai_rate_limit\(uuid\);/);
});

test('server-only database functions are revoked from anon and authenticated, not just PUBLIC', async () => {
  // Supabase grants EXECUTE to anon/authenticated directly on new public
  // functions, so REVOKE ... FROM PUBLIC alone leaves them callable over RPC.
  const { readdir } = await import('node:fs/promises');
  const dir = new URL('../supabase/migrations/', import.meta.url);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const sql = (await Promise.all(files.map((f) => readFile(new URL(f, dir), 'utf8')))).join('\n');

  for (const fn of [
    'activate_or_renew_subscription',
    'process_paid_order',
    'purge_expired_personal_data',
    'preserve_financial_records_for_erasure',
  ]) {
    assert.match(
      sql,
      new RegExp(`REVOKE EXECUTE ON FUNCTION ${fn}\\([^)]*\\) FROM PUBLIC, anon, authenticated;`),
      `${fn} must be revoked from anon and authenticated`,
    );
    assert.doesNotMatch(sql, new RegExp(`GRANT EXECUTE ON FUNCTION ${fn}\\([^)]*\\) TO [^;]*(anon|authenticated)`));
  }
});

test('an ended subscription stops the QR page, AI drafting, and dashboard data', async () => {
  const [sql, aiFn, layout, billing] = await Promise.all([
    read('supabase/migrations/20260925110000_enforce_subscription_access.sql'),
    read('supabase/functions/generate-review/index.ts'),
    read('src/pages/dashboard/DashboardLayout.tsx'),
    read('src/pages/dashboard/BillingPage.tsx'),
  ]);

  // Access means a trial or paid plan that has not expired yet.
  assert.match(sql, /status IN \('trial', 'active'\)\s+AND expires_at > now\(\)/);
  // QR page: no new review sessions.
  assert.match(sql, /NOT business_has_active_subscription\(v_business\.id\)/);
  // Dashboard data is hidden at the database, not only in the UI.
  for (const table of ['review_sessions', 'review_session_topics', 'private_feedback', 'analytics_events']) {
    assert.match(sql, new RegExp(`ON ${table}\\s+AS RESTRICTIVE`), `${table} needs a restrictive subscription policy`);
  }
  assert.match(sql, /REVOKE EXECUTE ON FUNCTION business_has_active_subscription\(uuid\) FROM PUBLIC, anon;/);

  // AI drafting checks before calling the provider.
  const check = aiFn.indexOf('business_has_active_subscription');
  assert.ok(check > 0, 'generate-review must check the subscription');
  assert.ok(check < aiFn.indexOf('buildPrompt(trustedRequest)'), 'subscription check must run before the AI call');

  // Dashboard redirects to billing, keeps billing and settings open, and unlocks after payment.
  assert.match(layout, /<Navigate to="\/dashboard\/billing" replace \/>/);
  assert.match(billing, /refreshSubscription\(\)/);
});

test('owners who have never paid stay on onboarding\'s payment step, not in the app', async () => {
  const [gate, onboarding, layout] = await Promise.all([
    read('src/lib/payment-gate.ts'),
    read('src/pages/onboarding/OnboardingPage.tsx'),
    read('src/pages/dashboard/DashboardLayout.tsx'),
  ]);

  // Paid means the ₹1 AutoPay check went through or a plan was bought; a
  // subscription alone (the old sign-up-only trial) is not enough.
  assert.match(gate, /\.not\('auth_payment_id', 'is', null\)/);
  assert.match(gate, /\.eq\('status', 'paid'\)/);
  assert.match(gate, /return 'unknown'/);

  // Onboarding resumes at the payment step instead of opening the app...
  assert.match(onboarding, /paymentGate\(existing\.id\)/);
  assert.match(onboarding, /if \(gate !== 'not_paid'\) \{\s*navigate\('\/dashboard'/);
  assert.match(onboarding, /setStep\(STEP\.trial\)/);
  assert.match(onboarding, /<PayOncePlans/);
  // ...and offers no way into the dashboard before paying.
  assert.doesNotMatch(onboarding, /Do it later from Billing/);

  // The dashboard sends unpaid owners back, keeping Settings for account deletion.
  assert.match(layout, /notPaid && location\.pathname !== '\/dashboard\/settings' \? \(\s*<Navigate to="\/onboarding" replace \/>/);
});

test('dashboard access rule matches the database rule', async () => {
  const lib = await read('src/lib/subscription.ts');
  assert.match(lib, /status !== 'trial' && subscription\.status !== 'active'/);
  assert.match(lib, /'\/dashboard\/billing', '\/dashboard\/settings'/);
});

test('choosing "Other" requires the owner to type their own category, which is saved', async () => {
  const [onboarding, settings, categories] = await Promise.all([
    read('src/pages/onboarding/OnboardingPage.tsx'),
    read('src/pages/dashboard/SettingsPage.tsx'),
    read('src/config/categories.ts'),
  ]);

  assert.match(categories, /export const OTHER_CATEGORY = 'other'/);
  assert.match(onboarding, /category === OTHER_CATEGORY \? customCategory\.trim\(\) : category/);
  assert.match(onboarding, /if \(category === OTHER_CATEGORY\) return customCategory\.trim\(\)\.length >= 2;/);
  assert.match(onboarding, /p_category: effectiveCategory/);
  // Settings shows a stored custom category under "Other" instead of losing it.
  assert.match(settings, /isPresetCategory\(business\.category\)/);
  assert.match(settings, /category: effectiveCategory/);
});

test('AI topic suggestions are owner-only, rate limited, and gated like other paid features', async () => {
  const [fn, sql, config, onboarding, settings, privacy] = await Promise.all([
    read('supabase/functions/suggest-topics/index.ts'),
    read('supabase/migrations/20260925120000_topic_suggestion_rate_limit.sql'),
    read('supabase/config.toml'),
    read('src/pages/onboarding/OnboardingPage.tsx'),
    read('src/pages/dashboard/SettingsPage.tsx'),
    read('src/pages/legal/PrivacyPolicyPage.tsx'),
  ]);

  assert.match(config, /\[functions\.suggest-topics\]\s+verify_jwt = true/);
  assert.match(fn, /isAllowedBrowserOrigin\(req\)/);
  assert.match(fn, /admin\.auth\.getUser\(accessToken\)/);
  assert.match(fn, /business_has_active_subscription/);
  // The rate limit is claimed before the paid AI call.
  for (const call of ['await geminiGenerate', 'await anthropicGenerate', 'await openaiGenerate']) {
    assert.ok(fn.indexOf('claim_topic_suggestion') < fn.indexOf(call), `rate limit must come before ${call}`);
  }
  assert.match(sql, /REVOKE EXECUTE ON FUNCTION claim_topic_suggestion\(uuid\) FROM PUBLIC, anon, authenticated;/);
  assert.match(sql, /ON DELETE CASCADE/);

  assert.match(onboarding, /<AiTopicSuggestions/);
  assert.match(settings, /<AiTopicSuggestions/);
  assert.match(privacy, /suggest review topics/);
});

test('owners get help finding their Google review link', async () => {
  const [help, urlSafety, onboarding, settings] = await Promise.all([
    read('src/components/GoogleReviewLinkHelp.tsx'),
    read('src/lib/url-safety.ts'),
    read('src/pages/onboarding/OnboardingPage.tsx'),
    read('src/pages/dashboard/SettingsPage.tsx'),
  ]);

  assert.match(urlSafety, /https:\/\/search\.google\.com\/local\/writereview\?placeid=\$\{encodeURIComponent/);
  assert.match(help, /places-placeid-finder/);
  assert.match(help, /Ask for reviews/);
  // Every external link opens safely in a new tab.
  const blankTargets = help.match(/target="_blank"/g).length;
  assert.equal(help.match(/rel="noopener noreferrer"/g).length, blankTargets);
  assert.match(onboarding, /<GoogleReviewLinkHelp/);
  assert.match(settings, /<GoogleReviewLinkHelp/);
});

test('password reset lands on a page that sets the new password', async () => {
  const [auth, app, page] = await Promise.all([
    read('src/lib/auth-context.tsx'),
    read('src/App.tsx'),
    read('src/pages/auth/ResetPasswordPage.tsx'),
  ]);

  assert.match(auth, /redirectTo: `\$\{window\.location\.origin\}\/reset-password`/);
  assert.match(auth, /PASSWORD_RECOVERY/);
  assert.match(auth, /auth\.updateUser\(\{ password \}\)/);
  assert.match(app, /path="\/reset-password"/);
  assert.match(page, /updatePassword\(password\)/);
});

test('account deletion copies financial records before touching AutoPay or the account', async () => {
  const fn = await read('supabase/functions/delete-account/index.ts');
  const preserve = fn.indexOf('"preserve_financial_records_for_erasure"');
  const cancel = fn.indexOf('await cancelMandateAtRazorpay(mandate)');
  const remove = fn.indexOf('auth.admin.deleteUser(userId)');
  assert.ok(preserve > 0 && cancel > preserve && remove > cancel, 'preserve, then cancel AutoPay, then delete');
});

test('a lapsed business\'s QR code sends customers to Google instead of blaming their connection', async () => {
  const [page, migration] = await Promise.all([
    read('src/pages/customer/CustomerReviewPage.tsx'),
    read('supabase/migrations/20260926140000_lapsed_business_qr_fallback.sql'),
  ]);
  // "Business not found" is a refusal, not a network failure: never offer a
  // pointless retry or tell the customer to check their internet.
  assert.match(page, /isBusinessNotFound\(error\)/);
  assert.match(page, /get_lapsed_business_review_link/);
  assert.ok(
    page.indexOf('isBusinessNotFound(error)') < page.indexOf('Check your internet connection'),
    'the not-found case must be handled before the connection-error fallback',
  );
  assert.match(migration, /REVOKE EXECUTE ON FUNCTION get_lapsed_business_review_link\(text\) FROM PUBLIC;/);
  assert.match(migration, /NOT business_has_active_subscription\(b\.id\)/);
});

test('the AI treats the customer\'s comment as quoted text, never as instructions', async () => {
  const fn = await read('supabase/functions/generate-review/index.ts');
  assert.match(fn, /never instructions to you/);
  assert.match(fn, /replace\(\/"""\/g/);
  assert.match(fn, /reviews that read alike get filtered out by Google/);
});

test('production builds ship no source maps and keep Supabase off the first page load', async () => {
  const [vite, auth] = await Promise.all([read('vite.config.ts'), read('src/lib/auth-context.tsx')]);
  assert.match(vite, /sourcemap: false/);
  // Every page mounts the auth provider; a static import would put the whole
  // Supabase client (and its fetch polyfill) in front of every first visit.
  assert.doesNotMatch(auth, /^import .*['"]@\/lib\/supabase['"]/m);
  assert.doesNotMatch(auth, /^import .*['"]@\/lib\/use-dashboard-stats['"]/m);
  assert.match(auth, /import\('@\/lib\/supabase'\)/);
});

test('every navigation opens at the top of the page, and back restores the position', async () => {
  const [app, scroll] = await Promise.all([read('src/App.tsx'), read('src/components/ScrollToTop.tsx')]);
  assert.match(app, /<ScrollToTop \/>/);
  assert.match(scroll, /navigationType === 'POP'/);
  // Depends on the whole location (new key per click), so a link to the page
  // already open also scrolls up.
  assert.match(scroll, /\[location, navigationType\]/);
});

test('customers are sent to Google\'s review form itself, never the business listing', async (t) => {
  // The helpers are plain TypeScript with no imports; Node 22.18+ runs them
  // directly. Older Node versions skip this check rather than fail.
  let safety;
  try {
    safety = await import(new URL('../src/lib/url-safety.ts', import.meta.url));
  } catch {
    t.skip('this Node version cannot import TypeScript directly');
    return;
  }
  const { directReviewUrl, isDirectReviewLink, customerReviewUrl, validateGoogleReviewUrl } = safety;

  // g.page short links open the profile; "/review" opens the review box.
  assert.equal(directReviewUrl('https://g.page/r/CQ3xAbCd'), 'https://g.page/r/CQ3xAbCd/review');
  assert.equal(directReviewUrl('https://g.page/r/CQ3xAbCd/review'), 'https://g.page/r/CQ3xAbCd/review');
  assert.equal(directReviewUrl('https://maps.app.goo.gl/AbC123'), 'https://maps.app.goo.gl/AbC123');

  for (const direct of [
    'https://g.page/r/CQ3xAbCd',
    'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4',
  ]) {
    assert.equal(isDirectReviewLink(direct), true, direct);
    assert.equal(validateGoogleReviewUrl(direct), null, `${direct} must be accepted`);
  }
  for (const listing of [
    'https://maps.app.goo.gl/AbC123',
    'https://www.google.com/maps/place/Kaveri+Cafe/@16.5,80.6,17z',
    'https://www.google.com/search?q=cafe#lrd=0x3a35eff:0x9b8a4d,1,,,',
    // Opens the review form on desktop Google Search only, not on phones.
    'https://www.google.com/search?q=cafe#lrd=0x3a35eff:0x9b8a4d,3,,,',
  ]) {
    assert.equal(isDirectReviewLink(listing), false, listing);
    // Owners cannot save a link that would land customers on the listing.
    assert.match(validateGoogleReviewUrl(listing) ?? '', /not the review form/, listing);
  }

  // Still refuses anything that is not http(s).
  assert.equal(customerReviewUrl('javascript:alert(1)'), null);

  const [page, help, overview, settings, onboarding] = await Promise.all([
    read('src/pages/customer/CustomerReviewPage.tsx'),
    read('src/components/GoogleReviewLinkHelp.tsx'),
    read('src/pages/dashboard/DashboardOverview.tsx'),
    read('src/pages/dashboard/SettingsPage.tsx'),
    read('src/pages/onboarding/OnboardingPage.tsx'),
  ]);
  // Saved in the form that opens the review form (g.page links get /review).
  assert.match(settings, /directReviewUrl\(googleReviewUrl\)/);
  assert.match(onboarding, /directReviewUrl\(googleReviewUrl\)/);
  assert.match(page, /customerReviewUrl\(bizInfo\.business_google_review_url\)/);
  assert.match(help, /isDirectReviewLink\(currentUrl\)/);
  assert.match(overview, /isDirectReviewLink\(reviewLink\)/);
});

test('dashboard numbers and lists are read past Supabase\'s 1,000-row cap', async (t) => {
  // Supabase returns at most 1,000 rows per request whatever .limit() asks
  // for, so a larger .limit() silently undercounts instead of failing.
  const files = [
    'src/lib/use-dashboard-stats.ts',
    'src/pages/dashboard/PrivateFeedbackPage.tsx',
    'src/pages/admin/AdminPage.tsx',
  ];
  const sources = await Promise.all(files.map(read));
  for (const [index, source] of sources.entries()) {
    for (const [, n] of source.matchAll(/\.limit\((\d[\d_]*)\)/g)) {
      assert.ok(Number(n.replace(/_/g, '')) <= 1000, `${files[index]} asks for .limit(${n}), which returns at most 1,000 rows`);
    }
  }
  const [stats, feedback, admin] = sources;
  assert.match(stats, /fetchAllRows/);
  assert.match(feedback, /fetchAllRows/);
  // Admin totals are counted by the database, not by counting fetched rows.
  assert.doesNotMatch(admin, /from\('subscriptions'\)\.select\('status, expires_at'\)/);

  let helper;
  try {
    helper = await import(new URL('../src/lib/fetch-all-rows.ts', import.meta.url));
  } catch {
    t.skip('this Node version cannot import TypeScript directly');
    return;
  }
  const table = Array.from({ length: 2500 }, (_, i) => i);
  const requests = [];
  const rows = await helper.fetchAllRows(async (from, to) => {
    requests.push([from, to]);
    // Like Supabase: never more than 1,000 rows, whatever range is asked for.
    return { data: table.slice(from, Math.min(to + 1, from + 1000)), error: null };
  });
  assert.equal(rows.length, 2500);
  assert.deepEqual(requests, [[0, 999], [1000, 1999], [2000, 2999]]);
  await assert.rejects(helper.fetchAllRows(async () => ({ data: null, error: new Error('offline') })), /offline/);
});

test('the owner\'s funnel counts each visit once', async () => {
  const [page, stats, overview, analytics] = await Promise.all([
    read('src/pages/customer/CustomerReviewPage.tsx'),
    read('src/lib/use-dashboard-stats.ts'),
    read('src/pages/dashboard/DashboardOverview.tsx'),
    read('src/pages/dashboard/AnalyticsPage.tsx'),
  ]);
  // "Another version" and length changes are regenerations, not new visits.
  assert.match(page, /draftTracked\.current \? 'review_regenerated' : 'review_generated'/);
  assert.match(page, /if \(opensGoogle && !googleOpenTracked\.current\)/);
  assert.match(stats, /customersWithDraft: firstDraftRes\.count/);
  assert.match(overview, /label: 'Got an AI draft', value: stats\.customersWithDraft/);
  assert.match(analytics, /stats\.googleOpened \/ stats\.customersWithDraft/);
});

test('a failed copy never takes the customer\'s review off the screen', async () => {
  const [page, clipboard] = await Promise.all([
    read('src/pages/customer/CustomerReviewPage.tsx'),
    read('src/lib/clipboard.ts'),
  ]);
  // In-app browsers opened by QR scanner apps often lack the Clipboard API.
  assert.match(clipboard, /navigator\.clipboard\?\.writeText/);
  assert.match(clipboard, /document\.execCommand\('copy'\)/);
  assert.match(page, /copyText\(textToCopy\)/);
  // The thank-you screen replaces the draft, so it only follows a copy that worked.
  assert.match(page, /if \(ok && opensGoogle\) window\.setTimeout\(\(\) => goTo\('done'\)/);
  assert.doesNotMatch(page, /copyReview\(true\);\s*\n\s*\/\/[^\n]*\n\s*window\.setTimeout\(\(\) => goTo\('done'\)/);
  // Back from private feedback returns to the screen the customer came from.
  assert.match(page, /goTo\(feedbackReturnStep\.current\)/);
});

test('a Google link saved under older rules does not block saving the profile', async () => {
  const settings = await read('src/pages/dashboard/SettingsPage.tsx');
  assert.match(settings, /const urlProblem = linkDirty \? validateGoogleReviewUrl\(googleReviewUrl\) : null;/);
});

test('printed QR codes and shared links always point at the public site, never the current address', async () => {
  const source = await read('src/lib/review-source.ts');
  assert.match(source, /PUBLIC_SITE_ORIGIN = legal\.siteUrl/);
  assert.match(source, /\$\{PUBLIC_SITE_ORIGIN\}\/r\//);
  for (const file of [
    'src/pages/dashboard/QRManagementPage.tsx', 'src/pages/onboarding/OnboardingPage.tsx',
    'src/pages/dashboard/SettingsPage.tsx', 'src/components/dashboard/ExtraQrCodes.tsx',
    'src/components/dashboard/WhatsAppRequest.tsx',
  ]) {
    const page = await read(file);
    assert.match(page, /reviewUrlFor\(/, `${file} builds review links with reviewUrlFor`);
    assert.doesNotMatch(page, /location\.origin/, `${file} must not use the browser's address for customer links`);
  }
});

test('browser-facing functions allow the live site with and without www', async () => {
  const [cors, legalSrc] = await Promise.all([
    read('supabase/functions/_shared/cors.ts'),
    read('src/config/legal.ts'),
  ]);
  const siteUrl = legalSrc.match(/siteUrl: '([^']+)'/)[1];
  const host = new URL(siteUrl).host.replace(/^www\./, '');
  const list = cors.match(/PRODUCTION_ORIGINS = \[([^\]]*)\]/)[1];
  // Without these, payments fail with a CORS error on whichever host the
  // visitor typed, even when APP_ORIGINS is missing or has only one of them.
  assert.match(list, new RegExp(`"https://www\\.${host.replace(/\./g, '\\.')}"`));
  assert.match(list, new RegExp(`"https://${host.replace(/\./g, '\\.')}"`));
  assert.match(cors, /\.\.\.PRODUCTION_ORIGINS/);
});

test('owner emails come from support@revio.in, match the site config, and render without gaps', async (t) => {
  const [templatesSrc, legalSrc, plansSrc, email, webhook, verify, scheduler] = await Promise.all([
    read('supabase/functions/_shared/email-templates.ts'), read('src/config/legal.ts'), read('src/config/plans.ts'),
    read('supabase/functions/_shared/email.ts'), read('supabase/functions/razorpay-webhook/index.ts'),
    read('supabase/functions/verify-razorpay-payment/index.ts'), read('supabase/functions/autopay-scheduler/index.ts'),
  ]);
  // The Edge Functions cannot import the web app's config, so keep them in step.
  const field = (src, name) => src.match(new RegExp(`${name}: ['"]([^'"]*)['"]`))?.[1];
  for (const name of ['legalName', 'supportEmail', 'siteUrl']) {
    assert.equal(field(templatesSrc, name), field(legalSrc, name), `${name} differs between email-templates.ts and legal.ts`);
  }
  const address = field(legalSrc, 'address');
  assert.equal(field(templatesSrc, 'address'), address.startsWith('TODO_') ? '' : address, 'receipt address must match legal.ts');
  for (const [, plan, label] of plansSrc.matchAll(/'(\d+_months)': \{ label: '([^']+)'/g)) {
    assert.match(templatesSrc, new RegExp(`"${plan}": "${label}"`), `plan label for ${plan}`);
  }

  // Sent once (email_log), never blocking a payment, and triggered everywhere money settles.
  assert.match(email, /from\("email_log"\)/);
  assert.match(email, /ignoreDuplicates: true/);
  assert.match(email, /waitUntil/);
  assert.match(webhook, /sendReceipt\(admin, orderId\)/);
  assert.match(webhook, /sendPaymentFailed\(admin, orderId\)/);
  assert.match(verify, /sendReceipt\(supabase as AdminClient, razorpay_order_id\)/);
  assert.match(scheduler, /sendPendingEmails\(admin, summary\)/);

  let templates;
  try {
    templates = await import(new URL('../supabase/functions/_shared/email-templates.ts', import.meta.url));
  } catch {
    t.skip('this Node version cannot import TypeScript directly');
    return;
  }
  const emails = [
    templates.receiptEmail({ businessName: 'Kaveri <Café>', plan: '12_months', amountPaise: 299900, paymentId: 'pay_1', orderId: 'order_1', paidAt: '2026-09-29T10:00:00Z', accessUntil: '2027-09-29T10:00:00Z', autopay: true }),
    templates.renewalNoticeEmail({ businessName: 'Kaveri Café', plan: '6_months', amountPaise: 199900, chargeOn: '2026-10-02T10:00:00Z' }),
    templates.paymentFailedEmail({ businessName: 'Kaveri Café', plan: '6_months', amountPaise: 199900, accessUntil: null }),
    templates.planEndingEmail({ businessName: 'Kaveri Café', endsOn: '2026-10-02T10:00:00Z', isTrial: true }),
  ];
  for (const e of emails) {
    assert.ok(e.subject && e.text && e.html);
    assert.doesNotMatch(e.text + e.html, /undefined|NaN|TODO_|Invalid Date/);
    assert.match(e.text, /support@reviyo\.in/);
  }
  assert.match(emails[0].text, /₹2,999/);
  assert.match(emails[0].html, /Kaveri &lt;Café&gt;/, 'business names are escaped in HTML');
  assert.doesNotMatch(emails[0].text, /tax invoice/i, 'a receipt, not a tax invoice, until there is a GSTIN');
  assert.match(emails[1].text, /2 October 2026/);
});

test('sign-in codes go to existing accounts only, and the email template shows the code', async () => {
  const [auth, login, template] = await Promise.all([
    read('src/lib/auth-context.tsx'), read('src/pages/auth/LoginPage.tsx'), read('supabase/templates/magic_link.html'),
  ]);
  assert.match(auth, /signInWithOtp\(\{ email, options: \{ shouldCreateUser: false \} \}\)/);
  assert.match(auth, /verifyOtp\(\{ email, token: code, type: 'email' \}\)/);
  assert.match(login, /autoComplete="one-time-code"/);
  assert.match(template, /\{\{ \.Token \}\}/);
});

test('website visit counting sends no identifiers, skips private pages, and is disclosed', async () => {
  const [lib, counter, app, cookies] = await Promise.all([
    read('src/lib/page-views.ts'),
    read('src/components/PageViewCounter.tsx'),
    read('src/App.tsx'),
    read('src/pages/legal/CookiePolicyPage.tsx'),
  ]);
  assert.match(app, /<PageViewCounter \/>/);
  assert.match(counter, /import\.meta\.env\.PROD/);
  // Public (indexed) pages only, plus sign-up.
  assert.match(lib, /!getPageMeta\(pathname\)\.noindex/);
  // Only the path and the referring host leave the browser; nothing is stored in it.
  assert.match(lib, /body: JSON\.stringify\(\{ p_path: pathname, p_referrer_host:/);
  assert.match(lib, /credentials: 'omit'/);
  assert.doesNotMatch(lib + counter, /localStorage|sessionStorage|document\.cookie|userAgent/);
  // The Cookie Policy says so.
  assert.match(cookies, /We also count visits to our own public pages/);
});

test('Claude generation uses Haiku 4.5 through the official SDK, and the Privacy Policy names Anthropic', async () => {
  const [shared, review, topics, legalSrc] = await Promise.all([
    read('supabase/functions/_shared/anthropic.ts'),
    read('supabase/functions/generate-review/index.ts'),
    read('supabase/functions/suggest-topics/index.ts'),
    read('src/config/legal.ts'),
  ]);
  assert.match(shared, /import Anthropic from "npm:@anthropic-ai\/sdk@\d+\.\d+\.\d+"/);
  assert.match(shared, /DEFAULT_CLAUDE_MODEL = "claude-haiku-4-5"/);
  assert.match(shared, /Deno\.env\.get\("ANTHROPIC_API_KEY"\)/);
  // A cut-off or declined reply is never shown to a customer as a draft.
  assert.match(shared, /stop_reason === "max_tokens"/);
  assert.match(shared, /stop_reason === "refusal"/);
  for (const fn of [review, topics]) {
    assert.match(fn, /provider === "anthropic"/);
    assert.match(fn, /err instanceof Anthropic\.APIError/);
  }
  // Customers' consent covers the provider the policy names.
  assert.match(legalSrc, /aiProviderName: 'Anthropic, PBC \(Claude API\)'/);
});
