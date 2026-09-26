/**
 * Where a customer came from: which printed QR code they scanned, or the
 * WhatsApp message they were sent. It rides along as ?src=<id> on the review
 * page link and is stored in each analytics event's metadata, so the owner can
 * see which spot brings in the most reviews. It identifies a place, never a
 * customer.
 */
export const SOURCE_PARAM = 'src';
export const WHATSAPP_SOURCE = 'whatsapp';
const MAX_SOURCE_LENGTH = 40;

/** "Table 4" → "table-4". Returns '' when nothing usable is left. */
export function toSourceId(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, MAX_SOURCE_LENGTH)
    .replace(/-$/, '');
}

/** The ?src value from a URL, or null if absent or malformed. */
export function readSource(search: string): string | null {
  const raw = new URLSearchParams(search).get(SOURCE_PARAM);
  if (!raw) return null;
  const id = toSourceId(raw);
  return id || null;
}

export function reviewUrlFor(origin: string, businessSlug: string, source?: string | null): string {
  const base = `${origin}/r/${businessSlug}`;
  return source ? `${base}?${SOURCE_PARAM}=${encodeURIComponent(source)}` : base;
}

/** Display name for a source id: null is the main QR code. */
export function sourceLabel(id: string | null): string {
  if (!id) return 'Main QR code';
  if (id === WHATSAPP_SOURCE) return 'WhatsApp';
  return id.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}
