import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function loadGate(rows, failures = []) {
  const source = readFileSync(new URL('../src/lib/payment-gate.ts', import.meta.url), 'utf8');
  const exports = {};
  const queried = [];
  const supabase = { from(table) {
    queried.push(table);
    const chain = { select() { return chain; }, eq() { return chain; }, in() { return chain; }, gt() { return chain; },
      limit() { return Promise.resolve({ data: rows[table] ?? [], error: failures.includes(table) ? new Error('offline') : null }); } };
    return chain;
  } };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { exports, require: () => ({ supabase }) });
  return { gate: exports.paymentGate, queried };
}

test('mandate authorisation alone cannot unlock onboarding', async () => {
  const { gate, queried } = loadGate({ autopay_mandates: [{ id: 'refundable-check' }] });
  assert.equal(await gate('business'), 'not_paid');
  assert.ok(!queried.includes('autopay_mandates'));
});
test('a full paid order or existing access permits onboarding completion', async () => {
  for (const table of ['payment_orders', 'subscriptions']) {
    const { gate } = loadGate({ [table]: [{ id: 'confirmed' }] });
    assert.equal(await gate('business'), 'paid');
  }
});
test('failed access lookup cannot prompt an owner to pay again', async () => {
  for (const table of ['payment_orders', 'subscriptions']) {
    const { gate } = loadGate({}, [table]);
    assert.equal(await gate('business'), 'unknown');
  }
});
