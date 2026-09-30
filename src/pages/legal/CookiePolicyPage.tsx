import { Link } from 'react-router-dom';
import { branding } from '@/config/branding';
import { legal, displayValue } from '@/config/legal';
import { LegalPage, Clause, SubHeading, List, DataTable } from '@/components/legal/LegalPage';

// The exact key supabase-js uses: "sb-" + the project ref + "-auth-token".
// Worked out from the configured project at build time, so the policy always
// names the real key.
const authStorageKey = (() => {
  try {
    return `sb-${new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
  } catch {
    return 'sb-<project>-auth-token';
  }
})();

const N = branding.name;

export function CookiePolicyPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      summary={`${N} uses no advertising cookies, no analytics cookies, and no third-party trackers. This page lists every single thing we store in your browser, and explains why that means you do not get a consent banner.`}
    >
      <Clause id="summary" heading="1. The short version">
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-900">
          <p className="font-semibold">
            We store nothing in your browser except what is strictly necessary to run the page you
            asked for.
          </p>
          <p className="mt-2">
            No Google Analytics. No Meta Pixel. No advertising tags. No cross-site tracking. No
            profiling. No selling. Nothing we could show you a &ldquo;reject all&rdquo; button for,
            because there is nothing optional to reject.
          </p>
        </div>
      </Clause>

      <Clause id="review-page" heading="2. If you are a customer scanning a QR code">
        <p>
          The review page at <code className="rounded bg-gray-100 px-1.5 py-0.5">/r/…</code> sets{' '}
          <strong>no cookies at all</strong>, and stores nothing of its own on your device.
        </p>
        <p>
          The random session identifier that ties the steps of your visit together is held in the
          page&rsquo;s memory only, for as long as the tab is open. Close the tab and it is gone from
          your device. It is never written to a cookie, to local storage, or to session storage, and
          it cannot be read by any other site.
        </p>
        <p>
          The one exception, for completeness: if you happen to be signed in to a {N}{' '}
          <em>business account</em> in the same browser — for example a shop owner previewing their
          own page — then the sign-in item described in clause 3 is already present on your device. It
          is not set by the review page, it plays no part in the review flow, and your review session
          is not linked to it.
        </p>
      </Clause>

      <Clause id="account" heading="3. If you have a Reviyo account">
        <p>
          Signing in stores your session so you are not asked for your password on every page, and two
          tools on the QR code page remember what you typed into them, on your own device. Here is
          everything that involves:
        </p>
        <DataTable
          caption="Browser storage used by Reviyo"
          columns={['Name', 'Type', 'Purpose', 'Lifetime']}
          rows={[
            [
              <code key="k" className="text-xs">
                {authStorageKey}
              </code>,
              'Local storage (first-party, set by us)',
              'Holds your signed-in session and refresh token so you stay signed in. Without it, the dashboard cannot work.',
              'Until you sign out, or the session expires.',
            ],
            [
              <code key="k" className="text-xs">
                reviyo:whatsapp-message:…
              </code>,
              'Local storage (first-party, set by us)',
              'Remembers the WhatsApp review-request message you wrote, so it is ready next time on this device.',
              'Until you clear site data.',
            ],
            [
              <code key="k" className="text-xs">
                reviyo:qr-codes:…
              </code>,
              'Local storage (first-party, set by us)',
              'Remembers the names of the extra QR codes you made (for example “Table 4”), so you can download them again.',
              'Until you remove the code, or clear site data.',
            ],
          ]}
        />
        <p>
          That is the complete list. The first item is set by Supabase, our authentication provider;
          the other two are set by {N} and hold only text you typed. All three stay on our own origin:
          no other website can read them, they contain no advertising identifier, and they are not
          used to track you anywhere.
        </p>
        <p>
          You can clear them at any time by clearing site data in your browser settings. That signs
          you out and resets the saved message and code names on this device; QR codes you have
          already printed keep working.
        </p>
      </Clause>

      <Clause id="razorpay" heading="4. The one third-party script, and when it loads">
        <p>
          {N} loads exactly one third-party script:{' '}
          <code className="rounded bg-gray-100 px-1.5 py-0.5">checkout.razorpay.com</code>, the
          Razorpay payment checkout.
        </p>
        <p>It is deliberately constrained:</p>
        <List
          items={[
            'It is not on the landing page, the pricing page, the review page, or any policy page.',
            'It loads only on the Billing page, only after you are signed in, and only at the moment you click a button to start a payment.',
            'If you never start a payment, it never loads and Razorpay sets nothing in your browser.',
            'Once it loads, Razorpay sets its own cookies to run the checkout and to detect payment fraud. Those are strictly necessary to take a payment you asked to make.',
          ]}
        />
        <p>
          Razorpay&rsquo;s own privacy policy governs what it stores at that point:{' '}
          <a
            className="text-brand-700 underline underline-offset-2"
            href="https://razorpay.com/privacy/"
            target="_blank"
            rel="noopener noreferrer"
          >
            razorpay.com/privacy
          </a>
          .
        </p>
        <p>
          There are no other embeds anywhere on {N} — no YouTube, no Google Fonts fetched from
          Google&rsquo;s servers, no Maps iframe, no social widgets, no chat widget, no A/B testing
          tool, no session-replay tool, no heatmaps.
        </p>
      </Clause>

      <Clause id="analytics" heading="5. Our analytics and visit counts do not use cookies">
        <p>
          The dashboard shows a business how many people opened its review page, started a review,
          generated a draft, and opened Google. That is real, and it is worth being precise about how
          it works:
        </p>
        <List
          items={[
            'The counts are recorded server-side, in our own database, against the in-memory session identifier described in clause 2.',
            'No cookie, pixel, beacon, or third-party analytics service is involved.',
            'We do not record your IP address, user agent, device fingerprint, advertising ID, or location with these counts.',
            'The data cannot identify you, cannot follow you to another website, and is never shared with an advertiser.',
          ]}
        />
        <p>
          We also count visits to our own public pages (the home page, pricing, guides, and policies)
          so we know which pages people read. Each visit adds one to a daily total for that page,
          stored with the date and, on the page you arrived at, the name of the website that linked
          you (for example, google.com). Nothing else is sent: no cookie, no identifier, and nothing
          stored in your browser, and the same limits in the list above apply. Customer review pages
          and the signed-in app are never counted.
        </p>
        <p>
          This is why neither kind of count changes the answer in clause 6: there is no tracking
          technology in your browser to consent to.
        </p>
      </Clause>

      <Clause id="why-no-banner" heading="6. Why you do not see a cookie consent banner">
        <p>
          You were probably expecting one. Here is the honest reasoning, so you can check it yourself.
        </p>

        <SubHeading>Under Indian law</SubHeading>
        <p>
          India has no cookie-specific rule. The DPDPA, 2023 is a general consent law about processing
          personal data — it has no equivalent of the EU&rsquo;s ePrivacy Directive and does not
          require a banner for storing information on a device. Our obligation under the DPDPA is to
          give you a clear, itemised notice and to obtain consent for the personal data we actually
          process. We do that at the point of collection: on the review page before you write
          anything, and at signup. It is set out in full in our{' '}
          <Link className="text-brand-700 underline underline-offset-2" to="/privacy">
            Privacy Policy
          </Link>
          .
        </p>

        <SubHeading>Under EU/UK law, if it applies to us</SubHeading>
        <p>
          Article 5(3) of the ePrivacy Directive requires prior consent for storing or reading
          information on a user&rsquo;s device, <em>except</em> where it is strictly necessary to
          provide a service the user explicitly requested. Every item in clause 3 and clause 4 falls
          squarely inside that exemption — keeping you signed in when you asked to sign in,
          remembering what you typed into a dashboard tool so that tool works, and running a
          checkout when you clicked &ldquo;pay&rdquo;. We have no non-essential storage at
          all.
        </p>

        <SubHeading>The conclusion</SubHeading>
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 text-brand-900">
          <p>
            A consent banner exists to let you refuse optional tracking. We have no optional tracking,
            so a banner would offer you a choice that does not exist. Showing one anyway — with a
            &ldquo;reject&rdquo; button that changes nothing — would be theatre, and arguably a dark
            pattern of the kind the Central Consumer Protection Authority&rsquo;s 2023 guidelines
            discourage.
          </p>
          <p className="mt-2 font-semibold">
            If we ever add analytics, advertising, or any other non-essential tracking, we will add a
            real consent banner with a genuine reject option before we turn it on, and we will update
            this page first.
          </p>
        </div>
      </Clause>

      <Clause id="control" heading="7. Controlling browser storage yourself">
        <p>
          You can block or delete cookies and local storage in any browser&rsquo;s settings, and you
          can use private browsing. Blocking storage for this site will sign you out and prevent you
          from signing in again, because the sign-in session has nowhere to live. It will not affect
          the review page, which stores nothing.
        </p>
        <p>
          {N} does not respond to the Do Not Track header, because there is nothing for us to stop
          doing.
        </p>
      </Clause>

      <Clause id="questions" heading="8. Questions">
        <p>
          If any of the above turns out not to match what you observe in your browser&rsquo;s developer
          tools, we want to know. Email{' '}
          <a
            className="text-brand-700 underline underline-offset-2"
            href={`mailto:${legal.privacyEmail}`}
          >
            {displayValue(legal.privacyEmail)}
          </a>{' '}
          and we will fix either the behaviour or this page.
        </p>
      </Clause>
    </LegalPage>
  );
}
