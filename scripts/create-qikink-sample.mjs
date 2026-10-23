// Deterministic sandbox artwork: the QR opens the public Reviyo homepage.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import QRCode from 'qrcode';
const sharpPath = process.env.SHARP_MODULE_PATH;
if (!sharpPath) throw new Error('Set SHARP_MODULE_PATH to an installed sharp module.');
const { default: sharp } = await import(sharpPath);
const source = await readFile(new URL('../src/lib/qr-stand.ts', import.meta.url), 'utf8');
const exports = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports });
const qr = await QRCode.toString('https://reviyo.in/', { type: 'svg', margin: 4, color: { dark: '#000000', light: '#ffffff' } });
const artwork = exports.standArtwork('Reviyo sample', qr);
const folder = new URL('../public/images/stand/', import.meta.url);
await mkdir(folder, { recursive: true });
const png = await sharp(Buffer.from(artwork), { density: 300 }).resize(1200, 1800).png().withMetadata({ density: 300 }).toBuffer();
await writeFile(new URL('qikink-sample.png', folder), png);
// A diagram of the sample artwork on a stand, not a product photograph.
const mockup = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="2100"><rect width="1600" height="2100" fill="#f6f5f1"/><ellipse cx="800" cy="1920" rx="650" ry="70" fill="#ddd"/><rect x="195" y="95" width="1210" height="1810" rx="6" fill="white" stroke="#d1d5db" stroke-width="6"/><image x="200" y="100" width="1200" height="1800" href="data:image/png;base64,${png.toString('base64')}"/><path d="M390 1750h70l-35 190h-130z M1140 1750h70l95 190h-130z" fill="#e6e8e9" stroke="#bac0c4" stroke-width="4"/><text x="800" y="2060" text-anchor="middle" font-family="sans-serif" font-size="28" fill="#555">Illustrative sandbox mockup</text></svg>`;
await sharp(Buffer.from(mockup)).png().toFile(new URL('qikink-sample-mockup.png', folder).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
console.log('Created public sandbox print and mockup PNGs. No customer data.');
