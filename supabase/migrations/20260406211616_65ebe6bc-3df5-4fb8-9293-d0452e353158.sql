
SELECT cron.unschedule(4);

SELECT cron.unschedule(5);

SELECT cron.schedule(
  'auto-business-tips-weekly',
  '0 13 * * 1',
  $$
  SELECT net.http_post(
    url:='https://vcuwimodpfbzpuvzesfm.supabase.co/functions/v1/auto-business-tips',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjdXdpbW9kcGZienB1dnplc2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0OTgxMzUsImV4cCI6MjA4NjA3NDEzNX0.dmb2JuILUGIJMJvePNIzMm3ErZvBesjMuzDD6y6vG6s"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
