# Private partner commissions

The developer dashboard at `/admin` retains its existing statistics and adds
partner invitations, access revocation, referrals, earnings and payout status.
Invited partners use `/partners`. There are no public navigation, pricing-page,
signup or sitemap links to the programme. Knowing the URL does not grant access:
database policies and server checks enforce the developer invitation.

## Rules

Partners can prepare a business from their private dashboard: owner email,
business name, category, Google review link, logo and topics. Saving registers
the referral automatically. Resends reuse the saved setup. The owner follows
the invitation to `/onboarding`, reviews or edits the details, explicitly
accepts the terms/privacy notice and creates their own business before payment.
Partners never receive owner login links or access to the owner's dashboard.
Completed setups cannot be changed by partners.

- Register the owner's signup email before their first payment. Emails are
  trimmed and matched without case. One owner can belong to only one partner;
  self referrals and already-paid owners are refused.
- Only the first ₹2,999 annual-plan payment qualifies. ₹1 mandate setup,
  six-month plans and renewals do not qualify.
- The 14-day hold starts when the scheduler first confirms that Razorpay has
  actually captured the money. Authorisation alone does not start the hold.
  With the recommended hourly schedule, this can add up to an hour to the wait.
- Every qualifying owner creates one ₹1,000 earning. At 10, 20, 30 and each
  further multiple of 10, that partner receives one additional ₹2,000 earning.
  Milestones are lifetime totals, not monthly targets.
- Refunds and disputes block qualification. Payments are checked again before
  the first transfer; a later refund pauses an unsubmitted earning for review.
  Already transferred money is not automatically debited back from partners.
- Partners save a bank account with account-holder name, IFSC and repeated
  account number. Raw bank details are sent directly from the server to
  RazorpayX, never saved in Reviyo's tables or logs. Reviyo stores the contact,
  fund-account reference and last four digits. Bank changes require developer
  support; no self-service changes can redirect an in-flight transfer.
- Revoking access removes the dashboard and pauses new transfers. Transfers
  already submitted to RazorpayX may still finish and are still reconciled.

## Enable in production

1. Apply `supabase/migrations/20261001120000_private_commissions.sql` to project
   `yagchgwgbttxfihlyddm`. Review the remote migration history before `db push`.
   Also apply `20261001160000_partner_business_setup.sql` for partner onboarding.
2. Deploy `commission-access` and `commission-scheduler` using their checked-in
   `supabase/config.toml` settings. The scheduler authenticates its shared secret;
   the access endpoint validates the signed-in user and developer role itself.
3. Configure these **Supabase Edge Function secrets** (never `VITE_` variables):
   - `RAZORPAYX_KEY_ID`, `RAZORPAYX_KEY_SECRET`: RazorpayX credentials.
   - `RAZORPAYX_ACCOUNT_NUMBER`: your source RazorpayX account/customer identifier.
   - `COMMISSION_CRON_SECRET`: a random value of at least 32 characters.
   - `COMMISSION_PAYOUTS_ENABLED`: leave disabled until setup and testing are done;
     set to `true` to enable automatic capture checks, earnings and transfers.
   - Existing payment-gateway `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`: these verify
     subscription payments/refunds/disputes; they are separate from X credentials.
   - `AUTH_EMAIL_INVITATIONS_ENABLED=true`: reuse the verified Hostinger SMTP
     configuration in Supabase Auth for partner and owner invitations. Returning
     accounts receive the configured sign-in email, with an OTP or sign-in link.
   - Alternatively, use `SMTP_PASSWORD` and, if needed, `SMTP_HOST`, `SMTP_PORT`,
     `SMTP_USER`, `EMAIL_FROM` for direct Hostinger invitation delivery. These
     Edge SMTP settings are still needed for payment receipts and billing emails.
4. Add `https://reviyo.in/partners` and `https://reviyo.in/onboarding` to Supabase Auth's redirect allowlist.
   Set the Auth Site URL to `https://reviyo.in` and its SMTP sender/user to
   `support@reviyo.in`. Saved Auth email templates live under `supabase/templates`;
   copy their updated links into the dashboard templates if configured there.
   Developer invitations are emailed as an expiring Supabase sign-in link.
   Returning partners can request the existing sign-in code from `/partners`.
5. Configure RazorpayX API access, its required IP allowlist and funding. Ensure
   your execution host has an outbound IP that RazorpayX will accept. If the
   Supabase plan cannot provide an accepted stable egress IP, run this scheduler
   behind a controlled static-egress host before enabling payouts. Do not disable
   RazorpayX's IP protection. If your payout approval policy requires approval,
   API-created transfers may wait for it; arrange the appropriate account policy.
6. In Supabase Vault create secrets named `commission_cron_secret` (same value
   as the Edge secret) and `commission_publishable_key` (this project's public
   API key). Run `supabase/commission-cron.sql` once to schedule hourly processing.
7. Exercise invitation, bank setup and payout/reconciliation with a separate
   staging Supabase project and RazorpayX test keys first, then enable production.
   Do not insert fake earned commissions in production.

## Transfer recovery

The earning UUID is the RazorpayX idempotency key. The exact payout request is
saved before submission and reused after network failures, including the source
account, destination and amount. Queued and processing payouts are checked every
hour; processed payouts continue to be checked for a later reversal.

Unknown submission results stop after six days, before RazorpayX's documented
seven-day idempotency expiry. `needs_attention`, failed, reversed and cancelled
transfers are shown to the developer; they never automatically create a new
transfer. Reconcile the original `reference_id` in RazorpayX before repair.
The automated scheduler processes up to 20 referral checks and 20 transfers per
run; oldest checks go first so invalid or bank-less records cannot starve others.
For larger volume increase the cron frequency and monitor function run time.

Official API references:
- https://razorpay.com/docs/api/x/payouts/
- https://razorpay.com/docs/api/x/payout-idempotency/
- https://razorpay.com/docs/api/x/fund-accounts/
- https://razorpay.com/docs/api/disputes/

## Verification

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
The database tests execute the actual migrations in PostgreSQL (PGlite), covering
access boundaries, referral ownership, self-referrals, payment timing, 10/20
bonuses, duplicate qualification, immutable payout requests, access revocation
and the expired retry window. Provider-boundary tests never send real money.
