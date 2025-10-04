
-- First, let's see what cron jobs currently exist and then clean them up
SELECT * FROM cron.job;

-- Remove the broken cron jobs that are causing issues
SELECT cron.unschedule('invoke-send-task-reminder-email');
SELECT cron.unschedule('invoke-send-event-reminder-email'); 
SELECT cron.unschedule('process-reminders-job');

-- Create a single, properly configured cron job that calls our new process-reminders function
-- This will run every minute and handle both task and event reminders
SELECT cron.schedule(
  'unified-reminder-processor',
  '* * * * *', -- every minute
  $$
  SELECT net.http_post(
    url := 'https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/process-reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ydWVxcGZmemF1dmR4bXV3aGZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM0OTU5MTgsImV4cCI6MjA0OTA3MTkxOH0.tntt0C1AgzJN-x3XrmIKb4j9iow8m4DZq3imEhJt9-0"}'::jsonb,
    body := '{"source": "cron", "timestamp": "' || now() || '"}'::jsonb
  ) as request_id;
  $$
);

-- Verify the new cron job was created
SELECT * FROM cron.job WHERE jobname = 'unified-reminder-processor';
