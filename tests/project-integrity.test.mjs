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

  assert.match(onboarding, /\.rpc\('create_business_with_defaults'/);
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
  assert.ok(fn.indexOf('claim_topic_suggestion') < fn.indexOf('await geminiGenerate'));
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
