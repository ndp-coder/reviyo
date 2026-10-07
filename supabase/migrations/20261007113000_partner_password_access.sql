-- An invitation verifies the mailbox, but does not set an Auth password.
-- Inspect the Auth record rather than trusting editable user metadata.
CREATE FUNCTION partner_has_password(p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user AND nullif(encrypted_password, '') IS NOT NULL);
$$;
REVOKE ALL ON FUNCTION partner_has_password(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION partner_has_password(uuid) TO service_role;

CREATE OR REPLACE FUNCTION my_commission_partner() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id FROM commission_partners p JOIN auth.users u ON lower(btrim(u.email)) = p.email
  WHERE u.id = auth.uid() AND p.active AND nullif(u.encrypted_password, '') IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION my_commission_partner() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION my_commission_partner() TO authenticated;

-- Only the caller's access state is returned, never a password hash or another
-- member's bank details. This remains callable before password setup.
CREATE FUNCTION my_partner_access() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'invited', EXISTS (SELECT 1 FROM commission_partners p JOIN auth.users u ON lower(btrim(u.email)) = p.email WHERE u.id = auth.uid() AND p.active),
    'password_set', EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND nullif(encrypted_password, '') IS NOT NULL)
  );
$$;
REVOKE ALL ON FUNCTION my_partner_access() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION my_partner_access() TO authenticated;
