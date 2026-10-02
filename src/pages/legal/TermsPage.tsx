import { Link } from 'react-router-dom';
import { branding } from '@/config/branding';
import { legal, displayValue } from '@/config/legal';
import { PLAN_SUMMARY } from '@/config/plans';
import { LegalPage, Clause, SubHeading, List } from '@/components/legal/LegalPage';

const N = branding.name;

export function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      summary={`The agreement between you and ${displayValue(legal.legalName)} when you use ${N}. Clause 6 is the one that matters most — it is what you must and must not do with reviews.`}
    >
      <Clause id="agreement" heading="1. This agreement">
        <p>
          These terms are a binding agreement between you and {displayValue(legal.legalName)}, a{' '}
          {displayValue(legal.entityType)} registered at {displayValue(legal.address)},{' '}
          {legal.country} (&ldquo;we&rdquo;, &ldquo;us&rdquo;, {N}).
        </p>
        <p>
          By creating an account or using {N}, you accept these terms and our{' '}
          <Link className="text-brand-700 underline underline-offset-2" to="/privacy">
            Privacy Policy
          </Link>
          ,{' '}
          <Link className="text-brand-700 underline underline-offset-2" to="/refunds">
            Refund &amp; Cancellation Policy
          </Link>
          , and{' '}
          <Link className="text-brand-700 underline underline-offset-2" to="/cookies">
            Cookie Policy
          </Link>
          . If you do not accept them, do not use {N}.
        </p>
        <p>
          You must be at least 18 years old and legally able to enter into a contract. If you are
          accepting on behalf of a company or firm, you confirm you are authorised to bind it.
        </p>
      </Clause>

      <Clause id="what-it-is" heading="2. What Reviyo does — and what it does not do">
        <p>
          {N} gives your customers a page they reach by scanning your QR code. On it they tap the
          topics they liked, optionally add a comment, and an AI drafts review text from{' '}
          <em>their own input</em>. They can edit it, and they copy and paste it onto Google
          themselves.
        </p>
        <SubHeading>{N} does not:</SubHeading>
        <List
          items={[
            'Post, submit, or publish any review to Google or any other platform. Only the customer does that.',
            'Invent experiences, staff names, services, prices, ratings, or any other fact. The AI is instructed to use only what the customer provides.',
            'Filter, suppress, gate, or hide negative feedback. Every customer, however their visit went, gets the same flow and the same ability to post a public review.',
            'Guarantee you will receive any particular number of reviews, any particular rating, any search ranking, or any business outcome.',
            'Operate on behalf of, in partnership with, or with the endorsement of Google. Reviyo is independent.',
          ]}
        />
      </Clause>

      <Clause id="account" heading="3. Your account">
        <p>
          You are responsible for keeping your password secret and for everything done through your
          account. Tell us immediately at{' '}
          <a
            className="text-brand-700 underline underline-offset-2"
            href={`mailto:${legal.supportEmail}`}
          >
            {displayValue(legal.supportEmail)}
          </a>{' '}
          if you think it has been compromised.
        </p>
        <p>
          One subscription covers one business, one location, and one Google Business Profile. If you
          run more than one location, you need a subscription for each.
        </p>
        <p>
          The information you enter about your business must be accurate, and the Google review link
          you provide must be for a business you actually own or are authorised to represent.
        </p>
      </Clause>

      <Clause id="plans" heading="4. Trial, plans, and payment">
        <List
          items={[
            'New businesses get one 14-day free trial with full access. To start it you set up AutoPay (a UPI AutoPay mandate or a card mandate) with a ₹1 verification payment, which we refund immediately.',
            `Paid plans are ${PLAN_SUMMARY}, inclusive of applicable taxes unless stated otherwise at checkout. The monthly plan is billed once per calendar month with AutoPay, not once every 30 days.`,
            'With AutoPay, the plan you chose is charged automatically when your trial ends, and again at the end of every term, until you cancel. The mandate never allows more than the plan price per charge. You are notified by your bank or UPI app at least 24 hours before each charge.',
            'You can cancel AutoPay at any time from Billing, or from your UPI app. Cancelling stops all future charges; you keep access until the end of the trial or term you are in. Cancel before the trial ends and you pay nothing.',
            'You can instead pay once for a fixed term from Billing. One-time payments do not renew.',
            'Payments are processed by Razorpay. We never see or store your card, UPI, or bank details.',
            'We may change prices at any time. A price change never affects a term you have already paid for.',
          ]}
        />
        <p>
          Refunds and cancellations are governed by our{' '}
          <Link className="text-brand-700 underline underline-offset-2" to="/refunds">
            Refund &amp; Cancellation Policy
          </Link>
          , which forms part of these terms.
        </p>
      </Clause>

      <Clause id="acceptable-use" heading="5. Acceptable use">
        <p>You must not use {N} to:</p>
        <List
          items={[
            'Break any law, or infringe anyone’s intellectual property, privacy, or other rights.',
            'Collect reviews for a business you do not own or are not authorised to represent.',
            'Attempt to access another user’s account, business data, or customer feedback.',
            'Probe, scan, overload, scrape, reverse-engineer, or otherwise interfere with the service or its infrastructure.',
            'Upload a logo or any other content you do not have the right to use.',
            'Submit malicious code, or content that is unlawful, defamatory, obscene, hateful, or harassing.',
            'Resell, sublicense, or white-label Reviyo without our written agreement.',
          ]}
        />
      </Clause>

      <Clause id="review-rules" heading="6. Rules about reviews — read this one">
        <p>
          {N} is built so that the reviews it helps produce are genuine. Using it in a way that makes
          them not genuine breaks these terms, breaks Google&rsquo;s policies, and may break Indian
          consumer law. You agree that you will not:
        </p>
        <List
          items={[
            <>
              <strong>Offer any incentive for a review.</strong> No discounts, free items, cashback,
              loyalty points, entries into a draw, or anything else of value in exchange for writing a
              review, or for writing a positive one. Google&rsquo;s prohibited-content policy forbids
              this outright.
            </>,
            <>
              <strong>Gate or filter reviews.</strong> Do not show the QR code only to happy
              customers, do not screen by rating before deciding who gets asked, and do not
              discourage anyone from posting. {N} deliberately gives every customer the same path;
              do not defeat that outside the product.
            </>,
            <>
              <strong>Write reviews yourself, or have staff, family, friends, or an agency write
              them.</strong> Reviews must come from people who actually had the experience.
            </>,
            <>
              <strong>Post a review for a competitor, or a fake negative review about anyone.</strong>
            </>,
            <>
              <strong>Edit the drafted text into something the customer did not experience or did not
              agree to.</strong> The customer must be the one who reads, approves, and posts it.
            </>,
            <>
              <strong>Pressure, mislead, or rush a customer</strong> into posting, or post on a
              customer&rsquo;s device or account without them knowing exactly what they are posting.
            </>,
          ]}
        />
        <p>
          You are solely responsible for how you deploy the QR code and how you ask customers for
          feedback. Reviews you collect live on Google and are subject to Google&rsquo;s own terms and
          content policies, which Google enforces — Google can remove reviews or suspend a Business
          Profile, and we have no control over and no liability for that.
        </p>
        <p>
          The Consumer Protection Act, 2019 and the Central Consumer Protection Authority&rsquo;s
          guidelines on misleading advertisements and dark patterns apply to how you solicit and use
          reviews. IS 19000:2022, the Bureau of Indian Standards framework for online consumer
          reviews, is the relevant good-practice standard. Penalties for fake or paid reviews fall on
          the business that procured them.
        </p>
        <p>
          If we reasonably believe you are breaking this clause, we may suspend or terminate your
          account immediately and without refund.
        </p>
      </Clause>

      <Clause id="your-data" heading="7. Your data and your customers’ data">
        <p>
          You own your business data. You grant us a limited licence to host, process, and display it
          solely to run the service for you.
        </p>
        <p>
          When your customers use your review page, <strong>you</strong> decide to deploy {N} and{' '}
          <strong>you</strong> receive their feedback — which makes you a Data Fiduciary under the
          DPDPA for that feedback. We process it on your instructions. You agree to:
        </p>
        <List
          items={[
            'Handle the topics, comments, and private feedback you receive lawfully, and use them only to understand and improve your business.',
            'Not re-identify, resell, or publish customer feedback in a way that exposes an individual.',
            'Respond to any data-rights request or grievance a customer brings directly to you, and to cooperate with us if one comes to us instead.',
            'Display your QR code with enough context that customers understand they are being asked for feedback.',
          ]}
        />
        <p>
          How we handle all of this is set out in the{' '}
          <Link className="text-brand-700 underline underline-offset-2" to="/privacy">
            Privacy Policy
          </Link>
          .
        </p>
      </Clause>

      <Clause id="ai-terms" heading="8. AI-generated content">
        <p>
          Review drafts are produced by a third-party AI model from the customer&rsquo;s input. AI
          output can be wrong, awkward, or unsuitable. It is offered as a draft, not as finished or
          verified text.
        </p>
        <p>
          The customer is responsible for reading the draft and deciding whether it honestly reflects
          their experience before posting it. We make no warranty about the accuracy, quality, or
          suitability of any generated text, and we are not responsible for what anyone chooses to
          post.
        </p>
        <p>
          AI generation is rate-limited to keep costs and abuse under control. Limits are currently 10
          generations per customer session and 50 per business per hour; we may adjust them.
        </p>
      </Clause>

      <Clause id="ip" heading="9. Intellectual property">
        <p>
          {N}, its name, logo, design, and software are owned by {displayValue(legal.legalName)}. You
          get a limited, non-exclusive, non-transferable, revocable licence to use the service for
          your own business while your subscription is current. Nothing else is granted.
        </p>
        <p>
          You keep ownership of your logo and business content, and you confirm you have the right to
          use anything you upload.
        </p>
        <p>
          Google, Google Maps, and the Google Business Profile marks belong to Google LLC. We use them
          only descriptively, to say what the product interoperates with.
        </p>
      </Clause>

      <Clause id="availability" heading="10. Availability">
        <p>
          We aim to keep {N} available, but we do not promise a specific uptime percentage and we
          offer no service-level agreement. The service depends on third parties — Supabase, our AI
          provider, Razorpay, and Google — and any of them can have an outage.
        </p>
        <p>
          We may change, suspend, or discontinue features. If we discontinue {N} entirely, we will
          give you at least 30 days&rsquo; notice, let you export your data, and refund the unused
          portion of any prepaid term.
        </p>
      </Clause>

      <Clause id="warranty" heading="11. Disclaimer">
        <p>
          To the fullest extent the law allows, {N} is provided &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo;, without warranties of any kind, express or implied, including
          merchantability, fitness for a particular purpose, and non-infringement.
        </p>
        <p>
          Nothing in these terms excludes or limits any right you have under the Consumer Protection
          Act, 2019 or any other law that cannot be excluded by agreement.
        </p>
      </Clause>

      <Clause id="liability" heading="12. Limitation of liability">
        <p>
          To the fullest extent the law allows, we are not liable for indirect, incidental, special,
          consequential, or punitive damages, or for loss of profit, revenue, goodwill, data, or
          business opportunity — including anything arising from reviews being removed, a Google
          Business Profile being suspended, or AI output being unsuitable.
        </p>
        <p>
          Our total liability for any claim relating to {N} is capped at the amount you actually paid
          us in the 12 months before the claim arose.
        </p>
        <p>This clause does not limit liability for fraud, or for anything that cannot be limited by law.</p>
      </Clause>

      <Clause id="indemnity" heading="13. Indemnity">
        <p>
          You will indemnify us against claims, losses, and reasonable legal costs arising from your
          breach of these terms, your breach of clause 6, your misuse of the service, or your handling
          of your customers&rsquo; data.
        </p>
      </Clause>

      <Clause id="termination" heading="14. Suspension and termination">
        <p>
          You can stop using {N} at any time and delete your account from Settings → Account → Your
          data. Deletion is permanent.
        </p>
        <p>
          We may suspend or terminate your account if you break these terms, if we are required to by
          law, or if your payment fails or is reversed. Where the breach is minor and fixable, we will
          give you notice and a chance to fix it first. Where it involves clause 6, fraud, or a
          security risk, we may act immediately.
        </p>
        <p>
          On termination, your licence ends and your data is deleted per the retention schedule in the
          Privacy Policy. Clauses 9, 11, 12, 13, and 15 survive.
        </p>
      </Clause>

      <Clause id="law" heading="15. Governing law and disputes">
        <p>
          These terms are governed by the laws of {legal.governingLaw}. The courts at{' '}
          {displayValue(legal.jurisdictionCity)} have exclusive jurisdiction, except that nothing stops
          you from bringing a complaint before a consumer forum with jurisdiction where you live.
        </p>
        <p>
          Before going to court, please contact us at{' '}
          <a
            className="text-brand-700 underline underline-offset-2"
            href={`mailto:${legal.supportEmail}`}
          >
            {displayValue(legal.supportEmail)}
          </a>
          . Most disputes are quicker to fix by email.
        </p>
      </Clause>

      <Clause id="general" heading="16. General">
        <List
          items={[
            'If a clause is found unenforceable, the rest stays in force.',
            'Our not enforcing a term on one occasion does not waive it.',
            'You may not transfer this agreement. We may transfer it as part of a sale or merger, on notice to you.',
            'These terms, together with the policies linked in clause 1, are the entire agreement between us.',
            'We may update these terms. We will email account holders before a material change takes effect, and the version number at the top will change. Continuing to use Reviyo after that means you accept the update.',
          ]}
        />
      </Clause>
    </LegalPage>
  );
}
