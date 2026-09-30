/*
# Website visit counts for reviyo.in's own public pages

Counts, not visitors: one row per day, page, and referring website, holding a
number. No cookie, IP address, user agent, user ID, or device identifier is
sent or stored, so a count cannot identify anyone (see the Cookie Policy,
clause 5). Customer review pages (/r/...) and the signed-in app are never
counted.

- `record_site_page_view` is called by the browser, signed in or not.
- `site_traffic_summary` returns totals for the admin dashboard.
- Rows older than 400 days are deleted as new views arrive.
*/

CREATE TABLE IF NOT EXISTS site_page_views (
  -- Indian date, so "today" matches the owner's day.
  day date NOT NULL,
  path text NOT NULL CHECK (path ~ '^/[a-z0-9/-]{0,120}$'),
  -- The website that linked here, host only ('' = direct, typed, or unknown).
  referrer_host text NOT NULL DEFAULT '' CHECK (referrer_host ~ '^[a-z0-9.-]{0,253}$'),
  views integer NOT NULL DEFAULT 0 CHECK (views >= 0),
  PRIMARY KEY (day, path, referrer_host)
);

COMMENT ON TABLE site_page_views IS
  'Daily page-view counts for public marketing pages. No personal data: no IP, cookie, user, or device identifier.';

ALTER TABLE site_page_views ENABLE ROW LEVEL SECURITY;
-- Only the functions below touch it.
REVOKE ALL ON site_page_views FROM PUBLIC, anon, authenticated;
GRANT ALL ON site_page_views TO service_role;

CREATE OR REPLACE FUNCTION record_site_page_view(p_path text, p_referrer_host text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_day date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_path text := lower(coalesce(p_path, ''));
  v_ref text := lower(coalesce(p_referrer_host, ''));
BEGIN
  IF v_path <> '/' THEN
    v_path := rtrim(v_path, '/');
  END IF;
  -- Public pages only: never a customer's review page or the signed-in app.
  IF v_path !~ '^/[a-z0-9/-]{0,120}$'
     OR v_path ~ '^/(r|dashboard|admin|onboarding|reset-password|app)(/|$)' THEN
    RETURN;
  END IF;

  v_ref := regexp_replace(v_ref, '^www\.', '');
  IF v_ref !~ '^[a-z0-9.-]{1,253}$' OR v_ref IN ('reviyo.in', 'localhost', '127.0.0.1') THEN
    v_ref := '';
  END IF;

  -- A flood of made-up paths or referrers cannot grow the table without limit.
  IF (SELECT count(*) FROM site_page_views WHERE day = v_day) >= 2000
     AND NOT EXISTS (
       SELECT 1 FROM site_page_views WHERE day = v_day AND path = v_path AND referrer_host = v_ref
     ) THEN
    RETURN;
  END IF;

  INSERT INTO site_page_views (day, path, referrer_host, views)
  VALUES (v_day, v_path, v_ref, 1)
  ON CONFLICT (day, path, referrer_host) DO UPDATE SET views = site_page_views.views + 1;

  DELETE FROM site_page_views WHERE day < v_day - 400;
END;
$$;

REVOKE EXECUTE ON FUNCTION record_site_page_view(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_site_page_view(text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION site_traffic_summary(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 400);
  v_from date := v_today - (v_days - 1);
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  RETURN jsonb_build_object(
    'today', (SELECT coalesce(sum(views), 0) FROM site_page_views WHERE day = v_today),
    'last_7_days', (SELECT coalesce(sum(views), 0) FROM site_page_views WHERE day > v_today - 7),
    'period_total', (SELECT coalesce(sum(views), 0) FROM site_page_views WHERE day >= v_from),
    'days', v_days,
    'by_day', coalesce((
      SELECT jsonb_agg(jsonb_build_object('day', d.day, 'views', coalesce(v.views, 0)) ORDER BY d.day)
      FROM generate_series(v_from, v_today, interval '1 day') AS d(day)
      LEFT JOIN (
        SELECT day, sum(views) AS views FROM site_page_views WHERE day >= v_from GROUP BY day
      ) v ON v.day = d.day::date
    ), '[]'::jsonb),
    'top_pages', coalesce((
      SELECT jsonb_agg(jsonb_build_object('path', path, 'views', views) ORDER BY views DESC, path)
      FROM (
        SELECT path, sum(views) AS views FROM site_page_views
        WHERE day >= v_from GROUP BY path ORDER BY sum(views) DESC, path LIMIT 10
      ) p
    ), '[]'::jsonb),
    'top_sources', coalesce((
      SELECT jsonb_agg(jsonb_build_object('source', referrer_host, 'views', views) ORDER BY views DESC, referrer_host)
      FROM (
        SELECT referrer_host, sum(views) AS views FROM site_page_views
        WHERE day >= v_from GROUP BY referrer_host ORDER BY sum(views) DESC, referrer_host LIMIT 10
      ) s
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION site_traffic_summary(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION site_traffic_summary(integer) TO authenticated, service_role;
