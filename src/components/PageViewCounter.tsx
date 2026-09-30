import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { isCountedPage, recordPageView } from '@/lib/page-views';

/** Counts views of public pages for the admin dashboard. Production builds only. */
export function PageViewCounter() {
  const { pathname } = useLocation();
  // The referring website only applies to the page someone landed on.
  const landed = useRef(false);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    const referrer = landed.current ? '' : document.referrer;
    landed.current = true;
    if (isCountedPage(pathname)) recordPageView(pathname, referrer);
  }, [pathname]);

  return null;
}
