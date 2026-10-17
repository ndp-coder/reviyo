// Own, self-hosted UI illustrations. The QR points to Reviyo, not a customer.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const dest = fileURLToPath(new URL('../public/images/home/', import.meta.url));
mkdirSync(dest, { recursive: true });
mkdirSync(fileURLToPath(new URL('../output/', import.meta.url)), { recursive: true });
const qr = QRCode.create('https://reviyo.in', { errorCorrectionLevel: 'M' });
const cells = [];
for (let y = 0; y < qr.modules.size; y++) for (let x = 0; x < qr.modules.size; x++) {
  if (qr.modules.get(y, x)) cells.push(`M${x} ${y}h1v1h-1z`);
}
const qrShape = `<path d="${cells.join('')}" fill="#0e2250"/>`;
const qrAt = (x, y, size) => `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="-3 -3 ${qr.modules.size + 6} ${qr.modules.size + 6}"><rect x="-3" y="-3" width="${qr.modules.size + 6}" height="${qr.modules.size + 6}" fill="white"/>${qrShape}</svg>`;
const frame = (bg, content) => `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="540" viewBox="0 0 720 540"><rect width="720" height="540" fill="${bg}"/><style>text{font-family:'Segoe UI',Arial,sans-serif;fill:#0e2250}.muted{fill:#5d697b}.white{fill:white}</style>${content}</svg>`;
const t = (x, y, value, size = 24, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" ${extra}>${value}</text>`;
const phone = (content) => `<rect x="174" y="42" width="372" height="565" rx="43" fill="#0e2250"/><rect x="184" y="52" width="352" height="545" rx="34" fill="#fff"/><rect x="308" y="62" width="104" height="21" rx="10" fill="#0e2250"/>${t(211, 117, 'reviyo.in', 17, 'class="muted"')}${content}`;

writeFileSync(dest + 'scan.svg', frame('#e1efeb', `
<ellipse cx="365" cy="456" rx="214" ry="23" fill="#c1d5cd"/>
<path d="M198 115H493L521 450H169Z" fill="#0e2250"/>
<path d="M198 100H493L473 431H178Z" fill="white"/>
${t(236, 157, 'Kaveri Café', 29, 'font-weight="600"')}
${t(238, 191, 'How was your visit?', 19, 'class="muted"')}
${qrAt(234, 210, 190)}
<path d="M223 246v-24h24m165 0h24v24M223 355v24h24m165 0h24v-24" fill="none" stroke="#0b8280" stroke-width="4"/>
<path d="M227 298H431" stroke="#0b8280" stroke-width="3"/>
${t(235, 411, 'Scan to share your experience', 16)}
<rect x="440" y="350" width="188" height="54" rx="27" fill="#0e2250"/>
${t(463, 384, 'No app needed', 19, 'class="white"')}
`));
writeFileSync(dest + 'draft.svg', frame('#e7ebf9', phone(`
<rect x="212" y="147" width="40" height="40" rx="12" fill="#e1efeb"/>${t(225, 176, 'K', 22, 'font-weight="600"')}
${t(265, 173, 'Kaveri Café', 23, 'font-weight="600"')}
${t(212, 222, 'Your visit. Your words.', 25, 'font-weight="600"')}
${t(212, 255, 'What would you like to mention?', 17, 'class="muted"')}
<rect x="211" y="280" width="110" height="43" rx="21" fill="#0e2250"/>${t(236, 308, 'Coffee', 18, 'class="white"')}
<rect x="332" y="280" width="128" height="43" rx="21" fill="#0e2250"/>${t(353, 308, 'Service', 18, 'class="white"')}
<rect x="211" y="337" width="290" height="100" rx="12" fill="#f5f6fa"/>
${t(229, 367, 'I stopped in for a coffee', 19)}${t(229, 396, 'after work.', 19)}
<rect x="211" y="455" width="290" height="51" rx="11" fill="#0e2250"/>${t(278, 488, 'Create my draft', 19, 'class="white"')}
`)));
writeFileSync(dest + 'share.svg', frame('#f4e5d8', phone(`
${t(212, 169, 'Make it sound like you', 24, 'font-weight="600"')}
${t(212, 203, 'Read it. Edit it. Make it yours.', 18, 'class="muted"')}
<rect x="211" y="229" width="290" height="171" rx="13" fill="#faf9f7" stroke="#d5dce4"/>
${t(231, 265, 'I stopped in for a coffee', 19)}${t(231, 296, 'after work. The staff', 19)}${t(231, 327, 'helped me choose', 19)}${t(231, 358, 'something to order.', 19)}
<rect x="211" y="425" width="290" height="51" rx="11" fill="#0e2250"/>${t(246, 458, 'Copy &amp; open Google', 19, 'class="white"')}
${t(226, 512, 'You choose whether to post.', 17, 'class="muted"')}
`)));
writeFileSync(dest + 'review-qr.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="-3 -3 ${qr.modules.size + 6} ${qr.modules.size + 6}"><rect x="-3" y="-3" width="${qr.modules.size + 6}" height="${qr.modules.size + 6}" fill="white"/>${qrShape}</svg>`);
writeFileSync(fileURLToPath(new URL('../output/homepage-qr.json', import.meta.url)), JSON.stringify({ size: qr.modules.size, cells: Array.from(qr.modules.data) }));
console.log('Created three product illustrations and a real site QR.');
