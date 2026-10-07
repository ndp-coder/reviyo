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
  const slots = []; let cursor = 0; const effects = []; const cache = new Map(); const cleanups = new Map();
  const hooks = {
    createContext: () => ({ Provider: 'AuthContextProvider' }),
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) { const [value] = hooks.useState(() => ({ current: initial })); return value; },
    useCallback(fn) { return fn; },
    useEffect(fn, deps) {
      const index = cursor++;
      if (!slots[index] || deps.some((value, i) => value !== slots[index][i])) {
        slots[index] = deps;
        effects.push(() => { cleanups.get(index)?.(); cleanups.set(index, fn()); });
      }
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
      document: { activeElement: null }, URL, Set, Date, Response, String, Number, Error, DOMException }, { filename: file });
    return exports;
  }
  const exported = load(path);
  return {
    render(name, props) { cursor = 0; return exported[name](props); },
    async settle() { for (const effect of effects.splice(0)) effect(); for (let i = 0; i < 20; i++) await Promise.resolve(); },
    unmount() { for (const cleanup of cleanups.values()) cleanup?.(); cleanups.clear(); },
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

test('password recovery reuses account routing without repeating a successful password change',async()=>{
  let saves = 0;
  const runner=component('@/pages/auth/ResetPasswordPage',{
    'react-router-dom':{Link:'Link'},
    '@/pages/auth/AuthLayout':{AuthLayout:'AuthLayout'},
    '@/lib/auth-context':{useAuth:()=>({user:{email:'partner@example.in'},loading:false,updatePassword:async()=>{ saves++; return {error:null}; }})},
  });
  const render=()=>runner.render('ResetPasswordPage');
  nodes(render()).find(n=>n.type==='Input').props.onChange({target:{value:'long-enough'}});
  await nodes(render()).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
  assert.match(text(render()), /Password changed/);
  nodes(render()).find(n=>n.type==='Button').props.onClick();
  assert.equal(render().type, 'AccountRedirect'); assert.equal(saves, 1);
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

test('training keeps the latest chapter request before metadata and follows manual seeking', async () => {
  const runner = component('@/pages/partners/PartnerTraining');
  const render = () => runner.render('PartnerTraining');
  const initial = render();
  const player = nodes(initial).find(n => n.type === 'video');
  const media = { readyState: 0, currentTime: 0, play: async () => {} };
  player.props.ref.current = media;
  const buttons = nodes(initial).filter(n => n.type === 'Button');
  buttons[3].props.onClick();
  buttons[10].props.onClick();
  assert.equal(media.currentTime, 0, 'do not seek an unloaded media resource');
  media.readyState = 1;
  player.props.onLoadedMetadata();
  const chapterTimes = nodes(initial).filter(n => n.type === 'Button').map(n => text(n));
  assert.ok(chapterTimes[10].includes('Guide the invitation'));
  // The chapter track ships with the video; compare seeking with its timestamps.
  const vtt = readFileSync(resolve(root, 'public/media/partner-training-chapters.vtt'), 'utf8');
  const starts = [...vtt.matchAll(/^(\d{2}):(\d{2}):(\d{2})\.(\d{3}) -->/gm)]
    .map(m => Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000);
  assert.equal(media.currentTime, starts[10]);
  media.currentTime = starts[2] + 1;
  player.props.onSeeked();
  assert.equal(nodes(render()).filter(n => n.type === 'Button')[2].props['aria-current'], 'true');
  nodes(render()).filter(n => n.type === 'Button')[4].props.onClick();
  assert.equal(media.currentTime, starts[4]);
});

test('training playback failures preserve the complete written class and show recovery', async () => {
  const runner = component('@/pages/partners/PartnerTraining');
  const render = () => runner.render('PartnerTraining');
  const initial = render();
  const player = nodes(initial).find(n => n.type === 'video');
  player.props.ref.current = { readyState: 1, currentTime: 0, play: async () => { throw new DOMException('Blocked', 'NotAllowedError'); } };
  nodes(initial).find(n => n.type === 'Button').props.onClick();
  await Promise.resolve(); await Promise.resolve();
  assert.match(text(render()), /Press play on the video/);
  player.props.onError();
  assert.match(text(render()), /video could not load/);
  assert.match(text(render()), /Read the full class and practice scripts/);
  assert.match(text(render()), /What if payment is delayed/);
  assert.ok(nodes(render()).find(n => n.type === 'a' && n.props.href === '/media/partner-training.mp4'));
});

function accountRedirect(access, state = { user: { id: 'account_test' }, profile: { id: 'account_test', role: 'user' }, loading: false }) {
  const calls = [];
  const runner = component('@/components/AccountRedirect', {
    'react-router-dom': { Navigate: 'Navigate' },
    '@/lib/auth-context': { useAuth: () => ({ ...state, signOut() {} }) },
    '@/lib/supabase': { supabase: { rpc: async name => { calls.push(name); return access(); } } },
  });
  return { runner, state, calls, render: () => runner.render('AccountRedirect') };
}

test('generic account entry sends active partners to their dashboard, including passwordless invitations', async () => {
  for (const password_set of [true, false]) {
    const flow = accountRedirect(async () => ({ data: { invited: true, password_set } }));
    assert.equal(flow.render().props.role, 'status');
    await flow.runner.settle();
    assert.equal(flow.render().props.to, '/partners');
    assert.equal(flow.render().props.replace, true);
    assert.deepEqual(flow.calls, ['my_partner_access']);
  }
});

test('owners and inactive partners keep business setup; developers go directly to admin', async () => {
  const owner = accountRedirect(async () => ({ data: { invited: false, password_set: true } }));
  owner.render(); await owner.runner.settle();
  assert.equal(owner.render().props.to, '/onboarding');
  const admin = accountRedirect(async () => { throw new Error('Unneeded lookup'); }, {
    user: { id: 'developer' }, profile: { id: 'developer', role: 'admin' }, loading: false,
  });
  assert.equal(admin.render().props.to, '/admin'); await admin.runner.settle();
  assert.deepEqual(admin.calls, []);
});

test('account access errors never misroute partners into owner signup and can be retried', async () => {
  let attempts = 0;
  const flow = accountRedirect(async () => {
    attempts++;
    if (attempts === 1) return { error: { message: 'offline' } };
    if (attempts === 2) return { data: {} };
    if (attempts === 3) throw new Error('Connection lost');
    return { data: { invited: true, password_set: true } };
  });
  flow.render(); await flow.runner.settle();
  for (let i = 0; i < 3; i++) {
    assert.ok(!nodes(flow.render()).some(n => n.type === 'Navigate'));
    assert.match(text(flow.render()), /could not find your dashboard/);
    nodes(flow.render()).find(n => n.type === 'Button' && text(n) === 'Try again').props.onClick();
    flow.render(); await flow.runner.settle();
  }
  assert.equal(flow.render().props.to, '/partners');
});

test('account routing waits for auth and ignores responses belonging to a previous account', async () => {
  const pending = deferred(); let checks = 0;
  const flow = accountRedirect(() => ++checks === 1 ? pending.promise : Promise.resolve({ data: { invited: false } }));
  flow.state.loading = true;
  flow.render(); await flow.runner.settle();
  assert.deepEqual(flow.calls, []);
  flow.state.loading = false;
  flow.render(); await flow.runner.settle();
  flow.state.user = { id: 'another_owner' };
  flow.state.profile = { id: 'another_owner', role: 'user' };
  flow.render(); await flow.runner.settle();
  assert.equal(flow.render().props.to, '/onboarding');
  pending.resolve({ data: { invited: true } });
  await flow.runner.settle();
  assert.equal(flow.render().props.to, '/onboarding');
  flow.state.user = null;
  flow.state.profile = null;
  assert.equal(flow.render().props.to, '/login');
});

test('normal password and email-code sign-in both use account routing after authentication', async () => {
  for (const mode of ['password', 'code']) {
    const calls = [];
    const auth = { user: null, signIn: async (...args) => { calls.push(['password', ...args]); return { error: null }; },
      sendSignInCode: async address => { calls.push(['send', address]); return { error: null }; },
      verifySignInCode: async (...args) => { calls.push(['code', ...args]); return { error: null }; } };
    const runner = component('@/pages/auth/LoginPage', {
      'react-router-dom': { Link: 'Link', useNavigate: () => () => { throw new Error('Do not hardcode owner onboarding'); } },
      '@/lib/auth-context': { useAuth: () => auth },
    });
    const render = () => runner.render('LoginPage');
    if (mode === 'code') nodes(render()).find(n => n.type === 'button' && text(n).includes('email code instead')).props.onClick();
    nodes(render()).find(n => n.type === 'Input' && n.props.label === 'Email').props.onChange({ target: { value: 'partner@example.in' } });
    if (mode === 'password') nodes(render()).find(n => n.type === 'Input' && n.props.label === 'Password').props.onChange({ target: { value: 'partner-password' } });
    await nodes(render()).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
    if (mode === 'code') {
      nodes(render()).find(n => n.type === 'Input' && n.props.label === 'Sign-in code').props.onChange({ target: { value: '123456' } });
      await nodes(render()).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
    }
    assert.ok(calls.some(c => c[0] === mode));
    auth.user = { id: 'partner_test' };
    assert.equal(render().type, 'AccountRedirect');
  }
});

function authProvider(profileRequest = async id => ({ data: { id, role: 'user' } })) {
  const bootstrap = deferred(); let listener; let cleared = 0;
  const runner = component('@/lib/auth-context', {
    'react-router-dom': { useNavigate: () => () => {} },
    '@/lib/dashboard-stats-cache': { clearDashboardStatsCache() { cleared++; } },
    '@/lib/supabase': { supabase: {
      auth: {
        getSession: () => bootstrap.promise,
        onAuthStateChange: callback => { listener = callback; return { data: { subscription: { unsubscribe() {} } } }; },
        signInWithPassword: async () => { throw new Error('Offline'); },
        signInWithOtp: async () => { throw new Error('Offline'); },
        verifyOtp: async () => { throw new Error('Offline'); },
        resetPasswordForEmail: async () => { throw new Error('Offline'); },
        updateUser: async () => { throw new Error('Offline'); },
        signUp: async () => { throw new Error('Offline'); },
      },
      from: () => ({ select() { return this; }, eq(_, id) { this.id = id; return this; }, maybeSingle() { return profileRequest(this.id); } }),
    } },
  });
  const state = () => runner.render('AuthProvider', { children: null }).props.value;
  const emit = (event, id = null) => listener(event, id ? { user: { id, email: `${id}@example.in` } } : null);
  return { runner, bootstrap, state, emit, get cleared() { return cleared; } };
}

test('auth keeps role-dependent pages loading until the current profile has arrived', async () => {
  const profile = deferred(); const flow = authProvider(() => profile.promise);
  flow.state(); await flow.runner.settle();
  flow.bootstrap.resolve({ data: { session: null } }); await flow.runner.settle();
  assert.equal(flow.state().loading, false);
  flow.emit('SIGNED_IN', 'developer');
  assert.equal(flow.state().loading, true);
  assert.equal(flow.state().profile, null);
  profile.resolve({ data: { id: 'developer', role: 'admin' } }); await flow.runner.settle();
  assert.equal(flow.state().profile.role, 'admin'); assert.equal(flow.state().loading, false);
});

test('a profile response after logout cannot restore the previous account or role', async () => {
  const profile = deferred(); const flow = authProvider(() => profile.promise);
  flow.state(); await flow.runner.settle();
  flow.bootstrap.resolve({ data: { session: null } }); await flow.runner.settle();
  flow.emit('SIGNED_IN', 'old_admin'); await flow.runner.settle();
  flow.emit('SIGNED_OUT');
  profile.resolve({ data: { id: 'old_admin', role: 'admin' } }); await flow.runner.settle();
  assert.equal(flow.state().user, null); assert.equal(flow.state().profile, null);
  assert.equal(flow.state().loading, false); assert.equal(flow.cleared, 1);
});

test('the startup session cannot overwrite a newer sign-in event', async () => {
  const flow = authProvider(); flow.state(); await flow.runner.settle();
  flow.emit('SIGNED_IN', 'current_partner'); await flow.runner.settle();
  flow.bootstrap.resolve({ data: { session: { user: { id: 'old_owner' } } } }); await flow.runner.settle();
  assert.equal(flow.state().user.id, 'current_partner'); assert.equal(flow.state().profile.id, 'current_partner');
});

test('unexpected network errors from auth actions return a retryable error to forms', async () => {
  const flow = authProvider(); const auth = flow.state();
  for (const [method, args] of [
    ['signIn', ['owner@example.in', 'password']], ['sendSignInCode', ['owner@example.in']],
    ['verifySignInCode', ['owner@example.in', '123456']], ['resetPassword', ['owner@example.in']],
    ['updatePassword', ['new-password']], ['signUp', ['owner@example.in', 'password', 'terms-version']],
  ]) {
    const result = await auth[method](...args);
    assert.equal(typeof result.error, 'string'); assert.match(result.error, /connection|try again/i);
  }
});

test('profile refreshes cannot replace a newer account and unmounted sessions stop updating', async () => {
  const refresh = deferred(); let reads = 0;
  const flow = authProvider(async id => {
    if (id === 'previous_owner' && ++reads === 2) return refresh.promise;
    return { data: { id, role: 'user' } };
  });
  flow.state(); await flow.runner.settle();
  flow.bootstrap.resolve({ data: { session: null } }); await flow.runner.settle();
  flow.emit('SIGNED_IN', 'previous_owner'); await flow.runner.settle();
  const pendingRefresh = flow.state().refreshProfile(); await flow.runner.settle();
  flow.emit('SIGNED_IN', 'current_partner'); await flow.runner.settle();
  refresh.resolve({ data: { id: 'previous_owner', role: 'admin' } }); await pendingRefresh;
  assert.equal(flow.state().profile.id, 'current_partner');
  const delayed = deferred(); const unmounted = authProvider(() => delayed.promise);
  unmounted.state(); await unmounted.runner.settle();
  unmounted.emit('SIGNED_IN', 'owner'); await unmounted.runner.settle();
  unmounted.runner.unmount();
  delayed.resolve({ data: { id: 'owner', role: 'admin' } }); await unmounted.runner.settle();
  assert.equal(unmounted.state().profile, null);
});

test('profile and startup network failures finish checking instead of leaving a permanent loader', async () => {
  const flow = authProvider(async () => { throw new Error('Offline'); });
  flow.state(); await flow.runner.settle();
  flow.emit('SIGNED_IN', 'owner'); await flow.runner.settle();
  assert.equal(flow.state().profile, null); assert.equal(flow.state().loading, false);
  const bootstrap = authProvider(); bootstrap.state(); await bootstrap.runner.settle();
  bootstrap.bootstrap.resolve({ data: { session: null }, error: { message: 'Offline' } }); await bootstrap.runner.settle();
  assert.equal(bootstrap.state().user, null); assert.equal(bootstrap.state().loading, false);
});

test('a lost connection loading saved partner setups exposes retry instead of a permanent skeleton', async () => {
  let failed = true;
  const runner = component('@/pages/partners/PartnerBusinessSetup', {
    '@/lib/supabase': { supabase: { from: () => ({
      select() { return this; }, order() { return this; },
      async limit() { if (failed) throw new Error('Offline'); return { data: [], error: null }; },
    }) } },
  });
  const render = () => runner.render('PartnerBusinessSetup');
  render(); await runner.settle();
  assert.ok(!nodes(render()).some(n => n.type === 'Skeleton'));
  const alert = nodes(render()).find(n => n.type === 'Alert' && text(n).includes('Could not load saved setups'));
  assert.ok(alert); failed = false; await alert.props.action.props.onClick(); await runner.settle();
  assert.match(text(render()), /No businesses prepared yet/);
});

test('rapid partner invitation submissions send only one email', async () => {
  const pending = deferred(); let invites = 0;
  const runner = component('@/pages/partners/CommissionDashboard', {
    'react-router-dom': { Link: 'Link' },
    '@/lib/auth-context': { useAuth: () => ({ user: { id: 'developer', email: 'dev@example.in' }, profile: { role: 'admin' }, loading: false }) },
    '@/lib/fetch-all-rows': { fetchAllRows: async () => [] },
    '@/lib/supabase': { supabase: { functions: { invoke: async (_, { body }) => {
      if (body.action === 'setup') return { data: { emailReady: true, payoutsReady: true, enabled: true, schedulerReady: true } };
      assert.equal(body.action, 'invite'); invites++; return pending.promise;
    } } } },
  });
  const render = () => runner.render('CommissionDashboard', { developer: true });
  render(); await runner.settle();
  const form = nodes(render()).find(n => n.type === 'form');
  form.props.onSubmit({ preventDefault() {} }); form.props.onSubmit({ preventDefault() {} });
  assert.equal(invites, 1);
  pending.resolve({ data: { ok: true }, error: null }); await runner.settle();
  assert.equal(nodes(render()).find(n => n.type === 'Button' && text(n) === 'Send invitation').props.loading, false);
});

test('a video source failure can be retried without losing the selected time or written lessons', async () => {
  const runner = component('@/pages/partners/PartnerTraining');
  const render = () => runner.render('PartnerTraining');
  const initial = render(); const player = nodes(initial).find(n => n.type === 'video');
  let reloads = 0;
  const media = { currentTime: 120, readyState: 1, load() { reloads++; this.currentTime = 0; } };
  player.props.ref.current = media;
  nodes(initial).find(n => n.type === 'source').props.onError();
  const alert = nodes(render()).find(n => n.type === 'Alert');
  assert.ok(alert); assert.match(text(render()), /Read the full class/);
  alert.props.action.props.onClick(); assert.equal(reloads, 1);
  player.props.onLoadedMetadata(); assert.equal(media.currentTime, 120);
  player.props.onCanPlay(); assert.ok(!nodes(render()).some(n => n.type === 'Alert'));
});
