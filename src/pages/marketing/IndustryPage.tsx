import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowRight, Check, ExternalLink, MapPin, QrCode, ShieldCheck, Sparkles } from 'lucide-react';
import { MarketingHeader } from '@/components/MarketingHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SkipLink } from '@/components/SkipLink';
import { getIndustry, industries, industryTopics } from '@/config/industries';
import { TOOL_PATH } from '@/config/seo';
import { legal } from '@/config/legal';

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
        <section className="bg-gradient-to-br from-blue-50 via-white to-sky-50 px-6 py-16 lg:py-24">
          <div className="max-w-4xl mx-auto">
            <nav aria-label="Breadcrumb" className="text-xs text-gray-600">
              <ol className="flex flex-wrap items-center gap-1.5">
                <li><Link to="/" className="inline-block py-1.5 hover:underline">Home</Link></li>
                <li aria-hidden="true">/</li>
                <li><Link to="/for" className="inline-block py-1.5 hover:underline">Industries</Link></li>
                <li aria-hidden="true">/</li>
                <li aria-current="page" className="text-gray-900">{capitalise(industry.plural)}</li>
              </ol>
            </nav>
            <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-1.5 text-xs font-medium text-blue-800">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Google reviews for {industry.plural}
            </p>
            <h1 className="mt-4 text-3xl lg:text-5xl font-bold text-gray-900 leading-tight">{industry.headline}</h1>
            <p className="mt-5 text-lg text-gray-700 max-w-3xl">{industry.intro}</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                to="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white px-6 py-3.5 text-base font-medium hover:bg-blue-700"
              >
                Start your {legal.trialDays}-day free trial <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
              <Link
                to={TOOL_PATH}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white text-gray-800 px-6 py-3.5 text-base font-medium hover:bg-gray-50"
              >
                Get your free review link first
              </Link>
            </div>
          </div>
        </section>

        <section className="px-6 py-16">
          <div className="max-w-5xl mx-auto grid gap-10 md:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Why Google reviews matter for {industry.plural}</h2>
              <p className="mt-3 text-gray-700">{industry.whyReviewsMatter}</p>
              <h3 className="mt-8 text-lg font-semibold text-gray-900">What your customers can mention</h3>
              <p className="mt-2 text-sm text-gray-700">
                Customers tap the topics that fit their visit. These are the ones Reviyo suggests for a {industry.singular};
                you can change them any time.
              </p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {topics.map((topic) => (
                  <li key={topic} className="rounded-full bg-gray-100 px-3.5 py-1.5 text-sm text-gray-800">{topic}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
              <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
                <MapPin className="h-5 w-5 text-blue-700" aria-hidden="true" /> Where to put your QR code
              </h2>
              <ul className="mt-4 space-y-3">
                {industry.placement.map((place) => (
                  <li key={place} className="flex gap-2.5 text-gray-700">
                    <Check className="mt-1 h-4 w-4 flex-shrink-0 text-green-700" aria-hidden="true" />
                    <span>{place}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="bg-gray-50 px-6 py-16">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 text-center">How it works in your {industry.singular}</h2>
            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              {[
                { icon: QrCode, title: 'They scan', text: 'Your customer scans the QR code with their phone camera. No app, no sign-up.' },
                { icon: Sparkles, title: 'AI helps them write', text: 'They rate the visit and tap topics. AI drafts a review from only what they chose.' },
                { icon: ExternalLink, title: 'They post it on Google', text: 'They edit the draft if they like, then post it on your Google Business Profile themselves.' },
              ].map((step, index) => (
                <li key={step.title} className="rounded-2xl bg-white border border-gray-200 p-6">
                  <step.icon className="h-7 w-7 text-blue-700" aria-hidden="true" />
                  <p className="mt-3 text-xs font-bold text-gray-600">STEP {index + 1}</p>
                  <h3 className="text-lg font-semibold text-gray-900">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-gray-700">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="px-6 py-16">
          <div className="max-w-3xl mx-auto">
            <div className="rounded-2xl border border-green-200 bg-green-50 p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                <ShieldCheck className="h-5 w-5 text-green-700" aria-hidden="true" /> Reviews that follow Google’s rules
              </h2>
              <p className="mt-2 text-sm text-gray-800">
                Every customer sees the same options whatever their rating, nothing is offered in return for a review, and
                the customer writes and posts the final review themselves. That keeps your reviews credible and your
                Business Profile safe.
              </p>
            </div>

            <h2 className="mt-14 text-2xl font-bold text-gray-900">Questions from {industry.plural}</h2>
            <ul className="mt-6 space-y-4">
              {industry.faqs.map((faq) => (
                <li key={faq.q} className="rounded-2xl border border-gray-200 p-5">
                  <h3 className="text-base font-semibold text-gray-900">{faq.q}</h3>
                  <p className="mt-1.5 text-sm text-gray-700">{faq.a}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="px-6 pb-16">
          <div className="max-w-3xl mx-auto rounded-3xl bg-gradient-to-br from-blue-600 to-blue-700 p-10 text-center">
            <h2 className="text-2xl lg:text-3xl font-bold text-white">
              Start collecting genuine reviews for your {industry.singular}
            </h2>
            <p className="mt-3 text-blue-50">
              {legal.trialDays}-day free trial. ₹1 AutoPay check, refunded. Plans from ₹1,999 for 6 months.
            </p>
            <Link
              to="/signup"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-base font-medium text-blue-700 hover:bg-blue-50"
            >
              Start free <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section className="border-t border-gray-200 px-6 py-12">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-lg font-semibold text-gray-900">Reviyo for other businesses</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {others.map((other) => (
                <li key={other.slug}>
                  <Link
                    to={`/for/${other.slug}`}
                    className="inline-block rounded-full border border-gray-300 px-3.5 py-1.5 text-sm text-gray-800 hover:bg-gray-50"
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
