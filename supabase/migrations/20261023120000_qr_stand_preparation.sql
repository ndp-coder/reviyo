-- The offer stays closed until a supplier, landed cost and API are verified.
-- No credentials or supplier API responses belong in these tables.
CREATE TABLE stand_delivery_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT false,
  supplier_ready boolean NOT NULL DEFAULT false,
  supplier_name text,
  approved_unit_cost_paise integer CHECK (approved_unit_cost_paise > 0),
  CHECK (NOT enabled OR (supplier_ready AND nullif(btrim(supplier_name),'') IS NOT NULL AND approved_unit_cost_paise IS NOT NULL))
);
INSERT INTO stand_delivery_settings(id) VALUES(true);
ALTER TABLE stand_delivery_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON stand_delivery_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON stand_delivery_settings TO service_role;

CREATE TABLE stand_preferences (
  business_id uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  printed_name text NOT NULL CHECK (length(printed_name) BETWEEN 1 AND 80),
  delivery_address jsonb,
  consent_version text,
  consented_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE stand_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  payment_order_id uuid NOT NULL UNIQUE REFERENCES payment_orders(id),
  printed_name text NOT NULL,
  business_slug text NOT NULL,
  delivery_address jsonb NOT NULL,
  consent_version text NOT NULL,
  supplier_name text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','submitting','submitted','shipped','delivered','cancelled','needs_attention')),
  supplier_order_id text,
  tracking_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE stand_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE stand_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON stand_preferences, stand_orders FROM PUBLIC, anon, authenticated;
GRANT SELECT ON stand_preferences, stand_orders TO authenticated;
GRANT ALL ON stand_preferences, stand_orders TO service_role;
CREATE POLICY stand_preferences_read ON stand_preferences FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM businesses b WHERE b.id=business_id AND b.owner_id=auth.uid()));
CREATE POLICY stand_orders_read ON stand_orders FOR SELECT TO authenticated
  USING (is_admin() OR EXISTS(SELECT 1 FROM businesses b WHERE b.id=business_id AND b.owner_id=auth.uid()));

CREATE FUNCTION qr_stand_offer() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object('enabled',enabled AND supplier_ready,'quantity',1,'first_purchase_only',true,'supplier',CASE WHEN enabled AND supplier_ready THEN supplier_name ELSE NULL END)
  FROM stand_delivery_settings WHERE id=true;
$$;
REVOKE ALL ON FUNCTION qr_stand_offer() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION qr_stand_offer() TO anon, authenticated, service_role;

CREATE FUNCTION save_stand_preferences(p_business_id uuid,p_printed_name text,p_address jsonb DEFAULT NULL,p_consent_version text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_name text:=btrim(p_printed_name); k text; v_limit integer;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM businesses WHERE id=p_business_id AND owner_id=auth.uid()) THEN
    RAISE EXCEPTION 'Business owner access required';
  END IF;
  IF v_name IS NULL OR length(v_name) NOT BETWEEN 1 AND 80 OR v_name ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Use a business name of 1 to 80 characters'; END IF;
  IF p_address IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM stand_delivery_settings WHERE id=true AND enabled AND supplier_ready) THEN RAISE EXCEPTION 'Printed stand delivery is not available yet'; END IF;
    IF jsonb_typeof(p_address) IS DISTINCT FROM 'object' OR octet_length(p_address::text)>3000 THEN RAISE EXCEPTION 'Invalid delivery address'; END IF;
    IF p_consent_version IS DISTINCT FROM '2026-10-23.1' THEN RAISE EXCEPTION 'Accept the delivery privacy notice'; END IF;
    FOREACH k IN ARRAY ARRAY['recipient','phone','line1','city','state','pincode','country'] LOOP
      IF jsonb_typeof(p_address->k) IS DISTINCT FROM 'string' OR length(btrim(p_address->>k))=0 THEN RAISE EXCEPTION 'Complete every required delivery field'; END IF;
    END LOOP;
    FOR k IN SELECT jsonb_object_keys(p_address) LOOP
      IF k NOT IN ('recipient','phone','line1','line2','city','state','pincode','country') THEN RAISE EXCEPTION 'Unexpected address field'; END IF;
      v_limit:=CASE WHEN k IN ('line1','line2') THEN 80 ELSE 60 END;
      IF jsonb_typeof(p_address->k) IS DISTINCT FROM 'string' OR length(p_address->>k)>v_limit OR (p_address->>k) ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Invalid address field'; END IF;
    END LOOP;
    IF p_address->>'country'<>'IN' OR (p_address->>'pincode') !~ '^[1-9][0-9]{5}$' OR (p_address->>'phone') !~ '^[6-9][0-9]{9}$' THEN RAISE EXCEPTION 'Use an Indian delivery address, six-digit PIN and ten-digit mobile number'; END IF;
    IF EXISTS(SELECT 1 FROM stand_orders WHERE business_id=p_business_id) THEN RAISE EXCEPTION 'Your stand order is already confirmed; contact support before changing delivery details'; END IF;
  END IF;
  INSERT INTO stand_preferences(business_id,printed_name,delivery_address,consent_version,consented_at)
  VALUES(p_business_id,v_name,p_address,p_consent_version,CASE WHEN p_address IS NOT NULL THEN now() END)
  ON CONFLICT(business_id) DO UPDATE SET printed_name=excluded.printed_name,
    delivery_address=coalesce(excluded.delivery_address,stand_preferences.delivery_address),
    consent_version=coalesce(excluded.consent_version,stand_preferences.consent_version),
    consented_at=coalesce(excluded.consented_at,stand_preferences.consented_at),updated_at=now();
END $$;
REVOKE ALL ON FUNCTION save_stand_preferences(uuid,text,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION save_stand_preferences(uuid,text,jsonb,text) TO authenticated;

-- Run before creating the Razorpay order. Only the trusted checkout function
-- can attach this immutable delivery snapshot to a payment order.
CREATE FUNCTION stand_checkout_snapshot(p_business_id uuid,p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_profile stand_preferences%ROWTYPE; v_slug text; v_supplier text;
BEGIN
  SELECT slug INTO v_slug FROM businesses WHERE id=p_business_id AND owner_id=p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Business owner access required'; END IF;
  SELECT supplier_name INTO v_supplier FROM stand_delivery_settings WHERE id=true AND enabled AND supplier_ready;
  IF NOT FOUND OR EXISTS(SELECT 1 FROM payment_orders WHERE business_id=p_business_id AND status='paid') OR EXISTS(SELECT 1 FROM stand_orders WHERE business_id=p_business_id) THEN RETURN NULL; END IF;
  SELECT * INTO v_profile FROM stand_preferences WHERE business_id=p_business_id;
  IF NOT FOUND OR v_profile.delivery_address IS NULL OR v_profile.consented_at IS NULL THEN RAISE EXCEPTION 'Save your stand delivery details before paying'; END IF;
  RETURN jsonb_build_object('printed_name',v_profile.printed_name,'business_slug',v_slug,'address',v_profile.delivery_address,'consent_version',v_profile.consent_version,'supplier_name',v_supplier);
END $$;
REVOKE ALL ON FUNCTION stand_checkout_snapshot(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION stand_checkout_snapshot(uuid,uuid) TO service_role;
ALTER TABLE payment_orders ADD COLUMN stand_snapshot jsonb;

-- Paid settlement and queue insertion share the same transaction. Duplicate
-- webhooks and renewals can never create a second stand for the business.
CREATE FUNCTION queue_paid_qr_stand() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status='paid' AND OLD.status IS DISTINCT FROM 'paid' AND NEW.stand_snapshot IS NOT NULL THEN
    INSERT INTO stand_orders(business_id,payment_order_id,printed_name,business_slug,delivery_address,consent_version,supplier_name)
    VALUES(NEW.business_id,NEW.id,NEW.stand_snapshot->>'printed_name',NEW.stand_snapshot->>'business_slug',NEW.stand_snapshot->'address',NEW.stand_snapshot->>'consent_version',NEW.stand_snapshot->>'supplier_name')
    ON CONFLICT(business_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION queue_paid_qr_stand() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER queue_paid_qr_stand AFTER UPDATE OF status ON payment_orders FOR EACH ROW EXECUTE FUNCTION queue_paid_qr_stand();
