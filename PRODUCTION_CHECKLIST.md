# Reviyo production readiness

Audit date: 26 September 2026

Current decision: **HOLD — do not send production traffic yet.**

The codebase builds and its automated security, database, payment, compliance,
and accessibility checks pass except for intentional legal and provider gates.
The selected production project is `bpzcumfztnaouxwepvuf` (Singapore). The
Supabase CLI account currently gets HTTP 403 for this project's API keys,
functions, secrets, and link operation, so its remote state has not been
verified. The ignored local `.env.local` now has the selected project's URL
and a deliberately blank publishable key, so local login fails closed instead
of contacting the former project. The former CLI link was removed; no project
is linked until access is granted.

## Blocking before launch

- [ ] Replace `TODO_REGISTERED_ADDRESS` in `src/config/legal.ts` with the real
  registered or principal business address, including street/locality, city,
  state, and PIN code. The supplied Vijayawada / 520001 is incomplete.
- [ ] Buy/configure the planned `reviyo.com` mailbox, or supply a different
  working mailbox. Replace `TODO_SUPPORT_EMAIL`, `TODO_PRIVACY_EMAIL`, and
  `TODO_GRIEVANCE_EMAIL` in `src/config/legal.ts` only after a send/receive
  test. The domain had no MX record during this audit, and you said the mailbox
  is not yet purchased.
- [ ] Grant the Supabase CLI account Developer or Owner access to project
  `bpzcumfztnaouxwepvuf`. Read its publishable key, link the repository, and
  fill `.env.local` and the production host's `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_PUBLISHABLE_KEY` to that same project. Do not mix keys between
  projects.
- [ ] Verify the chosen production AI provider, key, model, and policy URL;
  replace `TODO_AI_PROVIDER_NAME` and `TODO_AI_PROVIDER_POLICY_URL` in
  `src/config/legal.ts` with the actual processor details. Then rerun `npm test`.
- [ ] Run the guarded `npm run build` with the Singapore project's HTTPS URL
  and publishable key. It now fails if the old project or any unfinished legal
  field would be bundled into a release.
- [ ] Rotate any Razorpay credentials that were ever copied into source, chat,
  screenshots, or shell history. Use newly created test keys for staging and
  newly created live keys for production.
- [ ] Compare local migrations with the selected production project, review
  each pending migration, then apply them. The previously linked Seoul project
  was missing migrations `20260925090000` through `20260925140000`; the
  Singapore project's migration state is unknown because of the 403.
- [ ] Fill an ignored `supabase/functions/.env` from `supabase/.env.example`
  and upload it with `supabase secrets set --env-file supabase/functions/.env`.
  The previously linked Seoul project lacked `APP_ORIGINS`,
  `RAZORPAY_WEBHOOK_SECRET`, and `AUTOPAY_CRON_SECRET`; the selected project's
  secret names cannot yet be inspected. Set `APP_ORIGINS` to the deployed origin.
- [ ] Redeploy all Edge Functions after the migrations and secrets are in
  place. Use the complete list in `README.md`.
- [ ] Configure the Razorpay webhook with the complete event list in
  `README.md`, use the same webhook secret, and verify signed test events are
  accepted exactly once.
- [ ] Create the secret-protected AutoPay Cron job from `README.md`. Verify a
  successful run and alert on repeated failures before enabling AutoPay.
- [ ] Prove the full Razorpay AutoPay renewal in test mode, including mandate
  registration, pre-debit notice, recurring debit API acceptance, signed
  webhook, settlement, and cancellation. The scheduler's recurring debit API
  has not yet been validated against this merchant account; do not take live
  mandates based on static tests alone.
- [ ] Schedule `purge_expired_personal_data()` exactly as documented so the
  published retention promise is true in practice.
- [ ] Configure the production host: HTTPS redirect, SPA fallback to
  `app.html` for non-public routes, serve the prerendered public HTML files,
  set CSP and security headers, environment variables, and a rollback to the
  previous immutable frontend build. `www.reviyo.in` did not resolve during
  the audit; finish DNS and TLS setup before launch.
- [ ] Configure monitored frontend error reporting and Supabase/Cron/Razorpay
  alerts. Never send review text, tokens, secrets, or full payment payloads to
  the monitoring provider.

## Required staging acceptance

- [ ] New owner: signup, confirmation/reset email, login, logout, onboarding,
  duplicate-slug handling, and account deletion.
- [ ] Customer: QR link on a phone, consent, every star rating, topic/comment
  validation, AI draft, edit/copy, Google handoff, and private feedback.
- [ ] Billing: one-time test payment success/failure/dismissal, duplicate
  callbacks, invalid signatures, and expired subscriptions.
- [ ] AutoPay: UPI and card mandate setup, ₹1 refund, trial start, scheduled
  debit, failed debit, retry/reconciliation, cancellation, and late webhooks.
- [ ] Access control: owner A cannot read or mutate owner B's business,
  sessions, feedback, analytics, billing, or mandate data.
- [ ] Production-like browser pass on Chrome, Edge, Safari/iOS, and Android;
  keyboard-only and screen-reader checks; 200% zoom; slow network.
- [ ] Lighthouse/Core Web Vitals measurement from the deployed staging URL.

## Business sign-off

- [ ] Lawyer review of Privacy, Terms, Cookies, Refund/Cancellation, Contact,
  AutoPay consent, tax wording, and the data-processing arrangement.
- [ ] Confirm logo ownership/licence and clear the Reviyo trade mark.
- [ ] Confirm Razorpay merchant activation, GST position, invoice wording,
  support mailbox/phone coverage, and refund operations.
- [ ] Record an incident owner, breach-notification runbook, backup/restore
  drill, deployment owner, and rollback decision-maker.

## Final command gate

Run this against the exact release commit:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
supabase migration list --linked
supabase db lint --linked --level warning
```

Launch only when every command succeeds, the local and remote migration columns
match, production secrets exist, scheduled jobs are healthy, and every checkbox
above has an accountable owner.
