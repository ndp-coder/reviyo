/*
  Security and onboarding hardening for independently provisioned projects.

  - Removes public table reads that exposed anonymous review-session data.
  - Keeps public customer writes behind bearer-token RPC functions.
  - Creates a business, topics, and trial subscription in one transaction.
  - Gives application admins read access to the data used by the admin dashboard.
*/

-- The public customer flow uses create_review_session and other RPCs. It never
-- needs direct access to business or review-session rows.
DROP POLICY IF EXISTS "businesses_select_public" ON businesses;
DROP POLICY IF EXISTS "sessions_select_public" ON review_sessions;
DROP POLICY IF EXISTS "session_topics_select_public" ON review_session_topics;

-- The UI assumes one business per account.
CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_owner_unique ON businesses(owner_id);

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

DROP POLICY IF EXISTS "profiles_select_admin" ON profiles;
CREATE POLICY "profiles_select_admin" ON profiles FOR SELECT
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "businesses_select_admin" ON businesses;
CREATE POLICY "businesses_select_admin" ON businesses FOR SELECT
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "subscriptions_select_admin" ON subscriptions;
CREATE POLICY "subscriptions_select_admin" ON subscriptions FOR SELECT
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "ai_generation_log_select_admin" ON ai_generation_log;
CREATE POLICY "ai_generation_log_select_admin" ON ai_generation_log FOR SELECT
  TO authenticated USING (is_admin());

CREATE OR REPLACE FUNCTION create_business_with_defaults(
  p_name text,
  p_slug text,
  p_category text,
  p_google_review_url text DEFAULT NULL,
  p_logo_url text DEFAULT NULL,
  p_welcome_message text DEFAULT NULL,
  p_topics text[] DEFAULT ARRAY[]::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid := auth.uid();
  v_business businesses%ROWTYPE;
  v_slug text := lower(trim(p_slug));
  v_topic text;
  v_topic_index int;
  v_seen_topics text[] := ARRAY[]::text[];
BEGIN
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF EXISTS (SELECT 1 FROM businesses WHERE owner_id = v_owner_id) THEN
    RAISE EXCEPTION 'A business already exists for this account';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 OR length(trim(p_name)) > 200 THEN
    RAISE EXCEPTION 'Business name must be between 1 and 200 characters';
  END IF;

  IF p_category IS NULL OR length(trim(p_category)) = 0 OR length(trim(p_category)) > 100 THEN
    RAISE EXCEPTION 'Business category must be between 1 and 100 characters';
  END IF;

  IF cardinality(p_topics) = 0 OR cardinality(p_topics) > 20 THEN
    RAISE EXCEPTION 'Choose between 1 and 20 review topics';
  END IF;

  IF v_slug IS NULL OR v_slug = '' OR v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    v_slug := 'business-' || left(replace(gen_random_uuid()::text, '-', ''), 8);
  END IF;

  WHILE EXISTS (SELECT 1 FROM businesses WHERE slug = v_slug) LOOP
    v_slug := left(v_slug, 240) || '-' || left(replace(gen_random_uuid()::text, '-', ''), 8);
  END LOOP;

  INSERT INTO businesses (
    owner_id,
    name,
    slug,
    category,
    google_review_url,
    logo_url,
    welcome_message
  )
  VALUES (
    v_owner_id,
    trim(p_name),
    v_slug,
    trim(p_category),
    nullif(trim(p_google_review_url), ''),
    nullif(trim(p_logo_url), ''),
    nullif(trim(p_welcome_message), '')
  )
  RETURNING * INTO v_business;

  FOR v_topic_index IN 1..cardinality(p_topics) LOOP
    v_topic := trim(p_topics[v_topic_index]);

    IF length(v_topic) = 0 OR length(v_topic) > 80 THEN
      RAISE EXCEPTION 'Each review topic must be between 1 and 80 characters';
    END IF;

    IF lower(v_topic) = ANY(v_seen_topics) THEN
      CONTINUE;
    END IF;

    v_seen_topics := array_append(v_seen_topics, lower(v_topic));
    INSERT INTO review_topics (business_id, label, display_order, active)
    VALUES (v_business.id, v_topic, v_topic_index - 1, true);
  END LOOP;

  INSERT INTO subscriptions (business_id, plan, status, starts_at, expires_at)
  VALUES (
    v_business.id,
    '6_months',
    'trial',
    now(),
    now() + interval '14 days'
  );

  RETURN to_jsonb(v_business);
END;
$$;

REVOKE EXECUTE ON FUNCTION create_business_with_defaults(text, text, text, text, text, text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_business_with_defaults(text, text, text, text, text, text, text[]) TO authenticated;

-- A supplied session token must belong to the same business as the slug. This
-- prevents cross-business analytics rows with mismatched foreign keys.
CREATE OR REPLACE FUNCTION track_event(
  p_business_slug text,
  p_session_token uuid,
  p_event_type text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid;
  v_session_id uuid;
BEGIN
  SELECT id INTO v_business_id
  FROM businesses
  WHERE slug = p_business_slug AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business not found';
  END IF;

  IF p_session_token IS NOT NULL THEN
    SELECT id INTO v_session_id
    FROM review_sessions
    WHERE session_token = p_session_token
      AND business_id = v_business_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Session not found';
    END IF;
  END IF;

  IF p_event_type NOT IN (
    'qr_page_view', 'review_started', 'rating_selected', 'topics_selected',
    'review_generated', 'review_regenerated', 'review_copied',
    'google_review_opened', 'private_feedback_submitted'
  ) THEN
    RAISE EXCEPTION 'Invalid event type';
  END IF;

  INSERT INTO analytics_events (business_id, review_session_id, event_type, metadata)
  VALUES (v_business_id, v_session_id, p_event_type, coalesce(p_metadata, '{}'::jsonb));
END;
$$;

REVOKE EXECUTE ON FUNCTION track_event(text, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION track_event(text, uuid, text, jsonb) TO anon, authenticated;
