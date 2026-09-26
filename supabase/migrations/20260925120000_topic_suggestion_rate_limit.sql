/*
# Rate limit for AI review-topic suggestions

The `suggest-topics` Edge Function calls a paid AI provider on behalf of a
signed-in owner (during onboarding, and later from Settings). This caps it per
account so one account cannot run up the AI bill.

- 10 suggestions per rolling hour, 30 per rolling day, per user.
- Rows hold only the user id and a timestamp, and are deleted after a day by
  the check itself. They are also removed with the account (ON DELETE CASCADE).
- Only the service role may call the check, from the Edge Function.
*/

CREATE TABLE IF NOT EXISTS ai_topic_suggestion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_topic_suggestion_log_user_created
  ON ai_topic_suggestion_log(user_id, created_at);

-- No policies: clients can neither read nor write this table.
ALTER TABLE ai_topic_suggestion_log ENABLE ROW LEVEL SECURITY;

-- Returns true and records the attempt when the user is under the limit.
CREATE OR REPLACE FUNCTION claim_topic_suggestion(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_last_hour int;
  v_last_day int;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  -- Serialise concurrent requests from the same user so the limit is exact.
  PERFORM pg_advisory_xact_lock(hashtext('claim_topic_suggestion:' || p_user_id::text));

  DELETE FROM ai_topic_suggestion_log
  WHERE user_id = p_user_id AND created_at < now() - interval '1 day';

  SELECT
    count(*) FILTER (WHERE created_at > now() - interval '1 hour'),
    count(*)
  INTO v_last_hour, v_last_day
  FROM ai_topic_suggestion_log
  WHERE user_id = p_user_id;

  IF v_last_hour >= 10 OR v_last_day >= 30 THEN
    RETURN false;
  END IF;

  INSERT INTO ai_topic_suggestion_log (user_id) VALUES (p_user_id);
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION claim_topic_suggestion(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_topic_suggestion(uuid) TO service_role;
