SELECT cron.schedule(
  'poll-telegram-updates-v2',
  '* * * * *',
  $CRON$
  select net.http_post(
    url:='https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/telegram-poll',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ydWVxcGZmemF1dmR4bXV3aGZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM0OTU5MTgsImV4cCI6MjA0OTA3MTkxOH0.tntt0C1AgzJN-x3XrmIKb4j9iow8m4DZq3imEhJt9-0"}'::jsonb,
    body:='{}'::jsonb
  );
  $CRON$
);