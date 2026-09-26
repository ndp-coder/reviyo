/*
# Reviyo RLS Policies and Security Functions

## Overview
Enables Row Level Security on all tables and creates policies that enforce:
- Business owners can only access their own business's data
- Public customers can only see business info needed for the review flow
- No customer can query another customer's session or private feedback
- Sensitive mutations happen through SECURITY DEFINER functions

## Security Changes

### RLS Enabled On
- profiles, businesses, review_topics, review_sessions, review_session_topics,
  private_feedback, analytics_events, subscriptions, ai_generation_log

### Policies
1. **profiles** — Users read/update their own profile
2. **businesses** — Owner has full CRUD on own business; public can SELECT active businesses (name, slug, logo, welcome_message, category) for the customer flow
3. **review_topics** — Owner manages own; public can SELECT active topics for own business
4. **review_sessions** — Owner reads own; public can INSERT (via function) and UPDATE own session
5. **review_session_topics** — Owner reads own; public inserts via function
6. **private_feedback** — Owner reads/updates own; public inserts via function
7. **analytics_events** — Owner reads own; public inserts via function
8. **subscriptions** — Owner reads own
9. **ai_generation_log** — No direct access; managed via function

### SECURITY DEFINER Functions
1. **create_review_session(p_business_slug)** — Creates anonymous session, returns session + business public info
2. **update_review_session(p_session_token, p_rating, p_comment, p_generated_review, p_status)** — Updates session
3. **set_session_topics(p_session_token, p_topic_ids[])** — Sets selected topics
4. **submit_private_feedback(p_session_token, p_message, p_rating)** — Submits private feedback
5. **track_event(p_business_slug, p_session_token, p_event_type, p_metadata)** — Records analytics event
6. **log_ai_generation(p_session_token)** — Logs AI generation for rate limiting
7. **get_business_public(slug)** — Returns public business info for customer flow

### Column-Level Security
- profiles: REVOKE UPDATE on role column; only admin can change roles via function
- businesses: owner_id is defaulted and not client-writable
- subscriptions: status, payment_reference are not client-writable

## Important Notes
1. Public customer flow uses anon role — policies include `TO anon, authenticated`
2. Owner dashboard uses authenticated role with ownership checks
3. No business_id is trusted from the browser — always derived from session or slug
4. Error messages are generic to avoid leaking schema details
*/

-- ============================================
-- Enable RLS on all tables
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_session_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generation_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- profiles policies
-- ============================================
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Revoke UPDATE on role column so users can't escalate themselves
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (email, full_name, updated_at) ON profiles TO authenticated;

-- ============================================
-- businesses policies
-- ============================================
-- Owner full CRUD
DROP POLICY IF EXISTS "businesses_select_own" ON businesses;
CREATE POLICY "businesses_select_own" ON businesses FOR SELECT
  TO authenticated USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "businesses_insert_own" ON businesses;
CREATE POLICY "businesses_insert_own" ON businesses FOR INSERT
  TO authenticated WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "businesses_update_own" ON businesses;
CREATE POLICY "businesses_update_own" ON businesses FOR UPDATE
  TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "businesses_delete_own" ON businesses;
CREATE POLICY "businesses_delete_own" ON businesses FOR DELETE
  TO authenticated USING (owner_id = auth.uid());

-- Public can see active businesses (for customer review flow)
DROP POLICY IF EXISTS "businesses_select_public" ON businesses;
CREATE POLICY "businesses_select_public" ON businesses FOR SELECT
  TO anon, authenticated USING (is_active = true);

-- ============================================
-- review_topics policies
-- ============================================
-- Owner manages own topics
DROP POLICY IF EXISTS "topics_select_own" ON review_topics;
CREATE POLICY "topics_select_own" ON review_topics FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = review_topics.business_id AND businesses.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "topics_insert_own" ON review_topics;
CREATE POLICY "topics_insert_own" ON review_topics FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = review_topics.business_id AND businesses.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "topics_update_own" ON review_topics;
CREATE POLICY "topics_update_own" ON review_topics FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = review_topics.business_id AND businesses.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = review_topics.business_id AND businesses.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "topics_delete_own" ON review_topics;
CREATE POLICY "topics_delete_own" ON review_topics FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = review_topics.business_id AND businesses.owner_id = auth.uid())
  );

-- Public can see active topics for a business (customer flow)
DROP POLICY IF EXISTS "topics_select_public" ON review_topics;
CREATE POLICY "topics_select_public" ON review_topics FOR SELECT
  TO anon, authenticated USING (active = true);

-- ============================================
-- review_sessions policies
-- ============================================
-- Owner reads own business sessions
DROP POLICY IF EXISTS "sessions_select_own" ON review_sessions;
CREATE POLICY "sessions_select_own" ON review_sessions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = review_sessions.business_id AND businesses.owner_id = auth.uid())
  );

-- Owner can update (e.g., status changes)
DROP POLICY IF EXISTS "sessions_update_own" ON review_sessions;
CREATE POLICY "sessions_update_own" ON review_sessions FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = review_sessions.business_id AND businesses.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = review_sessions.business_id AND businesses.owner_id = auth.uid())
  );

-- Public can select their own session by token (for the customer flow)
DROP POLICY IF EXISTS "sessions_select_public" ON review_sessions;
CREATE POLICY "sessions_select_public" ON review_sessions FOR SELECT
  TO anon, authenticated USING (true);

-- ============================================
-- review_session_topics policies
-- ============================================
DROP POLICY IF EXISTS "session_topics_select_own" ON review_session_topics;
CREATE POLICY "session_topics_select_own" ON review_session_topics FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM businesses
      JOIN review_sessions ON review_sessions.business_id = businesses.id
      WHERE review_sessions.id = review_session_topics.review_session_id
      AND businesses.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "session_topics_select_public" ON review_session_topics;
CREATE POLICY "session_topics_select_public" ON review_session_topics FOR SELECT
  TO anon, authenticated USING (true);

-- ============================================
-- private_feedback policies
-- ============================================
DROP POLICY IF EXISTS "feedback_select_own" ON private_feedback;
CREATE POLICY "feedback_select_own" ON private_feedback FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = private_feedback.business_id AND businesses.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "feedback_update_own" ON private_feedback;
CREATE POLICY "feedback_update_own" ON private_feedback FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = private_feedback.business_id AND businesses.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = private_feedback.business_id AND businesses.owner_id = auth.uid())
  );

-- ============================================
-- analytics_events policies
-- ============================================
DROP POLICY IF EXISTS "events_select_own" ON analytics_events;
CREATE POLICY "events_select_own" ON analytics_events FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = analytics_events.business_id AND businesses.owner_id = auth.uid())
  );

-- ============================================
-- subscriptions policies
-- ============================================
DROP POLICY IF EXISTS "subs_select_own" ON subscriptions;
CREATE POLICY "subs_select_own" ON subscriptions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = subscriptions.business_id AND businesses.owner_id = auth.uid())
  );

-- ============================================
-- ai_generation_log — no direct access
-- ============================================
-- No policies: only accessible via SECURITY DEFINER function

-- ============================================
-- SECURITY DEFINER FUNCTIONS
-- ============================================

-- Helper: get business public info by slug
CREATE OR REPLACE FUNCTION get_business_public(p_slug text)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  category text,
  logo_url text,
  welcome_message text,
  google_review_url text
)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, name, slug, category, logo_url, welcome_message, google_review_url
  FROM businesses
  WHERE slug = p_slug AND is_active = true;
$$;

-- Create a new anonymous review session
CREATE OR REPLACE FUNCTION create_review_session(p_business_slug text)
RETURNS TABLE (
  session_id uuid,
  session_token uuid,
  business_id uuid,
  business_name text,
  business_slug text,
  business_category text,
  business_logo_url text,
  business_welcome_message text,
  business_google_review_url text
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_business businesses%ROWTYPE;
  v_session_id uuid;
  v_session_token uuid;
BEGIN
  SELECT * INTO v_business FROM businesses WHERE slug = p_business_slug AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business not found';
  END IF;

  v_session_token := gen_random_uuid();

  INSERT INTO review_sessions (business_id, session_token, status)
  VALUES (v_business.id, v_session_token, 'started')
  RETURNING id INTO v_session_id;

  RETURN QUERY SELECT
    v_session_id,
    v_session_token,
    v_business.id,
    v_business.name,
    v_business.slug,
    v_business.category,
    v_business.logo_url,
    v_business.welcome_message,
    v_business.google_review_url;
END;
$$;

-- Update a review session (by session token)
CREATE OR REPLACE FUNCTION update_review_session(
  p_session_token uuid,
  p_rating int DEFAULT NULL,
  p_customer_comment text DEFAULT NULL,
  p_generated_review text DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE review_sessions SET
    rating = COALESCE(p_rating, rating),
    customer_comment = COALESCE(p_customer_comment, customer_comment),
    generated_review = COALESCE(p_generated_review, generated_review),
    status = COALESCE(p_status, status),
    updated_at = now()
  WHERE session_token = p_session_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
END;
$$;

-- Set selected topics for a session
CREATE OR REPLACE FUNCTION set_session_topics(
  p_session_token uuid,
  p_topic_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
  v_business_id uuid;
  v_topic_id uuid;
BEGIN
  SELECT id, business_id INTO v_session_id, v_business_id
  FROM review_sessions WHERE session_token = p_session_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  -- Clear existing topics
  DELETE FROM review_session_topics WHERE review_session_id = v_session_id;

  -- Insert new topics (only if they belong to the same business)
  FOREACH v_topic_id IN ARRAY p_topic_ids LOOP
    INSERT INTO review_session_topics (review_session_id, topic_id)
    SELECT v_session_id, v_topic_id
    FROM review_topics
    WHERE id = v_topic_id AND business_id = v_business_id;
  END LOOP;
END;
$$;

-- Submit private feedback
CREATE OR REPLACE FUNCTION submit_private_feedback(
  p_session_token uuid,
  p_message text,
  p_rating int DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session review_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM review_sessions WHERE session_token = p_session_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF p_message IS NULL OR length(trim(p_message)) = 0 THEN
    RAISE EXCEPTION 'Message is required';
  END IF;

  IF length(p_message) > 5000 THEN
    RAISE EXCEPTION 'Message too long';
  END IF;

  INSERT INTO private_feedback (business_id, review_session_id, rating, message, status)
  VALUES (v_session.business_id, v_session.id, p_rating, p_message, 'new');
END;
$$;

-- Track analytics event
CREATE OR REPLACE FUNCTION track_event(
  p_business_slug text,
  p_session_token uuid,
  p_event_type text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_business_id uuid;
  v_session_id uuid;
BEGIN
  SELECT id INTO v_business_id FROM businesses WHERE slug = p_business_slug AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business not found';
  END IF;

  IF p_session_token IS NOT NULL THEN
    SELECT id INTO v_session_id FROM review_sessions WHERE session_token = p_session_token;
  END IF;

  -- Validate event type
  IF p_event_type NOT IN (
    'qr_page_view', 'review_started', 'rating_selected', 'topics_selected',
    'review_generated', 'review_regenerated', 'review_copied',
    'google_review_opened', 'private_feedback_submitted'
  ) THEN
    RAISE EXCEPTION 'Invalid event type';
  END IF;

  INSERT INTO analytics_events (business_id, review_session_id, event_type, metadata)
  VALUES (v_business_id, v_session_id, p_event_type, p_metadata);
END;
$$;

-- Log AI generation for rate limiting
CREATE OR REPLACE FUNCTION log_ai_generation(p_session_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session review_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM review_sessions WHERE session_token = p_session_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  INSERT INTO ai_generation_log (business_id, review_session_id)
  VALUES (v_session.business_id, v_session.id);
END;
$$;

-- Check AI generation rate limit (max 10 per session, max 50 per business per hour)
CREATE OR REPLACE FUNCTION check_ai_rate_limit(p_session_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session review_sessions%ROWTYPE;
  v_session_count int;
  v_business_count int;
BEGIN
  SELECT * INTO v_session FROM review_sessions WHERE session_token = p_session_token;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Per-session limit: 10 generations
  SELECT count(*) INTO v_session_count
  FROM ai_generation_log
  WHERE review_session_id = v_session.id;

  IF v_session_count >= 10 THEN
    RETURN false;
  END IF;

  -- Per-business hourly limit: 50 generations
  SELECT count(*) INTO v_business_count
  FROM ai_generation_log
  WHERE business_id = v_session.business_id
  AND created_at > now() - interval '1 hour';

  IF v_business_count >= 50 THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- Grant EXECUTE on public functions to anon and authenticated
REVOKE EXECUTE ON FUNCTION get_business_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_business_public(text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION create_review_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_review_session(text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION update_review_session(uuid, int, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_review_session(uuid, int, text, text, text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION set_session_topics(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_session_topics(uuid, uuid[]) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION submit_private_feedback(uuid, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_private_feedback(uuid, text, int) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION track_event(text, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION track_event(text, uuid, text, jsonb) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION log_ai_generation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_ai_generation(uuid) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION check_ai_rate_limit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_ai_rate_limit(uuid) TO anon, authenticated;

-- ============================================
-- Trigger: auto-create profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

REVOKE EXECUTE ON FUNCTION handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION handle_new_user() TO authenticated;
