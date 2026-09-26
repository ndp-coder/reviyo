/*
# Enforce the subscription

## Why

Until now the subscription was only displayed on the Billing page. When a
trial or paid plan ended, the QR review page, AI review drafting, and the
owner dashboard all kept working, so the product was free indefinitely.

## What changes

A business has access while it has a `trial` or `active` subscription whose
`expires_at` is still in the future. Without access:

1. **QR review page** — `create_review_session` refuses to start a session, and
   the page shows its existing "not available" message.
2. **AI review drafting** — the `generate-review` Edge Function checks
   `business_has_active_subscription` with the service role and refuses.
3. **Dashboard data** — restrictive RLS policies hide review sessions, private
   feedback, and analytics from the owner. The dashboard UI also redirects to
   Billing. Billing, subscriptions, payment orders, the business profile, and
   `export_my_data()` stay reachable so the owner can renew, and can still
   exercise their right of access and erasure.

Access returns the moment a payment is fulfilled, because
`activate_or_renew_subscription` sets a new future `expires_at`.
*/

CREATE OR REPLACE FUNCTION business_has_active_subscription(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM subscriptions
    WHERE business_id = p_business_id
      AND status IN ('trial', 'active')
      AND expires_at > now()
  );
$$;

-- `authenticated` needs EXECUTE because the RLS policies below call it as the
-- signed-in owner. It only reveals a yes/no for a business id the caller must
-- already know. Anonymous visitors never need it.
REVOKE EXECUTE ON FUNCTION business_has_active_subscription(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION business_has_active_subscription(uuid) TO authenticated, service_role;

-- ============================================
-- 1. QR review page: no new sessions without a subscription
-- ============================================
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
  -- Same generic error for "no such business" and "subscription ended", so the
  -- public page does not reveal a business's billing state.
  IF NOT FOUND OR NOT business_has_active_subscription(v_business.id) THEN
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

REVOKE EXECUTE ON FUNCTION create_review_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_review_session(text) TO anon, authenticated;

-- ============================================
-- 2. Dashboard data: hidden from the owner without a subscription
-- ============================================
-- RESTRICTIVE policies are ANDed with the existing owner/admin policies, so
-- they can only narrow access. Admins keep full visibility for support.

DROP POLICY IF EXISTS "sessions_require_subscription" ON review_sessions;
CREATE POLICY "sessions_require_subscription" ON review_sessions
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (is_admin() OR business_has_active_subscription(business_id));

DROP POLICY IF EXISTS "session_topics_require_subscription" ON review_session_topics;
CREATE POLICY "session_topics_require_subscription" ON review_session_topics
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM review_sessions rs
      WHERE rs.id = review_session_topics.review_session_id
        AND business_has_active_subscription(rs.business_id)
    )
  );

DROP POLICY IF EXISTS "feedback_require_subscription" ON private_feedback;
CREATE POLICY "feedback_require_subscription" ON private_feedback
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (is_admin() OR business_has_active_subscription(business_id));

DROP POLICY IF EXISTS "events_require_subscription" ON analytics_events;
CREATE POLICY "events_require_subscription" ON analytics_events
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (is_admin() OR business_has_active_subscription(business_id));
