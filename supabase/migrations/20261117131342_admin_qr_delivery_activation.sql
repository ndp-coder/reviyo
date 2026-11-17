CREATE TABLE admin_qr_deliveries (
  setup_id uuid PRIMARY KEY REFERENCES admin_business_setups(id) ON DELETE CASCADE,
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'razorpay')),
  cash_plan text CHECK (cash_plan IN ('1_month', '6_months', '12_months')),
  cash_amount integer CHECK (cash_amount > 0),
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  delivery_address jsonb NOT NULL,
  dispatched_at timestamptz,
  tracking_reference text,
  delivered_on date,
  delivered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CHECK ((payment_method = 'cash') = (cash_plan IS NOT NULL AND cash_amount IS NOT NULL)),
  CHECK (delivered_on IS NULL OR dispatched_at IS NOT NULL)
);
ALTER TABLE admin_qr_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON admin_qr_deliveries FROM PUBLIC, anon, authenticated;
GRANT SELECT ON admin_qr_deliveries TO authenticated;
GRANT ALL ON admin_qr_deliveries TO service_role;
CREATE POLICY admin_qr_deliveries_read ON admin_qr_deliveries FOR SELECT TO authenticated USING (is_admin());

ALTER TABLE payment_orders DROP CONSTRAINT payment_orders_kind_check;
ALTER TABLE payment_orders ADD CONSTRAINT payment_orders_kind_check CHECK (kind IN ('one_time', 'autopay', 'cash'));

CREATE FUNCTION save_admin_delivery_setup(
  p_email text, p_name text, p_category text, p_google_review_url text, p_logo_url text, p_topics text[],
  p_method text, p_cash_plan text, p_cash_received boolean, p_address jsonb, p_delivery_consent boolean
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_setup uuid; v_amount integer; v_key text; v_existing admin_qr_deliveries%ROWTYPE;
BEGIN
  IF NOT coalesce(is_admin(), false) THEN RAISE EXCEPTION 'Developer access required'; END IF;
  IF p_method IS NULL OR p_method NOT IN ('cash', 'razorpay') THEN RAISE EXCEPTION 'Choose a payment method'; END IF;
  IF p_method = 'cash' THEN
    v_amount := CASE p_cash_plan WHEN '1_month' THEN 29900 WHEN '6_months' THEN 175000 WHEN '12_months' THEN 299900 END;
    IF v_amount IS NULL OR p_cash_received IS DISTINCT FROM true THEN RAISE EXCEPTION 'Choose a plan and confirm cash was collected'; END IF;
  ELSIF p_cash_plan IS NOT NULL OR p_cash_received IS TRUE THEN RAISE EXCEPTION 'Cash details are only for cash payments';
  END IF;
  IF p_delivery_consent IS DISTINCT FROM true THEN RAISE EXCEPTION 'Confirm the owner agreed to use the delivery address'; END IF;
  IF jsonb_typeof(p_address) IS DISTINCT FROM 'object' OR octet_length(p_address::text) > 3000 THEN RAISE EXCEPTION 'Enter a valid delivery address'; END IF;
  FOREACH v_key IN ARRAY ARRAY['recipient','phone','line1','city','state','pincode','country'] LOOP
    IF jsonb_typeof(p_address->v_key) IS DISTINCT FROM 'string' OR btrim(p_address->>v_key) = '' THEN
      RAISE EXCEPTION 'Complete every required delivery field';
    END IF;
  END LOOP;
  FOR v_key IN SELECT jsonb_object_keys(p_address) LOOP
    IF v_key NOT IN ('recipient','phone','line1','line2','city','state','pincode','country')
      OR jsonb_typeof(p_address->v_key) IS DISTINCT FROM 'string'
      OR length(p_address->>v_key) > (CASE WHEN v_key IN ('line1','line2') THEN 80 ELSE 60 END)
      OR (p_address->>v_key) ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Invalid delivery address field'; END IF;
  END LOOP;
  IF p_address->>'country' <> 'IN' OR (p_address->>'pincode') !~ '^[1-9][0-9]{5}$' OR (p_address->>'phone') !~ '^[6-9][0-9]{9}$' THEN
    RAISE EXCEPTION 'Use an Indian delivery address, six-digit PIN and ten-digit mobile number';
  END IF;

  -- The existing setup function serializes updates to the same owner email.
  -- A retry returns the same setup and never changes a recorded payment.
  v_setup := save_admin_business_setup(p_email,p_name,p_category,p_google_review_url,p_logo_url,p_topics);
  SELECT * INTO v_existing FROM admin_qr_deliveries WHERE setup_id = v_setup;
  IF FOUND THEN
    IF v_existing.payment_method IS DISTINCT FROM p_method OR v_existing.cash_plan IS DISTINCT FROM p_cash_plan
      OR v_existing.delivery_address IS DISTINCT FROM p_address THEN RAISE EXCEPTION 'A payment and delivery setup is already recorded for this email'; END IF;
    RETURN v_setup;
  END IF;
  INSERT INTO admin_qr_deliveries(setup_id,payment_method,cash_plan,cash_amount,recorded_by,delivery_address)
  VALUES(v_setup,p_method,p_cash_plan,v_amount,auth.uid(),p_address);
  RETURN v_setup;
END $$;

CREATE FUNCTION admin_qr_delivery_details(p_setup uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result jsonb;
BEGIN
  SELECT jsonb_build_object('method',d.payment_method,'cash_plan',d.cash_plan,'address',d.delivery_address,
    'dispatch_date', (d.dispatched_at AT TIME ZONE 'Asia/Kolkata')::date,'tracking_reference',d.tracking_reference,
    'delivered_on',d.delivered_on,'slug',b.slug,'paid',d.payment_method = 'cash' OR EXISTS (
      SELECT 1 FROM payment_orders o WHERE o.business_id = s.business_id AND o.status = 'paid'))
  INTO v_result FROM admin_qr_deliveries d JOIN admin_business_setups s ON s.id = d.setup_id
  LEFT JOIN businesses b ON b.id = s.business_id
  LEFT JOIN auth.users u ON u.id = auth.uid()
  WHERE s.id = p_setup AND (is_admin() OR b.owner_id = u.id OR (
    s.business_id IS NULL AND u.email_confirmed_at IS NOT NULL AND s.email = lower(btrim(u.email))));
  RETURN v_result;
END $$;

CREATE FUNCTION admin_delivery_for_business(p_business uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT admin_qr_delivery_details(s.id) FROM admin_business_setups s WHERE s.business_id = p_business;
$$;

CREATE OR REPLACE FUNCTION my_admin_business_setup(p_setup uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('id',s.id,'name',s.name,'category',s.category,'google_review_url',s.google_review_url,
    'logo_url',s.logo_url,'topics',s.topics,'business_id',s.business_id,'delivery',admin_qr_delivery_details(s.id))
  FROM admin_business_setups s JOIN auth.users u ON u.id = auth.uid()
  LEFT JOIN businesses b ON b.id = s.business_id
  WHERE s.id = p_setup AND (b.owner_id = u.id OR (
    s.business_id IS NULL AND u.email_confirmed_at IS NOT NULL AND s.email = lower(btrim(u.email))));
$$;

-- A cash payment collected in person enters the normal payment history when
-- the verified owner claims the business. It does not create a subscription.
CREATE FUNCTION post_admin_cash_payment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO payment_orders(business_id,user_id,order_id,payment_id,plan,amount,status,kind,created_at)
  SELECT NEW.business_id,b.owner_id,'cash-' || NEW.id,'cash-' || NEW.id,d.cash_plan,d.cash_amount,'paid','cash',d.recorded_at
  FROM admin_qr_deliveries d JOIN businesses b ON b.id = NEW.business_id
  WHERE d.setup_id = NEW.id AND d.payment_method = 'cash';
  RETURN NEW;
END $$;
CREATE TRIGGER post_admin_cash_payment AFTER UPDATE OF business_id ON admin_business_setups
FOR EACH ROW WHEN (OLD.business_id IS NULL AND NEW.business_id IS NOT NULL) EXECUTE FUNCTION post_admin_cash_payment();

ALTER FUNCTION stand_checkout_snapshot(uuid,uuid) RENAME TO standard_stand_checkout_snapshot;
CREATE FUNCTION stand_checkout_snapshot(p_business_id uuid,p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_delivery admin_qr_deliveries%ROWTYPE;
BEGIN
  SELECT d.* INTO v_delivery FROM admin_qr_deliveries d JOIN admin_business_setups s ON s.id = d.setup_id
  JOIN businesses b ON b.id = s.business_id WHERE b.id = p_business_id AND b.owner_id = p_user_id;
  IF NOT FOUND THEN RETURN standard_stand_checkout_snapshot(p_business_id,p_user_id); END IF;
  IF v_delivery.delivered_on IS NULL AND (v_delivery.payment_method = 'cash' OR EXISTS (
    SELECT 1 FROM payment_orders WHERE business_id = p_business_id AND status = 'paid'
  )) THEN RAISE EXCEPTION 'Payment is already recorded. Your plan begins when your QR stand is delivered'; END IF;
  RETURN NULL;
END $$;

-- Keep standard captures and renewals on the existing settlement path.
-- For deliveries, serialize capture and activation on the same delivery row.
ALTER FUNCTION process_paid_order(text,text) RENAME TO process_standard_paid_order;
CREATE FUNCTION process_paid_order(p_order_id text,p_payment_id text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order payment_orders%ROWTYPE; v_delivery admin_qr_deliveries%ROWTYPE;
BEGIN
  SELECT d.* INTO v_delivery FROM payment_orders o JOIN admin_business_setups s ON s.business_id = o.business_id
  JOIN admin_qr_deliveries d ON d.setup_id = s.id WHERE o.order_id = p_order_id FOR UPDATE OF d;
  IF NOT FOUND OR v_delivery.delivered_on IS NOT NULL THEN RETURN process_standard_paid_order(p_order_id,p_payment_id); END IF;
  IF nullif(p_payment_id,'') IS NULL THEN RAISE EXCEPTION 'Order ID and payment ID are required'; END IF;
  SELECT * INTO STRICT v_order FROM payment_orders WHERE order_id = p_order_id FOR UPDATE;
  IF v_order.status = 'paid' THEN
    IF v_order.payment_id IS DISTINCT FROM p_payment_id THEN RAISE EXCEPTION 'Payment order was fulfilled with a different payment'; END IF;
    RETURN jsonb_build_object('subscription',null,'already_processed',true,'awaiting_delivery',true);
  END IF;
  IF v_order.status NOT IN ('created','attempted','failed') THEN
    RAISE EXCEPTION 'Payment order cannot be fulfilled from status %', v_order.status;
  END IF;
  UPDATE payment_orders SET status = 'paid', payment_id = p_payment_id, updated_at = now() WHERE id = v_order.id;
  INSERT INTO analytics_events(business_id,event_type,metadata) VALUES(v_order.business_id,'subscription_purchased',
    jsonb_build_object('plan',v_order.plan,'order_id',v_order.order_id,'payment_id',p_payment_id));
  RETURN jsonb_build_object('subscription',null,'already_processed',false,'awaiting_delivery',true);
END $$;

CREATE FUNCTION update_admin_qr_delivery(p_setup uuid,p_tracking text DEFAULT NULL,p_delivered_on date DEFAULT NULL) RETURNS void
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
    RAISE EXCEPTION 'The owner must claim the business and payment must be recorded before dispatch';
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

REVOKE ALL ON FUNCTION save_admin_delivery_setup(text,text,text,text,text,text[],text,text,boolean,jsonb,boolean),
  admin_qr_delivery_details(uuid),admin_delivery_for_business(uuid),update_admin_qr_delivery(uuid,text,date),
  post_admin_cash_payment(),stand_checkout_snapshot(uuid,uuid),standard_stand_checkout_snapshot(uuid,uuid),
  process_paid_order(text,text),process_standard_paid_order(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION save_admin_delivery_setup(text,text,text,text,text,text[],text,text,boolean,jsonb,boolean),
  admin_qr_delivery_details(uuid),admin_delivery_for_business(uuid),update_admin_qr_delivery(uuid,text,date) TO authenticated;
REVOKE EXECUTE ON FUNCTION standard_stand_checkout_snapshot(uuid,uuid),process_standard_paid_order(text,text) FROM service_role;
GRANT EXECUTE ON FUNCTION stand_checkout_snapshot(uuid,uuid),process_paid_order(text,text) TO service_role;
