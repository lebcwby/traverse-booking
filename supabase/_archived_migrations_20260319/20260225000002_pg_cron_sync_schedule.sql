-- ============================================
-- pg_cron: Guesty sync schedules (Stay Portland website only)
-- ============================================
-- Only sync-listings is needed — it keeps the listings table populated
-- for the homepage, search suggestions, and featured properties.
--
-- PREREQUISITES:
--   1. Enable pg_cron and pg_net extensions in Supabase Dashboard
--   2. Store vault secrets:
--      select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--      select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
--
-- NOTE: Run this AFTER deploying Edge Functions and setting secrets.
-- ============================================

-- Enable required extensions
create extension if not exists pg_net with schema extensions;

-- Daily: Sync listings (4 AM UTC)
select cron.schedule(
  'sync-listings-daily',
  '0 4 * * *',
  $$
  select net.http_post(
    url := (
      select concat(decrypted_secret, '/functions/v1/sync-listings')
      from vault.decrypted_secrets
      where name = 'project_url'
    ),
    headers := jsonb_build_object(
      'Authorization', (
        select concat('Bearer ', decrypted_secret)
        from vault.decrypted_secrets
        where name = 'service_role_key'
      ),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
