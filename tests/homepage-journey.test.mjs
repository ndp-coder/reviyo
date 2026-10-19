import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

// Run the actual public component handlers without accounts, APIs or a DOM.
function component(file, overrides = {}) {
  let cursor = 0;
  const slots = [];
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) { return hooks.useState({ current: initial })[0]; },
    useEffect(effect) { effect(); },
  };
  const jsx = (type, props) => ({ type, props: props ?? {} });
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL(`../src/components/${file}.tsx`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { exports, encodeURIComponent, require(id) {
    if (id in overrides) return overrides[id];
    if (id === 'react') return hooks;
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (id === 'lucide-react') return { ArrowRight: 'ArrowRight' };
    if (id === '@/components/ui') return { Button: 'Button', Textarea: 'Textarea' };
    throw new Error(`Unexpected dependency in the public example: ${id}`);
  } });
  return props => { cursor = 0; return exports[file](props); };
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : [];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join('');
  return tree && typeof tree === 'object' ? text(tree.props?.children) : String(tree ?? '');
}

test('the homepage starts with an editable draft, preserves edits through the journey, and can reset the sample', () => {
  const render = component('HomeReviewDemo');
  const field = () => nodes(render()).find(n => n.type === 'Textarea');
  const button = label => nodes(render()).find(n => n.type === 'Button' && text(n) === label);
  const original = field().props.value;
  assert.match(text(render()), /Prewritten demo/);
  assert.ok(nodes(render()).find(n => n.props['aria-current'] === 'step' && /Review/.test(text(n))));
  assert.equal(field().props['aria-label'], 'Edit the sample review');
  const edit = 'The order was late. I would prefer a shorter wait.';
  field().props.onChange({ target: { value: edit } });
  button('01Scan').props.onClick();
  assert.ok(!field());
  button('Preview the review page').props.onClick();
  assert.match(text(render()), /customer gives consent/);
  button('See the sample draft').props.onClick();
  assert.equal(field().props.value, edit);
  button('Reset sample').props.onClick();
  assert.equal(field().props.value, original);
  assert.match(text(render()), /Nothing is sent or posted here/);
});

test('the shared counter card preserves dashboard printing and keeps the public sample out of print-only rules', () => {
  const render = component('ReviewCounterCard');
  const props = { businessName: 'A & B Clinic', qrImage: '/real-owner-code.svg' };
  const owner = render(props);
  assert.match(owner.props.className, /\bprint-area\b/);
  assert.match(text(owner), /How was your visit\? Tell us about it\./);
  assert.equal(nodes(owner).find(n => n.type === 'h3').props.children, props.businessName);
  assert.equal(nodes(owner).find(n => n.type === 'img').props.src, props.qrImage);
  const preview = render({ ...props, printable: false, qrAlt: 'Example code opens reviyo.in' });
  assert.doesNotMatch(preview.props.className, /\bprint-area\b/);
  assert.equal(nodes(preview).find(n => n.type === 'img').props.alt, 'Example code opens reviyo.in');
});

test('setup assistance uses the configured support contacts without submitting a message', () => {
  const render = component('SetupSupportLinks', {
    '@/config/legal': { legal: { supportPhone: '+91 12345 67890', supportEmail: 'support@example.test' } },
    '@/components/ui/button-styles': { buttonClasses: () => 'button' },
  });
  const links = nodes(render()).filter(n => n.type === 'a');
  assert.equal(links.length, 2);
  assert.equal(links[0].props.href, 'tel:+911234567890');
  assert.equal(links[1].props.href, 'mailto:support@example.test?subject=Help%20setting%20up%20Reviyo');
  assert.ok(links.every(n => !n.props.onClick));
  assert.ok(!nodes(render()).some(n => n.type === 'form'));
});
