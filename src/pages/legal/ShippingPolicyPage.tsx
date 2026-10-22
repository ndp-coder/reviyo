import { Link } from 'react-router-dom';
import { branding } from '@/config/branding';
import { legal, displayValue } from '@/config/legal';
import { LegalPage, Clause, List } from '@/components/legal/LegalPage';

const N = branding.name;

export function ShippingPolicyPage() {
  return (
    <LegalPage
      title="Shipping & Delivery Policy"
      summary={`${N} is an online service. The only thing we ship is the free printed QR kit that comes with your plan. This page explains what it is, when it ships, and what happens if something goes wrong.`}
    >
      <Clause id="what" heading="1. What we ship">
        <p>
          Every business gets <strong>one free printed QR kit</strong>: a QR table stand and a folded table tent
          card. Both show your business name, &ldquo;Scan to review us on Google&rdquo;, your review QR code, and a
          small &ldquo;by {N}&rdquo; line. The QR code is the same one in your dashboard, so it opens your review
          page.
        </p>
        <p>
          Everything else {N} provides, including the review page, AI drafting, and the dashboard, is delivered
          online the moment your account is active. Nothing else is shipped.
        </p>
      </Clause>

      <Clause id="when" heading="2. When it ships">
        <List
          items={[
            'The kit is earned by your first plan payment. The ₹1 AutoPay verification at the start of the free trial is refunded and is not a plan payment, so nothing ships during the trial.',
            'It is one kit per business. Renewals and later payments do not send another.',
            'As soon as we have both your payment and your delivery address, the order goes to our print partner automatically. You can add or correct the address on the QR code page of your dashboard until then.',
            `Printing and delivery usually take ${legal.printedKitDeliveryTime} from then, depending on where you are. We email you the courier and tracking number when it ships, and show them in your dashboard.`,
          ]}
        />
      </Clause>

      <Clause id="where" heading="3. Where we deliver, and the cost">
        <p>
          We deliver anywhere in India that our courier partners serve. <strong>Printing and delivery are free</strong>;
          there are no shipping charges and nothing is collected on delivery. We do not ship outside India.
        </p>
      </Clause>

      <Clause id="address" heading="4. Your delivery address">
        <p>
          You give us the receiver&rsquo;s name, a mobile number for the courier, and the address. We share these only
          with our print partner and courier, only to deliver your kit. See the{' '}
          <Link className="text-brand-700 underline underline-offset-2" to="/privacy">
            Privacy Policy
          </Link>{' '}
          for how long we keep them. Once the order has gone to the printer, write to us straight away if anything is
          wrong and we will fix it if it has not shipped yet.
        </p>
      </Clause>

      <Clause id="problems" heading="5. Damaged, lost, or returned parcels">
        <List
          items={[
            'Arrived damaged? Email us a photo within 7 days of delivery and we will send a replacement.',
            'Not arrived within the usual time, or tracking has stopped moving? Tell us and we will chase the courier, and send a replacement if the parcel is lost.',
            'Returned to us because the courier could not deliver? We will contact you to confirm the address and send it again.',
          ]}
        />
        <p>
          The kit is free and yours to keep, including if you later get a refund for your plan or cancel. It is not
          sold separately, so it cannot be returned for money.
        </p>
      </Clause>

      <Clause id="contact" heading="6. Contact">
        <p>
          Delivery questions:{' '}
          <a className="text-brand-700 underline underline-offset-2" href={`mailto:${legal.supportEmail}`}>
            {displayValue(legal.supportEmail)}
          </a>{' '}
          · {displayValue(legal.supportPhone)} · {legal.supportHours}
        </p>
      </Clause>
    </LegalPage>
  );
}
