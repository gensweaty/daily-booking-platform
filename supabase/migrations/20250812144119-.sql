-- Ensure realtime is enabled for task_comments inserts
DO $$
BEGIN
  -- Add task_comments to supabase_realtime publication if not already present
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'task_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;
  END IF;
EXCEPTION WHEN undefined_object THEN
  -- If publication doesn't exist for some reason, create and add the table
  CREATE PUBLICATION supabase_realtime FOR TABLE public.task_comments;
END$$;

-- For robust change payloads on updates (not strictly needed for INSERT but safe)
ALTER TABLE public.task_comments REPLICA IDENTITY FULL;