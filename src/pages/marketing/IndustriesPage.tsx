import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { MarketingHeader } from '@/components/MarketingHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SkipLink } from '@/components/SkipLink';
import { industries } from '@/config/industries';

const capitalise = (text: string) => text.replace(/^\w/, (c) => c.toUpperCase());

export function IndustriesPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SkipLink />
      <MarketingHeader />
      <main id="main-content" tabIndex={-1} className="flex-1 px-6 py-16">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900">Get more Google reviews, whatever your business</h1>
          <p className="mt-4 max-w-3xl text-lg text-gray-700">
            Reviyo is built for single-location businesses across India. Pick yours to see where the QR code works best,
            what your customers tend to mention, and answers to the questions owners like you ask.
          </p>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {industries.map((industry) => (
              <li key={industry.slug}>
                <Link
                  to={`/for/${industry.slug}`}
                  className="group flex h-full flex-col rounded-2xl border border-gray-200 p-6 hover:border-blue-400 hover:shadow-sm"
                >
                  <h2 className="text-lg font-semibold text-gray-900">{capitalise(industry.plural)}</h2>
                  <p className="mt-2 flex-1 text-sm text-gray-700">{industry.metaDescription}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-700">
                    See how it works <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-10 text-sm text-gray-700">
            Don’t see your business? Reviyo works for any local business with a Google Business Profile. During setup you
            can describe your business in your own words, and AI suggests review topics that fit.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
