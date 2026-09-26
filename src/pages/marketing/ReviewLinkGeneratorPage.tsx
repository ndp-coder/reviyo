import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Copy, Download, ExternalLink, MapPin, Search, Sparkles } from 'lucide-react';
import { MarketingHeader } from '@/components/MarketingHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SkipLink } from '@/components/SkipLink';
import { Button, Input } from '@/components/ui';
import { legal } from '@/config/legal';
import { reviewLinkToolFaqs } from '@/config/faq';
import { isGooglePlaceId, reviewUrlFromPlaceId, validateGoogleReviewUrl } from '@/lib/url-safety';

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
    } else if (value && validateGoogleReviewUrl(value) === null) {
      url = value;
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
        <section className="bg-gradient-to-br from-blue-50 via-white to-sky-50 px-6 py-14 lg:py-20">
          <div className="max-w-3xl mx-auto text-center">
            <p className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-1.5 text-xs font-medium text-blue-800">
              Free tool · No sign-up
            </p>
            <h1 className="mt-4 text-3xl lg:text-5xl font-bold text-gray-900 leading-tight">
              Free Google Review Link &amp; QR Code Generator
            </h1>
            <p className="mt-4 text-lg text-gray-700">
              Get the direct link that opens your Google “write a review” box, plus a printable QR code for your counter,
              in under a minute.
            </p>
          </div>

          <div className="mt-10 max-w-2xl mx-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <label htmlFor="review-link-input" className="block text-sm font-semibold text-gray-900">
              Your Google Place ID or review link
            </label>
            <p className="mt-1 text-xs text-gray-600">
              Don’t know it? Open{' '}
              <a href={PLACE_ID_FINDER_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 underline underline-offset-2">
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
                  className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-blue-700 underline underline-offset-2"
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
                      className="h-44 w-44 rounded-xl border border-gray-200"
                    />
                    <div className="text-sm text-gray-700">
                      <p>Print this at your counter, on bills, or on table cards. Test it with your phone camera first.</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <a
                          href={qrPng}
                          download="google-review-qr-code.png"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        >
                          <Download className="h-4 w-4" aria-hidden="true" /> PNG
                        </a>
                        {svgHref && (
                          <a
                            href={svgHref}
                            download="google-review-qr-code.svg"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
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
        </section>

        <section className="px-6 py-16">
          <div className="max-w-3xl mx-auto">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                <Sparkles className="h-5 w-5 text-blue-700" aria-hidden="true" /> A link gets them to Google. Reviyo helps them write.
              </h2>
              <p className="mt-2 text-sm text-gray-800">
                Many customers open the review box and then don’t know what to say. With Reviyo, your QR code first asks
                for a star rating and a few topics, then AI turns their own input into a review they can edit and post.
                You also get a private feedback inbox and a simple funnel dashboard.
              </p>
              <Link
                to="/signup"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Try Reviyo free for {legal.trialDays} days <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <h2 className="mt-14 text-2xl font-bold text-gray-900">How to find your Google review link</h2>
            <h3 className="mt-6 flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Search className="h-5 w-5 text-blue-700" aria-hidden="true" /> From your Google Business Profile
            </h3>
            <ol className="mt-3 list-decimal space-y-2 pl-6 text-gray-700">
              <li>Sign in to Google with the account that manages your business.</li>
              <li>Search Google for your business name. Your profile’s management panel appears at the top.</li>
              <li>Click <strong>Ask for reviews</strong> (sometimes shown as <strong>Get more reviews</strong>).</li>
              <li>Copy the link, which starts with <code className="text-sm">https://g.page/r/</code>, and paste it into the box above to get a QR code.</li>
            </ol>
            <h3 className="mt-8 flex items-center gap-2 text-lg font-semibold text-gray-900">
              <MapPin className="h-5 w-5 text-blue-700" aria-hidden="true" /> From your Place ID
            </h3>
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
                  <Check className="mt-1 h-4 w-4 flex-shrink-0 text-green-700" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <h2 className="mt-14 text-2xl font-bold text-gray-900">Frequently asked questions</h2>
            <ul className="mt-6 space-y-4">
              {reviewLinkToolFaqs.map((faq) => (
                <li key={faq.q} className="rounded-2xl border border-gray-200 p-5">
                  <h3 className="text-base font-semibold text-gray-900">{faq.q}</h3>
                  <p className="mt-1.5 text-sm text-gray-700">{faq.a}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

