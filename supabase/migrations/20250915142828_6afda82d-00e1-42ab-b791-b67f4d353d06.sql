-- Fix RLS policies for event_files to allow viewing based on event ownership
DROP POLICY IF EXISTS "Users can view their own event files" ON event_files;
CREATE POLICY "Users can view event files for their events" 
ON event_files 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  event_id IN (
    SELECT id FROM events WHERE user_id = auth.uid()
  ) OR
  event_id IN (
    SELECT id FROM events 
    WHERE user_id IN (
      SELECT user_id FROM public_boards WHERE is_active = true
    )
  )
);

-- Fix RLS policies for customers to allow viewing based on event ownership  
DROP POLICY IF EXISTS "Users can manage their own customers" ON customers;
CREATE POLICY "Users can manage customers for their events" 
ON customers 
FOR ALL 
USING (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
  (user_id IN (SELECT user_id FROM public_boards WHERE is_active = true)) OR
  (event_id IN (SELECT id FROM events WHERE user_id = auth.uid())) OR
  (event_id IN (SELECT id FROM events WHERE user_id IN (SELECT user_id FROM public_boards WHERE is_active = true)))
)
WITH CHECK (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
  (auth.uid() IS NULL AND user_id IN (SELECT user_id FROM public_boards WHERE is_active = true))
);