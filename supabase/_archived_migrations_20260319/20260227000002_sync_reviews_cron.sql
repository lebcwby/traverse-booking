-- Hourly: Sync reviews from Guesty (every hour at :30)
select cron.schedule(
  'sync-reviews-hourly',
  '30 * * * *',
  $$
  select net.http_post(
    url := (
      select concat(decrypted_secret, '/functions/v1/sync-reviews')
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
