/*
# UPI / card AutoPay with a 14-day free trial

## How it works

1. During onboarding (or later on Billing) the owner picks a plan and a method
   (UPI AutoPay or card) and pays a ₹1 authorisation. That payment registers a
   recurring mandate ("token") with Razorpay, capped at the plan price.
2. The ₹1 is refunded straight away. The 14-day trial starts at that moment —
   a new business no longer gets a trial without setting up AutoPay.
3. The `autopay-scheduler` Edge Function runs on a schedule. About three days
   before the trial or term ends it creates a Razorpay order with a pre-debit
   notification, and once the notice period has passed it charges the mandate.
4. Razorpay's webhook reports the result. A successful charge extends the
   subscription through the existing `process_paid_order`. A failed one is
   retried, up to three attempts in a row.

Owners can cancel AutoPay from Billing at any time; access continues until the
current trial or term ends.

## Money-safety rules enforced here

- At most one live mandate per business (partial unique index).
- At most one in-flight charge per mandate (partial unique index), so a
  scheduler that runs twice cannot charge twice.
- Every entitlement still comes from `process_paid_order`, which reads the
  stored order, locks it, and ignores duplicate webhooks.
- All functions below are callable only by the service role.
*/

-- ============================================
-- 1. Buying during a trial extends from the trial's end
-- ============================================
-- Previously a purchase during the trial started the paid term immediately and
-- the unused trial days were lost. AutoPay charges shortly before the trial
-- ends, so treat a live trial like a live term: the new term starts after it.
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
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_current_sub.status IN ('active', 'trial')
       AND v_current_sub.expires_at IS NOT NULL
       AND v_current_sub.expires_at > v_now THEN
      -- After a trial the paid term starts where the trial ends.
      v_new_starts_at := CASE WHEN v_current_sub.status = 'active' THEN v_current_sub.starts_at ELSE v_current_sub.expires_at END;
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
    INSERT INTO subscriptions (
      business_id, plan, status, starts_at, expires_at, payment_reference, created_at, updated_at
    )
    VALUES (
      p_business_id, p_plan, 'active', v_now, v_now + v_duration, p_payment_reference, v_now, v_now
    )
    RETURNING * INTO v_updated_sub;
  END IF;

  RETURN to_jsonb(v_updated_sub);
END;
$$;

REVOKE EXECUTE ON FUNCTION activate_or_renew_subscription(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION activate_or_renew_subscription(uuid, text, text) TO service_role;

-- ============================================
-- 2. New businesses start without a trial
-- ============================================
CREATE OR REPLACE FUNCTION create_business_with_defaults(
  p_name text,
  p_slug text,
  p_category text,
  p_google_review_url text DEFAULT NULL,
  p_logo_url text DEFAULT NULL,
  p_welcome_message text DEFAULT NULL,
  p_topics text[] DEFAULT ARRAY[]::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid := auth.uid();
  v_business businesses%ROWTYPE;
  v_slug text := lower(trim(p_slug));
  v_topic text;
  v_seen_topics text[] := ARRAY[]::text[];
BEGIN
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF EXISTS (SELECT 1 FROM businesses WHERE owner_id = v_owner_id) THEN
    RAISE EXCEPTION 'A business already exists for this account';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 OR length(trim(p_name)) > 200 THEN
    RAISE EXCEPTION 'Business name must be between 1 and 200 characters';
  END IF;

  IF p_category IS NULL OR length(trim(p_category)) = 0 OR length(trim(p_category)) > 100 THEN
    RAISE EXCEPTION 'Business category must be between 1 and 100 characters';
  END IF;

  IF cardinality(p_topics) = 0 OR cardinality(p_topics) > 20 THEN
    RAISE EXCEPTION 'Choose between 1 and 20 review topics';
  END IF;

  IF v_slug IS NULL OR v_slug = '' OR v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    v_slug := 'business-' || left(replace(gen_random_uuid()::text, '-', ''), 8);
  END IF;

  WHILE EXISTS (SELECT 1 FROM businesses WHERE slug = v_slug) LOOP
    v_slug := left(v_slug, 240) || '-' || left(replace(gen_random_uuid()::text, '-', ''), 8);
  END LOOP;

  INSERT INTO businesses (
    owner_id,
    name,
    slug,
    category,
    google_review_url,
    logo_url,
    welcome_message
  )
  VALUES (
    v_owner_id,
    trim(p_name),
    v_slug,
    trim(p_category),
    nullif(trim(p_google_review_url), ''),
    nullif(trim(p_logo_url), ''),
    nullif(trim(p_welcome_message), '')
  )
  RETURNING * INTO v_business;

  FOR v_topic_index IN 1..cardinality(p_topics) LOOP
    v_topic := trim(p_topics[v_topic_index]);

    IF length(v_topic) = 0 OR length(v_topic) > 80 THEN
      RAISE EXCEPTION 'Each review topic must be between 1 and 80 characters';
    END IF;

    IF lower(v_topic) = ANY(v_seen_topics) THEN
      CONTINUE;
    END IF;

    v_seen_topics := array_append(v_seen_topics, lower(v_topic));
    INSERT INTO review_topics (business_id, label, display_order, active)
    VALUES (v_business.id, v_topic, v_topic_index - 1, true);
  END LOOP;

  -- No subscription here: the 14-day trial starts when the owner sets up
  -- AutoPay (start_autopay_trial). Until then the dashboard sends them to Billing.

  RETURN to_jsonb(v_business);
END;
$$;

REVOKE EXECUTE ON FUNCTION create_business_with_defaults(text, text, text, text, text, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_business_with_defaults(text, text, text, text, text, text, text[]) TO authenticated;

-- ============================================
-- 3. Mandates
-- ============================================
CREATE TABLE IF NOT EXISTS autopay_mandates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  plan text NOT NULL CHECK (plan IN ('6_months', '12_months')),
  -- Charged every term, in paise. Also the mandate's maximum debit.
  amount integer NOT NULL CHECK (amount > 0),
  method text NOT NULL CHECK (method IN ('upi', 'card')),
  razorpay_customer_id text NOT NULL,
  auth_order_id text NOT NULL UNIQUE,
  auth_payment_id text UNIQUE,
  auth_refund_id text,
  token_id text UNIQUE,
  status text NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'authorized', 'active', 'paused', 'rejected', 'cancelled', 'failed')),
  failed_attempts int NOT NULL DEFAULT 0,
  consent_version text NOT NULL,
  consented_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE autopay_mandates IS
  'Recurring-payment mandates (Razorpay tokens). status: created = ₹1 not paid yet; authorized = ₹1 paid, bank confirmation pending; active = confirmed; paused/rejected/cancelled/failed = no charges.';

CREATE INDEX IF NOT EXISTS idx_autopay_mandates_business ON autopay_mandates(business_id);

-- One live mandate per business.
CREATE UNIQUE INDEX IF NOT EXISTS idx_autopay_mandates_one_live
  ON autopay_mandates(business_id)
  WHERE status IN ('authorized', 'active', 'paused');

ALTER TABLE autopay_mandates ENABLE ROW LEVEL SECURITY;

-- Owners and admins may read. Nobody writes from the browser.
DROP POLICY IF EXISTS "autopay_mandates_select_own" ON autopay_mandates;
CREATE POLICY "autopay_mandates_select_own" ON autopay_mandates FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = autopay_mandates.business_id AND businesses.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "autopay_mandates_select_admin" ON autopay_mandates;
CREATE POLICY "autopay_mandates_select_admin" ON autopay_mandates FOR SELECT
  TO authenticated USING (is_admin());

-- ============================================
-- 4. Recurring charges live in payment_orders
-- ============================================
ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'one_time',
  ADD COLUMN IF NOT EXISTS mandate_id uuid REFERENCES autopay_mandates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS charge_after timestamptz,
  ADD COLUMN IF NOT EXISTS attempted_at timestamptz;

ALTER TABLE payment_orders DROP CONSTRAINT IF EXISTS payment_orders_kind_check;
ALTER TABLE payment_orders
  ADD CONSTRAINT payment_orders_kind_check CHECK (kind IN ('one_time', 'autopay'));

-- One in-flight charge per mandate.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_orders_one_inflight_autopay
  ON payment_orders(mandate_id)
  WHERE kind = 'autopay' AND status IN ('created', 'attempted');

-- ============================================
-- 4b. Never refuse money that was actually received
-- ============================================
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

  -- 'failed' is allowed: a payment Razorpay later reports as captured (for
  -- example after its own UPI retries) is money received and must be honoured.
  IF v_order.status NOT IN ('created', 'attempted', 'failed') THEN
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

REVOKE EXECUTE ON FUNCTION process_paid_order(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION process_paid_order(text, text) TO service_role;

-- ============================================
-- 5. Start the trial once the ₹1 authorisation is paid
-- ============================================
-- Idempotent: the browser and the webhook may both report the same payment.
CREATE OR REPLACE FUNCTION start_autopay_trial(
  p_auth_order_id text,
  p_payment_id text,
  p_token_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_mandate autopay_mandates%ROWTYPE;
  v_subscription subscriptions%ROWTYPE;
  v_trial_started boolean := false;
BEGIN
  IF p_auth_order_id IS NULL OR p_payment_id IS NULL OR p_token_id IS NULL THEN
    RAISE EXCEPTION 'Order, payment, and token are required';
  END IF;

  SELECT * INTO v_mandate FROM autopay_mandates WHERE auth_order_id = p_auth_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'AutoPay setup not found';
  END IF;

  IF v_mandate.auth_payment_id IS NOT NULL THEN
    IF v_mandate.auth_payment_id IS DISTINCT FROM p_payment_id THEN
      RAISE EXCEPTION 'AutoPay setup was completed with a different payment';
    END IF;
  ELSIF v_mandate.status <> 'created' THEN
    RAISE EXCEPTION 'AutoPay setup cannot be completed from status %', v_mandate.status;
  ELSE
    -- Another setup may have completed in the meantime; keep only one live.
    IF EXISTS (
      SELECT 1 FROM autopay_mandates
      WHERE business_id = v_mandate.business_id
        AND id <> v_mandate.id
        AND status IN ('authorized', 'active', 'paused')
    ) THEN
      RAISE EXCEPTION 'AutoPay is already set up for this business';
    END IF;

    UPDATE autopay_mandates
    SET status = 'authorized', auth_payment_id = p_payment_id, token_id = p_token_id, updated_at = now()
    WHERE id = v_mandate.id;

    -- One free trial per business, ever.
    IF NOT EXISTS (SELECT 1 FROM subscriptions WHERE business_id = v_mandate.business_id) THEN
      INSERT INTO subscriptions (business_id, plan, status, starts_at, expires_at)
      VALUES (v_mandate.business_id, v_mandate.plan, 'trial', now(), now() + interval '14 days');
      v_trial_started := true;
    END IF;
  END IF;

  SELECT * INTO v_subscription FROM subscriptions
  WHERE business_id = v_mandate.business_id
  ORDER BY created_at DESC LIMIT 1;

  RETURN jsonb_build_object(
    'trial_started', v_trial_started,
    'subscription', CASE WHEN v_subscription.id IS NULL THEN NULL ELSE to_jsonb(v_subscription) END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION start_autopay_trial(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION start_autopay_trial(text, text, text) TO service_role;

-- ============================================
-- 6. Which mandates need a charge prepared
-- ============================================
-- Due when the current trial/term ends within three days (or already ended),
-- nothing is in flight, and fewer than three charges in a row have failed.
CREATE OR REPLACE FUNCTION autopay_mandates_due_for_charge()
RETURNS TABLE (
  mandate_id uuid,
  business_id uuid,
  user_id uuid,
  plan text,
  amount integer,
  method text,
  razorpay_customer_id text,
  token_id text,
  auth_payment_id text,
  expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.id, m.business_id, m.user_id, m.plan, m.amount, m.method,
         m.razorpay_customer_id, m.token_id, m.auth_payment_id, s.expires_at
  FROM autopay_mandates m
  JOIN LATERAL (
    SELECT expires_at FROM subscriptions
    WHERE subscriptions.business_id = m.business_id
    ORDER BY created_at DESC LIMIT 1
  ) s ON true
  WHERE m.status IN ('authorized', 'active')
    AND m.token_id IS NOT NULL
    AND m.failed_attempts < 3
    AND s.expires_at IS NOT NULL
    AND s.expires_at <= now() + interval '3 days'
    AND NOT EXISTS (
      SELECT 1 FROM payment_orders o
      WHERE o.mandate_id = m.id AND o.kind = 'autopay' AND o.status IN ('created', 'attempted')
    );
$$;

REVOKE EXECUTE ON FUNCTION autopay_mandates_due_for_charge() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION autopay_mandates_due_for_charge() TO service_role;

-- ============================================
-- 7. Record the outcome of a recurring charge
-- ============================================
-- Called from the webhook for payment.captured / payment.failed on an AutoPay
-- order. Safe to call repeatedly for the same event.
CREATE OR REPLACE FUNCTION settle_autopay_charge(
  p_order_id text,
  p_payment_id text,
  p_captured boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order payment_orders%ROWTYPE;
  v_result jsonb;
BEGIN
  SELECT * INTO v_order FROM payment_orders WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.kind <> 'autopay' THEN
    RAISE EXCEPTION 'AutoPay order not found';
  END IF;

  IF p_captured THEN
    v_result := process_paid_order(p_order_id, p_payment_id);
    -- Revive a mandate that had given up, unless the owner has since set up a
    -- new one (only one may be live, and this must never block recording money).
    UPDATE autopay_mandates m
    SET failed_attempts = 0,
        status = CASE
          WHEN m.status = 'authorized' THEN 'active'
          WHEN m.status = 'failed' AND NOT EXISTS (
            SELECT 1 FROM autopay_mandates other
            WHERE other.business_id = m.business_id AND other.id <> m.id
              AND other.status IN ('authorized', 'active', 'paused')
          ) THEN 'active'
          ELSE m.status
        END,
        updated_at = now()
    WHERE m.id = v_order.mandate_id;
    RETURN v_result;
  END IF;

  -- A failure only counts once, and never overrides a success.
  IF v_order.status IN ('created', 'attempted') THEN
    UPDATE payment_orders
    SET status = 'failed', updated_at = now(),
        metadata = metadata || jsonb_build_object('failed_payment_id', p_payment_id)
    WHERE id = v_order.id;

    UPDATE autopay_mandates
    SET failed_attempts = failed_attempts + 1,
        status = CASE WHEN failed_attempts + 1 >= 3 AND status IN ('authorized', 'active') THEN 'failed' ELSE status END,
        updated_at = now()
    WHERE id = v_order.mandate_id;
  END IF;

  RETURN jsonb_build_object('failed', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION settle_autopay_charge(text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION settle_autopay_charge(text, text, boolean) TO service_role;
