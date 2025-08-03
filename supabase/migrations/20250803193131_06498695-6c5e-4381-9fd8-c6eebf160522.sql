
-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a cron job to run the event reminder function every minute
SELECT cron.schedule(
  'send-event-reminders',
  '* * * * *', -- every minute
  $$
  SELECT net.http_post(
    url := 'https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/send-event-reminder-email',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ydWVxcGZmemF1dmR4bXV3aGZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM0OTU5MTgsImV4cCI6MjA0OTA3MTkxOH0.tntt0C1AgzJN-x3XrmIKb4j9iow8m4DZq3imEhJt9-0"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Verify the cron job was created
SELECT * FROM cron.job WHERE jobname = 'send-event-reminders';
