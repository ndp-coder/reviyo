/*
# Drop the superseded AI quota functions

check_ai_rate_limit and log_ai_generation were replaced by
claim_ai_generation (20260925140000), which checks and records the quota in
one transaction. Nothing calls them any more.

They are not just unused: log_ai_generation was still executable by anon and
authenticated with no limit. Anyone who opened a business's public review page
(and so held a session token) could call it repeatedly, filling
ai_generation_log and blocking AI drafting for that business for an hour.
Dropping both closes that.
*/

DROP FUNCTION IF EXISTS log_ai_generation(uuid);
DROP FUNCTION IF EXISTS check_ai_rate_limit(uuid);
