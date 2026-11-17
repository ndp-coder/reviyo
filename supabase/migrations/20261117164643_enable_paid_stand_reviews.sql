-- A paid stand can open the customer review flow during fulfillment.
-- Billing and dashboard access still use the recorded subscription dates.
CREATE FUNCTION business_accepts_public_reviews(p_business_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM businesses b
    WHERE b.id = p_business_id AND b.is_active AND (
      business_has_active_subscription(b.id) OR EXISTS (
        SELECT 1
        FROM admin_business_setups s
        JOIN admin_qr_deliveries d ON d.setup_id = s.id
        JOIN payment_orders o ON o.business_id = s.business_id
        WHERE s.business_id = b.id AND d.delivered_on IS NULL AND o.status = 'paid'
      )
    )
  );
$$;

REVOKE ALL ON FUNCTION business_accepts_public_reviews(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION business_accepts_public_reviews(uuid) TO service_role;

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
  IF NOT FOUND OR NOT business_accepts_public_reviews(v_business.id) THEN
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

CREATE OR REPLACE FUNCTION get_lapsed_business_review_link(p_business_slug text)
RETURNS TABLE (
  business_name text,
  business_logo_url text,
  business_google_review_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.name, b.logo_url, b.google_review_url
  FROM businesses b
  WHERE b.slug = p_business_slug
    AND b.is_active = true
    AND b.google_review_url IS NOT NULL
    AND NOT business_accepts_public_reviews(b.id);
$$;
