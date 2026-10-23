import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { inspect } from 'node:util';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const exports = {};
let now = 1000;
class Clock extends Date { static now() { return now; } }
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../supabase/functions/_shared/qikink.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, URL, URLSearchParams, AbortController, setTimeout, clearTimeout, TextEncoder, crypto: webcrypto, Date: Clock });
const { QikinkClient, QikinkError, buildStandOrder } = exports;
const token = () => ({ ClientId: 'fixture-client', Accesstoken: 'fixture-token', expires_in: 3600 });
const created = () => ({ message: 'Order created successfully', order_id: 1234567890, status_code: '200' });
const listed = () => ({ success: true, data: [{ order_id: 1234567890, number: 'fixture-client_ref', status: 'Live' }],
  pagination: { page: 1, per_page: 10, total_results: 1, total_pages: 1, has_next: false }, filters: {} });
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const options = (fetch, extra = {}) => ({ environment: 'sandbox', clientId: 'fixture-client', clientSecret: 'fixture-secret', fetch, ...extra });
const stand = { jobUUID: '550e8400-e29b-41d4-a716-446655440000', name: 'Asha Test Owner', email: 'asha@example.invalid',
  address: { line1: '12 Example Road', line2: 'Unit 2', phone: '9876543210', city: 'Coimbatore', state: 'Tamil Nadu', pincode: '641001' },
  sku: 'UAcryDiSt-Wh-NA', totalOrderValue: 499, designUrl: 'https://assets.example.invalid/design.png', mockupUrl: 'https://assets.example.invalid/mockup.png' };
const safeError = category => error => {
  assert.ok(error instanceof QikinkError);
  assert.equal(error.category, category);
  assert.equal(error.message, 'Qikink request failed');
  assert.doesNotMatch([String(error), error.stack, JSON.stringify(error), inspect(error)].join(' '), /fixture-secret|fixture-token|Example Road|asha@example|vendor-private/);
  assert.equal(error.cause, undefined);
  return true;
};

test('stand payload maps shipping and 4x6 accessories; hashes the whole UUID into a persisted reference', async () => {
  const order = await buildStandOrder(stand);
  assert.equal(order.order_number.length, 14);
  assert.match(order.order_number, /^[a-z0-9]{14}$/);
  assert.equal((await buildStandOrder({ ...stand, jobUUID: stand.jobUUID.toUpperCase() })).order_number, order.order_number);
  assert.notEqual((await buildStandOrder({ ...stand, jobUUID: stand.jobUUID.replace(/0$/, '1') })).order_number, order.order_number);
  assert.equal(order.gateway, 'Prepaid');
  assert.equal(order.qikink_shipping, 1);
  assert.equal(order.total_order_value, 499);
  assert.deepEqual(JSON.parse(JSON.stringify(order.shipping_address)), { first_name: 'Asha', last_name: 'Test Owner', address1: '12 Example Road', address2: 'Unit 2',
    phone: '9876543210', email: 'asha@example.invalid', city: 'Coimbatore', province: 'Tamil Nadu', zip: 641001, country_code: 'IN' });
  const item = order.line_items[0];
  assert.equal(item.sku, stand.sku);
  assert.equal(item.quantity, 1);
  assert.equal(item.price, 499);
  assert.equal(item.print_type_id, 5);
  assert.equal(item.search_from_my_products, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(item.designs)), [{ design_code: order.order_number, width_inches: 4, height_inches: 6,
    placement_sku: 'fr', design_link: stand.designUrl, mockup_link: stand.mockupUrl }]);
  for (const patch of [{ sku: '' }, { jobUUID: 'bad' }, { totalOrderValue: NaN }, { email: '' }, { designUrl: 'file:///tmp/a' },
    { mockupUrl: 'https://a.invalid/' + 'x'.repeat(512) }, { address: { ...stand.address, line1: 'x'.repeat(91) } }]) {
    await assert.rejects(buildStandOrder({ ...stand, ...patch }), safeError('validation'));
  }
});

test('explicit hosts, token form, authentication headers and official create/list routes', async () => {
  for (const environment of ['sandbox', 'live']) {
    const calls = [];
    const client = new QikinkClient(options(async (url, init) => { calls.push({ url, init }); return json(calls.length === 1 ? token() : calls.length === 2 ? created() : listed()); }, { environment }));
    assert.equal((await client.createOrder(await buildStandOrder(stand))).orderId, '1234567890');
    const result = await client.listOrders('client_ref');
    assert.equal(result.orders[0].orderId, '1234567890');
    assert.equal(result.orders[0].reference, 'fixture-client_ref');
    assert.equal(result.orders[0].status, 'Live');
    assert.equal(result.hasNext, false);
    const host = environment === 'sandbox' ? 'https://sandbox.qikink.com' : 'https://api.qikink.com';
    assert.equal(calls[0].url, host + '/api/token');
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(calls[0].init.headers['Content-Type'], 'application/x-www-form-urlencoded');
    assert.equal(new URLSearchParams(calls[0].init.body).get('ClientId'), 'fixture-client');
    assert.equal(new URLSearchParams(calls[0].init.body).get('client_secret'), 'fixture-secret');
    assert.equal(calls[1].url, host + '/api/order/create');
    assert.equal(calls[1].init.method, 'POST');
    assert.equal(calls[1].init.headers['Content-Type'], 'application/json');
    assert.equal(JSON.parse(calls[1].init.body).gateway, 'Prepaid');
    assert.equal(calls[2].url, host + '/api/order/list?order_reference_no=client_ref');
    assert.equal(calls[2].init.method, 'GET');
    for (const { init } of calls) { assert.equal(init.redirect, 'error'); assert.ok(init.signal instanceof AbortSignal); }
    for (const { init } of calls.slice(1)) { assert.equal(init.headers.ClientId, 'fixture-client'); assert.equal(init.headers.Accesstoken, 'fixture-token'); }
    assert.doesNotMatch(inspect(client), /fixture-secret|fixture-token/);
  }
  for (const environment of [undefined, 'https://evil.invalid', 'toString']) assert.throws(() => new QikinkClient(options(() => assert.fail(), { environment })), safeError('validation'));
  assert.throws(() => new QikinkClient(options(() => assert.fail(), { clientId: 'fixture-client\n' })), safeError('validation'));
  const invalid = new QikinkClient(options(() => assert.fail('invalid payload must not reach fetch')));
  const circular = {}; circular.self = circular;
  for (const payload of [null, circular, { toJSON: () => undefined }]) await assert.rejects(invalid.createOrder(payload), safeError('validation'));
});

test('one token acquisition for concurrent callers; cached token expires and refreshes once', async () => {
  let tokens = 0;
  const client = new QikinkClient(options(async url => { if (url.endsWith('/token')) { tokens++; await Promise.resolve(); return json(token()); } return json(created()); }));
  await Promise.all(Array.from({ length: 12 }, () => client.createOrder({})));
  assert.equal(tokens, 1);
  await client.createOrder({});
  assert.equal(tokens, 1);
  now += 3600_000;
  await Promise.all(Array.from({ length: 12 }, () => client.createOrder({})));
  assert.equal(tokens, 2);
});

test('sandbox connection check authenticates without placing or listing an order', async () => {
  const calls = [];
  const client = new QikinkClient(options(async url => { calls.push(url); return json(token()); }));
  assert.equal((await client.checkConnection()).authenticated, true);
  assert.deepEqual(calls, ['https://sandbox.qikink.com/api/token']);
});

test('200 vendor errors, HTTP failures, malformed successes and transport errors are safe; writes never retry', async () => {
  const cases = [[() => json({ error: 'vendor-private fixture-secret Example Road' }), 'vendor'],
    [() => json({ ...created(), status_code: '400' }), 'vendor'], [() => json({ ...created(), success: false }), 'vendor'],
    [() => json(created(), 401), 'auth'], [() => json(created(), 429), 'rate_limit'], [() => json(created(), 500), 'vendor'],
    [() => json({ order_id: 'fixture-token', status_code: '200' }), 'invalid_response'], [() => json({ ...created(), order_id: 0 }), 'invalid_response'],
    [() => json({ order_id: 1 }), 'invalid_response'], [() => json(null), 'invalid_response'],
    [() => new Response('vendor-private fixture-secret', { status: 200 }), 'invalid_response'],
    [() => { throw new Error('fixture-token asha@example.invalid Example Road'); }, 'network']];
  for (const [reply, category] of cases) {
    let writes = 0;
    const client = new QikinkClient(options(async url => url.endsWith('/token') ? json(token()) : (writes++, reply())));
    await assert.rejects(client.createOrder({}), safeError(category));
    assert.equal(writes, 1);
  }
});

test('invalid tokens are never cached, failed single-flight clears, and list responses require valid orders', async () => {
  for (const body of [{ ...token(), Accesstoken: '' }, { ...token(), expires_in: 0 }, { ...token(), expires_in: 'abc' },
    { ...token(), ClientId: 'another-client' }, { ...token(), error: 'fixture-secret' }]) {
    let calls = 0;
    const client = new QikinkClient(options(async () => { calls++; return json(body); }));
    await Promise.all(Array.from({ length: 3 }, () => assert.rejects(client.createOrder({}), safeError('error' in body ? 'vendor' : 'invalid_response'))));
    assert.equal(calls, 1);
  }
  let tokens = 0;
  const client = new QikinkClient(options(async url => url.endsWith('/token') ? (++tokens === 1 ? json({}, 503) : json(token())) : json(listed())));
  await assert.rejects(client.listOrders('ref'), safeError('vendor'));
  assert.equal((await client.listOrders('ref')).orders.length, 1);
  assert.equal(tokens, 2);
  for (const body of [{ success: false, data: [] }, { ...listed(), data: [{}] }, { ...listed(), pagination: {} }]) {
    const other = new QikinkClient(options(async url => json(url.endsWith('/token') ? token() : body)));
    await assert.rejects(other.listOrders('ref'), safeError(body.success === false ? 'vendor' : 'invalid_response'));
  }
  const empty = new QikinkClient(options(async url => json(url.endsWith('/token') ? token() : { ...listed(), data: [] })));
  assert.equal((await empty.listOrders('ref')).orders.length, 0);
});

test('timeouts cover token, writes and response bodies, abort the request, and never retry', async () => {
  for (const stage of ['token', 'write', 'body']) {
    let writes = 0, signal;
    const client = new QikinkClient(options(async (url, init) => {
      if (!url.endsWith('/token')) writes++;
      if (stage !== 'token' && url.endsWith('/token')) return json(token());
      signal = init.signal;
      const wait = () => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('fixture-secret Example Road')), { once: true }));
      return stage === 'body' ? { ok: true, status: 200, json: wait } : wait();
    }, { timeoutMs: 10 }));
    await assert.rejects(client.createOrder({}), safeError('timeout'));
    assert.equal(signal.aborted, true);
    assert.equal(writes, stage === 'token' ? 0 : 1);
  }
});
