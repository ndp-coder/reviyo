-- Partners prepare onboarding; only the matching owner can create the business.
CREATE TABLE partner_business_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL UNIQUE REFERENCES commission_referrals(id),
  name text NOT NULL,
  category text NOT NULL,
  google_review_url text,
  logo_url text,
  topics text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  invitation_sent_at timestamptz,
  claimed_at timestamptz
);
ALTER TABLE partner_business_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON partner_business_drafts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON partner_business_drafts TO authenticated;
GRANT ALL ON partner_business_drafts TO service_role;
CREATE POLICY partner_drafts_read ON partner_business_drafts FOR SELECT TO authenticated USING (
  is_admin() OR EXISTS (SELECT 1 FROM commission_referrals r WHERE r.id = referral_id AND r.partner_id = my_commission_partner())
);

-- Owner reads through a narrow function: referral RLS stays private to partners.
CREATE FUNCTION my_partner_business_draft() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT to_jsonb(d) FROM partner_business_drafts d
  JOIN commission_referrals r ON r.id = d.referral_id
  JOIN auth.users u ON lower(btrim(u.email)) = r.email
  JOIN commission_partners p ON p.id = r.partner_id AND p.active
  WHERE u.id = auth.uid() AND d.claimed_at IS NULL;
$$;

CREATE FUNCTION save_partner_business_draft(p_email text, p_name text, p_category text, p_google_review_url text, p_logo_url text, p_topics text[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_partner uuid := my_commission_partner(); v_ref uuid; v_id uuid; v_email text := lower(btrim(p_email)); v_topic text;
BEGIN
  IF v_partner IS NULL THEN RAISE EXCEPTION 'Invitation required'; END IF;
  PERFORM 1 FROM commission_partners WHERE id = v_partner AND active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation required'; END IF;
  IF p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 200 OR p_category IS NULL OR length(btrim(p_category)) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Enter a business name and category'; END IF;
  IF p_topics IS NULL OR cardinality(p_topics) NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Add between 1 and 20 topics'; END IF;
  FOREACH v_topic IN ARRAY p_topics LOOP
    IF v_topic IS NULL OR length(btrim(v_topic)) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Each topic must have 1 to 80 characters'; END IF;
  END LOOP;
  IF nullif(btrim(p_google_review_url),'') IS NOT NULL AND (length(p_google_review_url) > 2048 OR p_google_review_url !~ '^https://(search\.google\.com|www\.google\.com|maps\.google\.com|maps\.app\.goo\.gl|g\.page|goo\.gl)/') THEN RAISE EXCEPTION 'Enter a valid HTTPS Google review link'; END IF;
  IF nullif(p_logo_url,'') IS NOT NULL AND (length(p_logo_url) > 500000 OR p_logo_url !~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$') THEN RAISE EXCEPTION 'Upload a supported logo'; END IF;
  IF EXISTS (SELECT 1 FROM auth.users u JOIN businesses b ON b.owner_id = u.id WHERE lower(btrim(u.email)) = v_email) THEN RAISE EXCEPTION 'This owner already has a business'; END IF;
  SELECT id INTO v_ref FROM commission_referrals WHERE email = v_email AND partner_id = v_partner FOR UPDATE;
  IF v_ref IS NULL THEN v_ref := register_commission_referral(v_email); END IF;
  INSERT INTO partner_business_drafts(referral_id,name,category,google_review_url,logo_url,topics)
  VALUES(v_ref,btrim(p_name),btrim(p_category),nullif(btrim(p_google_review_url),''),nullif(p_logo_url,''),p_topics)
  ON CONFLICT (referral_id) DO UPDATE SET name = EXCLUDED.name,category = EXCLUDED.category,google_review_url = EXCLUDED.google_review_url,logo_url = EXCLUDED.logo_url,topics = EXCLUDED.topics
    WHERE partner_business_drafts.claimed_at IS NULL
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'The owner has already completed setup'; END IF;
  RETURN v_id;
END $$;

CREATE FUNCTION claim_partner_business(p_draft uuid, p_consent_version text, p_name text, p_slug text, p_category text, p_google_review_url text, p_logo_url text, p_welcome_message text, p_topics text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result jsonb;
BEGIN
  IF p_consent_version IS NULL OR length(btrim(p_consent_version)) NOT BETWEEN 1 AND 64 THEN RAISE EXCEPTION 'Accept the terms and privacy notice'; END IF;
  PERFORM 1 FROM partner_business_drafts d JOIN commission_referrals r ON r.id = d.referral_id
    JOIN auth.users u ON lower(btrim(u.email)) = r.email JOIN commission_partners p ON p.id = r.partner_id AND p.active
    WHERE d.id = p_draft AND d.claimed_at IS NULL AND u.id = auth.uid() FOR UPDATE OF d;
  IF NOT FOUND THEN RAISE EXCEPTION 'No pending setup for this account'; END IF;
  v_result := create_business_with_defaults(p_name,p_slug,p_category,p_google_review_url,p_logo_url,p_welcome_message,p_topics);
  UPDATE profiles SET terms_consent_version = p_consent_version, terms_consented_at = now() WHERE id = auth.uid();
  UPDATE partner_business_drafts SET claimed_at = now() WHERE id = p_draft;
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION my_partner_business_draft() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION save_partner_business_draft(text,text,text,text,text,text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION claim_partner_business(uuid,text,text,text,text,text,text,text,text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION my_partner_business_draft(), save_partner_business_draft(text,text,text,text,text,text[]), claim_partner_business(uuid,text,text,text,text,text,text,text,text[]) TO authenticated;
