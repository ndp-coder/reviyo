import { Link } from 'react-router-dom';
import { branding } from '@/config/branding';
import { legal, displayValue, isPlaceholder } from '@/config/legal';
import { BrandLogo } from '@/components/BrandLogo';
import { industries } from '@/config/industries';
import { TOOL_PATH } from '@/config/seo';

const legalLinks = [
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/terms', label: 'Terms & Conditions' },
  { to: '/cookies', label: 'Cookie Policy' },
  { to: '/refunds', label: 'Refund & Cancellation Policy' },
  { to: '/contact', label: 'Contact Us' },
];

/**
 * Site-wide footer. Carries the business identity and policy links that the
 * Consumer Protection (E-Commerce) Rules, 2020 and Razorpay's merchant terms
 * both require to be reachable from every public page.
 */
export function SiteFooter() {
  const showGstin = legal.gstin && !isPlaceholder(legal.gstin);
  const showCin = legal.cin && !isPlaceholder(legal.cin);

  const linkClass = 'text-sm text-gray-700 hover:text-gray-900 hover:underline underline-offset-2';

  return (
    <footer className="border-t border-gray-200 bg-paper px-5 pb-10 pt-14 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1.2fr_1fr_1.2fr] lg:gap-8">
          <div>
            <BrandLogo className="h-10 w-auto" />
            <p className="mt-3 max-w-xs text-sm text-gray-700">{branding.tagline}</p>
          </div>

          <nav aria-label="Product">
            <h2 className="text-sm font-semibold text-gray-900">Product</h2>
            <ul className="mt-4 space-y-2.5">
              <li><Link to="/guides" className={linkClass}>Google review guides</Link></li>
              <li>
                <Link to="/pricing" className={linkClass}>
                  Pricing
                </Link>
              </li>
              <li>
                <Link to={TOOL_PATH} className={linkClass}>
                  Free Google review link generator
                </Link>
              </li>
              <li>
                <Link to="/for" className={linkClass}>
                  Google reviews by industry
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Industries">
            <h2 className="text-sm font-semibold text-gray-900">Industries</h2>
            <ul className="mt-4 space-y-2.5">
              {industries.map((industry) => (
                <li key={industry.slug}>
                  <Link to={`/for/${industry.slug}`} className={linkClass}>
                    {industry.plural.replace(/^\w/, (c) => c.toUpperCase())}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Legal and policies">
            <h2 className="text-sm font-semibold text-gray-900">Policies</h2>
            <ul className="mt-4 space-y-2.5">
              {legalLinks.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="text-sm font-semibold text-gray-900">Business details</h2>
            {/* Details still marked TODO_ in config/legal.ts are left out rather
                than shown as placeholders. The release build refuses to run
                until every one is filled in, so a live site shows them all. */}
            <address className="mt-4 space-y-1 text-sm not-italic text-gray-700">
              <p>{displayValue(legal.legalName)}</p>
              {!isPlaceholder(legal.address) && <p className="whitespace-pre-line">{legal.address}</p>}
              {!isPlaceholder(legal.supportEmail) && (
                <p>
                  <a
                    href={`mailto:${legal.supportEmail}`}
                    className="underline underline-offset-2 hover:text-gray-900"
                  >
                    {legal.supportEmail}
                  </a>
                </p>
              )}
              {!isPlaceholder(legal.supportPhone) && (
                <p>
                  <a
                    href={`tel:${legal.supportPhone.replace(/\s+/g, '')}`}
                    className="underline underline-offset-2 hover:text-gray-900"
                  >
                    {legal.supportPhone}
                  </a>
                </p>
              )}
              <p>
                <Link to="/contact" className="underline underline-offset-2 hover:text-gray-900">
                  All contact details
                </Link>
              </p>
              {showGstin && <p>GSTIN: {legal.gstin}</p>}
              {showCin && <p>CIN: {legal.cin}</p>}
            </address>
          </div>
        </div>

        <div className="mt-12 space-y-3 border-t border-gray-300 pt-6">
          <p className="max-w-3xl text-xs leading-relaxed text-gray-600">
            {branding.name} helps customers write their own reviews from their own input. The AI
            does not invent experiences, and the customer always edits and posts the review
            themselves. {branding.name} is an independent product and is not affiliated with,
            endorsed by, or sponsored by Google. Google and Google Maps are trademarks of Google LLC.
          </p>
          <p className="text-xs text-gray-600">
            © {new Date().getFullYear()} {displayValue(legal.legalName)}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
