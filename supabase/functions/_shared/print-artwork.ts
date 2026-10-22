// Print-ready artwork for the free QR table stand and table tent card.
//
// Pure TypeScript with no imports, so the same template draws the dashboard
// preview (src/lib/print-artwork.ts) and the files emailed to the printer
// (_shared/email.ts). Sizes are in millimetres; the SVGs carry real-world
// width/height so they open at print size in CorelDRAW, Illustrator, or a
// browser.
//
// Layout on every panel: business name, "Scan to review us on Google", the QR
// code, and a small "by Reviyo" just under the code.

/** A QR code's modules: size × size, true = dark. */
export interface QrMatrix {
  size: number;
  isDark: (row: number, col: number) => boolean;
}

/** Acrylic stand insert: 4 × 6 inches, portrait. */
export const STAND_SIZE_MM = { width: 101.6, height: 152.4 } as const;
/** Tent card: two A6 portrait panels, printed flat and folded at the middle. */
export const TENT_PANEL_MM = { width: 105, height: 148 } as const;
export const TENT_FLAT_MM = { width: 105, height: 296 } as const;

/** ?src values, so analytics shows which printed piece brought each review. */
export const STAND_SOURCE = 'stand';
export const TENT_CARD_SOURCE = 'table-card';

const NAVY = '#0e2250';
const INK = '#111827';
const MUTED = '#4b5563';
const FONT = "Poppins, 'Helvetica Neue', Helvetica, Arial, 'Nirmala UI', 'Noto Sans', sans-serif";
/** Rough width of one bold character as a share of the font size. */
const CHAR_WIDTH = 0.6;
const QUIET_ZONE_MODULES = 4;

const n = (value: number) => Number(value.toFixed(3)).toString();

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Wraps a business name onto up to three lines and picks the largest font
 * size (mm) at which every line fits `maxWidth`. Words are never split; only
 * a name too long for three lines at the smallest readable size is shortened,
 * at a word boundary, with an ellipsis.
 */
export function fitName(name: string, maxWidth: number, maxSize: number): { lines: string[]; size: number } {
  const clean = name.replace(/\s+/g, ' ').trim() || 'Your business';
  const words = clean.split(' ');
  const minSize = maxSize * 0.5;
  const charsAt = (size: number) => Math.floor(maxWidth / (size * CHAR_WIDTH));

  // Greedy wrap at a given line width (in characters).
  const wrap = (width: number): string[] => {
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length <= width || !line) {
        line = next;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  // Shrink step by step: 1 line at full size first, then more lines, smaller.
  for (let size = maxSize; size >= minSize - 1e-9; size -= maxSize * 0.025) {
    const width = charsAt(size);
    const lines = wrap(width);
    const maxLines = size > maxSize * 0.8 ? 1 : size > maxSize * 0.65 ? 2 : 3;
    if (lines.length <= maxLines && lines.every((line) => line.length <= width)) {
      return { lines, size };
    }
  }

  // Still too long: three lines at the smallest size, the last one shortened.
  const width = charsAt(minSize);
  const lines = wrap(width).map((line) => (line.length > width ? `${line.slice(0, width - 1)}…` : line));
  if (lines.length > 3) {
    const kept = lines.slice(0, 3);
    let last = kept[2];
    while (last.length > width - 2 && last.includes(' ')) last = last.slice(0, last.lastIndexOf(' '));
    kept[2] = `${last.replace(/[\s,&-]+$/, '')}…`;
    return { lines: kept, size: minSize };
  }
  return { lines, size: minSize };
}

/** The QR modules as one path, drawn inside a white square with a quiet zone. */
function qrGroup(qr: QrMatrix, x: number, y: number, size: number): string {
  const total = qr.size + QUIET_ZONE_MODULES * 2;
  const m = size / total;
  let d = '';
  for (let row = 0; row < qr.size; row += 1) {
    for (let col = 0; col < qr.size; col += 1) {
      if (!qr.isDark(row, col)) continue;
      const px = x + (col + QUIET_ZONE_MODULES) * m;
      const py = y + (row + QUIET_ZONE_MODULES) * m;
      d += `M${n(px)} ${n(py)}h${n(m)}v${n(m)}h${n(-m)}z`;
    }
  }
  return (
    `<rect x="${n(x)}" y="${n(y)}" width="${n(size)}" height="${n(size)}" fill="#ffffff"/>` +
    `<path d="${d}" fill="${INK}" shape-rendering="crispEdges"/>`
  );
}

/** One panel's contents, drawn in a width × height box at the origin. */
function panel(businessName: string, qr: QrMatrix, width: number, height: number): string {
  const cx = width / 2;
  const margin = width * 0.08;
  const name = fitName(businessName, width - margin * 2, width * 0.085);
  const lineHeight = name.size * 1.2;
  const promptSize = width * 0.048;
  const bySize = width * 0.03;
  const qrSize = width * 0.72;

  // Heights of each piece and the gaps between them, top to bottom.
  const nameBlock = name.size + (name.lines.length - 1) * lineHeight;
  const ruleGap = height * 0.03;
  const ruleHeight = height * 0.004;
  const promptGap = height * 0.025 + promptSize;
  const qrGap = height * 0.03;
  const byGap = bySize * 1.2;
  const total = nameBlock + ruleGap + ruleHeight + promptGap + qrGap + qrSize + byGap;
  // Centred, nudged up a little: stands and folds hide the bottom edge first.
  const top = Math.max(height * 0.05, (height - total) / 2 - height * 0.02);

  const nameText = name.lines
    .map(
      (line, i) =>
        `<text x="${n(cx)}" y="${n(top + name.size + i * lineHeight)}" text-anchor="middle" ` +
        `font-family="${FONT}" font-weight="700" font-size="${n(name.size)}" fill="${NAVY}">${escapeXml(line)}</text>`,
    )
    .join('');
  const ruleY = top + nameBlock + ruleGap;
  const promptY = ruleY + ruleHeight + promptGap;
  const qrY = promptY + qrGap;
  const byY = qrY + qrSize + byGap;

  return (
    nameText +
    `<rect x="${n(cx - width * 0.08)}" y="${n(ruleY)}" width="${n(width * 0.16)}" height="${n(ruleHeight)}" fill="${NAVY}"/>` +
    `<text x="${n(cx)}" y="${n(promptY)}" text-anchor="middle" font-family="${FONT}" font-weight="500" ` +
    `font-size="${n(promptSize)}" fill="${INK}">Scan to review us on Google</text>` +
    qrGroup(qr, cx - qrSize / 2, qrY, qrSize) +
    `<text x="${n(cx)}" y="${n(byY)}" text-anchor="middle" font-family="${FONT}" font-weight="400" ` +
    `font-size="${n(bySize)}" fill="${MUTED}">by Reviyo</text>`
  );
}

function svgDocument(width: number, height: number, title: string, body: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(width)}mm" height="${n(height)}mm" ` +
    `viewBox="0 0 ${n(width)} ${n(height)}" role="img" aria-label="${escapeXml(title)}">` +
    `<title>${escapeXml(title)}</title>` +
    `<rect width="${n(width)}" height="${n(height)}" fill="#ffffff"/>` +
    body +
    `</svg>`
  );
}

/** The 4 × 6 inch insert for the acrylic table stand. */
export function standSvg(businessName: string, qr: QrMatrix): string {
  const { width, height } = STAND_SIZE_MM;
  return svgDocument(width, height, `QR table stand for ${businessName}`, panel(businessName, qr, width, height));
}

/**
 * The tent card, flat: two A6 panels stacked, the top one upside down so both
 * read upright once folded along the middle. Short grey ticks at the edges
 * mark the fold.
 */
export function tentCardSvg(businessName: string, qr: QrMatrix): string {
  const { width, height } = TENT_PANEL_MM;
  const top = `<g transform="rotate(180 ${n(width / 2)} ${n(height / 2)})">${panel(businessName, qr, width, height)}</g>`;
  const bottom = `<g transform="translate(0 ${n(height)})">${panel(businessName, qr, width, height)}</g>`;
  const tick = (x1: number, x2: number) =>
    `<line x1="${n(x1)}" y1="${n(height)}" x2="${n(x2)}" y2="${n(height)}" stroke="#9ca3af" stroke-width="0.2"/>`;
  return svgDocument(
    TENT_FLAT_MM.width,
    TENT_FLAT_MM.height,
    `QR table tent card for ${businessName}`,
    top + bottom + tick(0, 3) + tick(width - 3, width),
  );
}
