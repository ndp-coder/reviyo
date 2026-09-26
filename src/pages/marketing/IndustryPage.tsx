import { Link, Navigate, useParams } from 'react-router-dom';
import { MarketingHeader } from '@/components/MarketingHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SkipLink } from '@/components/SkipLink';
import { getIndustry, industries, industryTopics } from '@/config/industries';
import { TOOL_PATH } from '@/config/seo';
import { legal } from '@/config/legal';
import { PLANS, formatRupees } from '@/config/plans';

const capitalise = (text: string) => text.replace(/^\w/, (c) => c.toUpperCase());

const primaryCta =
  'inline-flex min-h-12 items-center justify-center rounded-lg bg-blue-600 px-6 text-base font-semibold text-white transition-colors hover:bg-blue-700';
const textLink = 'font-medium text-ink underline decoration-line decoration-2 underline-offset-4 hover:decoration-ink';

export function IndustryPage() {
  const { slug } = useParams<{ slug: string }>();
  const industry = getIndustry(slug);
  if (!industry) return <Navigate to="/for" replace />;

  const topics = industryTopics(industry);
  const others = industries.filter((i) => i.slug !== industry.slug);
  const steps = [
    ['They scan', 'Your customer scans the QR code with their phone camera. No app, no sign-up.'],
    ['They say what stood out', 'They rate the visit and tap topics. A draft is written from only what they chose.'],
    ['They post it on Google', 'They edit the draft if they like, then post it on your Google Business Profile themselves.'],
  ];

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <SkipLink />
      <MarketingHeader />

      <main id="main-content" tabIndex={-1} className="flex-1">
        <section className="mx-auto max-w-6xl px-5 pb-14 pt-10 sm:px-6 lg:pb-20 lg:pt-14">
          <nav aria-label="Breadcrumb" className="text-sm text-muted">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li><Link to="/" className="inline-block py-1.5 hover:text-ink hover:underline">Home</Link></li>
              <li aria-hidden="true">/</li>
              <li><Link to="/for" className="inline-block py-1.5 hover:text-ink hover:underline">Industries</Link></li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="text-ink">{capitalise(industry.plural)}</li>
            </ol>
          </nav>
          <h1 className="mt-6 max-w-3xl font-wide text-[2.1rem] font-bold leading-[1.05] tracking-[-0.015em] sm:text-5xl">
            {industry.headline}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">{industry.intro}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link to="/signup" className={primaryCta}>
              Start your {legal.trialDays}-day free trial
            </Link>
            <Link to={TOOL_PATH} className={`${textLink} inline-flex min-h-12 items-center justify-center px-2`}>
              Get your free review link first
            </Link>
          </div>
        </section>

        <section className="border-t border-line bg-white">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-14 sm:px-6 md:grid-cols-2 lg:py-20">
            <div>
              <h2 className="font-semiwide text-2xl font-bold tracking-[-0.01em]">Why Google reviews matter for {industry.plural}</h2>
              <p className="mt-3 leading-relaxed text-muted">{industry.whyReviewsMatter}</p>
              <h3 className="mt-10 text-lg font-semibold">What your customers can mention</h3>
              <p className="mt-2 leading-relaxed text-muted">
                Customers tap the topics that fit their visit. These are the ones Reviyo suggests for a {industry.singular};
                you can change them any time.
              </p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {topics.map((topic) => (
                  <li key={topic} className="rounded-full border border-line px-3.5 py-1.5 text-sm">{topic}</li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="font-semiwide text-2xl font-bold tracking-[-0.01em]">Where to put your QR code</h2>
              <ul className="mt-4 divide-y divide-line border-y border-line">
                {industry.placement.map((place) => (
                  <li key={place} className="py-3.5 leading-relaxed">{place}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="border-t border-line">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 lg:py-20">
            <h2 className="font-semiwide text-2xl font-bold tracking-[-0.01em]">How it works in your {industry.singular}</h2>
            <ol className="mt-8 grid gap-8 md:grid-cols-3">
              {steps.map(([title, text], index) => (
                <li key={title} className="border-t-2 border-ink pt-4">
                  <p className="flex items-baseline gap-3">
                    <span className="font-semiwide text-2xl font-bold text-blue-600">{index + 1}</span>
                    <span className="text-lg font-semibold">{title}</span>
                  </p>
                  <p className="mt-2 leading-relaxed text-muted">{text}</p>
                </li>
              ))}
            </ol>
            <p className="mt-12 max-w-3xl leading-relaxed">
              <strong className="font-semibold">Reviews that follow Google&apos;s rules.</strong>{' '}
              <span className="text-muted">
                Every customer sees the same options whatever their rating, nothing is offered in return for a review, and
                the customer writes and posts the final review themselves. That keeps your reviews credible and your
                Business Profile safe.
              </span>
            </p>
          </div>
        </section>

        <section className="border-t border-line bg-white">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:py-20">
            <h2 className="font-semiwide text-2xl font-bold tracking-[-0.01em]">Questions from {industry.plural}</h2>
            <div className="divide-y divide-line border-y border-line">
              {industry.faqs.map((faq) => (
                <details key={faq.q} className="group py-1">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                    <h3>{faq.q}</h3>
                    <span className="flex-shrink-0 text-2xl font-normal leading-none text-muted transition-transform group-open:rotate-45" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <p className="max-w-2xl pb-5 leading-relaxed text-muted">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-14 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-semiwide text-2xl font-bold leading-snug tracking-[-0.01em] sm:text-3xl">
                Start collecting genuine reviews for your {industry.singular}
              </h2>
              <p className="mt-2 text-muted">
                {legal.trialDays}-day free trial. ₹1 AutoPay check, refunded. Plans from {formatRupees(PLANS['6_months'].price)} for
                6 months.
              </p>
            </div>
            <Link to="/signup" className={`${primaryCta} flex-shrink-0`}>
              Start your free trial
            </Link>
          </div>
        </section>

        <section className="border-t border-line bg-white">
          <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6">
            <h2 className="text-lg font-semibold">Reviyo for other businesses</h2>
            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
              {others.map((other) => (
                <li key={other.slug}>
                  <Link to={`/for/${other.slug}`} className={textLink}>
                    {capitalise(other.plural)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
