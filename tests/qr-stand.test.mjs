import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import QRCode from 'qrcode';
const exports={};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/qr-stand.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});

test('stand artwork preserves the real QR paths and escapes the printed business name',async()=>{
  const qr=await QRCode.toString('https://reviyo.in/r/test-shop',{type:'svg',margin:4});
  const svg=exports.standArtwork('A & B <Shop>',qr);
  assert.match(svg,/A &amp; B &lt;Shop&gt;/);
  assert.match(svg,/QR by Reviyo/);
  assert.match(svg,/width="4in" height="6in"/);
  const path=qr.match(/<path[^>]*d="[^"]+"/)[0];
  assert.ok(svg.includes(path),'artwork does not redraw or distort QR modules');
  assert.throws(()=>exports.standArtwork('Shop','<svg onload="bad()"></svg>'),/Invalid/);
  for (const name of ['', 'A'.repeat(81), 'Shop\nName']) assert.throws(()=>exports.standArtwork(name,qr),/1 to 80/);
  assert.doesNotThrow(()=>exports.standArtwork('A'.repeat(80),qr));
});
test('delivery validation rejects missing details and invalid Indian mobile/PIN values',()=>{
  const good={recipient:'Owner',phone:'9876543210',line1:'12 Test Road',line2:'',city:'City',state:'State',pincode:'520001'};
  assert.equal(exports.validateDelivery(good),null);
  for(const patch of [{phone:'123'},{pincode:'000000'},{line1:''},{recipient:'Owner\nInjection'}]) assert.ok(exports.validateDelivery({...good,...patch}));
});
