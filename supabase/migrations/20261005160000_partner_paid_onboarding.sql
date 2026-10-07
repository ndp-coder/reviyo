-- Partner-prepared businesses activate with a paid plan, not a free trial.
-- Persist this on the business so a claimed invitation, refresh, or deleted
-- referral cannot accidentally restore trial eligibility.
ALTER TABLE businesses ADD COLUMN trial_eligible boolean NOT NULL DEFAULT true;

UPDATE businesses b SET trial_eligible = false
WHERE EXISTS (
  SELECT 1 FROM partner_business_drafts d
  JOIN commission_referrals r ON r.id = d.referral_id
  JOIN auth.users u ON lower(btrim(u.email)) = r.email
  WHERE u.id = b.owner_id
);

CREATE FUNCTION enforce_business_trial_eligibility() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.trial_eligible := NOT EXISTS (
      SELECT 1 FROM partner_business_drafts d
      JOIN commission_referrals r ON r.id = d.referral_id
      JOIN auth.users u ON lower(btrim(u.email)) = r.email
      WHERE u.id = NEW.owner_id
    );
  ELSIF NEW.trial_eligible IS DISTINCT FROM OLD.trial_eligible THEN
    RAISE EXCEPTION 'Trial eligibility is managed automatically';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER business_trial_eligibility BEFORE INSERT OR UPDATE OF trial_eligible
ON businesses FOR EACH ROW EXECUTE FUNCTION enforce_business_trial_eligibility();

-- Defense in depth for every path that could create a trial subscription.
-- Existing paid plans and already-running trials keep their original dates.
CREATE FUNCTION enforce_partner_paid_subscription() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'trial' AND NOT (SELECT trial_eligible FROM businesses WHERE id = NEW.business_id) THEN
    RAISE EXCEPTION 'This partner-prepared business requires a paid plan';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER partner_paid_subscription BEFORE INSERT OR UPDATE OF status, business_id
ON subscriptions FOR EACH ROW EXECUTE FUNCTION enforce_partner_paid_subscription();

REVOKE ALL ON FUNCTION enforce_business_trial_eligibility(), enforce_partner_paid_subscription() FROM PUBLIC, anon, authenticated;

-- AutoPay can still be enabled for renewals, but never grants a partner trial.
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
    IF (SELECT trial_eligible FROM businesses WHERE id = v_mandate.business_id) AND NOT EXISTS (SELECT 1 FROM subscriptions WHERE business_id = v_mandate.business_id) THEN
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
