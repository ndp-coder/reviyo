import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { MarketingHeader } from '@/components/MarketingHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SkipLink } from '@/components/SkipLink';
import { ProductPreview } from '@/components/ProductPreview';
import { landingFaqs } from '@/config/faq';
import { industries } from '@/config/industries';
import { TOOL_PATH } from '@/config/seo';
import { legal } from '@/config/legal';
import { PlanCards } from '@/components/PlanCards';
import { buttonClasses } from '@/components/ui/button-styles';

const steps = [
  {
    where: 'At your counter',
    title: 'They scan your QR code',
    text: 'Any phone camera opens your review page. There is no app to install and no account to create.',
  },
  {
    where: 'On their phone',
    title: 'They tap what stood out',
    text: 'A star rating, a few topics like “service” or “pricing”, and a line of their own if they want. AI turns that into a draft.',
  },
  {
    where: 'On Google',
    title: 'They post it themselves',
    text: 'They read the draft, change anything that isn’t right, then copy it and paste it on your Google profile.',
  },
];

const features = [
  {
    title: 'A QR code and a counter card, ready to print',
    text: 'Download your code as PNG or SVG, or print the ready-made card. Add separate codes for tables, bills, or a second counter and see which one gets scanned.',
  },
  {
    title: 'Review requests on WhatsApp',
    text: 'Send your review link after a visit with a message you write once. WhatsApp opens on your phone and you pick the customer; no numbers pass through Reviyo.',
  },
  {
    title: 'Help with the words, not the opinion',
    text: 'The AI uses only the rating, topics, and comment the customer gives. It adds no experiences, staff names, or prices they didn’t mention.',
  },
  {
    title: 'A private feedback inbox',
    text: 'Anyone can send you a private note as well as, or instead of, a review. Mark each one new, seen, or resolved.',
  },
  {
    title: 'Numbers you can act on',
    text: 'See how many people opened your page, started, got a draft, and went on to Google, so you know where people drop off.',
  },
  {
    title: 'Topics that fit your trade',
    text: 'Start from suggested topics for your kind of business, then rename, reorder, or add your own at any time.',
  },
];

const rules = [
  {
    title: 'Everyone is asked the same way',
    text: 'Whatever rating a customer gives, they see the same option to post on Google. We never hide it from someone who had a bad day with you.',
  },
  {
    title: 'Nothing is offered in return',
    text: 'No discounts, no freebies, no lucky draws for reviews. Google forbids it, so our Terms do too.',
  },
  {
    title: 'The customer posts, not us',
    text: 'Reviyo never posts on anyone’s behalf. The review goes up under the customer’s own Google account, in words they have checked.',
  },
];

const capitalise = (text: string) => text.replace(/^\w/, (c) => c.toUpperCase());

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <SkipLink />
      <MarketingHeader
        links={[
          { href: '#how-it-works', label: 'How it works' },
          { href: '#features', label: 'Features' },
          { to: '/for', label: 'Industries' },
          { href: '#pricing', label: 'Pricing' },
          { href: '#faq', label: 'FAQ' },
        ]}
      />

      <main id="main-content" tabIndex={-1}>
        {/* Hero */}
        <section className="px-5 pb-16 pt-10 sm:px-6 sm:pt-14 lg:pb-24 lg:pt-20">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-12">
            <div>
              <p className="text-sm font-semibold text-accent-700">Google reviews for local businesses in India</p>
              <h1 className="mt-4 text-[2.1rem] font-bold leading-[1.08] text-balance text-gray-900 sm:text-5xl lg:text-[3.25rem]">
                Your customers would review you on Google.{' '}
                <span className="text-gray-500">They just don’t know what to write.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-gray-700">
                Reviyo puts a QR code on your counter. Customers scan it, tap a rating and what they liked, and get a
                draft in their own words to edit and post on Google themselves.
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                <Link to="/signup" className={`${buttonClasses({ size: 'lg' })} w-full sm:w-auto`}>
                  Start {legal.trialDays}-day free trial <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </Link>
                <Link
                  to={TOOL_PATH}
                  className="text-center text-sm font-semibold text-brand-800 underline decoration-brand-200 decoration-2 underline-offset-4 hover:decoration-brand-700"
                >
                  Or get your free review link first
                </Link>
              </div>
              <p className="mt-5 text-sm text-gray-600">
                ₹1 AutoPay check, refunded straight away. Cancel any time before the trial ends and pay nothing.
              </p>
            </div>
            <ProductPreview />
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20 border-t border-gray-200 px-5 py-16 sm:px-6 lg:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">How it works</h2>
              <p className="mt-3 text-lg text-gray-700">From scan to posted review in about a minute.</p>
            </div>
            <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
              {steps.map((step, index) => (
                <li key={step.title} className="border-t-2 border-brand-900 pt-5">
                  <p className="text-sm font-semibold text-accent-700">
                    {index + 1}. {step.where}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-gray-900">{step.title}</h3>
                  <p className="mt-2 leading-relaxed text-gray-700">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 bg-paper px-5 py-16 sm:px-6 lg:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">What you get</h2>
              <p className="mt-3 text-lg text-gray-700">
                Everything is in every plan. There are no add-ons and no per-review charges.
              </p>
            </div>
            <dl className="grid gap-x-10 sm:grid-cols-2">
              {features.map((feature) => (
                <div key={feature.title} className="border-t border-gray-300 py-6">
                  <dt className="font-semibold text-gray-900">{feature.title}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-gray-700">{feature.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* The rules */}
        <section className="bg-brand-950 px-5 py-16 text-white sm:px-6 lg:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">
            <div>
              <h2 className="text-3xl font-bold sm:text-4xl">Three rules we don’t bend</h2>
              <p className="mt-3 text-lg text-brand-100">
                Google removes reviews, and can restrict a Business Profile, when these are broken. Reviyo is built
                around them.
              </p>
            </div>
            <ol className="grid gap-8 sm:grid-cols-3 sm:gap-6">
              {rules.map((rule, index) => (
                <li key={rule.title}>
                  <p className="font-display text-4xl font-bold text-accent-400" aria-hidden="true">
                    {index + 1}
                  </p>
                  <h3 className="mt-3 font-semibold">{rule.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-brand-100">{rule.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Who it's for */}
        <section className="px-5 py-16 sm:px-6 lg:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Who it’s for</h2>
              <p className="mt-3 text-lg text-gray-700">
                Small, single-location businesses where customers stand at a counter or sit and wait for a moment.
              </p>
              <p className="mt-6 text-sm text-gray-700">
                Just need your review link?{' '}
                <Link to={TOOL_PATH} className="font-semibold text-brand-800 underline underline-offset-2">
                  Generate it and a QR code for free
                </Link>
                .
              </p>
            </div>
            <ul className="grid content-start border-t border-gray-200 sm:grid-cols-2 sm:gap-x-10">
              {industries.map((industry) => (
                <li key={industry.slug} className="border-b border-gray-200">
                  <Link
                    to={`/for/${industry.slug}`}
                    className="group flex items-center justify-between gap-3 py-3.5 font-medium text-gray-900 hover:text-brand-700"
                  >
                    {capitalise(industry.plural)}
                    <ArrowRight
                      className="h-4 w-4 flex-shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-700"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-20 border-t border-gray-200 bg-paper px-5 py-16 sm:px-6 lg:py-24">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Pricing</h2>
            <p className="mt-3 text-lg text-gray-700">One business, one location. Every feature on both plans, taxes included.</p>
            <div className="mt-10">
              <PlanCards />
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 px-5 py-16 sm:px-6 lg:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Questions owners ask</h2>
              <p className="mt-3 text-gray-700">
                Something else?{' '}
                <Link to="/contact" className="font-semibold text-brand-800 underline underline-offset-2">
                  Get in touch
                </Link>
                .
              </p>
            </div>
            <ul className="list-none divide-y divide-gray-200 border-y border-gray-200 p-0">
              {landingFaqs.map((item) => (
                <li key={item.q} className="py-6">
                  <h3 className="font-semibold text-gray-900">{item.q}</h3>
                  <p className="mt-2 leading-relaxed text-gray-700">{item.a}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-brand-900 px-5 py-14 sm:px-6 lg:py-16">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-3xl font-bold text-white sm:text-4xl">Try it at your counter for {legal.trialDays} days.</h2>
              <p className="mt-2 text-brand-100">₹1 AutoPay check, refunded. Cancel any time before the trial ends.</p>
            </div>
            <Link
              to="/signup"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white px-6 text-base font-semibold text-brand-900 transition-colors hover:bg-brand-50"
            >
              Start your free trial <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
