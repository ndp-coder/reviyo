import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Client-side navigation keeps the previous page's scroll position, so a link
 * in the footer opened the next page already scrolled to the bottom. Every new
 * navigation — including a link to the page that is already open — starts at
 * the top, or at the #section the link points to. Back and forward (POP) are
 * left alone so the browser can restore where the visitor was.
 */
export function ScrollToTop() {
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === 'POP') return;
    if (location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) {
        target.scrollIntoView();
        return;
      }
    }
    // Instant, not the page's smooth scrolling: a new page should simply open
    // at the top rather than visibly scroll there.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [location, navigationType]);

  return null;
}
