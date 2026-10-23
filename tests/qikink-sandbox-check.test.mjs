import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';

test('sandbox diagnostics requires a verified developer and only authenticates against sandbox', async () => {
  let handler, role = 'owner', validUser = true, connections = 0, settings, creates = 0, lastPayload;
  const db = {
    auth: { getUser: async token => ({ data: { user: validUser && token === 'valid-token' ? { id: 'user-id' } : null }, error: null }) },
    from: table => {
      assert.equal(table, 'profiles');
      return { select: field => {
        assert.equal(field, 'role');
        return { eq: (column, id) => {
          assert.equal(column, 'id'); assert.equal(id, 'user-id');
          return { single: async () => ({ data: { role }, error: null }) };
        } };
      } };
    },
  };
  class QikinkError extends Error {}
  class QikinkClient {
    constructor(options) { settings = options; }
    async checkConnection() { connections++; return { authenticated: true }; }
    async createOrder(payload) { creates++; lastPayload = payload; return { orderId: '123' }; }
  }
  const source = readFileSync(new URL('../supabase/functions/qikink-sandbox-check/index.ts', import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports: {}, Request, Response, crypto: webcrypto, TextEncoder,
    Deno: { serve: fn => { handler = fn; }, env: { get: key => ({ QIKINK_CLIENT_ID: 'fixture-id', QIKINK_SANDBOX_SECRET: 'fixture-secret' })[key] } },
    require: name => name.endsWith('autopay.ts') ? { createAdminClient: async () => db, getSupabaseSecretKey: () => 'fixture-server-key' } : { QikinkClient, QikinkError, buildStandOrder: async input => { assert.equal(input.sku, 'UAcryDiSt-Wh-NA'); assert.equal(input.email, 'support@reviyo.in'); return { order_number: 'fixture_ref', line_items: [{ sku: input.sku, print_type_id: 5 }] }; } },
  });
  const request = (token, action = 'connection') => new Request('https://example.invalid', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: JSON.stringify({ action }) });
  assert.equal((await handler(request())).status, 401);
  assert.equal((await handler(request('wrong-token'))).status, 401);
  assert.equal((await handler(request('valid-token'))).status, 403);
  assert.equal(connections, 0);
  role = 'admin';
  assert.equal((await handler(request('valid-token', 'live'))).status, 400);
  assert.equal(connections, 0);
  const response = await handler(request('valid-token'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { environment: 'sandbox', authenticated: true });
  assert.equal(settings.environment, 'sandbox');
  assert.equal(connections, 1);
  validUser = false;
  assert.equal((await handler(request('valid-token'))).status, 401);
  assert.equal((await handler(request('fixture-server-key'))).status, 200);
  assert.equal((await handler(new Request('https://example.invalid', { method: 'POST', headers: { apikey: 'fixture-server-key' }, body: JSON.stringify({ action: 'connection' }) }))).status, 200);
  const sample = new Request('https://example.invalid', { method: 'POST', headers: { Authorization: 'Bearer fixture-server-key' }, body: JSON.stringify({ action: 'sample', requestId: '550e8400-e29b-41d4-a716-446655440000' }) });
  assert.equal((await handler(sample)).status, 200);
  assert.equal(creates, 1);
  assert.equal(lastPayload.line_items[0].sku, 'UAcryDiSt-Wh-NA');
  const reference = await handler(new Request('https://example.invalid', { method: 'POST', headers: { apikey: 'fixture-server-key' }, body: JSON.stringify({ action: 'api_reference_sample', requestId: '550e8400-e29b-41d4-a716-446655440000' }) }));
  assert.equal((await reference.json()).sampleType, 'documented_api_fixture');
  assert.equal(lastPayload.line_items[0].sku, 'MVnHs-Wh-S');
  assert.equal(lastPayload.line_items[0].print_type_id, 1);
});
