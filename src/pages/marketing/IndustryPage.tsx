import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { MarketingHeader } from '@/components/MarketingHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SkipLink } from '@/components/SkipLink';
import { getIndustry, industries, industryTopics } from '@/config/industries';
import { TOOL_PATH } from '@/config/seo';
import { legal } from '@/config/legal';
import { formatRupees, PLANS } from '@/config/plans';
import { buttonClasses } from '@/components/ui/button-styles';

const capitalise = (text: string) => text.replace(/^\w/, (c) => c.toUpperCase());

export function IndustryPage() {
  const { slug } = useParams<{ slug: string }>();
  const industry = getIndustry(slug);
  if (!industry) return <Navigate to="/for" replace />;

  const topics = industryTopics(industry);
  const others = industries.filter((i) => i.slug !== industry.slug);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SkipLink />
      <MarketingHeader />

      <main id="main-content" tabIndex={-1} className="flex-1">
        <section className="px-5 pb-16 pt-8 sm:px-6 lg:pb-20 lg:pt-12">
          <div className="mx-auto max-w-6xl">
            <nav aria-label="Breadcrumb" className="text-sm text-gray-600">
              <ol className="flex flex-wrap items-center gap-1.5">
                <li><Link to="/" className="inline-block py-1.5 hover:text-gray-900 hover:underline">Home</Link></li>
                <li aria-hidden="true">/</li>
                <li><Link to="/for" className="inline-block py-1.5 hover:text-gray-900 hover:underline">Industries</Link></li>
                <li aria-hidden="true">/</li>
                <li aria-current="page" className="text-gray-900">{capitalise(industry.plural)}</li>
              </ol>
            </nav>
            <div className="mt-10 max-w-3xl">
              <p className="text-sm font-semibold text-accent-700">Google reviews for {industry.plural}</p>
              <h1 className="mt-3 text-[2rem] font-extrabold leading-[1.1] text-balance text-gray-900 sm:text-5xl">{industry.headline}</h1>
              <p className="mt-6 text-lg leading-relaxed text-gray-700">{industry.intro}</p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                <Link to="/signup" className={`${buttonClasses({ size: 'lg' })} w-full sm:w-auto`}>
                  Start your {legal.trialDays}-day free trial <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </Link>
                <Link
                  to={TOOL_PATH}
                  className="text-center text-sm font-semibold text-brand-800 underline decoration-brand-200 decoration-2 underline-offset-4 hover:decoration-brand-700"
                >
                  Or get your free review link first
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-gray-200 bg-paper px-5 py-16 sm:px-6 lg:py-20">
          <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2 lg:gap-16">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Why Google reviews matter for {industry.plural}</h2>
              <p className="mt-4 leading-relaxed text-gray-700">{industry.whyReviewsMatter}</p>
              <h3 className="mt-10 text-lg font-semibold text-gray-900">What your customers can mention</h3>
              <p className="mt-2 text-sm text-gray-700">
                Customers tap the topics that fit their visit. These are the ones Reviyo suggests for a {industry.singular};
                you can change them any time.
              </p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {topics.map((topic) => (
                  <li key={topic} className="rounded-full border border-gray-300 bg-white px-3.5 py-1.5 text-sm text-gray-800">{topic}</li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Where to put your QR code</h2>
              <ol className="mt-6 border-t border-gray-300">
                {industry.placement.map((place, index) => (
                  <li key={place} className="flex gap-4 border-b border-gray-300 py-4 text-gray-800">
                    <span className="text-lg font-bold text-accent-700" aria-hidden="true">{index + 1}</span>
                    <span>{place}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="px-5 py-16 sm:px-6 lg:py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">How it works in your {industry.singular}</h2>
            <ol className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
              {[
                { title: 'They scan', text: 'Your customer scans the QR code with their phone camera. No app, no sign-up.' },
                { title: 'They tap what stood out', text: 'They rate the visit and tap topics. AI drafts a review from only what they chose.' },
                { title: 'They post it on Google', text: 'They edit the draft if they like, then post it on your Google Business Profile themselves.' },
              ].map((step, index) => (
                <li key={step.title} className="border-t-2 border-brand-900 pt-5">
                  <p className="text-sm font-semibold text-accent-700">Step {index + 1}</p>
                  <h3 className="mt-2 text-lg font-semibold text-gray-900">{step.title}</h3>
                  <p className="mt-2 leading-relaxed text-gray-700">{step.text}</p>
                </li>
              ))}
            </ol>

            <div className="mt-14 border-l-4 border-accent-500 bg-accent-50 px-6 py-5">
              <h2 className="text-lg font-bold text-gray-900">Reviews that follow Google’s rules</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-800">
                Every customer sees the same options whatever their rating, nothing is offered in return for a review, and
                the customer writes and posts the final review themselves. That keeps your reviews credible and your
                Business Profile safe.
              </p>
            </div>
          </div>
        </section>

        <section className="border-t border-gray-200 px-5 py-16 sm:px-6 lg:py-20">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Questions from {industry.plural}</h2>
            <ul className="divide-y divide-gray-200 border-y border-gray-200">
              {industry.faqs.map((faq) => (
                <li key={faq.q} className="py-6">
                  <h3 className="font-semibold text-gray-900">{faq.q}</h3>
                  <p className="mt-2 leading-relaxed text-gray-700">{faq.a}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-brand-900 px-5 py-14 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white sm:text-3xl">
                Start collecting genuine reviews for your {industry.singular}
              </h2>
              <p className="mt-2 text-brand-100">
                {legal.trialDays}-day free trial. ₹1 AutoPay check, refunded. Plans from {formatRupees(PLANS['6_months'].price)} for {PLANS['6_months'].months} months.
              </p>
            </div>
            <Link
              to="/signup"
              className="inline-flex min-h-12 flex-shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-6 text-base font-semibold text-brand-900 transition-colors hover:bg-brand-50"
            >
              Start your free trial <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section className="px-5 py-12 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-lg font-semibold text-gray-900">Reviyo for other businesses</h2>
            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
              {others.map((other) => (
                <li key={other.slug}>
                  <Link
                    to={`/for/${other.slug}`}
                    className="inline-block py-1 text-sm font-medium text-brand-800 underline decoration-brand-200 underline-offset-4 hover:decoration-brand-700"
                  >
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
