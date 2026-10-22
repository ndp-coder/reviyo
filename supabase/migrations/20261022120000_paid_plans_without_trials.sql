-- Stop new trials without changing any existing subscription or mandate.
ALTER TABLE businesses ALTER COLUMN trial_eligible SET DEFAULT false;
CREATE OR REPLACE FUNCTION enforce_business_trial_eligibility() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.trial_eligible := false;
  ELSIF NEW.trial_eligible IS DISTINCT FROM OLD.trial_eligible THEN
    RAISE EXCEPTION 'Trial eligibility is managed automatically';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION enforce_partner_paid_subscription() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'trial' THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'This business requires a paid plan; new trials are disabled';
    ELSIF OLD.status IS DISTINCT FROM 'trial' OR NEW.business_id IS DISTINCT FROM OLD.business_id THEN
      RAISE EXCEPTION 'This business requires a paid plan; new trials are disabled';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION enforce_business_trial_eligibility(), enforce_partner_paid_subscription() FROM PUBLIC, anon, authenticated;

-- Retain the server RPC name for browser/webhook retries from older clients.
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

    -- A mandate authorisation never grants plan access.

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
