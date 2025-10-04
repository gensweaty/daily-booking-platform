-- Fix RLS policy for events table to prevent sub-users from deleting events they didn't create
DROP POLICY IF EXISTS "Users can manage their own events" ON public.events;

-- Create separate policies for better control
CREATE POLICY "Users can view their own events" ON public.events
FOR SELECT 
USING (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
  (user_id IN (SELECT user_id FROM public_boards WHERE is_active = true))
);

CREATE POLICY "Users can create events" ON public.events
FOR INSERT 
WITH CHECK (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
  (auth.uid() IS NULL AND user_id IN (SELECT user_id FROM public_boards WHERE is_active = true))
);

CREATE POLICY "Users can update their own events" ON public.events
FOR UPDATE 
USING (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id AND created_by_type <> 'sub_user'::text) OR
  (auth.uid() IS NOT NULL AND created_by_type = 'sub_user'::text AND created_by_name IN (
    SELECT users.email FROM auth.users WHERE users.id = auth.uid()
    UNION
    SELECT sub_users.fullname FROM sub_users 
    WHERE sub_users.board_owner_id = events.user_id 
    AND lower(sub_users.email) = lower((SELECT users.email FROM auth.users WHERE users.id = auth.uid()))
  )) OR
  (auth.uid() IS NOT NULL AND last_edited_by_type = 'sub_user'::text AND last_edited_by_name IN (
    SELECT users.email FROM auth.users WHERE users.id = auth.uid()
    UNION
    SELECT sub_users.fullname FROM sub_users 
    WHERE sub_users.board_owner_id = events.user_id 
    AND lower(sub_users.email) = lower((SELECT users.email FROM auth.users WHERE users.id = auth.uid()))
  )) OR
  (created_by_type IS NULL AND created_by_name IS NULL AND last_edited_by_type IS NULL AND last_edited_by_name IS NULL)
);

CREATE POLICY "Users can delete only their own created events" ON public.events
FOR DELETE 
USING (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id AND created_by_type <> 'sub_user'::text) OR
  (auth.uid() IS NOT NULL AND created_by_type = 'sub_user'::text AND created_by_name IN (
    SELECT users.email FROM auth.users WHERE users.id = auth.uid()
    UNION
    SELECT sub_users.fullname FROM sub_users 
    WHERE sub_users.board_owner_id = events.user_id 
    AND lower(sub_users.email) = lower((SELECT users.email FROM auth.users WHERE users.id = auth.uid()))
  ))
);