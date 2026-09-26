import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Copy, Download, ExternalLink } from 'lucide-react';
import { MarketingHeader } from '@/components/MarketingHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SkipLink } from '@/components/SkipLink';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Button, Input } from '@/components/ui';
import { buttonClasses } from '@/components/ui/button-styles';
import { legal } from '@/config/legal';
import { reviewLinkToolFaqs } from '@/config/faq';
import { directReviewUrl, isGooglePlaceId, isSafeExternalUrl, reviewUrlFromPlaceId, validateGoogleReviewUrl } from '@/lib/url-safety';

const PLACE_ID_FINDER_URL =
  'https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder';


export function ReviewLinkGeneratorPage() {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);
  const [qrPng, setQrPng] = useState<string | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    const value = input.trim();
    let url: string | null = null;
    if (isGooglePlaceId(value)) {
      url = reviewUrlFromPlaceId(value);
    } else if (isSafeExternalUrl(value)) {
      // Says exactly what is wrong with a link, including a Maps share or
      // listing link: a QR code for that would land customers on the
      // business's page instead of the review form.
      const problem = validateGoogleReviewUrl(value);
      if (problem) {
        setError(problem);
        setReviewUrl(null);
        return;
      }
      // A g.page link is pointed at the review form rather than the profile.
      url = directReviewUrl(value);
    }
    if (!url) {
      setError('Paste a Google Place ID (it usually starts with “ChIJ”) or a Google review link starting with https://.');
      setReviewUrl(null);
      return;
    }

    setError(null);
    setReviewUrl(url);
    setCopied(false);
    // Loaded only when someone uses the tool, to keep the page fast.
    const QRCode = (await import('qrcode')).default;
    const options = { margin: 2, color: { dark: '#0f172a', light: '#ffffff' } };
    setQrPng(await QRCode.toDataURL(url, { ...options, width: 1024 }));
    setQrSvg(await QRCode.toString(url, { ...options, type: 'svg' }));
  }

  async function copyLink() {
    if (!reviewUrl) return;
    try {
      await navigator.clipboard.writeText(reviewUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const svgHref = qrSvg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}` : null;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SkipLink />
      <MarketingHeader />

      <main id="main-content" tabIndex={-1} className="flex-1">
        <section className="border-b border-gray-200 bg-paper px-5 pb-12 pt-8 sm:px-6 lg:pb-20 lg:pt-12">
          <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
            <div>
              <Breadcrumbs />
              <p className="mt-8 text-sm font-semibold text-accent-700">Free tool · No sign-up</p>
              <h1 className="mt-3 text-[2rem] font-extrabold leading-[1.1] text-balance text-gray-900 sm:text-5xl">
                Free Google review link &amp; QR code generator
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-gray-700">
                Get the direct link that opens your Google “write a review” box, plus a printable QR code for your counter,
                in under a minute.
              </p>
            </div>

            <div className="rounded-xl border border-gray-300 bg-white p-6 sm:p-8">
              <label htmlFor="review-link-input" className="block text-sm font-semibold text-gray-900">
                Your Google Place ID or review link
              </label>
              <p className="mt-1 text-xs text-gray-600">
                Don’t know it? Open{' '}
                <a href={PLACE_ID_FINDER_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-700 underline underline-offset-2">
                  Google’s Place ID Finder<span className="sr-only"> (opens in a new tab)</span>
                </a>
                , search your business name, and copy the ID it shows.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
                <Input
                  id="review-link-input"
                  value={input}
                  error={error ?? undefined}
                  onChange={(e) => {
                    setInput(e.target.value);
                    if (error) setError(null);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), void generate())}
                  placeholder="ChIJ… or https://g.page/r/…"
                  autoComplete="off"
                  spellCheck={false}
                  className="flex-1"
                />
                <Button onClick={() => void generate()} disabled={!input.trim()}>
                  Generate
                </Button>
              </div>

              {reviewUrl && (
                <div className="mt-6 border-t border-gray-200 pt-6" aria-live="polite">
                  <h2 className="text-sm font-semibold text-gray-900">Your Google review link</h2>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <code className="flex-1 break-all rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-800">{reviewUrl}</code>
                    <Button variant="outline" size="sm" onClick={() => void copyLink()}>
                      {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                  <a
                    href={reviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700 underline underline-offset-2"
                  >
                    Test the link <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>

                  {qrPng && (
                    <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                      <img
                        src={qrPng}
                        alt="QR code that opens your Google review page"
                        width={176}
                        height={176}
                        className="h-44 w-44 rounded-lg border border-gray-200"
                      />
                      <div className="text-sm text-gray-700">
                        <p>Print this at your counter, on bills, or on table cards. Test it with your phone camera first.</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <a
                            href={qrPng}
                            download="google-review-qr-code.png"
                            className={buttonClasses({ size: 'sm' })}
                          >
                            <Download className="h-4 w-4" aria-hidden="true" /> PNG
                          </a>
                          {svgHref && (
                            <a
                              href={svgHref}
                              download="google-review-qr-code.svg"
                              className={buttonClasses({ variant: 'outline', size: 'sm' })}
                            >
                              <Download className="h-4 w-4" aria-hidden="true" /> SVG (for printing)
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="px-5 py-16 sm:px-6 lg:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-3xl">
              <div className="border-l-4 border-accent-500 bg-accent-50 px-6 py-5">
                <h2 className="text-lg font-bold text-gray-900">A link gets them to Google. Reviyo helps them write.</h2>
                <p className="mt-2 text-sm text-gray-800">
                  Many customers open the review box and then don’t know what to say. With Reviyo, your QR code first asks
                  what they liked, then AI turns their own input into a review they can edit and post.
                  You also get a private feedback inbox and a simple funnel dashboard.
                </p>
                <p className="mt-2 text-sm text-gray-800">
                See{' '}
                <Link to="/for" className="font-medium text-brand-700 underline underline-offset-2">
                  how it works for clinics, salons, cafés, and more
                </Link>
                , or compare the{' '}
                <Link to="/pricing" className="font-medium text-brand-700 underline underline-offset-2">
                  plans
                </Link>
                .
              </p>
              <Link to="/signup" className={`${buttonClasses()} mt-4`}>
                  Try Reviyo free for {legal.trialDays} days <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>

              <h2 className="mt-14 text-2xl font-bold text-gray-900">How to find your Google review link</h2>
              <h3 className="mt-6 text-lg font-semibold text-gray-900">From your Google Business Profile</h3>
              <ol className="mt-3 list-decimal space-y-2 pl-6 text-gray-700">
                <li>Sign in to Google with the account that manages your business.</li>
                <li>Search Google for your business name. Your profile’s management panel appears at the top.</li>
                <li>Click <strong>Ask for reviews</strong> (sometimes shown as <strong>Get more reviews</strong>).</li>
                <li>Copy the link, which starts with <code className="text-sm">https://g.page/r/</code>, and paste it into the box above to get a QR code.</li>
              </ol>
              <h3 className="mt-8 text-lg font-semibold text-gray-900">From your Place ID</h3>
              <ol className="mt-3 list-decimal space-y-2 pl-6 text-gray-700">
                <li>Open Google’s Place ID Finder.</li>
                <li>Type your business name and choose it from the list.</li>
                <li>Copy the Place ID and paste it above. We build the direct review link from it.</li>
              </ol>

              <h2 className="mt-14 text-2xl font-bold text-gray-900">Where to use your review QR code</h2>
              <ul className="mt-4 space-y-2 text-gray-700">
                {[
                  'At the billing counter, next to (but clearly separate from) your payment QR',
                  'On bills, receipts, and takeaway bags',
                  'On table tents, reception desks, and waiting areas',
                  'In the WhatsApp or SMS message you send after a visit',
                ].map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <Check className="mt-1 h-4 w-4 flex-shrink-0 text-accent-700" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <h2 className="mt-14 text-2xl font-bold text-gray-900">Frequently asked questions</h2>
              <ul className="mt-6 divide-y divide-gray-200 border-y border-gray-200">
                {reviewLinkToolFaqs.map((faq) => (
                  <li key={faq.q} className="py-6">
                    <h3 className="font-semibold text-gray-900">{faq.q}</h3>
                    <p className="mt-2 leading-relaxed text-gray-700">{faq.a}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
