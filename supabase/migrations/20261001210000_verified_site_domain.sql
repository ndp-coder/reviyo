CREATE OR REPLACE FUNCTION record_site_page_view(p_path text, p_referrer_host text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_day date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_path text := lower(coalesce(p_path, ''));
  v_ref text := lower(coalesce(p_referrer_host, ''));
BEGIN
  IF v_path <> '/' THEN v_path := rtrim(v_path, '/'); END IF;
  IF v_path !~ '^/[a-z0-9/-]{0,120}$' OR v_path ~ '^/(r|dashboard|admin|partners|onboarding|reset-password|app)(/|$)' THEN RETURN; END IF;
  v_ref := regexp_replace(v_ref, '^www\.', '');
  IF v_ref !~ '^[a-z0-9.-]{1,253}$' OR v_ref IN ('reviyo.in', 'localhost', '127.0.0.1') THEN v_ref := ''; END IF;
  IF (SELECT count(*) FROM site_page_views WHERE day = v_day) >= 2000 AND NOT EXISTS (
    SELECT 1 FROM site_page_views WHERE day = v_day AND path = v_path AND referrer_host = v_ref
  ) THEN RETURN; END IF;
  INSERT INTO site_page_views(day,path,referrer_host,views) VALUES(v_day,v_path,v_ref,1)
  ON CONFLICT(day,path,referrer_host) DO UPDATE SET views = site_page_views.views + 1;
  DELETE FROM site_page_views WHERE day < v_day - 400;
END $$;
REVOKE EXECUTE ON FUNCTION record_site_page_view(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_site_page_view(text,text) TO anon, authenticated, service_role;
