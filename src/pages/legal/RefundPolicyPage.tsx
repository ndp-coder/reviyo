import { Link } from 'react-router-dom';
import { branding } from '@/config/branding';
import { legal, displayValue } from '@/config/legal';
import { LegalPage, Clause, SubHeading, List } from '@/components/legal/LegalPage';

const N = branding.name;

export function RefundPolicyPage() {
  return (
    <LegalPage
      title="Refund & Cancellation Policy"
      summary={`When you can get your money back from ${N}, how to ask, and how long it takes. Written plainly, because a refund policy nobody can understand is worse than none.`}
    >
      <Clause id="trial" heading="1. Try it before you pay">
        <p>
          Every new business gets a <strong>14-day free trial with full access</strong>. To start
          it you set up AutoPay with a <strong>₹1 verification payment, which we refund
          immediately</strong> (it usually reaches your account in 5–7 working days). The trial is
          the intended way to decide whether {N} works for your business.{' '}
          <strong>Cancel AutoPay before the trial ends and you are never charged.</strong> If you
          don&rsquo;t cancel, the plan you chose is charged when the trial ends; you will be
          notified at least 24 hours before.
        </p>
      </Clause>

      <Clause id="cooling-off" heading="2. 7-day refund window">
        <p>
          If you buy a plan and change your mind, email us within <strong>7 calendar days</strong> of
          payment and we will refund you in full, no questions asked and no reason required.
        </p>
        <p>
          This applies even if you have used the service during those 7 days. It applies once per
          account, to your first purchase of each plan length.
        </p>
      </Clause>

      <Clause id="after" heading="3. After the 7-day window">
        <p>
          Plans are prepaid for a fixed term of 6 or 12 months. After day 7, we do not give refunds
          for a change of mind or for not using the service — but we do refund in these cases:
        </p>
        <List
          items={[
            <>
              <strong>The service is materially broken and we cannot fix it.</strong> If a core
              feature — the review page, QR code, AI drafting, or the dashboard — is unusable for more
              than 72 consecutive hours because of a fault on our side, and you tell us, we will
              refund the unused part of your term on a pro-rata basis.
            </>,
            <>
              <strong>We discontinue Reviyo.</strong> If we shut the service down, we refund the
              unused portion of every prepaid term in full.
            </>,
            <>
              <strong>Duplicate or incorrect charge.</strong> If you were charged twice, or charged
              the wrong amount, we refund the difference in full. Always.
            </>,
            <>
              <strong>Payment taken but subscription not activated.</strong> Refunded in full, or
              activated — your choice.
            </>,
            <>
              <strong>We terminate your account without cause.</strong> Refunded pro-rata.
            </>,
          ]}
        />
      </Clause>

      <Clause id="no-refund" heading="4. When we do not refund">
        <p>We will not refund where:</p>
        <List
          items={[
            'You simply did not use the service during a term you paid for.',
            'You did not get the number of reviews, the ratings, or the business results you hoped for. We never promise a business outcome, and review volume depends on your customers.',
            'Google removes reviews, suspends your Business Profile, or changes its policies. That is Google’s decision and outside our control.',
            'You gave us an incorrect Google review link, or set your business profile up wrongly, and did not ask us for help.',
            'We terminated your account for breaking our Terms — in particular clause 6, the rules about incentivised, gated, or fake reviews.',
            'A third-party outage outside our control (your internet, Google, or a payment network) interrupted your use.',
          ]}
        />
        <p>
          Nothing here takes away any right you have under the Consumer Protection Act, 2019, which
          applies regardless of what this policy says.
        </p>
      </Clause>

      <Clause id="how" heading="5. How to request a refund">
        <SubHeading>What to send</SubHeading>
        <p>
          Email{' '}
          <a
            className="text-blue-700 underline underline-offset-2"
            href={`mailto:${legal.supportEmail}?subject=Refund%20request`}
          >
            {displayValue(legal.supportEmail)}
          </a>{' '}
          with the subject line <strong>Refund request</strong>, from the email address on your {N}{' '}
          account, including:
        </p>
        <List
          items={[
            'Your business name as it appears in Reviyo.',
            'The Razorpay payment reference, which you can find in Dashboard → Billing → Payment History.',
            'The reason, if you are asking under clause 3. (You do not need a reason inside the 7-day window.)',
          ]}
        />
        <SubHeading>What happens next</SubHeading>
        <List
          items={[
            <>
              We acknowledge your request within{' '}
              <strong>{legal.supportResponseTarget}</strong>.
            </>,
            <>
              We approve or decline within <strong>5 working days</strong>, and if we decline we tell
              you exactly which clause we are relying on.
            </>,
            <>
              Approved refunds are initiated with Razorpay within{' '}
              <strong>5 working days</strong> of approval.
            </>,
            <>
              The money reaches you in <strong>5 to 10 working days</strong> after that, depending on
              your bank or card issuer. That last stretch is controlled by the banks, not by us.
            </>,
          ]}
        />
        <p>
          Refunds always go back to the original payment method. We cannot redirect a refund to a
          different card, account, or UPI ID — that is a Razorpay and banking restriction, not our
          preference.
        </p>
      </Clause>

      <Clause id="cancellation" heading="6. Cancelling">
        <p>
          <strong>Cancel AutoPay any time from Billing</strong> (or from your UPI app). That stops
          every future charge straight away, and you keep access until the end of the trial or term
          you are in. Before each charge your bank or UPI app notifies you at least 24 hours in
          advance, so you always have time to cancel. One-time payments never renew, so there is
          nothing to cancel for them.
        </p>
        <p>
          You can stop using {N} whenever you like. If you also want your data gone, delete your
          account from Settings → Account → Your data. That is immediate and permanent.
        </p>
        <p>
          Deleting your account does not by itself trigger a refund — if you also want your money
          back, make a refund request under clause 5 <em>before</em> you delete, so we can still find
          your records.
        </p>
      </Clause>

      <Clause id="chargebacks" heading="7. Chargebacks">
        <p>
          If something has gone wrong, please email us first. We would much rather fix it or refund
          you directly — it is faster for you than a chargeback, which typically takes 30 to 90 days.
        </p>
        <p>
          If you raise a chargeback without contacting us, we may suspend the account while the
          dispute is open, and we will respond to the bank with our transaction records.
        </p>
      </Clause>

      <Clause id="taxes" heading="8. Taxes and fees">
        <p>
          Refunds include any GST that was charged. We do not deduct payment-gateway fees from your
          refund — we absorb them.
        </p>
      </Clause>

      <Clause id="contact" heading="9. Contact">
        <p>
          Refund questions:{' '}
          <a
            className="text-blue-700 underline underline-offset-2"
            href={`mailto:${legal.supportEmail}`}
          >
            {displayValue(legal.supportEmail)}
          </a>{' '}
          · {displayValue(legal.supportPhone)} · {legal.supportHours}
        </p>
        <p>
          Unhappy with how we handled a refund? Escalate it to our grievance officer — the details are
          in clause 9 of the{' '}
          <Link className="text-blue-700 underline underline-offset-2" to="/privacy">
            Privacy Policy
          </Link>{' '}
          and on our{' '}
          <Link className="text-blue-700 underline underline-offset-2" to="/contact">
            Contact page
          </Link>
          . You may also approach a consumer forum with jurisdiction where you live.
        </p>
      </Clause>
    </LegalPage>
  );
}
