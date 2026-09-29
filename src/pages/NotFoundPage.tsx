import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { MarketingHeader } from '@/components/MarketingHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SkipLink } from '@/components/SkipLink';
import { buttonClasses } from '@/components/ui/button-styles';
import { TOOL_PATH } from '@/config/seo';

const destinations = [
  { to: '/', label: 'Home', text: 'What Reviyo does and how it works.' },
  { to: '/pricing', label: 'Pricing', text: 'Two plans with the same features.' },
  { to: '/for', label: 'Industries', text: 'How Reviyo works for clinics, salons, cafés, and more.' },
  { to: TOOL_PATH, label: 'Free review link generator', text: 'Your Google review link and QR code, free.' },
  { to: '/contact', label: 'Contact us', text: 'Tell us what you were looking for.' },
];

/**
 * Shown for any URL that is not a page. Also prerendered to 404.html, which
 * the hosts serve with a real 404 status (see vercel.json and _redirects), so
 * search engines never index a mistyped URL as a copy of the home page.
 * The title and noindex tag come from getPageMeta() for unknown paths.
 */
export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SkipLink />
      <MarketingHeader />
      <main id="main-content" tabIndex={-1} className="flex-1 px-5 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-accent-700">Error 404</p>
            <h1 className="mt-3 text-[2rem] font-bold leading-[1.15] text-balance text-gray-900 sm:text-5xl">
              We couldn&rsquo;t find that page
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-gray-700">
              The link may be mistyped, or the page may have moved. If you scanned a shop&rsquo;s QR code, ask the staff
              for help. Otherwise, one of these should get you where you were going.
            </p>
            <Link to="/" className={`${buttonClasses({ size: 'lg' })} mt-8`}>
              Go to the home page
            </Link>
          </div>

          <nav aria-label="Popular pages" className="mt-14">
            <h2 className="text-lg font-bold text-gray-900">Popular pages</h2>
            <ul className="mt-4 grid border-t border-gray-200 md:grid-cols-2 md:gap-x-12">
              {destinations.map((page) => (
                <li key={page.to} className="border-b border-gray-200">
                  <Link to={page.to} className="group flex items-start justify-between gap-6 py-5">
                    <div>
                      <p className="font-semibold text-gray-900 group-hover:text-brand-700">{page.label}</p>
                      <p className="mt-1 text-sm text-gray-700">{page.text}</p>
                    </div>
                    <ArrowRight
                      className="mt-1 h-5 w-5 flex-shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-700"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
