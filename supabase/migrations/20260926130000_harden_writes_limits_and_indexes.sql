/*
# Harden direct writes, public RPC limits, and indexes

## 1. Owners write only what the app needs
Supabase grants every table to the API roles; RLS then decides which rows.
That left owners able to write columns and rows no feature uses:
- `businesses`: changing `slug` (every printed QR code silently breaks) or
  `is_active`; inserting a business outside `create_business_with_defaults`;
  and deleting the row directly, which cascades away payment records that
  `preserve_financial_records_for_erasure` must copy out first (account
  deletion goes through the delete-account Edge Function instead).
- `private_feedback`: editing a customer's message (only `status` changes).
- `review_sessions`: rewriting customers' ratings (no feature updates them).
All legitimate writes happen through SECURITY DEFINER functions or the
service role, which these grants do not affect.

## 2. Limits on the anonymous review-page functions
Anyone can open a public review page, so its functions are callable by anyone:
- `track_event` needs a session from the same business, caps metadata at 4 KB,
  counts at most one page view per session, and allows 100 events per session.
  Before, only a public slug was needed, with no size or count limit — enough
  to fake scans or bloat the table.
- `submit_private_feedback` allows three messages per session (inbox spam).
- `update_review_session` caps comment and draft length.

## 3. Constraints and indexes
Length limits matching the app, a size limit on inline logos, indexes for the
dashboard, quota, and 90-day purge queries, and three duplicate indexes removed.
*/

-- ============================================
-- 1. Table privileges
-- ============================================

-- businesses: profile fields only; creation and deletion go through the server.
REVOKE INSERT, UPDATE, DELETE ON businesses FROM anon, authenticated;
GRANT UPDATE (name, category, google_review_url, logo_url, welcome_message, updated_at)
  ON businesses TO authenticated;
DROP POLICY IF EXISTS "businesses_insert_own" ON businesses;
DROP POLICY IF EXISTS "businesses_delete_own" ON businesses;

-- private_feedback: owners mark messages new / seen / resolved, nothing else.
REVOKE INSERT, UPDATE, DELETE ON private_feedback FROM anon, authenticated;
GRANT UPDATE (status) ON private_feedback TO authenticated;

-- review_sessions: written only by the session RPCs.
REVOKE INSERT, UPDATE, DELETE ON review_sessions FROM anon, authenticated;
DROP POLICY IF EXISTS "sessions_update_own" ON review_sessions;

-- profiles: the name is editable; the email mirrors the sign-in address.
REVOKE INSERT, UPDATE, DELETE ON profiles FROM anon, authenticated;
GRANT UPDATE (full_name, updated_at) ON profiles TO authenticated;

-- Tables with no client write path at all. RLS already has no write policies
-- here; revoking the privilege as well means a future policy mistake cannot
-- open them up.
REVOKE INSERT, UPDATE, DELETE ON review_session_topics FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON analytics_events FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON subscriptions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON payment_orders FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON autopay_mandates FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON ai_generation_log FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON ai_topic_suggestion_log FROM anon, authenticated;
REVOKE ALL ON retained_financial_records FROM anon, authenticated;

-- ============================================
-- 2. Public review-page functions
-- ============================================

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
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_session_events int;
BEGIN
  IF p_event_type NOT IN (
    'qr_page_view', 'review_started', 'rating_selected', 'topics_selected',
    'review_generated', 'review_regenerated', 'review_copied',
    'google_review_opened', 'private_feedback_submitted'
  ) THEN
    RAISE EXCEPTION 'Invalid event type';
  END IF;

  IF jsonb_typeof(v_metadata) <> 'object' OR octet_length(v_metadata::text) > 4096 THEN
    RAISE EXCEPTION 'Invalid event metadata';
  END IF;

  SELECT id INTO v_business_id
  FROM businesses
  WHERE slug = p_business_slug AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business not found';
  END IF;

  -- Every event belongs to a review session of this business. The review page
  -- always has one; requiring it stops events being made up from a slug alone.
  SELECT id INTO v_session_id
  FROM review_sessions
  WHERE session_token = p_session_token
    AND business_id = v_business_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  -- One page view per visit, so scans cannot be inflated by repeating the call.
  IF p_event_type = 'qr_page_view' AND EXISTS (
    SELECT 1 FROM analytics_events
    WHERE review_session_id = v_session_id AND event_type = 'qr_page_view'
  ) THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_session_events
  FROM analytics_events
  WHERE review_session_id = v_session_id;
  IF v_session_events >= 100 THEN
    RAISE EXCEPTION 'Too many events for this session';
  END IF;

  INSERT INTO analytics_events (business_id, review_session_id, event_type, metadata)
  VALUES (v_business_id, v_session_id, p_event_type, v_metadata);
END;
$$;

REVOKE EXECUTE ON FUNCTION track_event(text, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION track_event(text, uuid, text, jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION submit_private_feedback(
  p_session_token uuid,
  p_message text,
  p_rating int DEFAULT NULL,
  p_consent_version text DEFAULT NULL
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

  IF p_consent_version IS NOT NULL AND length(p_consent_version) > 64 THEN
    RAISE EXCEPTION 'Consent version is invalid';
  END IF;

  -- A visit sends one message, occasionally a follow-up; more is spam.
  IF (SELECT count(*) FROM private_feedback WHERE review_session_id = v_session.id) >= 3 THEN
    RAISE EXCEPTION 'Too many messages for this session';
  END IF;

  INSERT INTO private_feedback (
    business_id, review_session_id, rating, message, status,
    consent_version, consented_at
  )
  VALUES (
    v_session.business_id, v_session.id, p_rating, p_message, 'new',
    COALESCE(p_consent_version, v_session.consent_version),
    now()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION submit_private_feedback(uuid, text, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_private_feedback(uuid, text, int, text) TO anon, authenticated;

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
  -- Same limits as the review page and the AI function.
  IF length(p_customer_comment) > 2000 THEN
    RAISE EXCEPTION 'Comment too long';
  END IF;
  IF length(p_generated_review) > 5000 THEN
    RAISE EXCEPTION 'Review too long';
  END IF;

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

REVOKE EXECUTE ON FUNCTION update_review_session(uuid, int, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_review_session(uuid, int, text, text, text) TO anon, authenticated;

-- ============================================
-- 3. Constraints
-- ============================================
-- NOT VALID: enforced for every new or changed row, without failing the
-- migration over any existing row that predates the limit.

ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_name_length;
ALTER TABLE businesses
  ADD CONSTRAINT businesses_name_length CHECK (char_length(name) BETWEEN 1 AND 200) NOT VALID;

ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_category_length;
ALTER TABLE businesses
  ADD CONSTRAINT businesses_category_length CHECK (char_length(category) BETWEEN 1 AND 100) NOT VALID;

ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_welcome_message_length;
ALTER TABLE businesses
  ADD CONSTRAINT businesses_welcome_message_length CHECK (char_length(welcome_message) <= 500) NOT VALID;

-- Logos are resized to 256px in the browser (a few tens of KB). The cap keeps
-- a hand-crafted multi-megabyte data URL off every customer's scan.
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_logo_url_size;
ALTER TABLE businesses
  ADD CONSTRAINT businesses_logo_url_size CHECK (octet_length(logo_url) <= 500000) NOT VALID;

ALTER TABLE review_topics DROP CONSTRAINT IF EXISTS review_topics_label_length;
ALTER TABLE review_topics
  ADD CONSTRAINT review_topics_label_length CHECK (char_length(trim(label)) BETWEEN 1 AND 80) NOT VALID;

-- ============================================
-- 4. Indexes
-- ============================================

-- Dashboard counts filter by business, event type, and date.
CREATE INDEX IF NOT EXISTS idx_analytics_events_business_type_created
  ON analytics_events (business_id, event_type, created_at);
-- Per-session limits above, and the ON DELETE SET NULL run for every review
-- session the 90-day purge removes (without it, each one scans the table).
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events (review_session_id);
CREATE INDEX IF NOT EXISTS idx_private_feedback_session ON private_feedback (review_session_id);
-- claim_ai_generation counts a business's drafts in the last hour.
CREATE INDEX IF NOT EXISTS idx_ai_gen_log_business_created ON ai_generation_log (business_id, created_at);
-- Dashboard lists, newest first.
CREATE INDEX IF NOT EXISTS idx_review_sessions_business_created ON review_sessions (business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_private_feedback_business_created ON private_feedback (business_id, created_at);
-- Deleting a topic cascades to review_session_topics by topic_id.
CREATE INDEX IF NOT EXISTS idx_review_session_topics_topic ON review_session_topics (topic_id);

-- Duplicates: the UNIQUE constraints already index these columns, and the
-- composite indexes above start with business_id.
DROP INDEX IF EXISTS idx_businesses_slug;
DROP INDEX IF EXISTS idx_businesses_owner;
DROP INDEX IF EXISTS idx_review_sessions_token;
DROP INDEX IF EXISTS idx_analytics_events_business;
DROP INDEX IF EXISTS idx_ai_gen_log_business;
