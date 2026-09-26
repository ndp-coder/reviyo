/*
# Printed QR codes keep working after a plan ends

When a trial or plan ended, `create_review_session` refused with "Business not
found", and the review page told the customer at the counter to check their
internet connection. Every counter card the shop had printed looked broken to
its own customers, and the owner had no reason to believe Reviyo was safe to
put on a counter.

This function gives the review page just enough to send those customers
straight to the business's Google review page instead: the business name,
logo, and Google review link. It creates no review session, records no
analytics, and collects nothing from the customer. AI drafting, analytics, and
private feedback stay paid features.

It returns nothing for a business with an active trial or plan (those use
`create_review_session`), a deactivated business, or one with no Google link.
*/

CREATE OR REPLACE FUNCTION get_lapsed_business_review_link(p_business_slug text)
RETURNS TABLE (
  business_name text,
  business_logo_url text,
  business_google_review_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.name, b.logo_url, b.google_review_url
  FROM businesses b
  WHERE b.slug = p_business_slug
    AND b.is_active = true
    AND b.google_review_url IS NOT NULL
    AND NOT business_has_active_subscription(b.id);
$$;

-- Called by the public review page, so anonymous visitors need it.
REVOKE EXECUTE ON FUNCTION get_lapsed_business_review_link(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_lapsed_business_review_link(text) TO anon, authenticated;
