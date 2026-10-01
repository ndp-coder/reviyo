import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

// Compile the actual Edge Function helper, with its network boundaries stubbed.
// These tests cannot issue a live payment or payout.
function helper(fetch = async () => { throw new Error('Unexpected network call'); }, env = {}) {
  const source = readFileSync(new URL('../supabase/functions/_shared/commissions.ts',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
  const exports = {};
  const context = { exports, fetch, Deno: { env: { get: key => env[key] } }, btoa, AbortSignal, Date, Set, Number, JSON, encodeURIComponent };
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
  return exports;
}
const now=Date.parse('2026-10-20T12:00:00Z');
const old='2026-10-06T12:00:00Z';
const payment={id:'pay_test',order_id:'order_test',status:'captured',captured:true,amount:299900,currency:'INR',amount_refunded:0,refund_status:null,created_at:Date.parse(old)/1000};

test('full annual payment qualifies exactly at 14 days; authorisations, trials, refunds and wrong orders never qualify',()=>{
  const {paymentQualifies}=helper();
  assert.equal(paymentQualifies(payment,'order_test',old,now),true);
  assert.equal(paymentQualifies(payment,'order_test',old,now-1),false);
  for(const patch of [{status:'authorized'},{captured:false},{amount:100},{amount:199900},{amount_refunded:1},{refund_status:'partial'},{currency:'USD'},{created_at:undefined}]) {
    assert.equal(paymentQualifies({...payment,...patch},'order_test',old,now),false,JSON.stringify(patch));
  }
  assert.equal(paymentQualifies(payment,'different_order',old,now),false);
  assert.equal(paymentQualifies(payment,'order_test','invalid',now),false);
  assert.equal(paymentQualifies(payment,'order_test','2026-10-07T12:00:00Z',now),false);
});

test('payout requests preserve the ledger idempotency key, exact payload and RazorpayX credentials',async()=>{
  const calls=[];
  const api=helper(async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({id:'pout_test'})};},{RAZORPAYX_KEY_ID:'x_test',RAZORPAYX_KEY_SECRET:'x_secret'});
  const payload={amount:100000,fund_account_id:'fa_test',reference_id:'11111111-1111-4111-8111-111111111111'};
  await api.razorpayX('payouts',payload,payload.reference_id);
  await api.razorpayX('payouts',payload,payload.reference_id);
  assert.equal(calls[0].url,'https://api.razorpay.com/v1/payouts');
  assert.equal(calls[0].options.headers['X-Payout-Idempotency'],payload.reference_id);
  assert.equal(calls[0].options.body,calls[1].options.body);
  assert.equal(calls[0].options.headers.Authorization,`Basic ${btoa('x_test:x_secret')}`);
});

test('unconfigured or disabled payouts cannot call a payment provider',async()=>{
  await assert.rejects(()=>helper().razorpayX('payouts',{amount:100000}),/not configured/);
  const result=await helper().runCommissions({});
  assert.equal(result.submitted,0);
});

test('provider failures do not expose bank data in errors',async()=>{
  const api=helper(async()=>({ok:false,status:400,json:async()=>({bank_account:{account_number:'secret'}})}),{RAZORPAYX_KEY_ID:'x_test',RAZORPAYX_KEY_SECRET:'x_secret'});
  await assert.rejects(()=>api.razorpayX('fund_accounts',{bank_account:{account_number:'secret'}}),/RazorpayX request failed \(400\)/);
});
