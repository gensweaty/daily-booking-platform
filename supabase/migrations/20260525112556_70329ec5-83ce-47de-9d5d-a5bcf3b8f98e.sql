SELECT cron.schedule(
  'retention-cleanup-daily',
  '0 3 * * *',
  $$
    DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days';
    DELETE FROM supabase_functions.hooks WHERE created_at < now() - interval '7 days';
    DELETE FROM net._http_response WHERE created < now() - interval '1 day';
  $$
);