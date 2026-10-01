-- Run AFTER creating the two Vault secrets described in COMMISSION_SETUP.md.
-- No credentials are stored in source or cron's job text.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name='commission_cron_secret' AND length(decrypted_secret)>=32)
    OR NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name='commission_publishable_key') THEN
    RAISE EXCEPTION 'Create commission_cron_secret and commission_publishable_key in Vault first';
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='reviyo-commissions-hourly') THEN
    PERFORM cron.unschedule('reviyo-commissions-hourly');
  END IF;
END $$;
SELECT cron.schedule('reviyo-commissions-hourly','0 * * * *', $job$
  SELECT net.http_post(
    url := 'https://yagchgwgbttxfihlyddm.supabase.co/functions/v1/commission-scheduler',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='commission_publishable_key' LIMIT 1),
      'x-cron-secret',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='commission_cron_secret' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$job$);
