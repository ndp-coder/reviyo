# Paid plans from 22 October 2026

New monthly purchases and mandates use ₹499 (49,900 paise). The other terms
and partner commission rules are unchanged. New owners use the existing
one-time Razorpay checkout and receive access only after payment confirmation.
AutoPay remains an optional renewal setup; its refundable ₹1 check does not
create access.

Migration `20261022120000_paid_plans_without_trials.sql` blocks new trial
subscriptions and retains the server-only authorisation RPC for older browser
and webhook retries. Existing trials, paid terms, orders and mandate amounts
are preserved. Billing and renewal notices display the actual mandate amount.

Deploy the migration and `create-razorpay-order` plus
`create-autopay-mandate` (including `_shared/autopay.ts`) before the frontend.
The source migration is recorded in Supabase migration history when applied
through the SQL editor. No credentials are stored in source.

Check typecheck, lint, tests and build. Database tests cover no trial on
mandate authorisation, payment activation and retries, legacy trial renewals,
existing mandate amounts and zero monthly commissions. The recorded partner
class retains its historical narration; its current price panel and checkout
are authoritative. Homepage images and Telugu walkthrough remain in place.
