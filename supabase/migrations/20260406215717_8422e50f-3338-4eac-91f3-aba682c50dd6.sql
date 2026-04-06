-- Remove old cron jobs for deleted functions
SELECT cron.unschedule(jobname) FROM cron.job 
WHERE jobname IN (
  'analytics-automation-engine',
  'auto-business-tips', 
  'auto-weather-notify',
  'broadcast-secretary',
  'invoke-analytics-automation-engine',
  'invoke-auto-business-tips',
  'invoke-broadcast-secretary',
  'invoke-auto-weather-notify'
);

-- Add Laura lifecycle cron (runs every hour at :15)
SELECT cron.schedule(
  'laura-lifecycle-cron',
  '15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/laura-lifecycle-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Disable all analytics_automations since Laura handles everything now
UPDATE analytics_automations SET enabled = false WHERE enabled = true;