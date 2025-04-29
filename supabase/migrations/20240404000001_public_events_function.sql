
-- Function to get public events for a specific user
CREATE OR REPLACE FUNCTION public.get_public_events_by_user_id(user_id_param UUID)
RETURNS SETOF events
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM events 
  WHERE user_id = user_id_param
  AND deleted_at IS NULL
  ORDER BY start_date ASC;
$$;

-- Update RLS on events table to ensure proper protection
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Ensure the events table has RLS policies
DO $$
BEGIN
  -- Check if policy exists for select
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'events' 
    AND policyname = 'Enable read access for users based on user_id'
  ) THEN
    CREATE POLICY "Enable read access for users based on user_id" 
    ON public.events FOR SELECT 
    USING (auth.uid() = user_id);
  END IF;
  
  -- Check if policy exists for insert
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'events' 
    AND policyname = 'Enable insert access for authenticated users'
  ) THEN
    CREATE POLICY "Enable insert access for authenticated users" 
    ON public.events FOR INSERT 
    WITH CHECK (auth.uid() = user_id);
  END IF;
  
  -- Check if policy exists for update
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'events' 
    AND policyname = 'Enable update access for users based on user_id'
  ) THEN
    CREATE POLICY "Enable update access for users based on user_id" 
    ON public.events FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
  
  -- Check if policy exists for delete
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'events' 
    AND policyname = 'Enable delete access for users based on user_id'
  ) THEN
    CREATE POLICY "Enable delete access for users based on user_id" 
    ON public.events FOR DELETE 
    USING (auth.uid() = user_id);
  END IF;
END
$$;

-- Ensure booking_requests table has deleted_at column for soft deletes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'booking_requests' 
    AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE public.booking_requests ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
  END IF;
END
$$;

