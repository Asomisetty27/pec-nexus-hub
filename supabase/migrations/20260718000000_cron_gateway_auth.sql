-- Corrective follow-up to 20260715010000_auto_prep_cron.sql. That migration
-- posted to auto-prep-meetings with only the x-cron-secret header, assuming
-- the function's verify_jwt=false (config.toml) would let the Supabase gateway
-- pass it through. On prod the gateway still required an auth header and
-- returned 401 UNAUTHORIZED_NO_AUTH_HEADER before the request reached the
-- function. Fix (verified live 2026-07-18): include the PUBLIC anon key as
-- apikey + Authorization so the gateway accepts the request; the private
-- x-cron-secret (in Vault) remains the real security gate the function checks.
--
-- The anon key below is the public, client-safe key already shipped in the
-- repo .env for the prod project; embedding it in the cron command is safe.
-- This migration is prod-shaped (it reads prod Vault secrets); apply only
-- where those secrets and this anon key are valid.

select cron.unschedule('auto-prep-meetings-daily')
where exists (select 1 from cron.job where jobname = 'auto-prep-meetings-daily');

select cron.schedule(
  'auto-prep-meetings-daily',
  '0 15 * * *',
  $CRON$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'edge_base_url') || '/auto-prep-meetings',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZXJvZXpqenlteXd2d3FmZW14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTc1MzQsImV4cCI6MjA4ODc3MzUzNH0.PpHOxC-YgE7gsOueEWUB-DVCvWdI_ADRSsigFUMICCE',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZXJvZXpqenlteXd2d3FmZW14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTc1MzQsImV4cCI6MjA4ODc3MzUzNH0.PpHOxC-YgE7gsOueEWUB-DVCvWdI_ADRSsigFUMICCE',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $CRON$
);
