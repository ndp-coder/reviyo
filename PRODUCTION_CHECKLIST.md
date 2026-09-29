# Reviyo production readiness

Audit date: 26 September 2026

Current decision: **HOLD — do not send production traffic yet.**

The underlying client/SSR build passed its last compile, and automated checks
pass except for intentional legal and provider gates. The guarded release build
remains blocked until those real details are provided.
The owner corrected the selected production project to
`yagchgwgbttxfihlyddm` (last verified in Seoul). The current Supabase CLI
account gets HTTP 403 for this project's API keys and cannot list it, so its
remote state cannot currently be rechecked. The ignored local `.env.local`
points to this project, and its browser key received HTTP 200 from this
project's public Auth settings endpoint. No project is currently linked in the
CLI.

## Blocking before launch

- [ ] Replace `TODO_REGISTERED_ADDRESS` in `src/config/legal.ts` with the real
  registered or principal business address, including street/locality, city,
  state, and PIN code. The supplied Vijayawada / 520001 is incomplete.
- [x] Domain `reviyo.in` bought; support, privacy, and grievance email set to
  `support@reviyo.in` in `src/config/legal.ts`. Before launch, send a test email
  to it from an outside account and confirm it arrives and replies go out.
- [ ] Point DNS for `reviyo.in` at the host: serve the site on
  `https://www.reviyo.in` (the canonical URL in `legal.siteUrl`) and
  301-redirect `https://reviyo.in` and `http://` to it. Add MX records for the
  mailbox, plus SPF, DKIM, and DMARC so mail from `support@reviyo.in` is not
  marked as spam.
- [ ] Sign the Supabase CLI into an account with Developer or Owner access to
  `yagchgwgbttxfihlyddm`, or grant that access to the current account. Link
  the repository and set the production host's `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_PUBLISHABLE_KEY` to this same project.
- [ ] Verify the chosen production AI provider, key, model, and policy URL;
  replace `TODO_AI_PROVIDER_NAME` and `TODO_AI_PROVIDER_POLICY_URL` in
  `src/config/legal.ts` with the actual processor details. Then rerun `npm test`.
- [ ] Run the guarded `npm run build` with the selected project's HTTPS URL and
  publishable key. It fails if the wrong project or any unfinished legal field
  would be bundled into a release.
- [ ] Rotate any Razorpay credentials that were ever copied into source, chat,
  screenshots, or shell history. Use newly created test keys for staging and
  newly created live keys for production.
- [ ] Compare local migrations with the selected project, review each pending
  migration, then apply them. The last successful audit of this project found
  migrations `20260925090000` through `20260925140000` missing remotely;
  recheck that finding once access is restored.
- [ ] Fill an ignored `supabase/functions/.env` from `supabase/.env.example`
  and upload it with `supabase secrets set --env-file supabase/functions/.env`.
  The last successful audit of this project did not find `APP_ORIGINS`,
  `RAZORPAY_WEBHOOK_SECRET`, or `AUTOPAY_CRON_SECRET`; recheck the secret names
  once access is restored. Set `APP_ORIGINS` to the deployed origin.
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
  previous immutable frontend build. finish DNS and TLS setup for
  `www.reviyo.in` before launch.
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
