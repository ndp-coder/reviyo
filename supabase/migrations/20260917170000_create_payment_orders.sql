-- Payment Orders and Razorpay Subscriptions Migration

CREATE TABLE IF NOT EXISTS payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id text UNIQUE NOT NULL,
  payment_id text,
  plan text NOT NULL CHECK (plan IN ('6_months', '12_months')),
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'attempted', 'paid', 'failed')),
  receipt text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_business ON payment_orders(business_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_order_id ON payment_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_orders_payment_id_unique
  ON payment_orders(payment_id) WHERE payment_id IS NOT NULL;

ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;

-- Owner can view payment orders for their own businesses
DROP POLICY IF EXISTS "payment_orders_select_own" ON payment_orders;
CREATE POLICY "payment_orders_select_own" ON payment_orders FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = payment_orders.business_id AND businesses.owner_id = auth.uid())
  );

-- Admins can view all payment orders
DROP POLICY IF EXISTS "payment_orders_select_admin" ON payment_orders;
CREATE POLICY "payment_orders_select_admin" ON payment_orders FOR SELECT
  TO authenticated USING (is_admin());

-- Atomically activate or extend a subscription on successful payment verification
CREATE OR REPLACE FUNCTION activate_or_renew_subscription(
  p_business_id uuid,
  p_plan text,
  p_payment_reference text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_sub record;
  v_now timestamptz := now();
  v_duration interval;
  v_new_starts_at timestamptz;
  v_new_expires_at timestamptz;
  v_updated_sub subscriptions%ROWTYPE;
BEGIN
  IF p_plan = '6_months' THEN
    v_duration := interval '6 months';
  ELSIF p_plan = '12_months' THEN
    v_duration := interval '12 months';
  ELSE
    RAISE EXCEPTION 'Invalid plan: %', p_plan;
  END IF;

  SELECT * INTO v_current_sub
  FROM subscriptions
  WHERE business_id = p_business_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    -- If currently active and not yet expired, extend starting from current expiration
    IF v_current_sub.status = 'active' AND v_current_sub.expires_at IS NOT NULL AND v_current_sub.expires_at > v_now THEN
      v_new_starts_at := v_current_sub.starts_at;
      v_new_expires_at := v_current_sub.expires_at + v_duration;
    ELSE
      v_new_starts_at := v_now;
      v_new_expires_at := v_now + v_duration;
    END IF;

    UPDATE subscriptions
    SET
      plan = p_plan,
      status = 'active',
      starts_at = v_new_starts_at,
      expires_at = v_new_expires_at,
      payment_reference = p_payment_reference,
      updated_at = v_now
    WHERE id = v_current_sub.id
    RETURNING * INTO v_updated_sub;
  ELSE
    v_new_starts_at := v_now;
    v_new_expires_at := v_now + v_duration;

    INSERT INTO subscriptions (
      business_id,
      plan,
      status,
      starts_at,
      expires_at,
      payment_reference,
      created_at,
      updated_at
    )
    VALUES (
      p_business_id,
      p_plan,
      'active',
      v_new_starts_at,
      v_new_expires_at,
      p_payment_reference,
      v_now,
      v_now
    )
    RETURNING * INTO v_updated_sub;
  END IF;

  RETURN to_jsonb(v_updated_sub);
END;
$$;

REVOKE EXECUTE ON FUNCTION activate_or_renew_subscription(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION activate_or_renew_subscription(uuid, text, text) TO service_role;

-- Fulfill a payment exactly once. All entitlement values come from the stored
-- order, never from webhook notes or browser input.
CREATE OR REPLACE FUNCTION process_paid_order(
  p_order_id text,
  p_payment_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order payment_orders%ROWTYPE;
  v_subscription jsonb;
BEGIN
  IF p_order_id IS NULL OR p_order_id = '' OR p_payment_id IS NULL OR p_payment_id = '' THEN
    RAISE EXCEPTION 'Order ID and payment ID are required';
  END IF;

  SELECT * INTO v_order
  FROM payment_orders
  WHERE order_id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment order not found';
  END IF;

  IF v_order.status = 'paid' THEN
    IF v_order.payment_id IS DISTINCT FROM p_payment_id THEN
      RAISE EXCEPTION 'Payment order was fulfilled with a different payment';
    END IF;

    SELECT to_jsonb(s) INTO v_subscription
    FROM subscriptions s
    WHERE s.business_id = v_order.business_id
    ORDER BY s.created_at DESC
    LIMIT 1;

    RETURN jsonb_build_object(
      'subscription', v_subscription,
      'already_processed', true
    );
  END IF;

  IF v_order.status NOT IN ('created', 'attempted') THEN
    RAISE EXCEPTION 'Payment order cannot be fulfilled from status %', v_order.status;
  END IF;

  v_subscription := activate_or_renew_subscription(
    v_order.business_id,
    v_order.plan,
    p_payment_id
  );

  UPDATE payment_orders
  SET status = 'paid', payment_id = p_payment_id, updated_at = now()
  WHERE id = v_order.id;

  INSERT INTO analytics_events (business_id, event_type, metadata)
  VALUES (
    v_order.business_id,
    'subscription_purchased',
    jsonb_build_object(
      'plan', v_order.plan,
      'order_id', v_order.order_id,
      'payment_id', p_payment_id
    )
  );

  RETURN jsonb_build_object(
    'subscription', v_subscription,
    'already_processed', false
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION process_paid_order(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION process_paid_order(text, text) TO service_role;
