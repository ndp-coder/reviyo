import { Link } from 'react-router-dom';
import { branding } from '@/config/branding';
import { legal, displayValue } from '@/config/legal';
import { LegalPage, Clause, SubHeading, List, DataTable } from '@/components/legal/LegalPage';

const N = branding.name;

export function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      summary={`How ${N} collects, uses, shares, and deletes personal data — written to match what the product actually does, under the Digital Personal Data Protection Act, 2023 (DPDPA).`}
    >
      <Clause id="who-we-are" heading="1. Who we are">
        <p>
          {N} is operated by {displayValue(legal.legalName)}, a {displayValue(legal.entityType)}{' '}
          registered at {displayValue(legal.address)}, {legal.country}.
        </p>
        <p>
          Under the DPDPA we are the <strong>Data Fiduciary</strong> for the personal data described
          in this policy, and you are a <strong>Data Principal</strong>. If you are in the EEA or UK,
          the equivalent terms are &ldquo;controller&rdquo; and &ldquo;data subject&rdquo;.
        </p>
        <p>
          Questions about this policy or about your data go to{' '}
          <a
            className="text-brand-700 underline underline-offset-2"
            href={`mailto:${legal.privacyEmail}`}
          >
            {displayValue(legal.privacyEmail)}
          </a>
          .
        </p>
      </Clause>

      <Clause id="two-groups" heading="2. Two different groups of people">
        <p>{N} handles personal data about two separate groups, and the rules differ for each.</p>
        <List
          items={[
            <>
              <strong>Business owners</strong> — the people who sign up for a {N} account, set up a
              business profile, and pay for a subscription. We are the Data Fiduciary for this data.
            </>,
            <>
              <strong>Customers of those businesses</strong> — people who scan a business&rsquo;s QR
              code and use the review page. We process this data on behalf of the business, which
              decides to deploy {N} and sees the resulting feedback. For this data we act largely as
              a <strong>Data Processor</strong> for that business, and this policy tells you what we
              do with it either way.
            </>,
          ]}
        />
      </Clause>

      <Clause id="what-we-collect" heading="3. What we collect, and why">
        <SubHeading>3.1 If you are a business owner with a {N} account</SubHeading>
        <DataTable
          caption="Personal data collected from business owners"
          columns={['What', 'Why', 'Legal basis (DPDPA)']}
          rows={[
            [
              'Email address, and your name if you gave one',
              'To create and secure your account, sign you in, send password resets, and contact you about your subscription.',
              'Consent given at signup; and necessary to provide the service you asked for.',
            ],
            [
              'Password',
              'Authentication. Stored only as a salted hash by our authentication provider. We never see or store your plaintext password.',
              'Necessary to provide the service.',
            ],
            [
              'Business profile — business name, category, Google review link, logo, welcome message, review topics',
              'To build your public review page and QR code.',
              'Necessary to provide the service.',
            ],
            [
              'Payment records — plan, amount, Razorpay order and payment identifiers, payment status',
              'To activate your subscription, show your payment history, and meet tax and accounting obligations.',
              'Necessary to provide the service; and legal obligation for retention.',
            ],
          ]}
        />
        <p>
          <strong>We do not collect your card, UPI, or bank details.</strong> Those are entered
          directly into Razorpay&rsquo;s checkout and never reach our servers or our database. We
          only ever receive an order identifier, a payment identifier, an amount, and a status.
        </p>

        <SubHeading>3.2 If you are a customer using a business&rsquo;s review page</SubHeading>
        <p>
          The review page is <strong>anonymous by design</strong>. We do not ask for your name,
          email, phone number, or address, and we do not require you to create an account or install
          anything. We collect only the following:
        </p>
        <DataTable
          caption="Data collected from customers using a review page"
          columns={['What', 'Why', 'Legal basis (DPDPA)']}
          rows={[
            [
              'A random session identifier generated when you open the page',
              'To tie the steps of a single visit together and to rate-limit abuse of the AI. It is a random value, not an identifier of you, and it is not shared across businesses or visits.',
              'Necessary to provide the service you requested.',
            ],
            [
              'The topics you tap',
              'To draft the review you asked for, and to show the business aggregate feedback.',
              'Your consent, given on the review page.',
            ],
            [
              'Any free-text comment you choose to write (optional)',
              'To draft the review you asked for. It is sent to our AI provider for that purpose and is visible to the business.',
              'Your consent, given on the review page.',
            ],
            [
              'The review text the AI drafts for you',
              'So you can read, edit, and copy it. The business can also see it.',
              'Your consent, given on the review page.',
            ],
            [
              'Any private feedback message you choose to send (optional)',
              'To pass it to the business. It is not published.',
              'Your consent, given when you send it.',
            ],
            [
              'Counts of steps reached — page opened, review started, review generated, Google opened — and which of the business’s QR codes or shared links you used to get there',
              'To show the business how many people used its page and which of its QR codes or links works best. These are counts tied to a session identifier, not to you; the QR code tag names a place, such as a table or desk, never a person using the page.',
              'Necessary to provide the service to the business.',
            ],
          ]}
        />
        <p>
          <strong>
            We do not store your IP address, device fingerprint, advertising identifier, or precise
            location, and we do not build a profile of you.
          </strong>{' '}
          Like any website, our hosting providers receive your IP address in order to deliver the
          page, and may keep it for a short time in their security logs; we never copy it into our
          database or use it to identify you.
          We do not use tracking pixels, advertising tags, or third-party analytics on the review
          page.
        </p>
        <p>
          <strong>Please do not type personal details into the comment box.</strong> The review you
          are drafting is meant to be posted publicly on Google. Do not include your own or anyone
          else&rsquo;s full name, phone number, address, medical details, financial details, or any
          other sensitive information. If you do, we will still process it, but you are choosing to
          share it — and once you paste the review onto Google, it is public.
        </p>
        <p>
          The review page is not intended for children. If you are under 18, please do not use it.
          See clause 10.
        </p>
      </Clause>

      <Clause id="ai" heading="4. How the AI works, and what it is sent">
        <p>
          When you ask {N} to draft a review, we send the following to our AI provider,{' '}
          {displayValue(legal.aiProviderName)}: the business&rsquo;s name and category, the topics you
          selected, your optional comment, and the length you asked for. That
          is all. We do not send your session identifier, and we have nothing else about you to send.
        </p>
        <p>
          When a business owner asks {N} to suggest review topics, we send the same AI provider the
          business&rsquo;s name, its category, and the topics the owner already has. No customer data
          is included.
        </p>
        <p>
          The AI is instructed to use only what you gave it and never to invent experiences, staff
          names, services, prices, or facts. It drafts text; you read it, edit it if you want, and
          decide whether to post it. {N} never posts a review to Google on your behalf, and never
          submits anything automatically.
        </p>
        <p>
          Our AI provider&rsquo;s own privacy terms apply at the moment of processing. You can read
          them at{' '}
          <a
            className="text-brand-700 underline underline-offset-2"
            href={displayValue(legal.aiProviderPolicyUrl)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {displayValue(legal.aiProviderPolicyUrl)}
          </a>
          . We use the provider&rsquo;s paid API, which under that provider&rsquo;s business terms is
          not used to train their general models by default. We have not opted in to such training.
        </p>
      </Clause>

      <Clause id="sharing" heading="5. Who we share data with">
        <p>
          We do not sell personal data. We have never sold personal data, and we do not share it for
          advertising or cross-context behavioural advertising. We share it only with the following
          processors, each for a single, stated purpose:
        </p>
        <DataTable
          caption="Third parties that process personal data for Reviyo"
          columns={['Who', 'What they process', 'Why']}
          rows={[
            [
              'Supabase',
              'All account data, business profiles, review sessions, private feedback, and analytics counts.',
              'Database, authentication, and server hosting.',
            ],
            [
              displayValue(legal.aiProviderName),
              'Business name and category, topics, and your optional comment — at the moment you ask for a draft. For owners who ask for topic suggestions: the business name, category, and existing topics.',
              'Generating the review draft you requested, and suggesting review topics to business owners.',
            ],
            [
              'Razorpay Software Private Limited',
              'Your name (or your business name if you did not give one), email, plan, and amount. Card, UPI, and bank details go directly to Razorpay and never reach us.',
              'Processing subscription payments. Razorpay is an RBI-authorised payment aggregator.',
            ],
            [
              'The business whose QR code you scanned',
              'Your selected topics, comment, drafted review, and any private feedback.',
              'That is the point of the product — the business asked for feedback and you chose to give it.',
            ],
          ]}
        />
        <p>
          We may also disclose data where we are legally required to — a valid court order, a lawful
          request from a government agency, or to establish or defend a legal claim. If we are
          permitted to tell you, we will.
        </p>
        <p>
          If {N} is ever sold or merged, personal data may transfer to the acquirer. We will tell you
          before that happens, and you will be able to delete your data first.
        </p>
      </Clause>

      <Clause id="transfers" heading="6. Where your data is stored">
        <p>
          Our database and servers are hosted by Supabase in the {displayValue(legal.dataRegion)}{' '}
          region. Our AI provider and Razorpay may process data outside India.
        </p>
        <p>
          Section 16 of the DPDPA permits transfer of personal data outside India except to countries
          the Central Government specifically restricts. We do not transfer data to any country
          currently on that restricted list, and we will stop any transfer that becomes restricted.
          For anyone in the EEA or UK, transfers out are made under the relevant provider&rsquo;s
          standard contractual clauses.
        </p>
      </Clause>

      <Clause id="retention" heading="7. How long we keep data">
        <p>We delete data on a schedule rather than keeping it indefinitely:</p>
        <DataTable
          caption="Data retention periods"
          columns={['Data', 'Kept for', 'Then']}
          rows={[
            [
              'Customer review sessions — topics, comment, drafted review (and, for visits before this version, a star rating)',
              `${legal.sessionRetentionDays} days from the visit`,
              'Permanently deleted. The business keeps only aggregate counts.',
            ],
            [
              'Private feedback messages',
              `${legal.feedbackRetentionDays} days, or until the business deletes them`,
              'Permanently deleted.',
            ],
            ['Analytics counts', `${legal.analyticsRetentionDays} days`, 'Permanently deleted.'],
            [
              'Business owner account and business profile',
              'For as long as your account is open',
              'Deleted when you delete your account.',
            ],
            [
              'Payment and invoice records',
              '8 years',
              'Retained because Indian tax and company law requires it, then deleted. This survives account deletion.',
            ],
          ]}
        />
      </Clause>

      <Clause id="your-rights" heading="8. Your rights">
        <p>Under the DPDPA, as a Data Principal you have the right to:</p>
        <List
          items={[
            <>
              <strong>Access</strong> a summary of the personal data we hold about you and who we
              have shared it with (s.11).
            </>,
            <>
              <strong>Correct, complete, update, or erase</strong> your personal data (s.12).
            </>,
            <>
              <strong>Withdraw your consent</strong> at any time, as easily as you gave it (s.6(4)).
              Withdrawing does not undo processing that already happened lawfully.
            </>,
            <>
              <strong>Nominate</strong> another person to exercise these rights on your behalf if you
              die or become incapacitated (s.14).
            </>,
            <>
              <strong>Raise a grievance</strong> with us, and escalate to the Data Protection Board of
              India if you are not satisfied with our answer (s.13).
            </>,
          ]}
        />
        <SubHeading>How to exercise them</SubHeading>
        <List
          items={[
            <>
              <strong>Business owners:</strong> you can correct your own data at any time in{' '}
              <Link className="text-brand-700 underline underline-offset-2" to="/dashboard/settings">
                Settings
              </Link>
              . To download everything we hold, or to delete your account and all of its data, use
              Settings → Account → Your data. Deletion is permanent.
            </>,
            <>
              <strong>Customers:</strong> because the review page is anonymous, we usually cannot find
              your session again — there is nothing tying it to you. If you want a specific submission
              deleted sooner than the {legal.sessionRetentionDays}-day schedule, email{' '}
              <a
                className="text-brand-700 underline underline-offset-2"
                href={`mailto:${legal.privacyEmail}`}
              >
                {displayValue(legal.privacyEmail)}
              </a>{' '}
              with the business name and the approximate date and time, and we will do our best to
              locate and delete it.
            </>,
          ]}
        />
        <p>
          We answer rights requests within 30 days and we do not charge for this. We may ask you to
          verify your identity before we act on a request about an account.
        </p>
      </Clause>

      <Clause id="grievance" heading="9. Grievance redressal">
        <p>Our grievance officer under section 13 of the DPDPA is:</p>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <address className="not-italic space-y-1">
            <p className="font-semibold text-gray-900">{displayValue(legal.grievanceOfficerName)}</p>
            <p>{displayValue(legal.legalName)}</p>
            <p className="whitespace-pre-line">{displayValue(legal.address)}</p>
            <p>
              <a
                className="text-brand-700 underline underline-offset-2"
                href={`mailto:${legal.grievanceEmail}`}
              >
                {displayValue(legal.grievanceEmail)}
              </a>
            </p>
          </address>
        </div>
        <p>
          We will acknowledge your grievance and respond within {legal.grievanceResponseTarget}. If
          you are not satisfied with our response, you may complain to the Data Protection Board of
          India.
        </p>
      </Clause>

      <Clause id="children" heading="10. Children">
        <p>
          {N} is a business tool. You must be 18 or older to hold a {N} account, and the review page
          is not directed at children.
        </p>
        <p>
          Section 9 of the DPDPA requires verifiable parental consent before processing a
          child&rsquo;s personal data, and prohibits tracking, behavioural advertising, and any
          processing likely to cause a detrimental effect on a child. We do not knowingly collect data
          from anyone under 18, we do not track or profile anyone on the review page, and we serve no
          advertising. If you believe a child has submitted data through {N}, email{' '}
          <a
            className="text-brand-700 underline underline-offset-2"
            href={`mailto:${legal.privacyEmail}`}
          >
            {displayValue(legal.privacyEmail)}
          </a>{' '}
          and we will delete it.
        </p>
      </Clause>

      <Clause id="security" heading="11. How we protect data">
        <p>We take the following specific measures:</p>
        <List
          items={[
            'All traffic to and from the site is encrypted in transit with HTTPS/TLS.',
            'Data is encrypted at rest by our hosting provider.',
            'Row-level security is enabled on every database table, so a business owner can only read their own data and one customer can never read another customer’s session.',
            'Passwords are stored only as salted hashes, by our authentication provider.',
            'Payment card details never touch our systems; they go directly to Razorpay, which is PCI-DSS Level 1 certified.',
            'API keys for the AI provider and Razorpay are held as server-side secrets and are never sent to the browser.',
          ]}
        />
        <p>
          No system is perfectly secure, and we do not claim otherwise. If we become aware of a
          personal data breach we will notify the Data Protection Board of India and every affected
          person, as section 8(6) of the DPDPA requires.
        </p>
      </Clause>

      <Clause id="cookies" heading="12. Cookies and local storage">
        <p>
          {N} uses no advertising cookies, no analytics cookies, and no third-party tracking. The only
          browser storage we use is for signed-in business owners: their sign-in session, and text
          they typed into two dashboard tools, kept on their own device. The full detail — and why we therefore do not show you a cookie consent banner —
          is in our{' '}
          <Link className="text-brand-700 underline underline-offset-2" to="/cookies">
            Cookie Policy
          </Link>
          .
        </p>
      </Clause>

      <Clause id="changes" heading="13. Changes to this policy">
        <p>
          If we change this policy in a way that materially affects how we handle your data, we will
          update the version number at the top and email account holders before the change takes
          effect. Continuing to use {N} after that means you accept the updated policy. If you do not,
          you can delete your account.
        </p>
      </Clause>
    </LegalPage>
  );
}
