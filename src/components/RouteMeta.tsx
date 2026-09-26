import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { canonicalUrl, DEFAULT_OG_IMAGE, getPageMeta, jsonLdText, SITE_NAME } from '@/config/seo';

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.content = content;
}

function setCanonical(href: string | null) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!href) {
    link?.remove();
    return;
  }
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = href;
}

/**
 * Keeps <head> in step with the current route after client-side navigation.
 * The first load of a public page already has these tags from the prerendered
 * HTML; this repeats them for every later navigation, from the same source
 * (config/seo.ts), and marks private pages noindex.
 */
export function RouteMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = getPageMeta(pathname);
    const image = meta.ogImage ?? DEFAULT_OG_IMAGE;

    document.title = meta.title;
    upsertMeta('name', 'description', meta.description);
    upsertMeta('name', 'robots', meta.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');
    upsertMeta('property', 'og:site_name', SITE_NAME);
    upsertMeta('property', 'og:title', meta.title);
    upsertMeta('property', 'og:description', meta.description);
    upsertMeta('property', 'og:type', meta.ogType ?? 'website');
    upsertMeta('property', 'og:image', image);
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', meta.title);
    upsertMeta('name', 'twitter:description', meta.description);
    upsertMeta('name', 'twitter:image', image);

    const url = meta.noindex ? null : canonicalUrl(meta);
    setCanonical(url);
    if (url) upsertMeta('property', 'og:url', url);
    else document.head.querySelector('meta[property="og:url"]')?.remove();

    document.head.querySelectorAll('script[data-route-meta]').forEach((node) => node.remove());
    for (const data of meta.jsonLd ?? []) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.dataset.routeMeta = '';
      script.textContent = jsonLdText(data);
      document.head.appendChild(script);
    }
  }, [pathname]);

  return null;
}
