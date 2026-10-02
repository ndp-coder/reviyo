import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

// Test helper mirroring the Web Crypto HMAC verification in verify-razorpay-payment
async function verifyHmacSha256(data, secret, expectedSignature) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  const generatedSignature = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return generatedSignature.toLowerCase() === expectedSignature.toLowerCase();
}

test('Razorpay HMAC-SHA256 signature verification matches official algorithm', async () => {
  const secret = 'rzp_test_secret_key_12345';
  const orderId = 'order_EKwxwAgItmmXdp';
  const paymentId = 'pay_G3bQJjJ3L1sO6A';

  // Standard Razorpay signature specification: HMAC_SHA256(order_id + "|" + payment_id, secret)
  const payload = `${orderId}|${paymentId}`;
  const validSignature = createHmac('sha256', secret).update(payload).digest('hex');

  // Verify that our Web Crypto implementation validates correct signature
  const isValid = await verifyHmacSha256(payload, secret, validSignature);
  assert.equal(isValid, true, 'Valid Razorpay signature must be accepted');

  // Verify that an invalid or tampered signature is strictly rejected
  const tamperedSignature = validSignature.replace(/^[0-9a-f]/, (c) => (c === 'a' ? 'b' : 'a'));
  const isInvalid = await verifyHmacSha256(payload, secret, tamperedSignature);
  assert.equal(isInvalid, false, 'Tampered Razorpay signature must be rejected');

  // Verify that tampered order ID or payment ID is strictly rejected
  const fakePayload = `${orderId}_tampered|${paymentId}`;
  const isTamperedPayload = await verifyHmacSha256(fakePayload, secret, validSignature);
  assert.equal(isTamperedPayload, false, 'Tampered payload must be rejected');
});

test('payment orders database migration defines schema, RLS, and renewal logic', async () => {
  const migration = await read('supabase/migrations/20260917170000_create_payment_orders.sql');

  assert.match(migration, /CREATE TABLE IF NOT EXISTS payment_orders/i);
  assert.match(migration, /order_id text UNIQUE NOT NULL/i);
  assert.match(migration, /plan text NOT NULL CHECK \(plan IN \('6_months', '12_months'\)\)/i);
  assert.match(migration, /ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY/i);
  assert.match(migration, /CREATE POLICY "payment_orders_select_own"/i);
  assert.match(migration, /CREATE POLICY "payment_orders_select_admin"/i);
  assert.match(migration, /CREATE OR REPLACE FUNCTION activate_or_renew_subscription/i);
});

test('create-razorpay-order edge function verifies user ownership, plans, and amounts', async () => {
  const edgeFn = await read('supabase/functions/create-razorpay-order/index.ts');

  assert.match(edgeFn, /api\.razorpay\.com\/v1\/orders/);
  assert.match(edgeFn, /RAZORPAY_KEY_ID/);
  assert.match(edgeFn, /RAZORPAY_KEY_SECRET/);
  assert.match(edgeFn, /"6_months":\s*\{\s*amount:\s*199900/);
  assert.match(edgeFn, /"12_months":\s*\{\s*amount:\s*299900/);
  assert.match(edgeFn, /supabase\.from\("payment_orders"\)\.insert/);
  assert.match(edgeFn, /if \(insertError\)/);
  assert.match(edgeFn, /Could not safely create payment order/);
  assert.match(edgeFn, /auth\.getUser/);
  assert.match(edgeFn, /Unauthorized access to business/);
});

test('verify-razorpay-payment edge function computes HMAC-SHA256 signature before activating subscription', async () => {
  const edgeFn = await read('supabase/functions/verify-razorpay-payment/index.ts');

  assert.match(edgeFn, /crypto\.subtle\.importKey/);
  assert.match(edgeFn, /SHA-256/);
  assert.match(edgeFn, /process_paid_order/);
  assert.match(edgeFn, /\.eq\("order_id", razorpay_order_id\)/);
  assert.match(edgeFn, /paymentOrder\.business_id !== business_id/);
  assert.match(edgeFn, /paymentOrder\.plan !== plan/);
  assert.match(edgeFn, /paymentResult\?\.subscription/);
});

test('razorpay-webhook edge function handles payment events idempotently', async () => {
  const edgeFn = await read('supabase/functions/razorpay-webhook/index.ts');

  assert.match(edgeFn, /x-razorpay-signature/i);
  assert.match(edgeFn, /RAZORPAY_WEBHOOK_SECRET/);
  assert.match(edgeFn, /order\.paid/);
  assert.match(edgeFn, /payment\.captured/);
  assert.match(edgeFn, /if \(!webhookSecret\)/);
  assert.match(edgeFn, /if \(!webhookSignature\)/);
  assert.doesNotMatch(edgeFn, /if \(webhookSecret && webhookSignature\)/);
  assert.match(edgeFn, /process_paid_order/);
  assert.doesNotMatch(edgeFn, /Access-Control-Allow-Origin/);
  assert.doesNotMatch(edgeFn, /err instanceof Error \? err\.message/);
});

test('frontend Razorpay helper provides checkout and verification logic', async () => {
  const helper = await read('src/lib/razorpay.ts');

  assert.match(helper, /checkout\.razorpay\.com\/v1\/checkout\.js/);
  assert.match(helper, /createRazorpayOrder/);
  assert.match(helper, /verifyRazorpayPayment/);
  assert.match(helper, /startRazorpayCheckout/);
});

test('billing page provides live Razorpay checkout, status badges, and transaction history', async () => {
  const [billing, payOnce] = await Promise.all([
    read('src/pages/dashboard/BillingPage.tsx'),
    read('src/components/PayOncePlans.tsx'),
  ]);

  // One-time checkout lives in a component shared with onboarding's payment step.
  assert.match(billing, /<PayOncePlans/);
  assert.match(payOnce, /createRazorpayOrder/);
  assert.match(payOnce, /startRazorpayCheckout/);
  assert.match(payOnce, /verifyRazorpayPayment/);
  assert.match(billing, /payment_orders/);
  assert.match(billing, /Payment History & Receipts/i);

  // The panel must say who handles payments, without the absolute "100% secure"
  // claim it used to carry. See the claims test in legal-compliance.test.mjs.
  assert.match(billing, /Payments are handled by Razorpay/i);
  assert.match(billing, /never reach\s*\n?\s*Reviyo's servers/i);
});

test('the site security policy lets Razorpay Checkout load everything it needs', async () => {
  const toml = await read('netlify.toml');
  const csp = toml.match(/Content-Security-Policy(?:-Report-Only)? = "([^"]+)"/)[1];
  const directive = (name) => csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? '';

  // checkout.js, plus the fraud-check script it pulls from Razorpay's CDN.
  for (const host of ['https://checkout.razorpay.com', 'https://cdn.razorpay.com']) {
    assert.ok(directive('script-src').includes(host), `script-src must allow ${host}`);
  }
  assert.ok(directive('frame-src').includes('https://api.razorpay.com'));
  assert.ok(directive('connect-src').includes('https://api.razorpay.com'));
  assert.ok(directive('connect-src').includes('https://yagchgwgbttxfihlyddm.supabase.co'));
});

test('supabase/.env.example documents the required Razorpay secrets', async () => {
  const envExample = await read('supabase/.env.example');

  assert.match(envExample, /RAZORPAY_KEY_ID=/);
  assert.match(envExample, /RAZORPAY_KEY_SECRET=/);
  assert.match(envExample, /RAZORPAY_WEBHOOK_SECRET=/);
  assert.match(envExample, /APP_ORIGINS=/);
  assert.doesNotMatch(envExample, /RAZORPAY_KEY_ID=rzp_(?:test|live)_\w+/);
  assert.doesNotMatch(envExample, /RAZORPAY_KEY_SECRET=\w+/);
  assert.doesNotMatch(envExample, /RAZORPAY_WEBHOOK_SECRET=\w+/);
});

test('browser-facing edge functions use an origin allowlist instead of wildcard CORS', async () => {
  const functionPaths = [
    'supabase/functions/generate-review/index.ts',
    'supabase/functions/create-razorpay-order/index.ts',
    'supabase/functions/verify-razorpay-payment/index.ts',
  ];

  for (const path of functionPaths) {
    const source = await read(path);
    assert.match(source, /getCorsHeaders/);
    assert.match(source, /isAllowedBrowserOrigin/);
    assert.doesNotMatch(source, /Access-Control-Allow-Origin["']:\s*["']\*["']/);
  }
});

test('payment fulfillment is atomic and uses the stored order values', async () => {
  const migration = await read('supabase/migrations/20260917170000_create_payment_orders.sql');

  assert.match(migration, /CREATE OR REPLACE FUNCTION process_paid_order/i);
  assert.match(migration, /FOR UPDATE/i);
  assert.match(migration, /v_order\.business_id/i);
  assert.match(migration, /v_order\.plan/i);
  assert.match(migration, /IF v_order\.status = 'paid'/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION process_paid_order/i);
  assert.match(migration, /idx_payment_orders_payment_id_unique/i);
});

test('AutoPay plan prices match the one-time checkout prices', async () => {
  const [oneTime, autopay, client] = await Promise.all([
    read('supabase/functions/create-razorpay-order/index.ts'),
    read('supabase/functions/_shared/autopay.ts'),
    // Client display prices live in one place, shared by Billing, AutoPay setup, and the marketing pages.
    read('src/config/plans.ts'),
  ]);
  for (const [plan, paise] of [['1_month', 50000], ['6_months', 199900], ['12_months', 299900]]) {
    assert.match(oneTime, new RegExp(`"${plan}":\\s*\\{\\s*amount:\\s*${paise}`));
    assert.match(autopay, new RegExp(`"${plan}":\\s*${paise}`));
    assert.match(client, new RegExp(`'${plan}':\\s*\\{[^}]*price:\\s*${paise / 100}`));
  }
  // The authorisation is exactly ₹1 and is always refunded.
  assert.match(autopay, /export const AUTH_AMOUNT = 100;/);
  assert.match(autopay, /\/refund`/);
});

test('AutoPay setup verifies signatures, requires explicit consent, and never charges from the browser', async () => {
  const [verify, create, scheduler, setup, config] = await Promise.all([
    read('supabase/functions/verify-autopay-mandate/index.ts'),
    read('supabase/functions/create-autopay-mandate/index.ts'),
    read('supabase/functions/autopay-scheduler/index.ts'),
    read('src/components/AutopaySetup.tsx'),
    read('supabase/config.toml'),
  ]);
  assert.match(verify, /verifyHmacSha256\(`\$\{orderId\}\|\$\{paymentId\}`/);
  assert.match(create, /frequency: "as_presented"/);
  assert.match(create, /max_amount: amount/);
  // The scheduler is only reachable with the cron secret, and claims an order before charging it.
  assert.match(scheduler, /AUTOPAY_CRON_SECRET/);
  assert.ok(scheduler.indexOf('.eq("status", "created")\n      .select("id")') < scheduler.indexOf('/payments/create/recurring'));
  assert.match(config, /\[functions\.autopay-scheduler\]\s+verify_jwt = false/);
  // Consent starts unticked.
  assert.match(setup, /useState\(false\);\s*\n\s*const \[consentError/);
});

test('public pages no longer promise "no card" or "no auto-renewal"', async () => {
  const pages = await Promise.all([
    'src/pages/LandingPage.tsx', 'src/pages/PricingPage.tsx', 'src/pages/auth/SignupPage.tsx',
    'src/pages/legal/TermsPage.tsx', 'src/pages/legal/RefundPolicyPage.tsx', 'src/pages/dashboard/BillingPage.tsx',
  ].map(read));
  for (const page of pages) {
    assert.doesNotMatch(page, /no (credit )?card (is )?(required|needed)|needs no card|No card needed/i);
    assert.doesNotMatch(page, /Plans do not auto-renew|No auto-renewal/i);
  }
});

test('one-time payments count only once Razorpay has actually captured the money', async () => {
  const [create, verify] = await Promise.all([
    read('supabase/functions/create-razorpay-order/index.ts'),
    read('supabase/functions/verify-razorpay-payment/index.ts'),
  ]);

  // Orders ask Razorpay to capture automatically, whatever the account default.
  assert.match(create, /payment_capture:\s*true/);

  // A valid signature only proves authorization. The browser path re-reads the
  // payment, checks it belongs to this order and amount, captures it if needed,
  // and refuses anything not captured — all before the plan is granted.
  const fetchPayment = verify.indexOf('razorpay(`/payments/${encodeURIComponent(razorpay_payment_id)}`)');
  const capture = verify.indexOf('/capture`');
  const requireCaptured = verify.indexOf('payment.status !== "captured"');
  const fulfil = verify.indexOf('"process_paid_order"');
  assert.ok(fetchPayment > 0 && capture > fetchPayment && requireCaptured > capture, 'payment is checked and captured');
  assert.ok(fulfil > requireCaptured, 'the plan is granted only after capture is confirmed');
  assert.match(verify, /payment\?\.amount !== paymentOrder\.amount/);
  assert.match(verify, /payment\?\.order_id !== razorpay_order_id/);
});
