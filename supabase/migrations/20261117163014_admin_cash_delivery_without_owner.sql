-- A recorded cash payment can be fulfilled before the owner opens an account.
-- The review page belongs to the same business before and after a later claim.
ALTER TABLE businesses ALTER COLUMN owner_id DROP NOT NULL;

CREATE FUNCTION provision_admin_cash_business(p_setup uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_setup admin_business_setups%ROWTYPE; v_business uuid;
BEGIN
  SELECT s.* INTO v_setup FROM admin_business_setups s
  JOIN admin_qr_deliveries d ON d.setup_id = s.id
  WHERE s.id = p_setup AND s.business_id IS NULL AND d.payment_method = 'cash'
  FOR UPDATE OF s;
  IF NOT FOUND THEN RETURN; END IF;

  INSERT INTO businesses(name, slug, category, google_review_url, logo_url, welcome_message)
  VALUES(v_setup.name, 'review-' || gen_random_uuid(), v_setup.category,
    v_setup.google_review_url, v_setup.logo_url, 'How was your experience at ' || v_setup.name || '?')
  RETURNING id INTO v_business;

  INSERT INTO review_topics(business_id,label,display_order)
  SELECT v_business,btrim(t.label),(t.position - 1)::int
  FROM unnest(v_setup.topics) WITH ORDINALITY AS t(label,position)
  WHERE NOT EXISTS (
    SELECT 1 FROM unnest(v_setup.topics) WITH ORDINALITY AS earlier(label,position)
    WHERE earlier.position < t.position AND lower(btrim(earlier.label)) = lower(btrim(t.label))
  );

  -- The existing setup trigger records the cash order, with a null payer
  -- account until the verified owner claims the business.
  UPDATE admin_business_setups SET business_id = v_business WHERE id = p_setup;
END $$;

CREATE FUNCTION provision_business_on_cash_delivery() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM provision_admin_cash_business(NEW.setup_id);
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION provision_admin_cash_business(uuid), provision_business_on_cash_delivery()
FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER provision_business_on_cash_delivery AFTER INSERT ON admin_qr_deliveries
FOR EACH ROW WHEN (NEW.payment_method = 'cash') EXECUTE FUNCTION provision_business_on_cash_delivery();

CREATE OR REPLACE FUNCTION claim_admin_business_setup(p_draft uuid, p_consent_version text, p_name text, p_slug text, p_category text, p_google_review_url text, p_logo_url text, p_welcome_message text, p_topics text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_business uuid;
  v_result jsonb;
  v_topic text;
  v_position int;
  v_seen text[] := ARRAY[]::text[];
BEGIN
  IF p_consent_version IS NULL OR length(btrim(p_consent_version)) NOT BETWEEN 1 AND 64 THEN
    RAISE EXCEPTION 'Accept the terms and privacy notice';
  END IF;
  SELECT s.business_id INTO v_business FROM admin_business_setups s
  JOIN auth.users u ON s.email = lower(btrim(u.email))
  WHERE s.id = p_draft AND s.claimed_at IS NULL AND u.id = v_owner AND u.email_confirmed_at IS NOT NULL
  FOR UPDATE OF s;
  IF NOT FOUND THEN RAISE EXCEPTION 'No pending setup for this account'; END IF;

  IF v_business IS NULL THEN
    v_result := create_business_with_defaults(p_name, p_slug, p_category, p_google_review_url, p_logo_url, p_welcome_message, p_topics);
    v_business := (v_result->>'id')::uuid;
  ELSE
    IF EXISTS (SELECT 1 FROM businesses WHERE owner_id = v_owner) THEN
      RAISE EXCEPTION 'A business already exists for this account';
    END IF;
    IF p_topics IS NULL OR cardinality(p_topics) NOT BETWEEN 1 AND 20 OR EXISTS (
      SELECT 1 FROM unnest(p_topics) AS t(label) WHERE label IS NULL OR length(btrim(label)) NOT BETWEEN 1 AND 80
    ) THEN RAISE EXCEPTION 'Add 1 to 20 topics of 1 to 80 characters each'; END IF;

    -- Preserve the slug on the printed QR and any payment or review history.
    UPDATE businesses b SET owner_id = v_owner, name = btrim(p_name), category = btrim(p_category),
      google_review_url = nullif(btrim(p_google_review_url), ''), logo_url = nullif(btrim(p_logo_url), ''),
      welcome_message = nullif(btrim(p_welcome_message), '')
    WHERE b.id = v_business AND b.owner_id IS NULL
    RETURNING to_jsonb(b) INTO v_result;
    IF NOT FOUND THEN RAISE EXCEPTION 'No pending setup for this account'; END IF;

    FOR v_topic, v_position IN
      SELECT btrim(t.label),(t.position - 1)::int FROM unnest(p_topics) WITH ORDINALITY AS t(label,position)
    LOOP
      CONTINUE WHEN lower(v_topic) = ANY(v_seen);
      v_seen := array_append(v_seen,lower(v_topic));
      UPDATE review_topics SET label = v_topic, display_order = v_position, active = true
      WHERE business_id = v_business AND lower(label) = lower(v_topic);
      IF NOT FOUND THEN
        INSERT INTO review_topics(business_id,label,display_order) VALUES(v_business,v_topic,v_position);
      END IF;
    END LOOP;
    UPDATE review_topics SET active = false WHERE business_id = v_business AND active AND lower(label) <> ALL(v_seen);

    UPDATE payment_orders SET user_id = v_owner
    WHERE business_id = v_business AND order_id = 'cash-' || p_draft AND kind = 'cash' AND user_id IS NULL;
  END IF;

  UPDATE profiles SET terms_consent_version = p_consent_version, terms_consented_at = now() WHERE id = v_owner;
  UPDATE admin_business_setups SET claimed_at = now(), business_id = v_business WHERE id = p_draft;
  RETURN v_result;
END $$;

-- An identical admin retry returns the existing setup without changing its QR.
CREATE OR REPLACE FUNCTION save_admin_business_setup(p_email text, p_name text, p_category text, p_google_review_url text, p_logo_url text, p_topics text[])
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
    WHERE admin_business_setups.business_id IS NULL OR (
      admin_business_setups.claimed_at IS NULL AND
      (admin_business_setups.name, admin_business_setups.category, admin_business_setups.google_review_url,
        admin_business_setups.logo_url, admin_business_setups.topics)
      IS NOT DISTINCT FROM (EXCLUDED.name, EXCLUDED.category, EXCLUDED.google_review_url, EXCLUDED.logo_url, EXCLUDED.topics)
    )
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'A business setup is already saved for this email'; END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION admin_qr_delivery_details(p_setup uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result jsonb;
BEGIN
  SELECT jsonb_build_object('method',d.payment_method,'cash_plan',d.cash_plan,'address',d.delivery_address,
    'dispatch_date', (d.dispatched_at AT TIME ZONE 'Asia/Kolkata')::date,'tracking_reference',d.tracking_reference,
    'delivered_on',d.delivered_on,'slug',b.slug,'paid',EXISTS (
      SELECT 1 FROM payment_orders o WHERE o.business_id = s.business_id AND o.status = 'paid'))
  INTO v_result FROM admin_qr_deliveries d JOIN admin_business_setups s ON s.id = d.setup_id
  LEFT JOIN businesses b ON b.id = s.business_id
  LEFT JOIN auth.users u ON u.id = auth.uid()
  WHERE s.id = p_setup AND (is_admin() OR b.owner_id = u.id OR (
    s.claimed_at IS NULL AND u.email_confirmed_at IS NOT NULL AND s.email = lower(btrim(u.email))));
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION my_admin_business_setup(p_setup uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('id',s.id,'name',s.name,'category',s.category,'google_review_url',s.google_review_url,
    'logo_url',s.logo_url,'topics',s.topics,'business_id',CASE WHEN s.claimed_at IS NOT NULL THEN s.business_id END,'delivery',admin_qr_delivery_details(s.id))
  FROM admin_business_setups s JOIN auth.users u ON u.id = auth.uid()
  LEFT JOIN businesses b ON b.id = s.business_id
  WHERE s.id = p_setup AND (b.owner_id = u.id OR (
    s.claimed_at IS NULL AND u.email_confirmed_at IS NOT NULL AND s.email = lower(btrim(u.email))));
$$;

CREATE OR REPLACE FUNCTION update_admin_qr_delivery(p_setup uuid,p_tracking text DEFAULT NULL,p_delivered_on date DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_delivery admin_qr_deliveries%ROWTYPE; v_business uuid; v_order payment_orders%ROWTYPE;
  v_plan text; v_reference text;
  v_start timestamp; v_end timestamp; v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  IF NOT coalesce(is_admin(),false) THEN RAISE EXCEPTION 'Developer access required'; END IF;
  SELECT * INTO v_delivery FROM admin_qr_deliveries WHERE setup_id = p_setup FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Delivery setup not found'; END IF;
  IF v_delivery.delivered_on IS NOT NULL THEN
    IF p_delivered_on = v_delivery.delivered_on THEN RETURN; END IF;
    RAISE EXCEPTION 'Delivery is already confirmed';
  END IF;
  SELECT business_id INTO v_business FROM admin_business_setups WHERE id = p_setup;
  IF v_business IS NULL OR NOT EXISTS (SELECT 1 FROM payment_orders WHERE business_id = v_business AND status = 'paid') THEN
    RAISE EXCEPTION 'Record the payment before dispatching the QR stand';
  END IF;
  IF p_delivered_on IS NULL THEN
    IF nullif(btrim(p_tracking),'') IS NULL OR length(btrim(p_tracking)) > 160 OR p_tracking ~ '[[:cntrl:]]' THEN
      RAISE EXCEPTION 'Enter a courier tracking or dispatch reference';
    END IF;
    UPDATE admin_qr_deliveries SET dispatched_at = coalesce(dispatched_at,now()), tracking_reference = btrim(p_tracking) WHERE setup_id = p_setup;
    RETURN;
  END IF;
  IF v_delivery.dispatched_at IS NULL OR p_delivered_on < (v_delivery.dispatched_at AT TIME ZONE 'Asia/Kolkata')::date OR p_delivered_on > v_today THEN
    RAISE EXCEPTION 'Enter the confirmed receipt date from dispatch through today';
  END IF;
  IF EXISTS (SELECT 1 FROM subscriptions WHERE business_id = v_business) THEN RAISE EXCEPTION 'This business already has a subscription'; END IF;

  v_start := p_delivered_on::timestamp;
  v_end := v_start;
  -- Honour every verified capture that raced with checkout in another tab.
  FOR v_order IN SELECT * FROM payment_orders WHERE business_id = v_business AND status = 'paid' ORDER BY updated_at, id LOOP
    v_end := v_end + CASE v_order.plan WHEN '1_month' THEN interval '1 month' WHEN '6_months' THEN interval '6 months' ELSE interval '12 months' END;
    v_plan := v_order.plan;
    v_reference := v_order.payment_id;
  END LOOP;
  INSERT INTO subscriptions(business_id,plan,status,starts_at,expires_at,payment_reference)
  VALUES(v_business,v_plan,'active',v_start AT TIME ZONE 'Asia/Kolkata',v_end AT TIME ZONE 'Asia/Kolkata',v_reference);
  UPDATE admin_qr_deliveries SET delivered_on = p_delivered_on, delivered_by = auth.uid() WHERE setup_id = p_setup;
END $$;

-- Provision existing cash-paid setups through the same transaction as new ones.
DO $$
DECLARE v_setup uuid;
BEGIN
  FOR v_setup IN
    SELECT s.id FROM admin_business_setups s JOIN admin_qr_deliveries d ON d.setup_id = s.id
    WHERE s.business_id IS NULL AND d.payment_method = 'cash'
  LOOP
    PERFORM provision_admin_cash_business(v_setup);
  END LOOP;
END $$;
