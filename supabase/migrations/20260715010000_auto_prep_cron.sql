-- Auto-prep meetings: daily cron that generates each upcoming meeting's deck +
-- hands-on kit from live context and notifies the organizer, so the president/
-- VP click nothing. Runs the auto-prep-meetings edge function.
--
-- PREREQUISITES (must exist before this migration; set once per project):
--   1. Extensions pg_cron and pg_net (already installed on prod + staging).
--   2. The auto-prep-meetings / generate-meeting-deck / generate-meeting-kit
--      edge functions deployed.
--   3. The edge functions have a CRON_SECRET secret set.
--   4. Two Vault secrets so nothing sensitive lives in the cron command:
--        select vault.create_secret('https://<ref>.functions.supabase.co', 'edge_base_url');
--        select vault.create_secret('<same value as the CRON_SECRET>',      'cron_secret');
--      (Use functions.supabase.co, the functions host, not the REST host.)
--
-- The job posts an empty body; auto-prep-meetings computes its own window.
-- 15:00 UTC is ~7-8 AM Pacific year-round, before any meeting day starts.

-- Idempotent (re)install: unschedule a prior copy if present.
select cron.unschedule('auto-prep-meetings-daily')
where exists (select 1 from cron.job where jobname = 'auto-prep-meetings-daily');

select cron.schedule(
  'auto-prep-meetings-daily',
  '0 15 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'edge_base_url')
           || '/auto-prep-meetings',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
