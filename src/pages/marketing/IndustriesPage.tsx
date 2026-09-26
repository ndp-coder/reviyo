import { Link } from 'react-router-dom';
import { MarketingHeader } from '@/components/MarketingHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SkipLink } from '@/components/SkipLink';
import { industries } from '@/config/industries';

const capitalise = (text: string) => text.replace(/^\w/, (c) => c.toUpperCase());

export function IndustriesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <SkipLink />
      <MarketingHeader />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6 lg:py-16">
          <h1 className="max-w-3xl font-wide text-[2.1rem] font-bold leading-[1.05] tracking-[-0.015em] sm:text-5xl">
            Get more Google reviews, whatever your business
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
            Reviyo is built for single-location businesses across India. Pick yours to see where the QR code works best,
            what your customers tend to mention, and answers to the questions owners like you ask.
          </p>
          <ul className="mt-12 divide-y divide-line border-y border-line">
            {industries.map((industry) => (
              <li key={industry.slug}>
                <Link
                  to={`/for/${industry.slug}`}
                  className="group grid gap-1 py-5 sm:grid-cols-[14rem_1fr] sm:gap-8"
                >
                  <h2 className="text-lg font-semibold underline decoration-transparent decoration-2 underline-offset-4 group-hover:decoration-ink">
                    {capitalise(industry.plural)}
                  </h2>
                  <p className="leading-relaxed text-muted">{industry.metaDescription}</p>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-10 max-w-2xl leading-relaxed text-muted">
            Don&apos;t see your business? Reviyo works for any local business with a Google Business Profile. During setup
            you can describe your business in your own words, and AI suggests review topics that fit.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
