/** Layout for the 4 × 6 inch sample, pending a supplier's final print template. */
export function standArtwork(name: string, qrSvg: string): string {
  const nameProblem = validatePrintedName(name);
  if (nameProblem) throw new Error(nameProblem);
  if (!qrSvg.startsWith('<svg ') || /<script|<foreignObject|onload=/i.test(qrSvg)) throw new Error('Invalid QR artwork');
  const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
  const chars = Array.from(name.trim());
  const lines = Array.from({ length: Math.ceil(chars.length / 28) }, (_, i) => chars.slice(i * 28, (i + 1) * 28).join(''));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="4in" height="6in" viewBox="0 0 1200 1800"><rect width="1200" height="1800" fill="white"/><g fill="#10284b" font-family="sans-serif" text-anchor="middle">${lines.map((line, i) => `<text x="600" y="${150 + i * 60}" font-size="45" font-weight="bold">${escape(line)}</text>`).join('')}<text x="600" y="360" font-size="34">How was your visit?</text></g>${qrSvg.replace('<svg ', '<svg x="120" y="420" width="960" height="960" ')}<g fill="#10284b" font-family="sans-serif" text-anchor="middle"><text x="600" y="1450" font-size="26">QR by Reviyo</text><text x="600" y="1580" font-size="34">Scan to share your experience</text><text x="600" y="1640" font-size="28">Your words. Your choice to post.</text></g></svg>`;
}

export const DELIVERY_CONSENT_VERSION = '2026-10-23.1';
export const DELIVERY_FIELDS = [
  { key: 'recipient', label: 'Recipient name', max: 60, autoComplete: 'shipping name' },
  { key: 'phone', label: 'Mobile number', max: 10, autoComplete: 'shipping tel-national' },
  { key: 'line1', label: 'Address line 1', max: 80, autoComplete: 'shipping address-line1' },
  { key: 'line2', label: 'Address line 2 (optional)', max: 80, autoComplete: 'shipping address-line2' },
  { key: 'city', label: 'City', max: 60, autoComplete: 'shipping address-level2' },
  { key: 'state', label: 'State or union territory', max: 60, autoComplete: 'shipping address-level1' },
  { key: 'pincode', label: 'PIN code', max: 6, autoComplete: 'shipping postal-code' },
] as const;
export type DeliveryAddress = Record<typeof DELIVERY_FIELDS[number]['key'], string>;
export const EMPTY_DELIVERY_ADDRESS: DeliveryAddress = { recipient: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' };
export const hasControlCharacters = (value: string) => Array.from(value).some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127);
export function validatePrintedName(name: string): string | null {
  return !name.trim() || Array.from(name.trim()).length > 80 || hasControlCharacters(name)
    ? 'Use a business name of 1 to 80 characters.' : null;
}
export function validateDelivery(address: DeliveryAddress): string | null {
  for (const field of DELIVERY_FIELDS) {
    const value = address[field.key].trim();
    if ((field.key !== 'line2' && !value) || value.length > field.max || hasControlCharacters(value)) return `Check ${field.label.toLowerCase()}.`;
  }
  if (!/^[6-9][0-9]{9}$/.test(address.phone.trim())) return 'Enter a ten-digit Indian mobile number.';
  if (!/^[1-9][0-9]{5}$/.test(address.pincode.trim())) return 'Enter a six-digit Indian PIN code.';
  return null;
}
