import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { MarketingHeader } from '@/components/MarketingHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SkipLink } from '@/components/SkipLink';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { industries } from '@/config/industries';

const capitalise = (text: string) => text.replace(/^\w/, (c) => c.toUpperCase());

export function IndustriesPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SkipLink />
      <MarketingHeader />
      <main id="main-content" tabIndex={-1} className="flex-1 px-5 pb-20 pt-8 sm:px-6 lg:pt-12">
        <div className="mx-auto max-w-6xl">
          <Breadcrumbs />
          <div className="mt-8 max-w-3xl">
            <h1 className="text-[2rem] font-extrabold leading-[1.1] text-balance text-gray-900 sm:text-5xl">
              Get more Google reviews, whatever your business
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-gray-700">
              Reviyo is built for single-location businesses across India. Pick yours to see where the QR code works best,
              what your customers tend to mention, and answers to the questions owners like you ask.
            </p>
          </div>
          <ul className="mt-14 grid border-t border-gray-200 md:grid-cols-2 md:gap-x-12">
            {industries.map((industry) => (
              <li key={industry.slug} className="border-b border-gray-200">
                <Link to={`/for/${industry.slug}`} className="group flex h-full items-start justify-between gap-6 py-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 group-hover:text-brand-700">{capitalise(industry.plural)}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-gray-700">{industry.metaDescription}</p>
                  </div>
                  <ArrowRight
                    className="mt-1.5 h-5 w-5 flex-shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-700"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-10 max-w-3xl text-sm text-gray-700">
            Don’t see your business? Reviyo works for any local business with a Google Business Profile. During setup you
            can describe your business in your own words, and AI suggests review topics that fit.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
