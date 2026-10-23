import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

test('live check requires the server secret and cannot create orders or return credentials', async () => {
  let handler, calls = 0, settings, fail = false;
  class QikinkError extends Error { category = 'auth'; }
  class QikinkClient {
    constructor(options) { settings = options; }
    async checkConnection() { calls++; if (fail) throw new QikinkError('fixture-secret'); return { authenticated: true }; }
    async createOrder() { assert.fail('Live diagnostic must never create an order'); }
  }
  const source = readFileSync(new URL('../supabase/functions/qikink-live-check/index.ts', import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports: {}, Response, TextEncoder, crypto: webcrypto,
    Deno: { serve: fn => { handler = fn; }, env: { get: key => ({ QIKINK_CLIENT_ID: 'fixture-id', QIKINK_LIVE_SECRET: 'fixture-secret' })[key] } },
    require: name => name.endsWith('autopay.ts') ? { getSupabaseSecretKey: () => 'fixture-server' } : { QikinkClient, QikinkError },
  });
  const request = (key, body = { action: 'connection' }) => new Request('https://example.invalid', {
    method: 'POST', headers: key ? { apikey: key } : {}, body: JSON.stringify(body),
  });
  assert.equal((await handler(new Request('https://example.invalid'))).status, 405);
  for (const key of [undefined, 'publishable-key', 'ordinary-user-token']) assert.equal((await handler(request(key))).status, 401);
  for (const body of [{ action: 'sample' }, { action: 'connection', order: {} }, null, []]) assert.equal((await handler(request('fixture-server', body))).status, 400);
  assert.equal((await handler(request('fixture-server', { action: 'x'.repeat(1024) }))).status, 413);
  assert.equal(calls, 0);
  const response = await handler(request('fixture-server'));
  assert.deepEqual(await response.json(), { environment: 'live', authenticated: true });
  assert.equal(settings.environment, 'live');
  assert.equal(settings.clientSecret, 'fixture-secret');
  fail = true;
  const failed = await handler(request('fixture-server'));
  assert.equal(failed.status, 502);
  assert.deepEqual(await failed.json(), { error: 'Live connection check failed', category: 'auth' });
});
