
-- Create reminder_entries table for backend scheduling
CREATE TABLE public.reminder_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  remind_at timestamp with time zone NOT NULL,
  delivered boolean NOT NULL DEFAULT false,
  delivered_at timestamp with time zone,
  type text NOT NULL CHECK (type IN ('event', 'task')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reminder_entries_target_check CHECK (
    (event_id IS NOT NULL AND task_id IS NULL) OR 
    (event_id IS NULL AND task_id IS NOT NULL)
  )
);

-- Enable RLS
ALTER TABLE public.reminder_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies for reminder_entries
CREATE POLICY "Users can view their own reminder entries" 
  ON public.reminder_entries 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reminder entries" 
  ON public.reminder_entries 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reminder entries" 
  ON public.reminder_entries 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reminder entries" 
  ON public.reminder_entries 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Service role can manage all reminder entries (for cron job)
CREATE POLICY "Service role can manage all reminder entries" 
  ON public.reminder_entries 
  FOR ALL
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

-- Create index for efficient querying of due reminders
CREATE INDEX idx_reminder_entries_due 
  ON public.reminder_entries (remind_at, delivered) 
  WHERE delivered = false;

-- Schedule the reminder processor to run every minute
SELECT cron.schedule(
  'process-reminders-job',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/process-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ydWVxcGZmemF1dmR4bXV3aGZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzQ5NTkxOCwiZXhwIjoyMDQ5MDcxOTE4fQ.tLxW8vdCVKJdJ5hJcfQRBBFQqJn2G8c-7Hb3KMYtvSs'
    ),
    body := '{"source": "cron"}'::jsonb
  ) as request_id;
  $$
);
