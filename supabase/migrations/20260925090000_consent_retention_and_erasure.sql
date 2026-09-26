/*
# Consent records, retention limits, data export, and account erasure

## Why this migration exists

The Digital Personal Data Protection Act, 2023 requires a Data Fiduciary to be
able to (a) demonstrate that consent was obtained against a specific notice,
(b) keep personal data no longer than the purpose requires, (c) give a Data
Principal a summary of their data on request, and (d) erase personal data when
asked. None of that was possible before this migration. It adds:

1. **Consent columns** on `review_sessions` and `private_feedback`, plus
   `terms_consent_version` on `profiles`, so every submission records which
   version of the notice the person actually agreed to (s.5, s.6).
2. **`record_review_consent()`** — called by the customer review page at the
   moment the customer ticks the consent box.
3. **`submit_private_feedback()`** — replaced so it records consent too. The
   old three-argument signature is dropped first, because adding a defaulted
   fourth argument would make every existing three-argument call ambiguous.
4. **`purge_expired_personal_data()`** — deletes review sessions, private
   feedback, analytics events, and AI rate-limit rows once their retention
   period has elapsed (s.8(7)). Schedule it; see the note at the bottom.
5. **`export_my_data()`** — returns everything held about the signed-in owner
   as JSON, for the right of access (s.11).
6. **`delete_my_account()`** — erases the signed-in owner's account and every
   record attached to it (s.12(3)), while first preserving the minimum
   financial record that Indian tax and company law requires to be kept. That
   carve-out is disclosed in the Privacy Policy retention table.

## Retention periods

These are the defaults rendered in the Privacy Policy. They are passed in as
arguments so the schedule and the published policy can be kept in step from one
place (`src/config/legal.ts`).
*/

-- ============================================
-- 1. Consent columns
-- ============================================

ALTER TABLE review_sessions
  ADD COLUMN IF NOT EXISTS consent_version text,
  ADD COLUMN IF NOT EXISTS consented_at timestamptz;

ALTER TABLE private_feedback
  ADD COLUMN IF NOT EXISTS consent_version text,
  ADD COLUMN IF NOT EXISTS consented_at timestamptz;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS terms_consent_version text,
  ADD COLUMN IF NOT EXISTS terms_consented_at timestamptz;

COMMENT ON COLUMN review_sessions.consent_version IS
  'Version of the customer privacy notice the customer agreed to (DPDPA s.6(1)).';
COMMENT ON COLUMN private_feedback.consent_version IS
  'Version of the notice in force when this private feedback was sent.';
COMMENT ON COLUMN profiles.terms_consent_version IS
  'Version of the Terms and Privacy Policy accepted at signup.';

-- Owners must never be able to backdate or forge their own consent record.
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (email, full_name, updated_at) ON profiles TO authenticated;

-- ============================================
-- 2. Record customer consent on a review session
-- ============================================

CREATE OR REPLACE FUNCTION record_review_consent(
  p_session_token uuid,
  p_consent_version text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_consent_version IS NULL OR length(trim(p_consent_version)) = 0 THEN
    RAISE EXCEPTION 'Consent version is required';
  END IF;

  IF length(p_consent_version) > 64 THEN
    RAISE EXCEPTION 'Consent version is invalid';
  END IF;

  -- Consent is recorded once, at the moment it is first given. A later call
  -- must not overwrite the original timestamp.
  UPDATE review_sessions
  SET consent_version = COALESCE(consent_version, p_consent_version),
      consented_at = COALESCE(consented_at, now()),
      updated_at = now()
  WHERE session_token = p_session_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION record_review_consent(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_review_consent(uuid, text) TO anon, authenticated;

-- ============================================
-- 3. Private feedback now records its own consent
-- ============================================

DROP FUNCTION IF EXISTS submit_private_feedback(uuid, text, int);

CREATE OR REPLACE FUNCTION submit_private_feedback(
  p_session_token uuid,
  p_message text,
  p_rating int DEFAULT NULL,
  p_consent_version text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session review_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM review_sessions WHERE session_token = p_session_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF p_message IS NULL OR length(trim(p_message)) = 0 THEN
    RAISE EXCEPTION 'Message is required';
  END IF;

  IF length(p_message) > 5000 THEN
    RAISE EXCEPTION 'Message too long';
  END IF;

  IF p_consent_version IS NOT NULL AND length(p_consent_version) > 64 THEN
    RAISE EXCEPTION 'Consent version is invalid';
  END IF;

  INSERT INTO private_feedback (
    business_id, review_session_id, rating, message, status,
    consent_version, consented_at
  )
  VALUES (
    v_session.business_id, v_session.id, p_rating, p_message, 'new',
    COALESCE(p_consent_version, v_session.consent_version),
    now()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION submit_private_feedback(uuid, text, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_private_feedback(uuid, text, int, text) TO anon, authenticated;

-- ============================================
-- 4. Signup consent is written by the signup trigger
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, terms_consent_version, terms_consented_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NULLIF(left(COALESCE(NEW.raw_user_meta_data->>'terms_consent_version', ''), 64), ''),
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'terms_consent_version', '') <> '' THEN now()
      ELSE NULL
    END
  );
  RETURN NEW;
END;
$$;

-- Same grants the original definition carried, so replacing the function does
-- not change who may execute it.
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION handle_new_user() TO authenticated;

-- ============================================
-- 5. Retained financial records survive erasure
-- ============================================
-- Indian tax and company law requires books of account and the supporting
-- vouchers to be preserved for several years. Erasing an account must not
-- destroy that trail, so the minimum needed for a payment record is copied
-- here first. This table holds no login credentials, no business content, and
-- no customer data — only the transaction.

CREATE TABLE IF NOT EXISTS retained_financial_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL,
  payment_id text,
  plan text NOT NULL,
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL,
  business_name text,
  billing_email text,
  transacted_at timestamptz NOT NULL,
  retain_until timestamptz NOT NULL,
  erased_account_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retained_financial_order
  ON retained_financial_records(order_id);
CREATE INDEX IF NOT EXISTS idx_retained_financial_retain_until
  ON retained_financial_records(retain_until);

ALTER TABLE retained_financial_records ENABLE ROW LEVEL SECURITY;

-- No client role may read this table. It is reachable only by the service role
-- (which bypasses RLS) for accounting and audit. No policy is defined on
-- purpose: with RLS enabled and no policy, every client read returns nothing.

COMMENT ON TABLE retained_financial_records IS
  'Minimum payment trail kept after account erasure to satisfy statutory bookkeeping retention. Disclosed in the Privacy Policy retention table.';

-- ============================================
-- 6. Right of access: export everything we hold
-- ============================================

CREATE OR REPLACE FUNCTION export_my_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT jsonb_build_object(
    'exported_at', now(),
    'notice', 'This is every record Reviyo holds that is linked to your account. '
              || 'Customer review sessions are shown because your business received them; '
              || 'they are anonymous and contain no identifier of the customer.',
    'account', (
      SELECT jsonb_build_object(
        'id', p.id,
        'email', p.email,
        'full_name', p.full_name,
        'role', p.role,
        'terms_consent_version', p.terms_consent_version,
        'terms_consented_at', p.terms_consented_at,
        'created_at', p.created_at
      )
      FROM profiles p WHERE p.id = v_user_id
    ),
    'businesses', COALESCE((
      SELECT jsonb_agg(to_jsonb(b) - 'owner_id')
      FROM businesses b WHERE b.owner_id = v_user_id
    ), '[]'::jsonb),
    'review_topics', COALESCE((
      SELECT jsonb_agg(to_jsonb(t))
      FROM review_topics t
      JOIN businesses b ON b.id = t.business_id
      WHERE b.owner_id = v_user_id
    ), '[]'::jsonb),
    'review_sessions', COALESCE((
      SELECT jsonb_agg(to_jsonb(s) - 'session_token')
      FROM review_sessions s
      JOIN businesses b ON b.id = s.business_id
      WHERE b.owner_id = v_user_id
    ), '[]'::jsonb),
    'private_feedback', COALESCE((
      SELECT jsonb_agg(to_jsonb(f))
      FROM private_feedback f
      JOIN businesses b ON b.id = f.business_id
      WHERE b.owner_id = v_user_id
    ), '[]'::jsonb),
    'analytics_events', COALESCE((
      SELECT jsonb_agg(to_jsonb(e))
      FROM analytics_events e
      JOIN businesses b ON b.id = e.business_id
      WHERE b.owner_id = v_user_id
    ), '[]'::jsonb),
    'subscriptions', COALESCE((
      SELECT jsonb_agg(to_jsonb(sub))
      FROM subscriptions sub
      JOIN businesses b ON b.id = sub.business_id
      WHERE b.owner_id = v_user_id
    ), '[]'::jsonb),
    'payment_orders', COALESCE((
      SELECT jsonb_agg(to_jsonb(o) - 'user_id')
      FROM payment_orders o
      JOIN businesses b ON b.id = o.business_id
      WHERE b.owner_id = v_user_id
    ), '[]'::jsonb),
    'shared_with', jsonb_build_array(
      'Supabase — database, authentication and hosting',
      'Our configured AI provider — only at the moment a review draft is requested',
      'Razorpay — payment processing'
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION export_my_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION export_my_data() TO authenticated;

-- ============================================
-- 7. Right to erasure: preserve the financial trail before deletion
-- ============================================
-- Erasure itself is performed by the `delete-account` Edge Function, which
-- calls Supabase's admin API to delete the auth user. That deletion cascades
-- to profiles and businesses, and from businesses to review_topics,
-- review_sessions, review_session_topics, private_feedback, analytics_events,
-- subscriptions, ai_generation_log, and payment_orders.
--
-- Deleting the auth user directly from SQL would depend on table privileges in
-- the `auth` schema that differ between Supabase projects, so it is done
-- through the admin API instead. This function performs the one step that must
-- happen *before* the cascade: copying the statutory financial trail out of
-- payment_orders, which is ON DELETE CASCADE from businesses.

CREATE OR REPLACE FUNCTION preserve_financial_records_for_erasure(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email text;
  v_preserved int := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  SELECT email INTO v_email FROM profiles WHERE id = p_user_id;

  WITH preserved AS (
    INSERT INTO retained_financial_records (
      order_id, payment_id, plan, amount, currency, status,
      business_name, billing_email, transacted_at, retain_until
    )
    SELECT
      o.order_id, o.payment_id, o.plan, o.amount, o.currency, o.status,
      b.name, v_email, o.created_at, o.created_at + interval '8 years'
    FROM payment_orders o
    JOIN businesses b ON b.id = o.business_id
    WHERE b.owner_id = p_user_id
      AND o.status = 'paid'
    RETURNING 1
  )
  SELECT count(*) INTO v_preserved FROM preserved;

  RETURN jsonb_build_object('financial_records_retained', v_preserved);
END;
$$;

-- Only the service role may call this, and only from the erasure Edge Function.
REVOKE EXECUTE ON FUNCTION preserve_financial_records_for_erasure(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION preserve_financial_records_for_erasure(uuid) TO service_role;

-- ============================================
-- 8. Storage limitation: purge data past its retention period
-- ============================================

CREATE OR REPLACE FUNCTION purge_expired_personal_data(
  p_session_retention_days int DEFAULT 90,
  p_feedback_retention_days int DEFAULT 365,
  p_analytics_retention_days int DEFAULT 395
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sessions int;
  v_feedback int;
  v_events int;
  v_ai_log int;
  v_financial int;
BEGIN
  IF p_session_retention_days < 1
     OR p_feedback_retention_days < 1
     OR p_analytics_retention_days < 1 THEN
    RAISE EXCEPTION 'Retention periods must be at least one day';
  END IF;

  -- AI rate-limit rows are operational only and are cleared first, because
  -- they reference sessions that are about to disappear.
  DELETE FROM ai_generation_log
  WHERE created_at < now() - make_interval(days => p_session_retention_days);
  GET DIAGNOSTICS v_ai_log = ROW_COUNT;

  -- Analytics events are kept longest so year-on-year counts still work, but
  -- events attached to a session must go when the session goes.
  DELETE FROM analytics_events
  WHERE created_at < now() - make_interval(days => p_analytics_retention_days);
  GET DIAGNOSTICS v_events = ROW_COUNT;

  DELETE FROM private_feedback
  WHERE created_at < now() - make_interval(days => p_feedback_retention_days);
  GET DIAGNOSTICS v_feedback = ROW_COUNT;

  -- Deleting the session nulls out review_session_id on any analytics event or
  -- private feedback still inside its own retention window (ON DELETE SET
  -- NULL), which is what we want: the count survives, the free text does not.
  DELETE FROM review_sessions
  WHERE created_at < now() - make_interval(days => p_session_retention_days);
  GET DIAGNOSTICS v_sessions = ROW_COUNT;

  DELETE FROM retained_financial_records WHERE retain_until < now();
  GET DIAGNOSTICS v_financial = ROW_COUNT;

  RETURN jsonb_build_object(
    'ran_at', now(),
    'review_sessions_deleted', v_sessions,
    'private_feedback_deleted', v_feedback,
    'analytics_events_deleted', v_events,
    'ai_generation_log_deleted', v_ai_log,
    'expired_financial_records_deleted', v_financial
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION purge_expired_personal_data(int, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purge_expired_personal_data(int, int, int) TO service_role;

/*
## Scheduling the purge — required, not optional

The retention periods published in the Privacy Policy are a promise. Nothing
enforces them until this function runs on a schedule. Pick one:

**Option A — pg_cron (preferred).** In the Supabase dashboard, enable the
`pg_cron` extension under Database > Extensions, then run:

    SELECT cron.schedule(
      'reviyo-purge-expired-personal-data',
      '30 2 * * *',
      $cron$ SELECT purge_expired_personal_data(90, 365, 395) $cron$
    );

**Option B — an external scheduler.** Call the function from any trusted
server-side job using the service-role key, once a day.

Keep the arguments in step with `sessionRetentionDays`, `feedbackRetentionDays`,
and `analyticsRetentionDays` in `src/config/legal.ts`, which is what the
published policy renders.
*/
