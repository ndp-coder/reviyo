-- Add the monthly term without altering existing subscriptions, mandates or commission rules.
BEGIN;
ALTER TABLE public.subscriptions DROP CONSTRAINT subscriptions_plan_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_check CHECK (plan IN ('1_month', '6_months', '12_months'));
ALTER TABLE public.payment_orders DROP CONSTRAINT payment_orders_plan_check;
ALTER TABLE public.payment_orders ADD CONSTRAINT payment_orders_plan_check CHECK (plan IN ('1_month', '6_months', '12_months'));
ALTER TABLE public.autopay_mandates DROP CONSTRAINT autopay_mandates_plan_check;
ALTER TABLE public.autopay_mandates ADD CONSTRAINT autopay_mandates_plan_check CHECK (plan IN ('1_month', '6_months', '12_months'));

-- Calendar months preserve PostgreSQL's month-end handling and payment idempotency.
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
  IF p_plan = '1_month' THEN
    v_duration := interval '1 month';
  ELSIF p_plan = '6_months' THEN
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
COMMIT;
