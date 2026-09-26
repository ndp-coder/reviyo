import { Link } from 'react-router-dom';
import { MarketingHeader } from '@/components/MarketingHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SkipLink } from '@/components/SkipLink';
import { PlanCards } from '@/components/PlanCards';
import { legal } from '@/config/legal';

export function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <SkipLink />
      <MarketingHeader />

      <main id="main-content" tabIndex={-1} className="flex-1">
      <section className="px-5 py-12 sm:px-6 lg:py-16">
        <div className="mx-auto max-w-6xl">
          <h1 className="font-wide text-[2.1rem] font-bold leading-[1.05] tracking-[-0.015em] sm:text-5xl">Pricing</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
            One subscription covers one business, one location, and one Google Business Profile. Prices include
            applicable taxes.
          </p>

          <div className="mt-10 max-w-4xl">
            <PlanCards headingLevel="h2" />
          </div>

          <h2 className="mt-16 font-semiwide text-2xl font-bold tracking-[-0.01em]">How billing works</h2>
          <dl className="mt-5 max-w-4xl divide-y divide-line border-y border-line">
            {[
              [
                'Free trial',
                `${legal.trialDays} days with full access. To start it you set up AutoPay with a ₹1 verification payment, refunded straight away. Nothing more is charged until the trial ends.`,
              ],
              [
                'Renewal',
                'Renews automatically with UPI AutoPay or card until you cancel. You are notified at least 24 hours before every charge. Prefer not to use AutoPay? Pay once for a term from Billing.',
              ],
              ['Cancelling', 'Cancel any time from Billing. Cancel before the trial ends and you pay nothing; otherwise you keep access until the end of the period you paid for.'],
              ['Refunds', 'Full refund within 7 days of a payment, no reason needed.'],
              [
                'Payments',
                'Processed by Razorpay, an RBI-authorised payment aggregator. We never see or store your card, UPI, or bank details.',
              ],
            ].map(([term, detail]) => (
              <div key={term} className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
                <dt className="font-semibold">{term}</dt>
                <dd className="leading-relaxed text-muted">{detail}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-muted">
            The details are in the{' '}
            <Link to="/refunds" className="font-medium text-ink underline decoration-line decoration-2 underline-offset-4 hover:decoration-ink">
              Refund &amp; Cancellation Policy
            </Link>{' '}
            and{' '}
            <Link to="/terms" className="font-medium text-ink underline decoration-line decoration-2 underline-offset-4 hover:decoration-ink">
              Terms &amp; Conditions
            </Link>
            .
          </p>
        </div>
      </section>
      </main>

      <SiteFooter />
    </div>
  );
}
