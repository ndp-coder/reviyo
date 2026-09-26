import { Link } from 'react-router-dom';
import { MarketingHeader } from '@/components/MarketingHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SkipLink } from '@/components/SkipLink';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { PlanCards } from '@/components/PlanCards';
import { legal } from '@/config/legal';
import { TOOL_PATH } from '@/config/seo';

export function PricingPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SkipLink />
      <MarketingHeader />

      <main id="main-content" tabIndex={-1} className="flex-1">
      <section className="bg-paper px-5 pb-16 pt-8 sm:px-6 lg:pb-24 lg:pt-12">
        <div className="max-w-4xl mx-auto">
          <Breadcrumbs />
          <h1 className="mt-8 text-[2rem] font-bold leading-[1.15] text-balance text-gray-900 sm:text-5xl">
            Every feature on both plans. Just pick a term.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-gray-700">
            One subscription covers one business, one location, and one Google Business Profile.
            Inclusive of applicable taxes. Renews automatically with UPI AutoPay or card until you
            cancel, and you are <strong className="text-gray-900">notified at least 24 hours before
            every charge</strong>. Prefer not to use AutoPay? Pay once for a term from Billing.
          </p>

          <div className="mt-12">
            <PlanCards headingLevel="h2" />
          </div>

          <div className="mt-10 max-w-3xl space-y-3 text-sm leading-relaxed text-gray-700">
            <p>
              Your {legal.trialDays}-day free trial includes full access. To start it you set up AutoPay with a ₹1
              verification payment, which is refunded straight away. Nothing more is charged until the
              trial ends, and cancelling before then costs nothing. Payments are processed by
              Razorpay, an RBI-authorised payment aggregator — we never see or store your card, UPI,
              or bank details.
            </p>
            <p>
              Changed your mind? Full refund within 7 days, no reason needed. See the{' '}
              <Link to="/refunds" className="font-medium text-brand-700 underline underline-offset-2">
                Refund &amp; Cancellation Policy
              </Link>{' '}
              and{' '}
              <Link to="/terms" className="font-medium text-brand-700 underline underline-offset-2">
                Terms &amp; Conditions
              </Link>
              .
            </p>
            <p>
              Not ready to sign up? Get your{' '}
              <Link to={TOOL_PATH} className="font-medium text-brand-700 underline underline-offset-2">
                Google review link and QR code free
              </Link>
              , or see{' '}
              <Link to="/for" className="font-medium text-brand-700 underline underline-offset-2">
                how Reviyo works for your kind of business
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
