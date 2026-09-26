import { useState } from 'react';
import { ExternalLink, Search, MapPin, CheckCircle2 } from 'lucide-react';
import { Alert, Button, Input } from '@/components/ui';
import { directReviewUrl, isDirectReviewLink, isGooglePlaceId, reviewUrlFromPlaceId, validateGoogleReviewUrl } from '@/lib/url-safety';

const PLACE_ID_FINDER_URL =
  'https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder';


interface GoogleReviewLinkHelpProps {
  businessName: string;
  /** The link currently in the form, used for the "Test this link" button. */
  currentUrl: string;
  /** Called with a ready-made review link, e.g. one built from a Place ID. */
  onUseLink: (url: string) => void;
  /** Start expanded, e.g. during onboarding when the owner is looking for it. */
  defaultOpen?: boolean;
}

/**
 * Step-by-step help for finding a business's Google review link, plus a
 * Place ID fallback for owners who cannot reach their Business Profile.
 * Every link here opens Google in a new tab; nothing is sent from this page.
 */
export function GoogleReviewLinkHelp({
  businessName,
  currentUrl,
  onUseLink,
  defaultOpen = false,
}: GoogleReviewLinkHelpProps) {
  const [placeId, setPlaceId] = useState('');
  const [placeIdError, setPlaceIdError] = useState<string | null>(null);

  const trimmedName = businessName.trim();
  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(trimmedName || 'my business')}`;
  const canTest = currentUrl.trim() !== '' && validateGoogleReviewUrl(currentUrl) === null;
  // A valid Google link can still open the business's listing instead of the
  // review box, which costs customers several taps and loses many of them.
  const opensListing = canTest && !isDirectReviewLink(currentUrl);

  function applyPlaceId() {
    const value = placeId.trim();
    if (!isGooglePlaceId(value)) {
      setPlaceIdError('That does not look like a Place ID. It usually starts with "ChIJ" and has no spaces.');
      return;
    }
    setPlaceIdError(null);
    onUseLink(reviewUrlFromPlaceId(value));
    setPlaceId('');
  }

  return (
    <div className="space-y-3">
      {opensListing && (
        <Alert variant="warning" title="This link opens your Google listing, not the review box">
          Customers would have to find &ldquo;Write a review&rdquo; themselves, and many give up there. Use the
          link from <strong>Ask for reviews</strong> on your Business Profile (it ends in <code>/review</code>), or
          build one from your Place ID below.
        </Alert>
      )}
      {canTest && (
        <a
          href={directReviewUrl(currentUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-800 underline underline-offset-2"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Test this link
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      )}

      <details open={defaultOpen} className="group rounded-lg border border-gray-300 bg-white">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-gray-900">
          How do I find my Google review link?
        </summary>

        <div className="space-y-5 border-t border-gray-200 px-4 py-4 text-sm text-gray-700">
          <section aria-labelledby="google-help-option-1">
            <h3 id="google-help-option-1" className="font-semibold text-gray-900">
              Option 1: From your Google Business Profile (recommended)
            </h3>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5">
              <li>Sign in to Google with the account that manages your business.</li>
              <li>
                Search Google for your business name. Your profile's management panel appears at the
                top.
              </li>
              <li>
                Click <strong>Ask for reviews</strong> (sometimes shown as <strong>Get more reviews</strong>).
              </li>
              <li>Copy the link it shows. It starts with <code className="text-xs">https://g.page/r/</code>.</li>
              <li>Paste it into the box above.</li>
            </ol>
            <a
              href={googleSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              Search Google for {trimmedName ? `"${trimmedName}"` : 'my business'}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </section>

          <section aria-labelledby="google-help-option-2">
            <h3 id="google-help-option-2" className="font-semibold text-gray-900">
              Option 2: Build it from your Place ID
            </h3>
            <p className="mt-1">
              Use this if you can't open your Business Profile, for example because someone else manages it.
            </p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5">
              <li>Open Google's Place ID Finder.</li>
              <li>Type your business name and pick it from the list.</li>
              <li>Copy the Place ID shown (it usually starts with <code className="text-xs">ChIJ</code>) and paste it below.</li>
            </ol>
            <a
              href={PLACE_ID_FINDER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
              Open Place ID Finder
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
              <Input
                aria-label="Google Place ID"
                value={placeId}
                error={placeIdError ?? undefined}
                onChange={(e) => {
                  setPlaceId(e.target.value);
                  if (placeIdError) setPlaceIdError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyPlaceId())}
                placeholder="ChIJ..."
                className="flex-1"
              />
              <Button variant="outline" onClick={applyPlaceId} disabled={!placeId.trim()}>
                Use this Place ID
              </Button>
            </div>
          </section>

          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            No Google Business Profile yet? Create one free at{' '}
            <a
              href="https://business.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline underline-offset-2"
            >
              business.google.com
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            . You can skip this for now and add the link later in Settings.
          </p>
        </div>
      </details>
    </div>
  );
}
