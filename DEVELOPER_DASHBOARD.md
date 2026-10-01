# Developer dashboard

Sign in with a profile whose role is `admin`, then open `/admin`.

- **Overview:** unique businesses with paid/trial access, recorded INR payment
  totals, account progress, AI drafts, website visits and records to inspect.
  Payment totals are before refunds, disputes, fees and commissions; they are
  not Razorpay settlement totals.
- **Businesses:** search by business name, slug, owner name or email; filter
  access and page through 20 results at a time. Pause/restore a review page
  with an explicit confirmation and reason. This does not cancel an owner's
  payment mandate or change their subscription.
- **Payments:** inspect the latest 50 orders and their Razorpay references.
  Search and status filters apply to those 50 records. The latest 20 failed,
  rejected or paused AutoPay mandates are shown separately.
- **Partners:** existing invitations, access controls, referrals, earnings,
  milestone bonuses and payout status remain available.
- **Activity:** latest 30 business-access changes with developer, reason and
  timestamp. Browser clients cannot insert, edit or delete these records.
- **Setup:** mail, payout and scheduler configuration indicators. These confirm
  saved settings, not successful delivery, transfers or a running scheduled job.

Use **Refresh dashboard** to reload all sections. A concurrent business-access
change rejects a stale action; refresh and review the current state before retrying.

The two migrations `20261001200000_developer_operations.sql` and
`20261001201000_developer_directory.sql` must be applied before deploying the
frontend. New RPCs check the caller's developer role in the database; ordinary
owners, partners and anonymous callers cannot use them. No new Edge Function
or secret is required for these dashboard additions. Existing invitation and
payout setup requirements are documented in `COMMISSION_SETUP.md`.
