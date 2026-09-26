/*
# Atomic AI generation quota

The old Edge Function checked the quota and logged a generation in two
separate transactions. Parallel requests could all pass the check before any
of them wrote a row, allowing unbounded provider spend.

This function serializes claims per business, so concurrent sessions cannot
exceed the shared hourly limit. It checks both limits and records the attempt
in the same transaction.
*/

CREATE OR REPLACE FUNCTION claim_ai_generation(p_session_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session review_sessions%ROWTYPE;
  v_session_count integer;
  v_business_count integer;
BEGIN
  IF p_session_token IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_session
  FROM review_sessions
  WHERE session_token = p_session_token;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Every session for this business claims against the same lock. Locking
  -- only the session token would still let 51 different sessions race past
  -- the business-wide hourly cap of 50.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_session.business_id::text, 0));

  SELECT count(*) INTO v_session_count
  FROM ai_generation_log
  WHERE review_session_id = v_session.id;

  IF v_session_count >= 10 THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO v_business_count
  FROM ai_generation_log
  WHERE business_id = v_session.business_id
    AND created_at > now() - interval '1 hour';

  IF v_business_count >= 50 THEN
    RETURN false;
  END IF;

  INSERT INTO ai_generation_log (business_id, review_session_id)
  VALUES (v_session.business_id, v_session.id);

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION claim_ai_generation(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_ai_generation(uuid) TO service_role;
