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
      document: { activeElement: null }, URL, Set, Date, Response, String, Number, Error }, { filename: file });
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

function passwordSetup(updatePassword, account = 'partner') {
  let completed=0;
  const runner=component('@/components/InvitationPasswordSetup',{
    '@/lib/auth-context':{useAuth:()=>({updatePassword,signOut(){}})},
  });
  const render=()=>runner.render('InvitationPasswordSetup',{email:'partner@example.in',account,onComplete:async()=>{completed++;}});
  const set=(label,value)=>nodes(render()).find(n=>n.type==='Input' && n.props.label===label).props.onChange({target:{value}});
  const submit=()=>nodes(render()).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
  return {render,set,submit,get completed(){return completed;}};
}

test('partner password creation validates both entries and cannot be submitted twice',async()=>{
  const pending=deferred();let calls=0;
  const form=passwordSetup(async()=>{calls++;return pending.promise;});
  form.set('New password','short');form.set('Confirm password','short');await form.submit();
  assert.equal(calls,0);assert.match(text(form.render()),/at least 8/);
  form.set('New password','long-enough');form.set('Confirm password','different');await form.submit();
  assert.equal(calls,0);assert.match(text(form.render()),/do not match/);
  form.set('Confirm password','long-enough');
  const first=form.submit();const second=form.submit();
  assert.equal(calls,1);assert.equal(form.completed,0);
  pending.resolve({error:null});await Promise.all([first,second]);assert.equal(form.completed,1);
});

test('password failures keep partners on setup and allow a safe retry',async()=>{
  let fail=true;
  const form=passwordSetup(async()=>{if(fail) throw new Error('Connection lost');return {error:null};});
  form.set('New password','long-enough');form.set('Confirm password','long-enough');
  await form.submit();assert.equal(form.completed,0);assert.match(text(form.render()),/Connection lost/);
  assert.equal(nodes(form.render()).find(n=>n.type==='Button').props.loading,false);
  fail=false;await form.submit();assert.equal(form.completed,1);
  const rejected=passwordSetup(async()=>({error:'Choose a stronger password.'}));
  rejected.set('New password','long-enough');rejected.set('Confirm password','long-enough');await rejected.submit();
  assert.equal(rejected.completed,0);assert.match(text(rejected.render()),/stronger password/);
});

test('the partner dashboard checks server access before loading private data',async()=>{
  let passwordSet=false, lookupFails=false, reads=0;
  const runner=component('@/pages/partners/CommissionDashboard',{
    'react-router-dom':{Link:'Link'},
    '@/pages/partners/PartnerBusinessSetup':{PartnerBusinessSetup:'PartnerBusinessSetup'},
    '@/components/InvitationPasswordSetup':{InvitationPasswordSetup:'InvitationPasswordSetup'},
    '@/pages/partners/PartnerWalkthrough':{PartnerWalkthrough:'PartnerWalkthrough'},
    '@/lib/auth-context':{useAuth:()=>({user:{id:'partner-user',email:'partner@example.in'},profile:null,loading:false})},
    '@/lib/supabase':{supabase:{rpc:async name=>{assert.equal(name,'my_partner_access');return lookupFails?{error:{message:'offline'}}:{data:{invited:true,password_set:passwordSet}};}}},
    '@/lib/fetch-all-rows':{fetchAllRows:async()=>{reads++;return [{id:'partner',email:'partner@example.in',active:true}];}},
  });
  const render=()=>runner.render('CommissionDashboard',{});
  render();await runner.settle();
  const setup=nodes(render()).find(n=>n.type==='InvitationPasswordSetup');assert.ok(setup);assert.equal(reads,0);
  passwordSet=true;await setup.props.onComplete();
  assert.ok(nodes(render()).find(n=>n.type==='PartnerWalkthrough'));assert.equal(reads,3);
  lookupFails=true;nodes(render()).find(n=>n.type==='Button' && text(n)==='Refresh commissions').props.onClick();await runner.settle();
  assert.ok(!nodes(render()).find(n=>n.type==='PartnerWalkthrough'));assert.match(text(render()),/Could not load commissions/);
});

test('a partner password recovery returns to the private partner dashboard',async()=>{
  const destinations=[];
  const runner=component('@/pages/auth/ResetPasswordPage',{
    'react-router-dom':{Link:'Link',useNavigate:()=>path=>destinations.push(path)},
    '@/pages/auth/AuthLayout':{AuthLayout:'AuthLayout'},
    '@/lib/auth-context':{useAuth:()=>({user:{email:'partner@example.in'},loading:false,updatePassword:async()=>({error:null})})},
    '@/lib/supabase':{supabase:{rpc:async()=>({data:{invited:true,password_set:true}})}},
  });
  const render=()=>runner.render('ResetPasswordPage');
  nodes(render()).find(n=>n.type==='Input').props.onChange({target:{value:'long-enough'}});
  await nodes(render()).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
  nodes(render()).find(n=>n.type==='Button').props.onClick();assert.deepEqual(destinations,['/partners']);
});

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

function owner(claim, access = async () => ({data:false})) {
  const requests=[];
  const user = { id: 'owner_test', email: 'owner@example.in' };
  const navigate = () => {};
  const runner = component('@/pages/onboarding/OnboardingPage', {
    'react-router-dom': { Link: 'Link', useNavigate: () => navigate },
    '@/lib/auth-context': { useAuth: () => ({ user, profile: null, signOut() {} }) },
    qrcode: { toDataURL: async () => 'data:image/png;base64,demo' },
    '@/lib/payment-gate': { paymentGate: async () => 'not_paid' },
    '@/lib/supabase': { supabase: {
      from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: null }) }),
      rpc: async (name, args) => {
        requests.push(name);
        return name === 'owner_setup_password_required' ? access() : name === 'my_partner_business_draft'
          ? { data: { id: 'draft_test', name: 'Prepared cafe', category: 'cafe', topics: ['Coffee'], google_review_url: null } }
          : claim(args);
      },
    } },
  });
  const render = () => runner.render('OnboardingPage');
  return { runner, render, requests, async ready() { render(); await runner.settle(); render(); await runner.settle(); } };
}

test('an owner invitation shows password creation before business review and rechecks after saving',async()=>{
  let needsPassword=true;
  const flow=owner(async()=>{throw new Error('Unexpected claim');},async()=>({data:needsPassword}));
  await flow.ready();
  const setup=nodes(flow.render()).find(n=>n.type==='InvitationPasswordSetup');
  assert.equal(setup.props.account,'owner');assert.equal(setup.props.email,'owner@example.in');
  assert.ok(!flow.requests.includes('my_partner_business_draft'));
  await setup.props.onComplete();await flow.ready();
  assert.ok(nodes(flow.render()).find(n=>n.type==='InvitationPasswordSetup'),'a refresh cannot pretend that a password was saved');
  needsPassword=false;await setup.props.onComplete();await flow.ready();
  assert.ok(flow.requests.includes('my_partner_business_draft'));
  const review=nodes(flow.render()).find(n=>n.type==='PartnerOwnerReview');assert.ok(review);assert.equal(review.props.accepted,false);
  const form=passwordSetup(async()=>({error:null}),'owner');
  assert.equal(nodes(form.render()).find(n=>n.type==='PageHeader').props.title,'Create your account password');
});

test('an owner password access lookup failure cannot expose business review or payment',async()=>{
  const flow=owner(async()=>{throw new Error('Unexpected claim');},async()=>({error:{message:'offline'}}));
  await flow.ready();
  assert.ok(!nodes(flow.render()).find(n=>n.type==='PartnerOwnerReview'));
  assert.ok(!flow.requests.includes('my_partner_business_draft'));
  assert.match(text(flow.render()),/Try again/);
});

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
