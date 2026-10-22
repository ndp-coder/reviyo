/*
# Free printed QR stand and table card, ordered automatically

Every business gets one printed QR kit (an acrylic table stand insert and a
folded table tent card) after its first real plan payment. The ₹1 AutoPay
check is not a plan payment (it never becomes a paid payment_orders row).

1. `delivery_addresses`: where the owner wants the kit sent, one per business.
   Saved through `save_delivery_address` (owner) only.
2. `qr_print_orders`: one per business, created by a trigger the moment a
   payment order becomes paid. Statuses:
     awaiting_address -> ready -> sent_to_printer -> shipped -> delivered
     (or cancelled by an admin)
   - awaiting_address: paid, no address yet; we email the owner to add one.
   - ready: has an address snapshot; Edge Functions email the printer.
   - sent_to_printer: set by the Edge Function once that email went out.
   - shipped / delivered / cancelled: set by an admin (admin_update_print_order).
3. email_log gains the four print-order email kinds, so each goes out once.

The trigger never blocks recording a payment: any failure is logged as a
warning and the payment still completes.
*/

-- ============================================
-- 1. Delivery address
-- ============================================
CREATE TABLE IF NOT EXISTS delivery_addresses (
  business_id uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  recipient_name text NOT NULL CHECK (char_length(recipient_name) BETWEEN 2 AND 80),
  phone text NOT NULL CHECK (phone ~ '^[6-9][0-9]{9}$'),
  address_line1 text NOT NULL CHECK (char_length(address_line1) BETWEEN 5 AND 120),
  address_line2 text NOT NULL DEFAULT '' CHECK (char_length(address_line2) <= 120),
  city text NOT NULL CHECK (char_length(city) BETWEEN 2 AND 60),
  state text NOT NULL CHECK (state IN (
    'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
    'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa',
    'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka',
    'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
    'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
  )),
  pincode text NOT NULL CHECK (pincode ~ '^[1-9][0-9]{5}$'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE delivery_addresses IS
  'Where a business''s free printed QR kit is delivered. Shared only with the print and courier partner.';

ALTER TABLE delivery_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_addresses_select_own" ON delivery_addresses;
CREATE POLICY "delivery_addresses_select_own" ON delivery_addresses FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = delivery_addresses.business_id AND businesses.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "delivery_addresses_select_admin" ON delivery_addresses;
CREATE POLICY "delivery_addresses_select_admin" ON delivery_addresses FOR SELECT
  TO authenticated USING (is_admin());

-- Reads go through RLS; every write goes through the functions below.
REVOKE ALL ON delivery_addresses FROM PUBLIC, anon, authenticated;
GRANT SELECT ON delivery_addresses TO authenticated;
GRANT ALL ON delivery_addresses TO service_role;

-- ============================================
-- 2. Print orders
-- ============================================
CREATE TABLE IF NOT EXISTS qr_print_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- One kit per business, ever.
  business_id uuid NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  -- The paid payment_orders.order_id that earned it.
  payment_order_id text NOT NULL,
  status text NOT NULL DEFAULT 'awaiting_address'
    CHECK (status IN ('awaiting_address', 'ready', 'sent_to_printer', 'shipped', 'delivered', 'cancelled')),
  -- Where it ships, copied from delivery_addresses until it goes to the printer.
  recipient_name text,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  pincode text,
  -- The business name as printed (set when it goes to the printer).
  business_name text,
  courier text CHECK (courier IS NULL OR char_length(courier) BETWEEN 2 AND 60),
  tracking_number text CHECK (tracking_number IS NULL OR char_length(tracking_number) BETWEEN 3 AND 60),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_to_printer_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qr_print_orders_address_when_ready CHECK (
    status IN ('awaiting_address', 'cancelled')
    OR (recipient_name IS NOT NULL AND phone IS NOT NULL AND address_line1 IS NOT NULL
        AND city IS NOT NULL AND state IS NOT NULL AND pincode IS NOT NULL)
  ),
  CONSTRAINT qr_print_orders_tracking_when_shipped CHECK (
    status NOT IN ('shipped', 'delivered') OR (courier IS NOT NULL AND tracking_number IS NOT NULL)
  )
);

COMMENT ON TABLE qr_print_orders IS
  'The free printed QR kit (table stand + tent card), one per business, created on its first paid order.';

CREATE INDEX IF NOT EXISTS idx_qr_print_orders_status ON qr_print_orders(status);

ALTER TABLE qr_print_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qr_print_orders_select_own" ON qr_print_orders;
CREATE POLICY "qr_print_orders_select_own" ON qr_print_orders FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = qr_print_orders.business_id AND businesses.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "qr_print_orders_select_admin" ON qr_print_orders;
CREATE POLICY "qr_print_orders_select_admin" ON qr_print_orders FOR SELECT
  TO authenticated USING (is_admin());

REVOKE ALL ON qr_print_orders FROM PUBLIC, anon, authenticated;
GRANT SELECT ON qr_print_orders TO authenticated;
GRANT ALL ON qr_print_orders TO service_role;

-- ============================================
-- 3. Create the order when a payment is recorded
-- ============================================
CREATE OR REPLACE FUNCTION create_qr_print_order_for_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_address delivery_addresses%ROWTYPE;
BEGIN
  IF NEW.status <> 'paid' OR NEW.amount <= 0 THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT * INTO v_address FROM delivery_addresses WHERE business_id = NEW.business_id;
    IF FOUND THEN
      INSERT INTO qr_print_orders (
        business_id, payment_order_id, status,
        recipient_name, phone, address_line1, address_line2, city, state, pincode
      )
      VALUES (
        NEW.business_id, NEW.order_id, 'ready',
        v_address.recipient_name, v_address.phone, v_address.address_line1, v_address.address_line2,
        v_address.city, v_address.state, v_address.pincode
      )
      ON CONFLICT (business_id) DO NOTHING;
    ELSE
      INSERT INTO qr_print_orders (business_id, payment_order_id)
      VALUES (NEW.business_id, NEW.order_id)
      ON CONFLICT (business_id) DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Recording money must never fail because of the free kit.
    RAISE WARNING 'Printed QR order for business % was not created: %', NEW.business_id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION create_qr_print_order_for_payment() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS payment_orders_create_qr_print_order ON payment_orders;
CREATE TRIGGER payment_orders_create_qr_print_order
  AFTER INSERT OR UPDATE OF status ON payment_orders
  FOR EACH ROW
  WHEN (NEW.status = 'paid')
  EXECUTE FUNCTION create_qr_print_order_for_payment();

-- ============================================
-- 4. The owner saves (or corrects) the delivery address
-- ============================================
-- Also fills in an order that is waiting for an address, or corrects one that
-- has not gone to the printer yet. Returns that order, or null.
CREATE OR REPLACE FUNCTION save_delivery_address(
  p_business_id uuid,
  p_recipient_name text,
  p_phone text,
  p_address_line1 text,
  p_address_line2 text,
  p_city text,
  p_state text,
  p_pincode text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_name text := regexp_replace(btrim(coalesce(p_recipient_name, '')), '\s+', ' ', 'g');
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_line1 text := regexp_replace(btrim(coalesce(p_address_line1, '')), '\s+', ' ', 'g');
  v_line2 text := regexp_replace(btrim(coalesce(p_address_line2, '')), '\s+', ' ', 'g');
  v_city text := regexp_replace(btrim(coalesce(p_city, '')), '\s+', ' ', 'g');
  v_state text := btrim(coalesce(p_state, ''));
  v_pincode text := btrim(coalesce(p_pincode, ''));
  v_order qr_print_orders%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM businesses WHERE id = p_business_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Business not found';
  END IF;

  IF length(v_phone) = 12 AND left(v_phone, 2) = '91' THEN
    v_phone := substr(v_phone, 3);
  ELSIF length(v_phone) = 11 AND left(v_phone, 1) = '0' THEN
    v_phone := substr(v_phone, 2);
  END IF;

  IF char_length(v_name) NOT BETWEEN 2 AND 80 THEN RAISE EXCEPTION 'Enter the name of the person who will receive it'; END IF;
  IF v_phone !~ '^[6-9][0-9]{9}$' THEN RAISE EXCEPTION 'Enter a 10-digit Indian mobile number'; END IF;
  IF char_length(v_line1) NOT BETWEEN 5 AND 120 THEN RAISE EXCEPTION 'Enter the shop or building and street'; END IF;
  IF char_length(v_line2) > 120 THEN RAISE EXCEPTION 'The second address line is too long'; END IF;
  IF char_length(v_city) NOT BETWEEN 2 AND 60 THEN RAISE EXCEPTION 'Enter the city or town'; END IF;
  IF v_pincode !~ '^[1-9][0-9]{5}$' THEN RAISE EXCEPTION 'Enter a 6-digit PIN code'; END IF;

  INSERT INTO delivery_addresses (business_id, recipient_name, phone, address_line1, address_line2, city, state, pincode, updated_at)
  VALUES (p_business_id, v_name, v_phone, v_line1, v_line2, v_city, v_state, v_pincode, now())
  ON CONFLICT (business_id) DO UPDATE SET
    recipient_name = EXCLUDED.recipient_name,
    phone = EXCLUDED.phone,
    address_line1 = EXCLUDED.address_line1,
    address_line2 = EXCLUDED.address_line2,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    pincode = EXCLUDED.pincode,
    updated_at = now();

  UPDATE qr_print_orders SET
    status = 'ready',
    recipient_name = v_name,
    phone = v_phone,
    address_line1 = v_line1,
    address_line2 = v_line2,
    city = v_city,
    state = v_state,
    pincode = v_pincode,
    updated_at = now()
  WHERE business_id = p_business_id
    AND status IN ('awaiting_address', 'ready')
  RETURNING * INTO v_order;

  IF v_order.id IS NULL THEN
    SELECT * INTO v_order FROM qr_print_orders WHERE business_id = p_business_id;
  END IF;
  RETURN CASE WHEN v_order.id IS NULL THEN NULL ELSE to_jsonb(v_order) END;
END;
$$;

REVOKE EXECUTE ON FUNCTION save_delivery_address(uuid, text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION save_delivery_address(uuid, text, text, text, text, text, text, text) TO authenticated, service_role;

-- ============================================
-- 5. Admin: shipped (with tracking), delivered, or cancelled
-- ============================================
CREATE OR REPLACE FUNCTION admin_update_print_order(
  p_order_id uuid,
  p_status text,
  p_courier text DEFAULT NULL,
  p_tracking_number text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order qr_print_orders%ROWTYPE;
  v_courier text := nullif(regexp_replace(btrim(coalesce(p_courier, '')), '\s+', ' ', 'g'), '');
  v_tracking text := nullif(btrim(coalesce(p_tracking_number, '')), '');
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  SELECT * INTO v_order FROM qr_print_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Print order not found';
  END IF;

  IF p_status = 'shipped' THEN
    IF v_order.status NOT IN ('ready', 'sent_to_printer', 'shipped') THEN
      RAISE EXCEPTION 'Only an order with an address can be marked shipped';
    END IF;
    IF v_courier IS NULL OR v_tracking IS NULL THEN
      RAISE EXCEPTION 'Enter the courier and tracking number';
    END IF;
    UPDATE qr_print_orders
    SET status = 'shipped', courier = v_courier, tracking_number = v_tracking,
        shipped_at = coalesce(shipped_at, now()), updated_at = now()
    WHERE id = p_order_id RETURNING * INTO v_order;
  ELSIF p_status = 'delivered' THEN
    IF v_order.status <> 'shipped' THEN
      RAISE EXCEPTION 'Only a shipped order can be marked delivered';
    END IF;
    UPDATE qr_print_orders SET status = 'delivered', delivered_at = now(), updated_at = now()
    WHERE id = p_order_id RETURNING * INTO v_order;
  ELSIF p_status = 'cancelled' THEN
    IF v_order.status = 'delivered' THEN
      RAISE EXCEPTION 'A delivered order cannot be cancelled';
    END IF;
    UPDATE qr_print_orders SET status = 'cancelled', updated_at = now()
    WHERE id = p_order_id RETURNING * INTO v_order;
  ELSE
    RAISE EXCEPTION 'Unsupported status %', p_status;
  END IF;

  RETURN to_jsonb(v_order);
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_update_print_order(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_update_print_order(uuid, text, text, text) TO authenticated, service_role;

-- ============================================
-- 6. Print-order emails are sent once each
-- ============================================
ALTER TABLE email_log DROP CONSTRAINT IF EXISTS email_log_kind_check;
ALTER TABLE email_log ADD CONSTRAINT email_log_kind_check CHECK (kind IN (
  'receipt', 'renewal_notice', 'payment_failed', 'plan_ending',
  'print_order', 'print_order_placed', 'print_address_needed', 'print_shipped'
));

-- ============================================
-- 7. The owner's data export includes the address and the kit
-- ============================================
-- Same as 20260925090000_consent_retention_and_erasure.sql, plus AutoPay
-- mandates (without the card/UPI token), delivery addresses, print orders,
-- and every processor that receives owner data.
CREATE OR REPLACE FUNCTION export_my_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT jsonb_build_object(
    'exported_at', now(),
    'notice', 'This is every record Reviyo holds that is linked to your account. '
              || 'Customer review sessions are shown because your business received them; '
              || 'they are anonymous and contain no identifier of the customer.',
    'account', (
      SELECT jsonb_build_object(
        'id', p.id,
        'email', p.email,
        'full_name', p.full_name,
        'role', p.role,
        'terms_consent_version', p.terms_consent_version,
        'terms_consented_at', p.terms_consented_at,
        'created_at', p.created_at
      )
      FROM profiles p WHERE p.id = v_user_id
    ),
    'businesses', COALESCE((
      SELECT jsonb_agg(to_jsonb(b) - 'owner_id')
      FROM businesses b WHERE b.owner_id = v_user_id
    ), '[]'::jsonb),
    'review_topics', COALESCE((
      SELECT jsonb_agg(to_jsonb(t))
      FROM review_topics t
      JOIN businesses b ON b.id = t.business_id
      WHERE b.owner_id = v_user_id
    ), '[]'::jsonb),
    'review_sessions', COALESCE((
      SELECT jsonb_agg(to_jsonb(s) - 'session_token')
      FROM review_sessions s
      JOIN businesses b ON b.id = s.business_id
      WHERE b.owner_id = v_user_id
    ), '[]'::jsonb),
    'private_feedback', COALESCE((
      SELECT jsonb_agg(to_jsonb(f))
      FROM private_feedback f
      JOIN businesses b ON b.id = f.business_id
      WHERE b.owner_id = v_user_id
    ), '[]'::jsonb),
    'analytics_events', COALESCE((
      SELECT jsonb_agg(to_jsonb(e))
      FROM analytics_events e
      JOIN businesses b ON b.id = e.business_id
      WHERE b.owner_id = v_user_id
    ), '[]'::jsonb),
    'subscriptions', COALESCE((
      SELECT jsonb_agg(to_jsonb(sub))
      FROM subscriptions sub
      JOIN businesses b ON b.id = sub.business_id
      WHERE b.owner_id = v_user_id
    ), '[]'::jsonb),
    'payment_orders', COALESCE((
      SELECT jsonb_agg(to_jsonb(o) - 'user_id')
      FROM payment_orders o
      JOIN businesses b ON b.id = o.business_id
      WHERE b.owner_id = v_user_id
    ), '[]'::jsonb),
    'autopay_mandates', COALESCE((
      SELECT jsonb_agg(to_jsonb(m) - 'user_id' - 'token_id')
      FROM autopay_mandates m
      JOIN businesses b ON b.id = m.business_id
      WHERE b.owner_id = v_user_id
    ), '[]'::jsonb),
    'delivery_addresses', COALESCE((
      SELECT jsonb_agg(to_jsonb(a))
      FROM delivery_addresses a
      JOIN businesses b ON b.id = a.business_id
      WHERE b.owner_id = v_user_id
    ), '[]'::jsonb),
    'qr_print_orders', COALESCE((
      SELECT jsonb_agg(to_jsonb(q))
      FROM qr_print_orders q
      JOIN businesses b ON b.id = q.business_id
      WHERE b.owner_id = v_user_id
    ), '[]'::jsonb),
    'shared_with', jsonb_build_array(
      'Supabase — database, authentication and hosting',
      'Our configured AI provider — only at the moment a review draft is requested',
      'Razorpay — payment processing',
      'Hostinger — sending the emails we send you',
      'Our print partner and courier — your delivery address, only to print and deliver your free QR kit'
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION export_my_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION export_my_data() TO authenticated;


-- ============================================
-- 8. Businesses already paying when this launched
-- ============================================
-- Any business with a paid order and a plan running now gets its kit too.
INSERT INTO qr_print_orders (business_id, payment_order_id)
SELECT DISTINCT ON (o.business_id) o.business_id, o.order_id
FROM payment_orders o
JOIN LATERAL (
  SELECT status, expires_at FROM subscriptions s
  WHERE s.business_id = o.business_id
  ORDER BY s.created_at DESC LIMIT 1
) s ON true
WHERE o.status = 'paid' AND o.amount > 0
  AND s.status = 'active' AND s.expires_at > now()
ORDER BY o.business_id, o.created_at
ON CONFLICT (business_id) DO NOTHING;
