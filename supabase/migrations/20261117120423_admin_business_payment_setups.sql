CREATE TABLE admin_business_setups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  google_review_url text,
  logo_url text,
  topics text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  business_id uuid UNIQUE REFERENCES businesses(id) ON DELETE CASCADE
);
ALTER TABLE admin_business_setups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON admin_business_setups FROM PUBLIC, anon, authenticated;
GRANT SELECT ON admin_business_setups TO authenticated;
GRANT ALL ON admin_business_setups TO service_role;
CREATE POLICY admin_business_setups_read ON admin_business_setups FOR SELECT TO authenticated USING (is_admin());

CREATE FUNCTION save_admin_business_setup(p_email text, p_name text, p_category text, p_google_review_url text, p_logo_url text, p_topics text[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text := lower(btrim(p_email));
  v_id uuid;
BEGIN
  IF NOT coalesce(is_admin(), false) THEN RAISE EXCEPTION 'Developer access required'; END IF;
  IF v_email IS NULL OR length(v_email) > 254 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Enter a valid owner email';
  END IF;
  IF p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 200 OR p_category IS NULL OR length(btrim(p_category)) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Enter a business name and category';
  END IF;
  IF p_topics IS NULL OR cardinality(p_topics) NOT BETWEEN 1 AND 20 OR EXISTS (
    SELECT 1 FROM unnest(p_topics) AS t(topic) WHERE topic IS NULL OR length(btrim(topic)) NOT BETWEEN 1 AND 80
  ) THEN RAISE EXCEPTION 'Add 1 to 20 topics of 1 to 80 characters each'; END IF;
  IF nullif(btrim(p_google_review_url), '') IS NOT NULL AND (length(p_google_review_url) > 2048 OR btrim(p_google_review_url) !~ '^https://(search\.google\.com|www\.google\.com|maps\.google\.com|maps\.app\.goo\.gl|g\.page|goo\.gl)/') THEN
    RAISE EXCEPTION 'Enter a valid HTTPS Google review link';
  END IF;
  IF nullif(p_logo_url, '') IS NOT NULL AND (length(p_logo_url) > 500000 OR p_logo_url !~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$') THEN
    RAISE EXCEPTION 'Upload a supported logo';
  END IF;
  IF EXISTS (
    SELECT 1 FROM auth.users u LEFT JOIN profiles p ON p.id = u.id
    LEFT JOIN businesses b ON b.owner_id = u.id
    WHERE lower(btrim(u.email)) = v_email AND (b.id IS NOT NULL OR p.role = 'admin')
  ) THEN RAISE EXCEPTION 'Use the email of an owner who has not set up a business'; END IF;

  INSERT INTO admin_business_setups(email, name, category, google_review_url, logo_url, topics)
  VALUES(v_email, btrim(p_name), btrim(p_category), nullif(btrim(p_google_review_url), ''), nullif(p_logo_url, ''), p_topics)
  ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category,
    google_review_url = EXCLUDED.google_review_url, logo_url = EXCLUDED.logo_url, topics = EXCLUDED.topics
    WHERE admin_business_setups.business_id IS NULL
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'The owner has already completed setup'; END IF;
  RETURN v_id;
END $$;

-- A shared QR contains only the setup ID. Read the details after verifying the
-- owner's email, or use the actual owner ID once the business has been created.
CREATE FUNCTION my_admin_business_setup(p_setup uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('id', s.id, 'name', s.name, 'category', s.category,
    'google_review_url', s.google_review_url, 'logo_url', s.logo_url, 'topics', s.topics, 'business_id', s.business_id)
  FROM admin_business_setups s
  JOIN auth.users u ON u.id = auth.uid()
  LEFT JOIN businesses b ON b.id = s.business_id
  WHERE s.id = p_setup
    AND (b.owner_id = u.id OR (
      s.business_id IS NULL AND u.email_confirmed_at IS NOT NULL AND s.email = lower(btrim(u.email))
    ));
$$;

CREATE FUNCTION claim_admin_business_setup(p_draft uuid, p_consent_version text, p_name text, p_slug text, p_category text, p_google_review_url text, p_logo_url text, p_welcome_message text, p_topics text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result jsonb;
BEGIN
  IF p_consent_version IS NULL OR length(btrim(p_consent_version)) NOT BETWEEN 1 AND 64 THEN
    RAISE EXCEPTION 'Accept the terms and privacy notice';
  END IF;
  PERFORM 1 FROM admin_business_setups s JOIN auth.users u ON s.email = lower(btrim(u.email))
  WHERE s.id = p_draft AND s.business_id IS NULL AND u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL
  FOR UPDATE OF s;
  IF NOT FOUND THEN RAISE EXCEPTION 'No pending setup for this account'; END IF;

  v_result := create_business_with_defaults(p_name, p_slug, p_category, p_google_review_url, p_logo_url, p_welcome_message, p_topics);
  UPDATE profiles SET terms_consent_version = p_consent_version, terms_consented_at = now() WHERE id = auth.uid();
  UPDATE admin_business_setups SET claimed_at = now(), business_id = (v_result->>'id')::uuid WHERE id = p_draft;
  RETURN v_result;
END $$;

REVOKE ALL ON FUNCTION save_admin_business_setup(text,text,text,text,text,text[]), my_admin_business_setup(uuid), claim_admin_business_setup(uuid,text,text,text,text,text,text,text,text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION save_admin_business_setup(text,text,text,text,text,text[]), my_admin_business_setup(uuid), claim_admin_business_setup(uuid,text,text,text,text,text,text,text,text[]) TO authenticated;

CREATE FUNCTION erase_pending_admin_business_setup() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM admin_business_setups WHERE business_id IS NULL AND email = lower(btrim(OLD.email));
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION erase_pending_admin_business_setup() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER erase_pending_admin_business_setup AFTER DELETE ON auth.users
FOR EACH ROW EXECUTE FUNCTION erase_pending_admin_business_setup();
