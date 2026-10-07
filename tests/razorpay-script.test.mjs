import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function loader() {
  let current = null; const scripts = []; const timers = new Map(); let timerId = 0;
  const window = { setTimeout(callback) { timers.set(++timerId, callback); return timerId; }, clearTimeout(id) { timers.delete(id); } };
  const document = {
    querySelector: () => current,
    createElement() {
      const events = new Map();
      const script = {
        addEventListener(type, fn) { if (!events.has(type)) events.set(type, new Set()); events.get(type).add(fn); },
        removeEventListener(type, fn) { events.get(type)?.delete(fn); },
        fire(type) { script[`on${type}`]?.(); for (const fn of [...(events.get(type) ?? [])]) fn(); },
        remove() { if (current === script) current = null; },
      };
      scripts.push(script); return script;
    },
    body: { appendChild(script) { current = script; } },
  };
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('../src/lib/razorpay.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText.replaceAll('import.meta.env', '({})');
  vm.runInNewContext(source, { exports, require: () => ({}), window, document, URL, console: { error() {} } });
  return { load: exports.loadRazorpayScript, scripts, window, timers, get current() { return current; } };
}

test('a failed checkout script can be downloaded again without refreshing the page', async () => {
  const sdk = loader(); const first = sdk.load();
  sdk.scripts[0].fire('error'); assert.equal(await first, false);
  const retry = sdk.load(); assert.equal(sdk.scripts.length, 2);
  sdk.window.Razorpay = function Razorpay() {}; sdk.scripts[1].fire('load');
  assert.equal(await retry, true); assert.equal(sdk.timers.size, 0);
});

test('concurrent checkout requests share one download and never mistake an empty script for the SDK', async () => {
  const sdk = loader(); const first = sdk.load(); const second = sdk.load();
  assert.equal(first, second); assert.equal(sdk.scripts.length, 1);
  sdk.scripts[0].fire('load'); assert.equal(await first, false);
  const retry = sdk.load(); sdk.window.Razorpay = function Razorpay() {}; sdk.scripts[1].fire('load');
  assert.equal(await retry, true); assert.equal(await sdk.load(), true); assert.equal(sdk.scripts.length, 2);
});

test('a stalled download releases checkout and a late event cannot cancel its replacement', async () => {
  const sdk = loader(); const pending = sdk.load();
  assert.equal(sdk.timers.size, 1); [...sdk.timers.values()][0]();
  assert.equal(await pending, false); assert.equal(sdk.current, null);
  const retry = sdk.load(); sdk.scripts[0].fire('error');
  assert.equal(sdk.current, sdk.scripts[1]);
  sdk.window.Razorpay = function Razorpay() {}; sdk.scripts[1].fire('load');
  assert.equal(await retry, true);
});
