import { Link } from 'react-router-dom';
import { MarketingHeader } from '@/components/MarketingHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SkipLink } from '@/components/SkipLink';
import { PlanCards } from '@/components/PlanCards';
import { CounterCard, DraftScreen, Phone, RatingScreen, TopicsScreen } from '@/components/marketing/ProductArt';
import { landingFaqs } from '@/config/faq';
import { industries } from '@/config/industries';
import { SITE_URL, TOOL_PATH } from '@/config/seo';
import { legal } from '@/config/legal';
import { PLANS, formatRupees } from '@/config/plans';

const primaryCta =
  'inline-flex min-h-12 items-center justify-center rounded-lg bg-blue-600 px-6 text-base font-semibold text-white transition-colors hover:bg-blue-700';

// The customer's side really is a sequence, so it is numbered.
const CUSTOMER_STEPS = [
  {
    title: 'Scan and rate',
    body: 'They point their phone camera at the card on your counter. No app, no sign-up. One tap gives a star rating.',
    screen: <RatingScreen />,
  },
  {
    title: 'Say what stood out',
    body: 'They tap the topics that fit — the doctor, the wait, the food — and can add a few words of their own.',
    screen: <TopicsScreen />,
  },
  {
    title: 'Post it on Google',
    body: 'A draft appears, built only from what they chose. They edit it if they like, copy it, and post it themselves.',
    screen: <DraftScreen compact />,
  },
];

const OWNER_TOOLS = [
  ['A printable counter card', 'Your name and QR code on a card sized for the counter, reception, or bill folder. PNG and SVG too.'],
  ['A code for every spot', 'Separate QR codes for tables, desks, or staff, so you can see which one brings in reviews.'],
  ['Ask on WhatsApp', 'Send your review link after a visit or an order with a message you write once.'],
  ['Private feedback', 'Customers who would rather tell you than the world can send a message only you see.'],
  ['Where customers drop off', 'Scans, drafts, and hand-offs to Google, so you know whether the card is working.'],
];

// What the product refuses to do. These are its rules, not marketing.
const WONT_DO = [
  ['Post reviews for anyone.', 'Every review is copied and posted by the customer, on Google, under their own name.'],
  ['Hide unhappy customers.', 'A one-star visit gets the same page and the same button as a five-star one.'],
  ['Make anything up.', 'The draft uses only the rating, the topics tapped, and anything the customer typed.'],
  ['Collect customer details.', 'No names, numbers, or emails — and what they enter is deleted after 90 days.'],
];

export function LandingPage() {
  const sixMonths = formatRupees(PLANS['6_months'].price);
  const twelveMonths = formatRupees(PLANS['12_months'].price);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SkipLink />
      <MarketingHeader
        links={[
          { href: '#how-it-works', label: 'How it works' },
          { to: '/for', label: 'Industries' },
          { href: '#pricing', label: 'Pricing' },
          { href: '#faq', label: 'FAQ' },
        ]}
      />

      <main id="main-content" tabIndex={-1}>
        {/* Hero: the thing itself — the card on the counter, and the review it becomes. */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-8 lg:pb-24 lg:pt-20">
          <div>
            <h1 className="font-wide text-[2.35rem] font-bold leading-[1.02] tracking-[-0.015em] sm:text-5xl lg:text-[3.6rem]">
              Turn the thank‑you at your counter into a Google review.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Put a Reviyo QR code where customers pay. They scan it, tap a rating, and get a draft review in their
              own words to post on Google. It takes them about a minute.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link to="/signup" className={primaryCta}>
                Start {legal.trialDays}-day free trial
              </Link>
              <a href="#how-it-works" className="inline-flex min-h-12 items-center justify-center px-2 text-base font-medium text-ink underline decoration-line decoration-2 underline-offset-4 hover:decoration-ink">
                See what customers see
              </a>
            </div>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-muted">
              A ₹1 UPI or card check starts the trial and is refunded straight away. After that it&apos;s {sixMonths}{' '}
              for 6 months or {twelveMonths} for 12, and you can cancel before the trial ends.
            </p>
          </div>

          {/* The counter card, and the phone of a customer who has just scanned it. */}
          {/* Phones get the card alone: the customer's screens follow right below. */}
          <div className="relative mx-auto flex w-full justify-center sm:block sm:h-[31rem] sm:max-w-[31rem]" aria-hidden="true">
            <CounterCard qrValue={SITE_URL} className="-rotate-2 sm:absolute sm:left-0 sm:top-0 sm:-rotate-3" />
            <Phone className="absolute bottom-0 right-0 hidden w-60 sm:block">
              <DraftScreen />
            </Phone>
          </div>
        </section>

        {/* The customer's minute */}
        <section id="how-it-works" className="border-t border-line bg-white">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:py-24">
            <h2 className="font-semiwide text-3xl font-bold tracking-[-0.01em] sm:text-4xl">A customer&apos;s minute</h2>
            <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted">
              This is the whole flow on your customer&apos;s phone. Nothing to install, nothing to sign up for.
            </p>
            <ol className="mt-12 grid gap-12 md:grid-cols-3 md:gap-8">
              {CUSTOMER_STEPS.map((step, i) => (
                <li key={step.title}>
                  <Phone className="mx-auto w-56" screenClassName="h-[23rem]">
                    {step.screen}
                  </Phone>
                  <div className="mx-auto mt-6 max-w-xs">
                    <p className="flex items-baseline gap-3">
                      <span className="font-semiwide text-2xl font-bold text-blue-600">{i + 1}</span>
                      <span className="text-lg font-semibold">{step.title}</span>
                    </p>
                    <p className="mt-1.5 leading-relaxed text-muted">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* The owner's side */}
        <section className="border-t border-line">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-24">
            <div>
              <h2 className="font-semiwide text-3xl font-bold tracking-[-0.01em] sm:text-4xl">What you get</h2>
              <p className="mt-3 text-lg leading-relaxed text-muted">
                One plan, one business, everything included. Set-up takes about three minutes: your name, your Google
                review link, and the topics your customers care about.
              </p>
            </div>
            <dl className="divide-y divide-line border-y border-line">
              {OWNER_TOOLS.map(([term, detail]) => (
                <div key={term} className="grid gap-1 py-5 sm:grid-cols-[13rem_1fr] sm:gap-6">
                  <dt className="font-semibold">{term}</dt>
                  <dd className="leading-relaxed text-muted">{detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* The rules the product keeps */}
        <section className="bg-ink text-white">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:py-24">
            <h2 className="max-w-2xl font-semiwide text-3xl font-bold tracking-[-0.01em] sm:text-4xl">
              Genuine reviews only. Reviyo won&apos;t:
            </h2>
            <ul className="mt-10 grid gap-x-12 gap-y-8 sm:grid-cols-2">
              {WONT_DO.map(([rule, detail]) => (
                <li key={rule} className="border-t border-white/20 pt-5">
                  <p className="text-xl font-semibold">{rule}</p>
                  <p className="mt-2 leading-relaxed text-blue-100/80">{detail}</p>
                </li>
              ))}
            </ul>
            <p className="mt-10 max-w-2xl leading-relaxed text-blue-100/80">
              That keeps your Google Business Profile safe: Google&apos;s rules forbid reviews that are filtered, paid
              for, or posted on someone&apos;s behalf, and it can take them down. Reviyo is not affiliated with Google.
            </p>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-b border-line">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:py-24">
            <h2 className="font-semiwide text-3xl font-bold tracking-[-0.01em] sm:text-4xl">Pricing</h2>
            <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted">
              One business, one location, one Google Business Profile. Taxes included. Renews with UPI AutoPay or card
              until you cancel, with a notice before every charge.
            </p>
            <div className="mt-10 max-w-4xl">
              <PlanCards showFeatures={false} />
            </div>
          </div>
        </section>

        {/* Industries */}
        <section className="bg-white">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6">
            <h2 className="font-semiwide text-2xl font-bold tracking-[-0.01em]">Made for local businesses</h2>
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-lg">
              {industries.map((industry) => (
                <li key={industry.slug}>
                  <Link
                    to={`/for/${industry.slug}`}
                    className="underline decoration-line decoration-2 underline-offset-4 hover:decoration-ink"
                  >
                    {industry.plural.replace(/^\w/, (c) => c.toUpperCase())}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-muted">
              Only need a link?{' '}
              <Link to={TOOL_PATH} className="font-medium text-ink underline decoration-line decoration-2 underline-offset-4 hover:decoration-ink">
                Make your Google review link and QR code for free
              </Link>
              , no account needed.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-line">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:py-24">
            <h2 className="font-semiwide text-3xl font-bold tracking-[-0.01em] sm:text-4xl">Questions owners ask</h2>
            <div className="divide-y divide-line border-y border-line">
              {landingFaqs.map((item) => (
                <details key={item.q} className="group py-1">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span className="flex-shrink-0 text-2xl font-normal leading-none text-muted transition-transform group-open:rotate-45" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <p className="max-w-2xl pb-5 leading-relaxed text-muted">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Close */}
        <section className="border-t border-line bg-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-14 sm:px-6 md:flex-row md:items-center md:justify-between">
            <p className="max-w-xl font-semiwide text-2xl font-bold leading-snug tracking-[-0.01em] sm:text-3xl">
              Put a QR code on your counter this week.
            </p>
            <Link to="/signup" className={`${primaryCta} flex-shrink-0`}>
              Start {legal.trialDays}-day free trial
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
