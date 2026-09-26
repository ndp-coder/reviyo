import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Clock, ShieldQuestion, Receipt } from 'lucide-react';
import { branding } from '@/config/branding';
import { legal, displayValue, isPlaceholder } from '@/config/legal';
import { LegalPage, Clause, List } from '@/components/legal/LegalPage';

const N = branding.name;

export function ContactPage() {
  const showGstin = legal.gstin && !isPlaceholder(legal.gstin);
  const showCin = legal.cin && !isPlaceholder(legal.cin);

  return (
    <LegalPage
      title="Contact Us"
      summary={`Who operates ${N}, where we are, and how to reach a real person — including the specific route for data-protection grievances.`}
    >
      <Clause id="details" heading="1. Business details">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
          <dl className="space-y-4">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                Registered name
              </dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">
                {displayValue(legal.legalName)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                Entity type
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{displayValue(legal.entityType)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                <MapPin className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
                Registered address
              </dt>
              <dd className="mt-1 whitespace-pre-line text-sm text-gray-900">
                {displayValue(legal.address)}
                {'\n'}
                {legal.country}
              </dd>
            </div>
            {showGstin && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-600">GSTIN</dt>
                <dd className="mt-1 font-mono text-sm text-gray-900">{legal.gstin}</dd>
              </div>
            )}
            {showCin && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-600">CIN</dt>
                <dd className="mt-1 font-mono text-sm text-gray-900">{legal.cin}</dd>
              </div>
            )}
          </dl>
        </div>
      </Clause>

      <Clause id="support" heading="2. Customer support">
        <div className="grid gap-4 sm:grid-cols-2">
          <a
            href={`mailto:${legal.supportEmail}`}
            className="flex items-start gap-3 rounded-xl border border-gray-200 p-4 transition-colors hover:border-blue-400 hover:bg-blue-50"
          >
            <Mail className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-700" aria-hidden="true" />
            <span>
              <span className="block text-sm font-semibold text-gray-900">Email us</span>
              <span className="mt-0.5 block text-sm text-gray-700">
                {displayValue(legal.supportEmail)}
              </span>
            </span>
          </a>
          <a
            href={`tel:${legal.supportPhone.replace(/\s+/g, '')}`}
            className="flex items-start gap-3 rounded-xl border border-gray-200 p-4 transition-colors hover:border-blue-400 hover:bg-blue-50"
          >
            <Phone className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-700" aria-hidden="true" />
            <span>
              <span className="block text-sm font-semibold text-gray-900">Call us</span>
              <span className="mt-0.5 block text-sm text-gray-700">
                {displayValue(legal.supportPhone)}
              </span>
            </span>
          </a>
        </div>
        <p className="flex items-start gap-2 pt-2">
          <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-600" aria-hidden="true" />
          <span>
            {legal.supportHours}. We aim to reply to every email within{' '}
            {legal.supportResponseTarget}.
          </span>
        </p>
      </Clause>

      <Clause id="right-route" heading="3. The right route for your question">
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-xl border border-gray-200 p-4">
            <Receipt className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-600" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-gray-900">Billing, refunds, cancellations</p>
              <p className="mt-1 text-sm text-gray-700">
                Email{' '}
                <a
                  className="text-blue-700 underline underline-offset-2"
                  href={`mailto:${legal.supportEmail}?subject=Refund%20request`}
                >
                  {displayValue(legal.supportEmail)}
                </a>{' '}
                with the subject <strong>Refund request</strong>. What to include, and how long it
                takes, is set out in the{' '}
                <Link className="text-blue-700 underline underline-offset-2" to="/refunds">
                  Refund &amp; Cancellation Policy
                </Link>
                .
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-gray-200 p-4">
            <ShieldQuestion
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-600"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Your personal data — access, correction, deletion, or withdrawing consent
              </p>
              <p className="mt-1 text-sm text-gray-700">
                Email{' '}
                <a
                  className="text-blue-700 underline underline-offset-2"
                  href={`mailto:${legal.privacyEmail}`}
                >
                  {displayValue(legal.privacyEmail)}
                </a>
                . If you have a {N} account you can also download or delete everything yourself, at
                any time, from Settings → Account → Your data. We answer data requests within 30 days
                and never charge for them.
              </p>
            </div>
          </div>
        </div>
      </Clause>

      <Clause id="grievance" heading="4. Grievance officer">
        <p>
          If you are not satisfied with how we have handled a request or a complaint — about your
          data, a payment, or anything else — escalate it to our grievance officer, appointed under
          section 13 of the Digital Personal Data Protection Act, 2023.
        </p>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
          <address className="not-italic space-y-1 text-sm">
            <p className="font-semibold text-gray-900">{displayValue(legal.grievanceOfficerName)}</p>
            <p className="text-gray-700">Grievance Officer, {displayValue(legal.legalName)}</p>
            <p className="whitespace-pre-line text-gray-700">{displayValue(legal.address)}</p>
            <p>
              <a
                className="text-blue-700 underline underline-offset-2"
                href={`mailto:${legal.grievanceEmail}`}
              >
                {displayValue(legal.grievanceEmail)}
              </a>
            </p>
          </address>
        </div>
        <p>
          We acknowledge grievances on receipt and respond within {legal.grievanceResponseTarget}.
        </p>
        <p>Still not satisfied? You can escalate beyond us:</p>
        <List
          items={[
            <>
              <strong>Data protection:</strong> the Data Protection Board of India, under the DPDPA,
              2023.
            </>,
            <>
              <strong>Consumer complaints:</strong> the National Consumer Helpline (1915 /
              consumerhelpline.gov.in), or a consumer commission with jurisdiction where you live,
              under the Consumer Protection Act, 2019.
            </>,
            <>
              <strong>Payment disputes:</strong> Razorpay&rsquo;s own grievance channel, or the RBI
              Ombudsman for Digital Transactions.
            </>,
          ]}
        />
      </Clause>

      <Clause id="not-google" heading="5. One clarification we get asked about">
        <p>
          {N} is an independent product. We are not affiliated with, endorsed by, sponsored by, or
          acting on behalf of Google. We cannot restore a deleted review, reinstate a suspended
          Business Profile, or influence how Google ranks or displays anything. For those, you need
          Google Business Profile support.
        </p>
      </Clause>
    </LegalPage>
  );
}
