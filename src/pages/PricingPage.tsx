import { Link } from 'react-router-dom';
import { MarketingHeader } from '@/components/MarketingHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SkipLink } from '@/components/SkipLink';
import { PlanCards } from '@/components/PlanCards';
import { legal } from '@/config/legal';

export function PricingPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SkipLink />
      <MarketingHeader />

      <main id="main-content" tabIndex={-1} className="flex-1">
      <section className="py-12 sm:py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 text-center">Simple, transparent pricing</h1>
          <p className="mt-4 text-gray-600 text-center max-w-xl mx-auto">
            One subscription covers one business, one location, and one Google Business Profile.
            Inclusive of applicable taxes. Renews automatically with UPI AutoPay or card until you
            cancel, and you are <strong className="text-gray-900">notified at least 24 hours before
            every charge</strong>. Prefer not to use AutoPay? Pay once for a term from Billing.
          </p>

          <div className="mt-12">
            <PlanCards headingLevel="h2" />
          </div>

          <div className="mt-8 space-y-3 text-center text-sm text-gray-600">
            <p>
              Your {legal.trialDays}-day free trial includes full access. To start it you set up AutoPay with a ₹1
              verification payment, which is refunded straight away. Nothing more is charged until the
              trial ends, and cancelling before then costs nothing. Payments are processed by
              Razorpay, an RBI-authorised payment aggregator — we never see or store your card, UPI,
              or bank details.
            </p>
            <p>
              Changed your mind? Full refund within 7 days, no reason needed. See the{' '}
              <Link to="/refunds" className="font-medium text-blue-700 underline underline-offset-2">
                Refund &amp; Cancellation Policy
              </Link>{' '}
              and{' '}
              <Link to="/terms" className="font-medium text-blue-700 underline underline-offset-2">
                Terms &amp; Conditions
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
      </main>

      <SiteFooter />
    </div>
  );
}
