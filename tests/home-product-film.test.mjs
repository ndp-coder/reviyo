import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

// Run the real player handlers with controlled media promises. Nothing is
// downloaded or played by these tests, and no account or payment is involved.
function player(play = async () => {}) {
  let cursor = 0; const slots = [];
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = value; }];
    },
    useRef(initial) { const [value] = hooks.useState({ current: initial }); return value; },
  };
  const jsx = (type, props) => ({ type, props: props ?? {} });
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('../src/components/HomeProductFilm.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { exports, DOMException, require(id) {
    if (id === 'react') return hooks;
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (id === '@/components/ui') return { Alert: 'Alert', Button: 'Button' };
    if (id === '@/config/home-film') return { homeFilm: { duration: 75.9, audioLanguage: 'Telugu', videoSrc: '/media/reviyo-product-film-te.mp4', posterSrc: '/media/reviyo-product-film-te-poster.jpg', captions: [{ lang: 'en', label: 'English', src: '/media/reviyo-product-film-te-en.vtt' }, { lang: 'te', label: 'తెలుగు', src: '/media/reviyo-product-film-te-te.vtt' }], scenes: [{ title: 'Scan', narration: 'Scan your QR.', narrationTelugu: 'క్యూ ఆర్ కోడ్ స్కాన్ చేయండి.' }] } };
    throw new Error(`Unexpected import: ${id}`);
  } });
  const render = () => { cursor = 0; return exports.HomeProductFilm(); };
  let loads = 0; let plays = 0;
  const media = { load() { loads++; }, play() { plays++; return play(); } };
  nodes(render()).find(n => n.type === 'video').props.ref.current = media;
  return { render, get loads() { return loads; }, get plays() { return plays; } };
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

test('the homepage film loads only after play and exposes native controls with a transcript', () => {
  const flow = player(); const initial = flow.render();
  const video = nodes(initial).find(n => n.type === 'video');
  assert.equal(video.props.preload, 'none'); assert.ok(!video.props.autoPlay);
  assert.equal(flow.loads, 0); assert.equal(flow.plays, 0);
  assert.ok(nodes(initial).find(n => n.type === 'track' && n.props.kind === 'captions'));
  assert.match(text(initial), /Telugu audio/);
  assert.equal(nodes(initial).find(n => n.type === 'source').props.src, '/media/reviyo-product-film-te.mp4');
  const tracks = nodes(initial).filter(n => n.type === 'track');
  assert.equal(tracks.length, 2);
  assert.ok(tracks.find(n => n.props.srcLang === 'en' && n.props.default));
  assert.ok(tracks.find(n => n.props.srcLang === 'te' && !n.props.default));
  assert.ok(nodes(initial).find(n => n.type === 'p' && n.props.lang === 'te'));
  assert.match(text(initial), /Scan your QR/);
  nodes(initial).find(n => n.type === 'button').props.onClick();
  assert.equal(flow.loads, 1); assert.equal(flow.plays, 1);
  assert.equal(nodes(flow.render()).find(n => n.type === 'video').props.controls, true);
  assert.ok(!nodes(flow.render()).find(n => n.type === 'button'));
});

test('a failed video source offers a retry while preserving the readable walkthrough', () => {
  const flow = player(); const initial = flow.render();
  nodes(initial).find(n => n.type === 'button').props.onClick();
  nodes(initial).find(n => n.type === 'source').props.onError();
  const alert = nodes(flow.render()).find(n => n.type === 'Alert');
  assert.ok(alert); assert.match(text(flow.render()), /Scan your QR/);
  alert.props.action.props.onClick();
  assert.equal(flow.loads, 2); assert.equal(flow.plays, 2);
  nodes(flow.render()).find(n => n.type === 'video').props.onCanPlay();
  assert.ok(!nodes(flow.render()).find(n => n.type === 'Alert'));
});

test('a blocked playback request points to the native play control', async () => {
  const flow = player(async () => { throw new DOMException('Blocked', 'NotAllowedError'); });
  nodes(flow.render()).find(n => n.type === 'button').props.onClick();
  await Promise.resolve(); await Promise.resolve();
  assert.match(text(flow.render()), /Press play on the video/);
  assert.equal(nodes(flow.render()).find(n => n.type === 'video').props.controls, true);
});
