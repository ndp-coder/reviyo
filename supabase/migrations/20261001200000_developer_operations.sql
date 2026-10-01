CREATE TABLE developer_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  business_id uuid REFERENCES businesses(id) ON DELETE SET NULL,
  business_name text NOT NULL,
  action text NOT NULL CHECK (action IN ('pause_business','restore_business')),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 5 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE developer_activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON developer_activity FROM PUBLIC, anon, authenticated;
GRANT SELECT ON developer_activity TO authenticated;
GRANT ALL ON developer_activity TO service_role;
CREATE POLICY developer_activity_read ON developer_activity FOR SELECT TO authenticated USING (is_admin());

CREATE FUNCTION developer_set_business_access(p_id uuid, p_active boolean, p_expected_active boolean, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_business businesses%ROWTYPE;
BEGIN
  IF NOT coalesce(is_admin(),false) THEN RAISE EXCEPTION 'Developer access required'; END IF;
  IF p_active IS NULL OR p_expected_active IS NULL OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Enter a reason with 5 to 500 characters'; END IF;
  SELECT * INTO v_business FROM businesses WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Business not found'; END IF;
  IF v_business.is_active IS DISTINCT FROM p_expected_active THEN RAISE EXCEPTION 'Business access changed. Refresh before trying again'; END IF;
  IF v_business.is_active = p_active THEN RETURN; END IF;
  UPDATE businesses SET is_active = p_active WHERE id = p_id;
  INSERT INTO developer_activity(actor_id,business_id,business_name,action,reason)
  VALUES(auth.uid(),p_id,v_business.name,CASE WHEN p_active THEN 'restore_business' ELSE 'pause_business' END,btrim(p_reason));
END $$;

CREATE FUNCTION developer_summary() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT coalesce(is_admin(),false) THEN RAISE EXCEPTION 'Developer access required'; END IF;
  RETURN jsonb_build_object(
    'businesses',(SELECT count(*) FROM businesses),
    'users',(SELECT count(*) FROM profiles),
    'trials',(SELECT count(DISTINCT business_id) FROM subscriptions WHERE status = 'trial' AND expires_at > now()),
    'paying',(SELECT count(DISTINCT business_id) FROM subscriptions WHERE status = 'active' AND expires_at > now()),
    'expired',(SELECT count(*) FROM businesses b WHERE EXISTS(SELECT 1 FROM subscriptions s WHERE s.business_id=b.id) AND NOT EXISTS(SELECT 1 FROM subscriptions s WHERE s.business_id=b.id AND s.status IN ('trial','active') AND s.expires_at>now())),
    'aiDrafts',(SELECT count(*) FROM ai_generation_log),
    'started',(SELECT count(DISTINCT business_id) FROM subscriptions),
    'paidTotal',(SELECT coalesce(sum(amount),0) FROM payment_orders WHERE status='paid' AND currency='INR'),
    'paid30Days',(SELECT coalesce(sum(amount),0) FROM payment_orders WHERE status='paid' AND currency='INR' AND coalesce(commission_paid_at,updated_at)>now()-interval '30 days'),
    'failedPayments',(SELECT count(*) FROM payment_orders WHERE status='failed' AND updated_at>now()-interval '7 days'),
    'mandatesAttention',(SELECT count(*) FROM autopay_mandates WHERE status IN ('failed','rejected','paused')),
    'payoutsAttention',(SELECT count(*) FROM commission_earnings WHERE status IN ('needs_attention','failed','reversed')),
    'pendingPayouts',(SELECT coalesce(sum(amount),0) FROM commission_earnings WHERE status IN ('pending','sending','queued','processing')),
    'paused',(SELECT count(*) FROM businesses WHERE NOT is_active)
  );
END $$;
REVOKE ALL ON FUNCTION developer_set_business_access(uuid,boolean,boolean,text), developer_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION developer_set_business_access(uuid,boolean,boolean,text), developer_summary() TO authenticated;
