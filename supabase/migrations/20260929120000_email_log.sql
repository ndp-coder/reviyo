/*
# Owner emails are sent exactly once

Payment receipts, AutoPay renewal notices, failed-payment notices, and
plan-ending reminders are sent from support@reviyo.in by the Edge Functions
(supabase/functions/_shared/email.ts). The same payment can be reported by the
browser, the Razorpay webhook, and the scheduler, so each email is claimed
here first: the insert succeeds for exactly one of them.

`ref` identifies what the email is about (a Razorpay order id, or a
subscription id and its end date). If sending fails the row is deleted, so a
later run can try again.

Server-only: browsers have no access to this table or its rows.
*/

CREATE TABLE IF NOT EXISTS email_log (
  kind text NOT NULL CHECK (kind IN ('receipt', 'renewal_notice', 'payment_failed', 'plan_ending')),
  ref text NOT NULL CHECK (char_length(ref) BETWEEN 1 AND 200),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, ref)
);

ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON email_log FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON email_log TO service_role;
