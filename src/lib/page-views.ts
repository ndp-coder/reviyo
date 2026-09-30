import { getPageMeta } from '@/config/seo';

// Pages counted besides the public (indexed) ones: sign-up is the step the
// admin funnel starts from.
const EXTRA_COUNTED = new Set(['/signup']);

/** Only public pages: never a customer's review page or the signed-in app. */
export function isCountedPage(pathname: string): boolean {
  return !getPageMeta(pathname).noindex || EXTRA_COUNTED.has(pathname.replace(/\/+$/, '') || '/');
}

/** Host of the website that linked here, without "www."; '' for direct visits and our own pages. */
export function referrerHost(referrer: string, ownHost: string): string {
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, '');
    return host === ownHost.toLowerCase().replace(/^www\./, '') ? '' : host;
  } catch {
    return '';
  }
}

/**
 * Adds one to today's count for this page (see the site_page_views
 * migration). Sends only the path and the referring website's host: no
 * cookie, no identifier, nothing stored in the browser. Uses fetch rather
 * than the Supabase client so public pages don't load it just for this.
 */
export function recordPageView(pathname: string, referrer: string): void {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY)?.trim();
  if (!url || !key || navigator.webdriver) return;
  void fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/record_site_page_view`, {
    method: 'POST',
    keepalive: true,
    credentials: 'omit',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_path: pathname, p_referrer_host: referrerHost(referrer, window.location.hostname) }),
  }).catch(() => {
    // A lost count is not worth an error in the visitor's console.
  });
}
