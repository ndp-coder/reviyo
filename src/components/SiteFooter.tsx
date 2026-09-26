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

  return (
    <footer className="border-t border-gray-200 bg-gray-50 py-10 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <BrandLogo className="h-10 w-auto" />
            <p className="mt-3 text-sm text-gray-600 max-w-xs">{branding.tagline}</p>
          </div>

          <nav aria-label="Product">
            <h2 className="text-sm font-semibold text-gray-900">Product</h2>
            <ul className="mt-3 space-y-2">
              <li>
                <Link to="/pricing" className="text-sm text-gray-600 underline underline-offset-2 hover:text-gray-900">
                  Pricing
                </Link>
              </li>
              <li>
                <Link to={TOOL_PATH} className="text-sm text-gray-600 underline underline-offset-2 hover:text-gray-900">
                  Free Google review link generator
                </Link>
              </li>
              <li>
                <Link to="/for" className="text-sm text-gray-600 underline underline-offset-2 hover:text-gray-900">
                  Google reviews by industry
                </Link>
                <ul className="mt-2 space-y-1.5 pl-3">
                  {industries.map((industry) => (
                    <li key={industry.slug}>
                      <Link
                        to={`/for/${industry.slug}`}
                        className="text-xs text-gray-600 hover:text-gray-900 hover:underline underline-offset-2"
                      >
                        {industry.plural.replace(/^\w/, (c) => c.toUpperCase())}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            </ul>
          </nav>

          <nav aria-label="Legal and policies">
            <h2 className="text-sm font-semibold text-gray-900">Policies</h2>
            <ul className="mt-3 space-y-2">
              {legalLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-gray-600 underline underline-offset-2 hover:text-gray-900"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="text-sm font-semibold text-gray-900">Business details</h2>
            <address className="mt-3 not-italic text-sm text-gray-600 space-y-1">
              <p>{displayValue(legal.legalName)}</p>
              <p className="whitespace-pre-line">{displayValue(legal.address)}</p>
              <p>
                <a
                  href={`mailto:${legal.supportEmail}`}
                  className="underline underline-offset-2 hover:text-gray-900"
                >
                  {displayValue(legal.supportEmail)}
                </a>
              </p>
              <p>
                <a
                  href={`tel:${legal.supportPhone.replace(/\s+/g, '')}`}
                  className="underline underline-offset-2 hover:text-gray-900"
                >
                  {displayValue(legal.supportPhone)}
                </a>
              </p>
              {showGstin && <p>GSTIN: {legal.gstin}</p>}
              {showCin && <p>CIN: {legal.cin}</p>}
            </address>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-200 pt-6 space-y-3">
          <p className="text-xs text-gray-600 max-w-3xl">
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
