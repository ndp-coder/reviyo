/*
# Restrict owner-supplied URLs to safe schemes

## Why

`businesses.google_review_url` is typed in by a business owner and then rendered
into an `href` on the *public* review page that their customers open by
scanning a QR code in a shop. `businesses.logo_url` is rendered into an `img`
`src` on the same page.

Business owners can update their own row directly through the REST API — the
RLS policy allows it, as it must — so validating only in the signup form is not
enough. Without a constraint, an owner could save `javascript:…` as their review
link and have it execute in the browser of every customer who scans their code.

These constraints make the database the last line of defence. The browser also
checks (src/lib/url-safety.ts) and the review page drops anything unsafe at
render time, so a row written before this migration still cannot produce a
dangerous link.

## What is allowed

- `google_review_url`: NULL, or an absolute `http://` or `https://` URL.
- `logo_url`: NULL, an absolute `http(s)` URL, or a base64 `data:image/...`
  URL in PNG, JPEG, GIF, or WebP (the onboarding and settings forms store
  uploaded logos inline as data URLs, so that has to keep working). SVG is
  deliberately excluded: the upload control only accepts PNG, JPEG, and WebP,
  and SVG is the one image type that can carry markup.

Existing rows that violate the rule are set to NULL rather than blocking the
migration — an unsafe URL is not worth preserving, and NULL degrades cleanly:
the review page simply omits the link.
*/

-- Clear any existing unsafe values so the constraints can be validated.
UPDATE businesses
SET google_review_url = NULL
WHERE google_review_url IS NOT NULL
  AND google_review_url !~* '^https?://';

UPDATE businesses
SET logo_url = NULL
WHERE logo_url IS NOT NULL
  AND logo_url !~* '^(https?://|data:image/(png|jpeg|jpg|gif|webp);base64,)';

ALTER TABLE businesses
  DROP CONSTRAINT IF EXISTS businesses_google_review_url_scheme;

ALTER TABLE businesses
  ADD CONSTRAINT businesses_google_review_url_scheme
  CHECK (
    google_review_url IS NULL
    OR google_review_url ~* '^https?://[^\s]+$'
  );

ALTER TABLE businesses
  DROP CONSTRAINT IF EXISTS businesses_logo_url_scheme;

ALTER TABLE businesses
  ADD CONSTRAINT businesses_logo_url_scheme
  CHECK (
    logo_url IS NULL
    OR logo_url ~* '^https?://[^\s]+$'
    OR logo_url ~* '^data:image/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=]+$'
  );

COMMENT ON CONSTRAINT businesses_google_review_url_scheme ON businesses IS
  'Only absolute http(s) URLs. This value is rendered into an href on the public customer review page.';

COMMENT ON CONSTRAINT businesses_logo_url_scheme ON businesses IS
  'Only absolute http(s) URLs or base64 image data URLs. This value is rendered into an img src on the public customer review page.';
