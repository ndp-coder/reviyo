import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const nativeRequire = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));

// Execute the actual component event handlers with deterministic hooks and
// service doubles. No requests, emails, checkouts or payouts leave these tests.
function component(path, overrides = {}) {
  const slots = []; let cursor = 0; const effects = []; const cache = new Map();
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) { const [value] = hooks.useState(() => ({ current: initial })); return value; },
    useCallback(fn) { return fn; },
    useEffect(fn, deps) {
      const index = cursor++;
      if (!slots[index] || deps.some((value, i) => value !== slots[index][i])) { slots[index] = deps; effects.push(fn); }
    },
  };
  const jsx = (type, props) => ({ type, props: props ?? {} });
  function load(id) {
    if (id in overrides) return overrides[id];
    if (id === 'react') return hooks;
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
    if (id === 'lucide-react' || (id !== path && id.startsWith('@/components/'))) return new Proxy({}, { get: (_, name) => String(name) });
    if (!id.startsWith('@/')) return nativeRequire(id);
    const base = resolve(root, 'src', id.slice(2));
    const file = ['.ts', '.tsx'].map(ext => base + ext).find(existsSync);
    assert.ok(file, `Module exists: ${id}`);
    if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText;
    vm.runInNewContext(source, { exports, require: load, console: { error() {} },
      window: { scrollTo() {}, setTimeout, clearTimeout, location: { reload() {} } },
      document: { activeElement: null }, URL, Set, Date, Response, String, Number }, { filename: file });
    return exports;
  }
  const exported = load(path);
  return {
    render(name, props) { cursor = 0; return exported[name](props); },
    async settle() { for (const effect of effects.splice(0)) effect(); for (let i = 0; i < 20; i++) await Promise.resolve(); },
  };
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join('');
  return tree && typeof tree === 'object' ? text(tree.props?.children) : String(tree ?? '');
}
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const payment = { razorpay_order_id: 'order_test', razorpay_payment_id: 'pay_test', razorpay_signature: 'signed_test' };

function checkout(verify = async () => ({ success: true })) {
  const calls = []; const completed = []; let callbacks;
  const runner = component('@/components/PayOncePlans', {
    '@/lib/autopay': { formatRupees: amount => `₹${amount}` },
    'react-router-dom': { Link: 'Link' },
    '@/lib/razorpay': {
      createRazorpayOrder: async (id, plan) => { calls.push({ id, plan }); return { order: { order_id: 'order_test' } }; },
      startRazorpayCheckout: async options => { callbacks = options; },
      verifyRazorpayPayment: verify,
    },
  });
  const render = () => runner.render('PayOncePlans', { businessId: 'business_test', userName: 'Owner', userEmail: 'owner@example.in', onFeedback() {}, onFinished: paid => completed.push(paid) });
  const pay = () => nodes(render()).find(node => node.type === 'Button' && text(node).startsWith('Pay')).props.onClick();
  return { render, pay, calls, completed, get callbacks() { return callbacks; } };
}

test('rapid payment clicks create only one order and dismissed checkouts can be retried', async () => {
  const flow = checkout();
  await Promise.all([flow.pay(), flow.pay()]);
  assert.equal(flow.calls.length, 1);
  flow.callbacks.onDismiss();
  await flow.pay();
  assert.equal(flow.calls.length, 2);
});

test('closing the modal during verification cannot start another payment', async () => {
  const verification = deferred(); const flow = checkout(() => verification.promise);
  await flow.pay();
  const confirmation = flow.callbacks.onSuccess(payment);
  flow.callbacks.onDismiss();
  await flow.pay();
  assert.equal(flow.calls.length, 1);
  verification.resolve({ success: true }); await confirmation;
  assert.deepEqual(flow.completed, [true]);
});

test('delayed confirmation retries the same payment without charging again', async () => {
  const verified = []; let success = false;
  const flow = checkout(async payload => { verified.push(payload); return { success }; });
  await flow.pay(); await flow.callbacks.onSuccess(payment);
  const retry = nodes(flow.render()).find(node => node.type === 'Button' && text(node) === 'Check payment status');
  assert.ok(retry);
  assert.ok(nodes(flow.render()).filter(node => node.type === 'Button' && text(node).startsWith('Pay')).every(node => node.props.disabled));
  await flow.pay(); assert.equal(flow.calls.length, 1);
  success = true; retry.props.onClick();
  for (let i = 0; i < 20; i++) await Promise.resolve();
  assert.equal(verified.length, 2);
  assert.deepEqual(verified[0], verified[1]);
  assert.deepEqual(flow.completed, [false, true]);
});

function owner(claim) {
  const user = { id: 'owner_test', email: 'owner@example.in' };
  const navigate = () => {};
  const runner = component('@/pages/onboarding/OnboardingPage', {
    'react-router-dom': { Link: 'Link', useNavigate: () => navigate },
    '@/lib/auth-context': { useAuth: () => ({ user, profile: null, signOut() {} }) },
    qrcode: { toDataURL: async () => 'data:image/png;base64,demo' },
    '@/lib/payment-gate': { paymentGate: async () => 'not_paid' },
    '@/lib/supabase': { supabase: {
      from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: null }) }),
      rpc: async (name, args) => name === 'my_partner_business_draft'
        ? { data: { id: 'draft_test', name: 'Prepared cafe', category: 'cafe', topics: ['Coffee'], google_review_url: null } }
        : claim(args),
    } },
  });
  const render = () => runner.render('OnboardingPage');
  return { runner, render, async ready() { render(); await runner.settle(); render(); await runner.settle(); } };
}

test('partner owner consent stays unticked and rapid saves claim only once', async () => {
  const pending = deferred(); let calls = 0;
  const flow = owner(() => { calls++; return pending.promise; });
  await flow.ready();
  const review = nodes(flow.render()).find(node => node.type === 'PartnerOwnerReview');
  assert.equal(review.props.accepted, false);
  review.props.onAccepted(true);
  const save = nodes(flow.render()).find(node => node.type === 'Button' && text(node).startsWith('Save and choose'));
  const first = save.props.onClick(); const second = save.props.onClick();
  assert.equal(calls, 1);
  pending.resolve({ data: { id: 'business_test', name: 'Prepared cafe', slug: 'prepared-cafe', trial_eligible: false } });
  await Promise.all([first, second]);
  assert.ok(text(flow.render()).includes('Activate Prepared cafe'));
});

test('a lost connection while claiming a business restores the save button and preserves details', async () => {
  const flow = owner(async () => { throw new Error('Connection lost'); });
  await flow.ready();
  nodes(flow.render()).find(node => node.type === 'PartnerOwnerReview').props.onAccepted(true);
  const save = nodes(flow.render()).find(node => node.type === 'Button' && text(node).startsWith('Save and choose'));
  await save.props.onClick().catch(() => {});
  const review = nodes(flow.render()).find(node => node.type === 'PartnerOwnerReview');
  assert.equal(review.props.busy, false);
  assert.equal(review.props.name, 'Prepared cafe');
  assert.ok(text(flow.render()).includes('connection'));
});
