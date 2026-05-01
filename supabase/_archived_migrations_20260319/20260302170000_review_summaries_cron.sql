-- Daily: Generate AI review summaries for listings that don't have one yet (5 AM UTC)
-- Runs after sync-listings (4 AM) and a review sync cycle (:30 each hour)
select cron.schedule(
  'generate-review-summaries-daily',
  '0 5 * * *',
  $$
  select net.http_post(
    url := (
      select concat(decrypted_secret, '/functions/v1/generate-review-summaries')
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
