import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

test('monthly receipts, advance notices and failed-payment emails identify the actual ₹500 plan', () => {
  const source = readFileSync(new URL('../supabase/functions/_shared/email-templates.ts', import.meta.url), 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports });
  const base = { businessName: 'Monthly salon', plan: '1_month', amountPaise: 50000 };
  const emails = [
    exports.receiptEmail({ ...base, paymentId: 'pay_monthly', orderId: 'order_monthly', paidAt: '2026-10-02T06:00:00Z', accessUntil: '2026-11-02T06:00:00Z', autopay: true }),
    exports.renewalNoticeEmail({ ...base, chargeOn: '2026-11-02T06:00:00Z' }),
    exports.paymentFailedEmail({ ...base, accessUntil: '2026-11-02T06:00:00Z' }),
  ];
  for (const email of emails) {
    assert.match(email.text, /Monthly/);
    assert.match(email.text, /₹500/);
    assert.doesNotMatch(email.text + email.html, /1_month|12 months|₹2,999|undefined/);
  }
});
