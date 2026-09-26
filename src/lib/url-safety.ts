/**
 * URL scheme validation for owner-supplied links.
 *
 * The Google review URL is entered by a business owner and then rendered into
 * an `href` on a *public* page that their customers open by scanning a QR code
 * in a shop. Without a scheme check, an owner could save `javascript:…` or a
 * `data:text/html` URL and have it run in their customers' browsers. Only
 * http and https are ever legitimate here.
 *
 * This is enforced in three places on purpose: here in the browser when the
 * owner types it, again by a CHECK constraint in the database so the REST API
 * cannot be used to bypass the form, and once more at render time so a row
 * saved before the constraint existed still cannot produce a dangerous link.
 */

const SAFE_PROTOCOLS = new Set(['http:', 'https:']);

/** True only for a well-formed absolute http(s) URL. */
export function isSafeExternalUrl(value: string | null | undefined): boolean {
  if (!value) return false;

  try {
    const parsed = new URL(value.trim());
    return SAFE_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

/** Returns the URL if it is safe to put in an href, otherwise null. */
export function safeExternalUrl(value: string | null | undefined): string | null {
  return isSafeExternalUrl(value) ? value!.trim() : null;
}

/**
 * Validates a Google review link for the settings and onboarding forms.
 * Returns an error message to show the owner, or null when the value is fine.
 * An empty value is allowed — the link is optional.
 */
export function validateGoogleReviewUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (!isSafeExternalUrl(trimmed)) {
    return 'Enter a full link starting with https:// — for example https://g.page/r/…/review';
  }

  const host = new URL(trimmed).hostname.toLowerCase();
  const looksLikeGoogle =
    host === 'g.page' ||
    host === 'goo.gl' ||
    host === 'maps.app.goo.gl' ||
    host === 'google.com' ||
    host.endsWith('.google.com') ||
    /(^|\.)google\.[a-z.]{2,6}$/.test(host);

  if (!looksLikeGoogle) {
    return 'That does not look like a Google review link. Use the link from “Ask for reviews” on your Google Business Profile.';
  }

  // Only links that open the review form itself are accepted, so every
  // customer lands on the stars and the review box rather than the business's
  // page, where many give up looking for "Write a review".
  if (!isDirectReviewLink(trimmed)) return NOT_A_REVIEW_FORM_LINK;

  return null;
}

export const NOT_A_REVIEW_FORM_LINK =
  'This link opens your Google listing, not the review form. Use the link from “Ask for reviews” on your Google Business Profile (it ends in /review), or use your Place ID instead.';

// Google Place IDs are URL-safe base64-like strings, usually starting "ChIJ".
const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]{10,300}$/;

export function isGooglePlaceId(value: string): boolean {
  return PLACE_ID_PATTERN.test(value.trim());
}

/** Google's direct "write a review" link for a place, built from its Place ID. */
export function reviewUrlFromPlaceId(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId.trim())}`;
}

/**
 * Makes a Google link open the "write a review" box where that is possible.
 * A g.page short link without "/review" (g.page/r/<code>, g.page/<name>)
 * opens the business's profile; with "/review" appended it opens the review
 * box itself. Anything else is returned unchanged.
 */
export function directReviewUrl(value: string): string {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    if (url.hostname.toLowerCase() === 'g.page' && url.pathname.length > 1 && !/\/review\/?$/.test(url.pathname)) {
      url.pathname = `${url.pathname.replace(/\/+$/, '')}/review`;
      return url.toString();
    }
  } catch {
    // Not a URL: leave it for the validator to report.
  }
  return trimmed;
}

/**
 * True when a Google link opens the review form (the stars and the text box)
 * directly on a phone. Only Google's two documented formats qualify: the
 * "Ask for reviews" link (g.page/…/review) and the Place ID link
 * (search.google.com/local/writereview?placeid=…). Other Google links — a
 * Maps share link such as maps.app.goo.gl, a listing URL, or a Google Search
 * "#lrd" link, which opens the form only on desktop — land customers on the
 * business's page, where they must find "Write a review" themselves.
 */
export function isDirectReviewLink(value: string): boolean {
  try {
    const url = new URL(directReviewUrl(value));
    const host = url.hostname.toLowerCase();
    if (host === 'g.page') return /\/review\/?$/.test(url.pathname);
    if (host === 'search.google.com') return url.pathname.startsWith('/local/writereview') && Boolean(url.searchParams.get('placeid'));
    return false;
  } catch {
    return false;
  }
}

/** The link to give customers: checked for safety, and opening the review box where possible. */
export function customerReviewUrl(value: string | null | undefined): string | null {
  const safe = safeExternalUrl(value);
  return safe ? directReviewUrl(safe) : null;
}
