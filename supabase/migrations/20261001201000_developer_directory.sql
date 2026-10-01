CREATE FUNCTION developer_businesses(p_search text DEFAULT '', p_filter text DEFAULT 'all', p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT coalesce(is_admin(),false) THEN RAISE EXCEPTION 'Developer access required'; END IF;
  IF p_search IS NULL OR length(p_search)>200 OR p_filter IS NULL OR p_filter NOT IN ('all','paused','active','trial','unpaid','expired') OR p_offset IS NULL OR p_offset<0 OR p_offset>1000000 THEN RAISE EXCEPTION 'Invalid search or page'; END IF;
  WITH directory AS (
    SELECT b.id,b.name,b.slug,b.category,b.is_active,b.created_at,p.email,p.full_name,
      s.plan,s.expires_at,
      CASE WHEN NOT b.is_active THEN 'paused'
        WHEN EXISTS(SELECT 1 FROM subscriptions a WHERE a.business_id=b.id AND a.status='active' AND a.expires_at>now()) THEN 'active'
        WHEN EXISTS(SELECT 1 FROM subscriptions a WHERE a.business_id=b.id AND a.status='trial' AND a.expires_at>now()) THEN 'trial'
        WHEN s.id IS NULL THEN 'unpaid' ELSE 'expired' END AS access
    FROM businesses b LEFT JOIN profiles p ON p.id=b.owner_id
    LEFT JOIN LATERAL (SELECT id,plan,expires_at FROM subscriptions WHERE business_id=b.id ORDER BY CASE WHEN status='active' AND expires_at>now() THEN 2 WHEN status='trial' AND expires_at>now() THEN 1 ELSE 0 END DESC,created_at DESC,id DESC LIMIT 1) s ON true
    WHERE strpos(lower(b.name||' '||b.slug||' '||coalesce(p.email,'')||' '||coalesce(p.full_name,'')),lower(btrim(p_search)))>0
  ), filtered AS (SELECT * FROM directory WHERE p_filter='all' OR access=p_filter),
  page AS (SELECT * FROM filtered ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET p_offset)
  SELECT jsonb_build_object('total',(SELECT count(*) FROM filtered),'rows',coalesce((SELECT jsonb_agg(to_jsonb(page) ORDER BY created_at DESC,id DESC) FROM page),'[]'::jsonb)) INTO v_result;
  RETURN v_result;
END $$;

CREATE FUNCTION developer_operations() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT coalesce(is_admin(),false) THEN RAISE EXCEPTION 'Developer access required'; END IF;
  RETURN jsonb_build_object(
    'payments',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC,t.id DESC) FROM (
      SELECT o.id,o.order_id,o.payment_id,o.amount,o.currency,o.plan,o.status,o.created_at,o.kind,b.name AS business_name,p.email
      FROM payment_orders o JOIN businesses b ON b.id=o.business_id LEFT JOIN profiles p ON p.id=o.user_id ORDER BY o.created_at DESC,o.id DESC LIMIT 50
    ) t),'[]'::jsonb),
    'mandates',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.updated_at DESC,t.id DESC) FROM (
      SELECT m.id,m.status,m.failed_attempts,m.updated_at,b.name AS business_name FROM autopay_mandates m JOIN businesses b ON b.id=m.business_id
      WHERE m.status IN ('failed','rejected','paused') ORDER BY m.updated_at DESC,m.id DESC LIMIT 20
    ) t),'[]'::jsonb),
    'activity',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC,t.id DESC) FROM (
      SELECT a.id,a.business_name,a.action,a.reason,a.created_at,p.email AS actor_email FROM developer_activity a LEFT JOIN profiles p ON p.id=a.actor_id ORDER BY a.created_at DESC,a.id DESC LIMIT 30
    ) t),'[]'::jsonb)
  );
END $$;
REVOKE ALL ON FUNCTION developer_businesses(text,text,integer), developer_operations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION developer_businesses(text,text,integer), developer_operations() TO authenticated;
