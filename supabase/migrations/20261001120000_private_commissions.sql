-- Private, invitation-only partners. All money writes are server-only.
CREATE TABLE commission_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email = lower(btrim(email))),
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 100),
  active boolean NOT NULL DEFAULT true,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  invitation_sent_at timestamptz,
  contact_id text,
  fund_account_id text,
  bank_last4 text,
  bank_setup_at timestamptz
);
CREATE TABLE commission_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES commission_partners(id),
  email text NOT NULL UNIQUE CHECK (email = lower(btrim(email))),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz,
  paid_at timestamptz,
  capture_verified_at timestamptz,
  qualified_at timestamptz,
  order_id uuid UNIQUE REFERENCES payment_orders(id) ON DELETE SET NULL
);
CREATE INDEX commission_referrals_partner ON commission_referrals(partner_id);
CREATE TABLE commission_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES commission_partners(id),
  referral_id uuid UNIQUE REFERENCES commission_referrals(id),
  milestone integer,
  amount integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('commission', 'bonus')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','queued','processing','processed','failed','reversed','cancelled','needs_attention')),
  created_at timestamptz NOT NULL DEFAULT now(),
  first_attempt_at timestamptz,
  payout_id text UNIQUE,
  payout_body jsonb,
  last_checked_at timestamptz,
  detail text,
  CHECK ((kind = 'commission' AND amount = 100000 AND referral_id IS NOT NULL AND milestone IS NULL)
    OR (kind = 'bonus' AND amount = 200000 AND referral_id IS NULL AND milestone > 0 AND milestone % 10 = 0)),
  UNIQUE (partner_id, milestone)
);
CREATE INDEX commission_earnings_partner ON commission_earnings(partner_id);
CREATE INDEX commission_earnings_pending ON commission_earnings(status, last_checked_at);

ALTER TABLE payment_orders ADD COLUMN commission_paid_at timestamptz;
CREATE FUNCTION stamp_commission_payment() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'paid' AND OLD.status <> 'paid' THEN NEW.commission_paid_at := now();
  ELSE NEW.commission_paid_at := OLD.commission_paid_at; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER commission_payment_clock BEFORE UPDATE ON payment_orders
FOR EACH ROW EXECUTE FUNCTION stamp_commission_payment();
CREATE FUNCTION link_commission_payment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'paid' AND OLD.status <> 'paid' AND NEW.amount = 299900 AND NEW.currency = 'INR' AND NEW.plan = '12_months'
    AND NOT EXISTS (SELECT 1 FROM payment_orders o WHERE o.user_id = NEW.user_id AND o.id <> NEW.id AND o.status = 'paid') THEN
    UPDATE commission_referrals r SET paid_at = NEW.commission_paid_at, order_id = NEW.id
    FROM auth.users u WHERE u.id = NEW.user_id AND lower(btrim(u.email)) = r.email
    AND r.created_at < NEW.commission_paid_at AND r.order_id IS NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER commission_payment_link AFTER UPDATE ON payment_orders FOR EACH ROW EXECUTE FUNCTION link_commission_payment();
-- Existing payments intentionally do not gain a new referral clock.

CREATE FUNCTION my_commission_partner() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id FROM commission_partners p JOIN auth.users u ON lower(btrim(u.email)) = p.email
  WHERE u.id = auth.uid() AND p.active;
$$;
ALTER TABLE commission_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_earnings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON commission_partners, commission_referrals, commission_earnings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON commission_partners, commission_referrals, commission_earnings TO authenticated;
GRANT ALL ON commission_partners, commission_referrals, commission_earnings TO service_role;
CREATE POLICY commission_partners_read ON commission_partners FOR SELECT TO authenticated USING (id = my_commission_partner() OR is_admin());
CREATE POLICY commission_referrals_read ON commission_referrals FOR SELECT TO authenticated USING (partner_id = my_commission_partner() OR is_admin());
CREATE POLICY commission_earnings_read ON commission_earnings FOR SELECT TO authenticated USING (partner_id = my_commission_partner() OR is_admin());

CREATE FUNCTION register_commission_referral(p_email text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_partner uuid := my_commission_partner(); v_email text := lower(btrim(p_email)); v_id uuid;
BEGIN
  IF v_partner IS NULL THEN RAISE EXCEPTION 'Invitation required'; END IF;
  -- Lock the membership so revocation cannot race registration.
  PERFORM 1 FROM commission_partners WHERE id = v_partner AND active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation required'; END IF;
  IF length(v_email) > 254 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Enter a valid email'; END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND lower(btrim(email)) = v_email) THEN RAISE EXCEPTION 'You cannot refer yourself'; END IF;
  IF EXISTS (SELECT 1 FROM auth.users u JOIN payment_orders o ON o.user_id = u.id WHERE lower(btrim(u.email)) = v_email AND o.status = 'paid') THEN
    RAISE EXCEPTION 'This owner has already paid. Register referrals before their first payment';
  END IF;
  IF (SELECT count(*) FROM commission_referrals WHERE partner_id = v_partner AND created_at > now() - interval '1 day') >= 100 THEN RAISE EXCEPTION 'Daily referral limit reached'; END IF;
  INSERT INTO commission_referrals(partner_id,email) VALUES (v_partner,v_email) RETURNING id INTO v_id;
  RETURN v_id;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'This email has already been referred';
END $$;

-- Only candidates from the first paid order per owner, registered beforehand.
-- Authorisation payments are not payment_orders and cannot qualify.
CREATE FUNCTION commission_candidates() RETURNS TABLE(referral_id uuid, payment_order_id uuid, payment_id text, razorpay_order_id text, paid_at timestamptz, capture_verified_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT r.id,o.id,o.payment_id,o.order_id,o.commission_paid_at,r.capture_verified_at
 FROM commission_referrals r JOIN commission_partners p ON p.id = r.partner_id AND p.active
 JOIN payment_orders o ON o.id = r.order_id AND o.status = 'paid'
 JOIN auth.users u ON u.id = o.user_id AND lower(btrim(u.email)) <> p.email
 WHERE r.qualified_at IS NULL AND r.created_at < o.commission_paid_at
 AND (r.last_checked_at IS NULL OR r.last_checked_at < now() - interval '1 hour')
 AND o.amount = 299900 AND o.currency = 'INR' AND o.plan = '12_months'
 AND o.payment_id IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM payment_orders earlier WHERE earlier.user_id = u.id AND earlier.status = 'paid' AND (earlier.created_at,earlier.id) < (o.created_at,o.id))
 ORDER BY r.last_checked_at NULLS FIRST,o.commission_paid_at,r.id LIMIT 20;
$$;

-- Called only after checking the live Razorpay payment and disputes/refunds.
CREATE FUNCTION qualify_commission(p_referral_id uuid, p_order_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_partner uuid; v_count integer;
BEGIN
  SELECT partner_id INTO v_partner FROM commission_referrals WHERE id = p_referral_id;
  IF v_partner IS NULL THEN RETURN false; END IF;
  PERFORM 1 FROM commission_partners WHERE id = v_partner AND active FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM commission_referrals WHERE id = p_referral_id AND capture_verified_at <= now() - interval '14 days') THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM commission_candidates() WHERE referral_id = p_referral_id AND payment_order_id = p_order_id) THEN RETURN false; END IF;
  UPDATE commission_referrals SET qualified_at = now(), order_id = p_order_id WHERE id = p_referral_id AND qualified_at IS NULL;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO commission_earnings(partner_id,referral_id,kind,amount) VALUES(v_partner,p_referral_id,'commission',100000);
  SELECT count(*) INTO v_count FROM commission_referrals WHERE partner_id = v_partner AND qualified_at IS NOT NULL;
  IF v_count % 10 = 0 THEN
    INSERT INTO commission_earnings(partner_id,milestone,kind,amount) VALUES(v_partner,v_count,'bonus',200000) ON CONFLICT DO NOTHING;
  END IF;
  RETURN true;
END $$;

-- Freeze the exact payload before any external transfer. Retried requests use
-- the earning UUID and this immutable body, even if server configuration changes.
CREATE FUNCTION prepare_commission_payout(p_id uuid, p_account text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e commission_earnings%ROWTYPE; p commission_partners%ROWTYPE;
BEGIN
  SELECT * INTO e FROM commission_earnings WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO p FROM commission_partners WHERE id = e.partner_id AND active FOR UPDATE;
  IF NOT FOUND OR p.fund_account_id IS NULL THEN RETURN NULL; END IF;
  IF e.payout_id IS NOT NULL OR e.status NOT IN ('pending','sending') THEN RETURN NULL; END IF;
  IF e.first_attempt_at < now() - interval '6 days' THEN
    UPDATE commission_earnings SET status = 'needs_attention',detail = 'Transfer response unknown. Reconcile in RazorpayX before any retry.' WHERE id = e.id;
    RETURN NULL;
  END IF;
  IF e.payout_body IS NULL THEN
    e.payout_body := jsonb_build_object('account_number',p_account,'fund_account_id',p.fund_account_id,'amount',e.amount,'currency','INR','mode','IMPS','purpose','payout','queue_if_low_balance',true,'reference_id',e.id::text,'narration','Reviyo commission');
  END IF;
  UPDATE commission_earnings SET status='sending',first_attempt_at=coalesce(first_attempt_at,now()),payout_body=e.payout_body,last_checked_at=now() WHERE id=e.id;
  RETURN e.payout_body;
END $$;

REVOKE ALL ON FUNCTION stamp_commission_payment(), link_commission_payment(), my_commission_partner(), register_commission_referral(text), commission_candidates(), qualify_commission(uuid,uuid), prepare_commission_payout(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION my_commission_partner(), register_commission_referral(text) TO authenticated;
GRANT EXECUTE ON FUNCTION commission_candidates(), qualify_commission(uuid,uuid), prepare_commission_payout(uuid,text) TO service_role;
