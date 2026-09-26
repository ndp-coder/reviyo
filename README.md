# Reviyo

AI-assisted Google review platform for small, single-location businesses.

Reviyo helps businesses collect genuine Google reviews by making it easy for customers to express their real experience. Customers scan a QR code, rate their experience, select topics, and the AI helps them write a natural review based on their input. The customer then copies and pastes the review on Google themselves.

## Product Principles

- **No fake reviews.** AI only helps customers express their genuine experience based on information they provide.
- **No automatic submission.** The customer always submits the final review on Google.
- **No filtering.** Positive, neutral, and negative customers follow the same workflow.
- **No affiliation with Google.** Reviyo is an independent tool.
- **No incentivised reviews.** Terms clause 6 forbids offering anything of value
  for a review. This breaks Google's policies and Indian consumer law, and the
  penalty falls on the business that did it.
- **Anonymous by design.** The customer flow collects a rating, topic taps, and
  optional free text. No name, email, phone, IP address, or tracking cookie.

## Tech Stack

- **Frontend:** React + TypeScript + Tailwind CSS
- **Routing:** React Router
- **Icons:** Lucide React
- **QR Codes:** qrcode (npm)
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions, Row Level Security)
- **AI:** Provider-selectable Supabase Edge Function (OpenAI or Gemini)

## Architecture

```
src/
├── config/          # Branding and business categories
├── lib/             # Supabase client, auth context, types, analytics, AI client
├── components/ui/   # Shared UI components (Button, Card, Input, etc.)
├── pages/
│   ├── auth/        # Login, signup, forgot password
│   ├── onboarding/  # 6-step business setup wizard
│   ├── customer/    # Public customer review flow (/r/:slug)
│   ├── dashboard/   # Owner dashboard (overview, analytics, feedback, QR, settings, billing)
│   └── admin/      # Admin foundation
├── App.tsx          # Routes
└── main.tsx         # Entry point

supabase/
├── config.toml      # Edge function config
└── functions/
    ├── generate-review/          # AI review generation
    ├── suggest-topics/           # Authenticated AI topic suggestions
    ├── create-razorpay-order/    # Authenticated payment order creation
    ├── verify-razorpay-payment/  # Authenticated checkout verification
    ├── razorpay-webhook/         # Signed server-to-server payment events
    ├── create-autopay-mandate/   # Authenticated AutoPay setup
    ├── verify-autopay-mandate/   # Authenticated mandate verification
    ├── cancel-autopay/           # Authenticated AutoPay cancellation
    ├── autopay-scheduler/        # Secret-protected renewal worker
    └── delete-account/           # Authenticated account erasure
```

## Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `profiles` | Extends auth.users with role (user/admin) |
| `businesses` | Business info (name, slug, category, logo, Google review URL) |
| `review_topics` | Configurable tags for customer review flow |
| `review_sessions` | Anonymous customer sessions with rating, comment, generated review |
| `review_session_topics` | Join table linking sessions to selected topics |
| `private_feedback` | Private feedback from customers to business |
| `analytics_events` | Event tracking (qr_page_view, review_started, etc.) |
| `subscriptions` | Business subscription plans and status |
| `ai_generation_log` | Rate limiting for AI generation |
| `payment_orders` | Server-owned Razorpay orders and fulfillment state |
| `retained_financial_records` | Minimum payment trail kept after account erasure for statutory bookkeeping |

### Security

- **Row Level Security** enabled on every table
- Business owners can only access their own business's data
- Public customers can only see business info needed for the review flow
- No customer can query another customer's session or private feedback
- Sensitive mutations happen through SECURITY DEFINER functions
- Column-level privileges prevent users from forging `owner_id`, `role`, or subscription `status`

### Migrations

Run all files in `supabase/migrations` in timestamp order. They create the schema,
enable RLS, add the customer-flow RPCs, harden onboarding/public data access, add
consent records with retention/export/erasure functions, and constrain
owner-supplied URLs to safe schemes.

## Connect Your Supabase Project

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local`.
3. In Supabase **Settings > API**, add your project URL and publishable key:

   ```dotenv
   VITE_SUPABASE_URL=
   VITE_SUPABASE_PUBLISHABLE_KEY=
   ```

   A legacy anon key can be supplied as `VITE_SUPABASE_ANON_KEY` instead. Never
   put a secret key or service-role key in a `VITE_` variable.
4. Link this repository and apply the migrations:

   ```bash
   supabase login
   supabase link --project-ref yagchgwgbttxfihlyddm
   supabase db push --linked
   ```
5. Deploy the Edge Functions:

   ```bash
   supabase functions deploy generate-review --project-ref yagchgwgbttxfihlyddm
   supabase functions deploy suggest-topics --project-ref yagchgwgbttxfihlyddm
   supabase functions deploy create-razorpay-order --project-ref yagchgwgbttxfihlyddm
   supabase functions deploy verify-razorpay-payment --project-ref yagchgwgbttxfihlyddm
   supabase functions deploy razorpay-webhook --project-ref yagchgwgbttxfihlyddm
   supabase functions deploy create-autopay-mandate --project-ref yagchgwgbttxfihlyddm
   supabase functions deploy verify-autopay-mandate --project-ref yagchgwgbttxfihlyddm
   supabase functions deploy cancel-autopay --project-ref yagchgwgbttxfihlyddm
   supabase functions deploy autopay-scheduler --project-ref yagchgwgbttxfihlyddm
   supabase functions deploy delete-account --project-ref yagchgwgbttxfihlyddm
   ```

   `delete-account` implements the right to erasure and needs no secrets of its
   own — it uses the server-side Supabase key that hosted functions already
   receive. It runs with `verify_jwt = true` and resolves the account to delete
   from the caller's own token, never from the request body.
6. In Supabase **Edge Functions > Secrets**, configure one real provider. No
   template or dummy review generator is used:

   ```dotenv
   AI_PROVIDER=openai
   AI_MODEL=YOUR_OPENAI_MODEL
   OPENAI_API_KEY=
   ```

   Or:

   ```dotenv
   AI_PROVIDER=gemini
   AI_MODEL=gemini-3.8-flash
   GEMINI_API_KEY=
   ```

   Also set `APP_ORIGINS` to the exact deployed frontend origin. Use commas for
   multiple trusted origins (for example, production and staging). Local Vite
   origins are allowed automatically. Add all server-side values to an ignored
   `supabase/functions/.env` file, then upload them without placing credentials
   in shell history:

   ```bash
   supabase secrets set --env-file supabase/functions/.env --project-ref yagchgwgbttxfihlyddm
   ```

   `SUPABASE_URL` and the server-side Supabase secret keys are provided to hosted
   Edge Functions by Supabase. They must never be added to frontend environment
   variables.

7. In **Authentication > URL Configuration**, set your deployed site URL and
   add local/deployed redirect URLs. In **Authentication > Providers > Email**,
   choose whether email confirmation is required.

## AI Architecture

The `generate-review` edge function is provider-agnostic:

1. It receives structured input (businessName, businessCategory, rating, selectedTopics, customerComment, requestedStyle)
2. Validates and sanitizes input
3. Checks rate limits (10 per session, 50 per business per hour)
4. Calls the configured AI provider
5. Returns the generated review text

To swap providers, change only the provider module inside the edge function. The rest of the app is unaffected.

### System Prompt Rules

The AI is instructed to:
- Use ONLY the customer's provided input
- Never invent experiences, staff, services, or facts
- Write in natural, conversational language
- Keep reviews concise
- Match tone to rating without being dishonest

## Local Development

```bash
npm install
npm run dev      # Start dev server
npm run build    # Guarded production build (requires approved project and legal details)
npm run typecheck # Type checking
npm run lint     # ESLint
```

## Deployment

Build the frontend with `npm run build` and deploy `dist/` to your host.
The build first checks that `VITE_SUPABASE_URL` targets the selected production
project (`yagchgwgbttxfihlyddm`), a publishable key is present, and the legal
configuration has no `TODO_` values. It is expected to fail until those launch
requirements are complete. Local development still uses `npm run dev`.

### SEO build

`npm run build` prerenders every public page (home, pricing, industry pages,
the free review-link tool, and the policies) to static HTML with its own
title, description, canonical URL, social tags, and JSON-LD, and writes
`sitemap.xml` and `robots.txt`. All page metadata lives in `src/config/seo.ts`;
industry page copy lives in `src/config/industries.ts`. The site URL comes from
`siteUrl` in `src/config/legal.ts`.

Hosting requirements:

- Serve `pricing.html` at `/pricing` (Vercel with `cleanUrls`, Netlify, and
  Cloudflare Pages all do). `vercel.json` and `public/_redirects` are included.
- Send every other path (dashboard, sign-in, `/r/:slug`) to `app.html`, the
  `noindex` app shell. Both files above already do this.
- Serve the site only on `https://www.reviyo.in`, and 301-redirect
  `reviyo.in` and `http://` to it, so search engines see one canonical host. Add the
same two public `VITE_` variables to that host. Database migrations and Edge
Functions are deployed separately with the Supabase CLI commands above.

## Integrations

### Google Business Profile API

The `google_review_url` field on the `businesses` table stores the direct review link. When the Google Business Profile API is integrated:

1. Add API credentials as edge function secrets
2. Create an edge function to fetch/verify the review URL
3. Optionally verify when a review is actually posted

### Razorpay Payments Integration

Reviyo integrates Razorpay for automated subscription payments and renewals (6 Months @ ₹1,999 and 12 Months @ ₹2,999).

#### 1. Set Supabase Edge Function Secrets
Copy the blank server template and fill the ignored file with your own live
Razorpay credentials, exact frontend origin, and a random AutoPay scheduler
secret of at least 32 characters:

```powershell
Copy-Item supabase/.env.example supabase/functions/.env
supabase secrets set --env-file supabase/functions/.env --project-ref yagchgwgbttxfihlyddm
```

Never use the Bolt project's credentials. Rotate any key that has previously
appeared in source, chat, screenshots, or shell history. Use Razorpay test-mode
keys in staging and live-mode keys only in production.

#### 2. Deploy Edge Functions
Deploy every payment and AutoPay function:
```bash
supabase functions deploy create-razorpay-order --project-ref yagchgwgbttxfihlyddm
supabase functions deploy verify-razorpay-payment --project-ref yagchgwgbttxfihlyddm
supabase functions deploy razorpay-webhook --project-ref yagchgwgbttxfihlyddm
supabase functions deploy create-autopay-mandate --project-ref yagchgwgbttxfihlyddm
supabase functions deploy verify-autopay-mandate --project-ref yagchgwgbttxfihlyddm
supabase functions deploy cancel-autopay --project-ref yagchgwgbttxfihlyddm
supabase functions deploy autopay-scheduler --project-ref yagchgwgbttxfihlyddm
```

#### 3. Razorpay Webhook Configuration
In the Razorpay Dashboard under **Settings > Webhooks**, add an endpoint:
- **Webhook URL**: `https://yagchgwgbttxfihlyddm.supabase.co/functions/v1/razorpay-webhook`
- **Secret**: Value configured in `RAZORPAY_WEBHOOK_SECRET`
- **Active Events**: `order.paid`, `payment.authorized`, `payment.captured`,
  `payment.failed`, `token.confirmed`, `token.rejected`, `token.paused`, and
  `token.cancelled`

#### 4. Schedule AutoPay renewals

AutoPay does not renew anything until the scheduler is running. In Supabase,
open **Integrations > Cron**, create an HTTP job that runs every three hours
(`0 */3 * * *`), and configure:

- **Method**: `POST`
- **URL**: `https://yagchgwgbttxfihlyddm.supabase.co/functions/v1/autopay-scheduler`
- **Headers**: `Content-Type: application/json` and `x-cron-secret` set to the
  exact same `AUTOPAY_CRON_SECRET` stored in Edge Function secrets
- **Body**: `{}`

Keep the cron secret out of migrations and source control. Confirm the first
job run returns a successful summary, then monitor Cron history and Edge
Function logs. Do not enable AutoPay for customers until this job is healthy.

## Compliance and Legal

Reviyo collects personal data from two groups — business owners and their
customers — takes payments in India, and publishes text that ends up on Google.
That puts it inside the Digital Personal Data Protection Act, 2023 (DPDPA), the
Consumer Protection Act, 2019, and Razorpay's merchant requirements. This
section records what is implemented and what still needs a human.

> **None of this is legal advice, and none of it has been reviewed by a lawyer.**
> The policy pages were written to match what the code actually does, which is
> the hard part and the part that is usually wrong. Have a lawyer read them
> before launch — especially the Terms and the Refund Policy, which create
> obligations you have to honour.

### Before you can launch

1. **Fill in `src/config/legal.ts`.** Every `TODO_` value is rendered publicly
   on the Contact, Privacy, Terms, Refund, and Cookie pages. `npm test` fails
   while any placeholder remains — that failure is the pre-launch gate, not a
   bug.
2. **Apply every migration and deploy every Edge Function** listed above. A
   deployed function can still fail if the database migration it depends on is
   missing.
3. **Set every server secret** from `supabase/.env.example`, including the
   exact `APP_ORIGINS`, the Razorpay webhook secret, and a 32+ character
   `AUTOPAY_CRON_SECRET`. Keep the filled file ignored.
4. **Configure and test Razorpay in test mode**, including every webhook event
   and the AutoPay scheduler described below. Switch to live keys only after
   the full setup, renewal, failure, cancellation, and refund flows pass.
5. **Schedule the retention purge.** The Privacy Policy promises that customer
   data is deleted on a schedule. Nothing enforces that until the job runs.
6. **Set the host security headers**, HTTPS redirect, SPA fallback, and the
   Content-Security-Policy below.
7. **Configure production monitoring and alerts.** The app has a safe crash
   screen and Supabase logs, but no external frontend exception tracking or
   alert delivery is configured by this repository.

### Policy pages

| Route | Page | Why it is required |
|-------|------|--------------------|
| `/privacy` | Privacy Policy | DPDPA s.5 notice, s.8(9) contact, s.16 transfers |
| `/terms` | Terms & Conditions | Contract; clause 6 carries the review-integrity rules |
| `/cookies` | Cookie Policy | Transparency; explains why no consent banner is shown |
| `/refunds` | Refund & Cancellation Policy | Razorpay merchant requirement; Consumer Protection Act |
| `/contact` | Contact Us | Consumer Protection (E-Commerce) Rules 2020; DPDPA s.13 grievance officer |

All five are routed publicly in `src/App.tsx`, outside any auth wrapper, and are
linked from the marketing footer, the auth pages, the onboarding wizard, and the
dashboard footer.

### Do you need a cookie consent banner? No — and here is why

Reviyo sets **no** analytics, advertising, or tracking storage. The complete
inventory:

| What | Where | Classification |
|------|-------|----------------|
| `sb-yagchgwgbttxfihlyddm-auth-token` | Local storage, first-party | Strictly necessary — it is the signed-in session |
| Razorpay checkout cookies | Only after a signed-in owner clicks to pay | Strictly necessary for a payment the user requested |
| Review-session id | In-page memory only, never persisted | Not storage at all |

India has no cookie-specific rule; the DPDPA is a general consent law and its
notice-and-consent obligation is met at the point of collection instead. Under
the EU/UK ePrivacy Directive, Article 5(3) exempts storage that is strictly
necessary for a service the user explicitly requested, which covers every item
above. A banner offering a "reject" button that changes nothing would be
theatre, and arguably a dark pattern under the CCPA's 2023 guidelines.

`tests/legal-compliance.test.mjs` fails the build if any analytics, advertising,
session-replay, or externally hosted font provider is added to the codebase. If
you ever add one, you must add a real consent banner with a working reject
option and update `/cookies` first.

### Consent

- **Customers** see an itemised notice on the review page *before* any data is
  collected, paired with an unticked consent box. The agreed version is written
  to `review_sessions.consent_version` via `record_review_consent()`.
- **Owners** must tick an unticked box at signup accepting the Terms and Privacy
  Policy. The version travels in the signup metadata and is written to
  `profiles.terms_consent_version` by the `handle_new_user()` trigger.
- Bump `legal.consentVersion` whenever the substance of a policy changes.

### Data subject rights

Owners can do both of these themselves, immediately and free, from
**Settings → Account → Your data**:

- **Access (s.11)** — `export_my_data()` returns everything held about the
  account as JSON.
- **Erasure (s.12(3))** — the `delete-account` Edge Function deletes the auth
  user, which cascades through every table. Paid-invoice records are copied to
  `retained_financial_records` first and kept 8 years for statutory
  bookkeeping; that carve-out is disclosed in the Privacy Policy and in the
  confirmation dialog.

Customer review sessions are anonymous, so there is usually nothing to look up.
Deletion requests for them go to the privacy mailbox and are honoured
best-effort, as the policy states.

### Retention — you must schedule this

`purge_expired_personal_data()` enforces the retention periods the Privacy
Policy publishes. It does nothing until it runs. Enable `pg_cron` under
**Database > Extensions**, then:

```sql
SELECT cron.schedule(
  'reviyo-purge-expired-personal-data',
  '30 2 * * *',
  $$ SELECT purge_expired_personal_data(90, 365, 395) $$
);
```

Keep those three numbers in step with `sessionRetentionDays`,
`feedbackRetentionDays`, and `analyticsRetentionDays` in `src/config/legal.ts`,
which is what the published policy renders.

### Accessibility

Targeting WCAG 2.2 level AA. Implemented: skip links and `main` landmarks on
every layout; accessible names on all icon-only controls; `aria-pressed` on
toggle chips; a labelled star-rating control (it was five unnamed buttons);
`role="alert"` on error banners and live regions on async results; visible
`:focus-visible` outlines globally; `prefers-reduced-motion` support; form
labels, `autocomplete`, and `aria-describedby` on every input; alt text on every
image, empty `alt` where an image is decorative.

Contrast: `text-gray-400` (2.5:1) and `text-gray-300` (1.9:1) both fail AA for
text and have been replaced with `text-gray-600` or darker everywhere except
explicitly `aria-hidden` decoration. A test enforces this.

**Not yet done:** no audit with a real screen reader, and no automated axe run
in CI. Both are worth adding.

### Review integrity

Terms clause 6 forbids incentivised reviews, review gating, self-authored
reviews, and pressuring customers — because Google's prohibited-content policy
forbids them, and because the Consumer Protection Act, 2019, the CCPA's
misleading-advertisement and dark-pattern guidelines, and IS 19000:2022 all
apply to how reviews are solicited. Penalties for fake or paid reviews fall on
the business that procured them. The product itself does not gate: every rating
follows the same path to a public review.

### Owner-supplied URLs

`businesses.google_review_url` is rendered into an `href` on a public page that
strangers open from a QR code in a shop. Owners can write to their own row
through the REST API, so form validation alone is not enough. Scheme checks run
in three places: `src/lib/url-safety.ts` when typed, a database `CHECK`
constraint, and again at render time in the review page. Logo data URLs are
restricted to PNG/JPEG/GIF/WebP — SVG is excluded because it is the one image
type that can carry markup.

### Recommended Content-Security-Policy

Not set in the app, because `index.html` cannot template the environment-specific
Supabase origin. Set it as a response header at your host instead, substituting
your project ref:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' https://checkout.razorpay.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self';
  connect-src 'self' https://yagchgwgbttxfihlyddm.supabase.co wss://yagchgwgbttxfihlyddm.supabase.co https://api.razorpay.com https://lumberjack.razorpay.com;
  frame-src https://api.razorpay.com https://checkout.razorpay.com;
  form-action 'self';
  base-uri 'self';
  object-src 'none';
  frame-ancestors 'none'
```

Also worth setting: `Referrer-Policy: strict-origin-when-cross-origin`,
`X-Content-Type-Options: nosniff`, and
`Strict-Transport-Security: max-age=31536000; includeSubDomains`.

Verify the Razorpay directives against their current checkout requirements
before enforcing — they change, and a wrong `connect-src` silently breaks
payments.

### Third-party processors

| Processor | Receives | When |
|-----------|----------|------|
| Supabase | All application data | Always |
| AI provider (OpenAI or Gemini) | Business name and category, rating, topics, optional comment | Only when a customer requests a draft |
| Razorpay | Owner name, email, plan, amount | Only at checkout |

Record the actual provider and region in `legal.aiProviderName`,
`legal.aiProviderPolicyUrl`, and `legal.dataRegion` — the Privacy Policy renders
them verbatim, so a wrong value there is a false disclosure.

### Asset licensing

| Asset | Source | Licence |
|-------|--------|---------|
| `public/brand/reviyo-logo.png`, `reviyo-icon.png` | Project-supplied | **You must confirm you own or are licensed to use these.** They are the only raster images in the repo. |
| Icons | `lucide-react` | ISC |
| QR codes | Generated at runtime by `qrcode` (MIT) | No third-party rights |

There are no stock photographs, no illustrations, and no web fonts fetched from
a third party anywhere in the project, so there is no image-licensing exposure
beyond the two logo files.

**Still unverified:** whether "Reviyo" is clear for use as a trade mark in your
class and territory. Run a search on the IP India public trade-mark database
before you print QR cards, buy the domain, or sign a customer. Rebranding after
launch is far more expensive than checking now.

### What is still open

These are outside what the code can settle:

- Legal review of all five policy pages.
- Trade-mark clearance for the name "Reviyo".
- Confirming ownership of the logo files.
- GST registration and whether prices are tax-inclusive as the pages state.
- Razorpay merchant activation, which will check the published policy pages.
- A processing agreement with business owners — they are Data Fiduciaries for
  the customer feedback they receive, and Terms clause 7 assigns them that role,
  but a signed DPA is stronger.
- A documented breach-notification runbook for DPDPA s.8(6).
- Screen-reader testing and automated accessibility checks in CI.

## Branding

All branding (name, colors, domain) is centralized in `src/config/branding.ts`. Change it there to rebrand the entire app.
