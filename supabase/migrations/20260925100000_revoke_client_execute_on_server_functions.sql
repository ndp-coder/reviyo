/*
# Close client access to server-only functions

## Why

On Supabase, every function created in `public` receives EXECUTE grants for
`anon`, `authenticated`, and `service_role` through the schema's default
privileges. Those are direct grants to each role, so `REVOKE ... FROM PUBLIC`
does not remove them.

Earlier migrations only revoked from PUBLIC on the functions below, which left
them callable by anyone holding the public anon key via `/rest/v1/rpc/...`:

- `activate_or_renew_subscription` — any visitor could grant any business a
  paid 12-month subscription without paying.
- `process_paid_order` — any owner could create an order and then mark it paid
  with an invented payment id.
- `purge_expired_personal_data` — any visitor could delete every tenant's
  review sessions, feedback, and analytics older than one day.
- `preserve_financial_records_for_erasure` — any visitor could copy another
  owner's email and payment trail into the retained records table.

These must only ever run through the service role from Edge Functions or a
scheduled job.
*/

REVOKE EXECUTE ON FUNCTION activate_or_renew_subscription(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION activate_or_renew_subscription(uuid, text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION process_paid_order(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION process_paid_order(text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION purge_expired_personal_data(int, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION purge_expired_personal_data(int, int, int) TO service_role;

REVOKE EXECUTE ON FUNCTION preserve_financial_records_for_erasure(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION preserve_financial_records_for_erasure(uuid) TO service_role;

-- Functions meant for signed-in owners only. Each already rejects a missing
-- auth.uid(), but anonymous visitors have no reason to reach them at all.
REVOKE EXECUTE ON FUNCTION create_business_with_defaults(text, text, text, text, text, text, text[]) FROM anon;
REVOKE EXECUTE ON FUNCTION export_my_data() FROM anon;
REVOKE EXECUTE ON FUNCTION is_admin() FROM anon;

-- Stop repeating this mistake: new functions in `public` start with no client
-- access, so each migration must GRANT explicitly (as every existing one does).
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
