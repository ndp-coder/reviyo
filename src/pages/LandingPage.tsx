import { Link } from 'react-router-dom';
import { QrCode, Sparkles, ExternalLink, BarChart3, MessageSquare, ArrowRight, Zap, Shield } from 'lucide-react';
import { MarketingHeader } from '@/components/MarketingHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SkipLink } from '@/components/SkipLink';
import { landingFaqs } from '@/config/faq';
import { industries } from '@/config/industries';
import { TOOL_PATH } from '@/config/seo';
import { legal } from '@/config/legal';
import { PlanCards } from '@/components/PlanCards';

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
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-sky-50" />
        <div className="relative max-w-4xl mx-auto px-5 py-14 sm:px-6 sm:py-20 lg:py-28 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-1.5 text-xs font-medium text-blue-800 mb-6">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Google review QR code + AI review writing
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight tracking-tight">
            Get more genuine Google reviews from customers who already love you.
          </h1>
          <p className="mt-5 text-base sm:text-lg text-gray-700 max-w-2xl mx-auto">
            Put a Reviyo QR code at your counter. Customers scan it, rate their visit, and AI helps them write a
            Google review in their own words. Built for local businesses in India.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/signup" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white px-6 py-3.5 text-base font-medium hover:bg-blue-700 transition-colors shadow-sm w-full sm:w-auto justify-center">
              Start {legal.trialDays}-day free trial <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>
            <a href="#how-it-works" className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white text-gray-700 px-6 py-3.5 text-base font-medium hover:bg-gray-50 transition-colors w-full sm:w-auto justify-center">
              See how it works
            </a>
          </div>
          <p className="mt-4 text-xs text-gray-600">{legal.trialDays}-day free trial. ₹1 AutoPay check, refunded. Cancel anytime.</p>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center">How it works</h2>
          <p className="mt-3 text-gray-600 text-center max-w-xl mx-auto">From scan to posted review in about a minute.</p>
          <div className="mt-12 grid md:grid-cols-3 gap-8">
            {[
              { icon: QrCode, title: 'Customer scans', desc: 'Customer scans your QR code at the counter. No app to install, no account to create.', color: 'text-blue-600 bg-blue-50' },
              { icon: Sparkles, title: 'AI helps them write', desc: 'They rate their experience, pick topics, and AI drafts a genuine review from their input.', color: 'text-amber-600 bg-amber-50' },
              { icon: ExternalLink, title: 'Customer posts on Google', desc: 'They review the draft, edit if they want, then copy and paste it on Google themselves.', color: 'text-green-600 bg-green-50' },
            ].map((step, i) => (
              <div key={step.title} className="text-center relative">
                <div className={`inline-flex h-16 w-16 items-center justify-center rounded-2xl ${step.color} mb-4`}>
                  <step.icon className="h-8 w-8" aria-hidden="true" />
                </div>
                <div className="mb-1 text-sm font-semibold text-gray-600">Step {i + 1}</div>
                <h3 className="text-lg font-bold text-gray-900">{step.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{step.desc}</p>
                {i < 2 && (
                  <div aria-hidden="true" className="hidden md:block absolute top-8 -right-4 text-gray-300">
                    <ArrowRight className="h-6 w-6" aria-hidden="true" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center">Everything you need</h2>
          <p className="mt-3 text-gray-600 text-center">Tools to collect genuine reviews and understand your customers.</p>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: QrCode, title: 'Custom QR code', desc: 'Generate and download a QR code for your counter. Customers scan and start writing instantly.' },
              { icon: Sparkles, title: 'AI review writing', desc: 'AI helps customers express their experience naturally, based on their own input. No fake reviews.' },
              { icon: BarChart3, title: 'Analytics dashboard', desc: 'See how many people opened your page, started a review, generated a draft, and went on to Google.' },
              { icon: MessageSquare, title: 'Private feedback', desc: 'Customers can send private feedback too. Manage it with new, seen, and resolved statuses.' },
              { icon: Shield, title: 'No invented experiences', desc: 'The AI is instructed to use only what the customer enters. The customer edits and posts the final review themselves.' },
              { icon: Zap, title: 'Fast on phones', desc: 'Optimized for phones with a short, focused customer journey.' },
            ].map((feature) => (
              <div key={feature.title} className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 mb-4">
                  <feature.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="text-base font-bold text-gray-900">{feature.title}</h3>
                <p className="mt-1.5 text-sm text-gray-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who It's For */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900">Who it's for</h2>
          <p className="mt-3 text-gray-600">Built for small, single-location businesses. See how it works for yours:</p>
          <ul className="mt-10 flex flex-wrap justify-center gap-3">
            {industries.map((industry) => (
              <li key={industry.slug}>
                <Link
                  to={`/for/${industry.slug}`}
                  className="inline-block rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-blue-50 hover:text-blue-800"
                >
                  {industry.plural.replace(/^\w/, (c) => c.toUpperCase())}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-gray-700">
            Just need your review link?{' '}
            <Link to={TOOL_PATH} className="font-medium text-blue-700 underline underline-offset-2">
              Generate your Google review link and QR code free
            </Link>
            .
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center">Simple pricing</h2>
          <p className="mt-3 text-gray-600 text-center">One subscription. One business. One location.</p>
          <div className="mt-10">
            <PlanCards />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 px-6 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center">FAQ</h2>
          <ul className="mt-10 space-y-4 list-none p-0">
            {landingFaqs.map((item) => (
              <li key={item.q} className="rounded-2xl bg-white border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900">{item.q}</h3>
                <p className="mt-1.5 text-sm text-gray-700">{item.a}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center rounded-3xl bg-gradient-to-br from-blue-600 to-blue-700 p-12 lg:p-16">
          <h2 className="text-3xl font-bold text-white">Start collecting better reviews today</h2>
          <p className="mt-3 text-blue-50">{legal.trialDays}-day free trial. ₹1 AutoPay check, refunded. Cancel anytime.</p>
          <Link to="/signup" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white text-blue-700 px-6 py-3.5 text-base font-medium hover:bg-blue-50 transition-colors">
            Start your free trial <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
      </section>

      </main>

      <SiteFooter />
    </div>
  );
}
