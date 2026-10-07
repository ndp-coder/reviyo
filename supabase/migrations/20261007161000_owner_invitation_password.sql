-- Owners invited through a partner create their own password after the email
-- verifies them. Existing passwords and ordinary signup/OAuth remain valid.
CREATE FUNCTION owner_setup_password_required() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    JOIN commission_referrals r ON r.email = lower(btrim(u.email))
    JOIN partner_business_drafts d ON d.referral_id = r.id
    WHERE u.id = auth.uid() AND nullif(u.encrypted_password, '') IS NULL
  );
$$;
REVOKE ALL ON FUNCTION owner_setup_password_required() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION owner_setup_password_required() TO authenticated;

-- Both the invitation claim and the ordinary create-business RPC pass through
-- this trigger, so a passwordless invited owner cannot bypass the first step.
CREATE FUNCTION require_invited_owner_password() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.owner_id = auth.uid() AND owner_setup_password_required() THEN
    RAISE EXCEPTION 'Create your account password before continuing';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION require_invited_owner_password() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER require_invited_owner_password BEFORE INSERT ON businesses
FOR EACH ROW EXECUTE FUNCTION require_invited_owner_password();
