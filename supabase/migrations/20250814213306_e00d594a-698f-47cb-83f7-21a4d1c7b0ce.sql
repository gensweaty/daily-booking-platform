-- Fix RLS policies for events table to prevent sub-users from editing/deleting events they didn't create

-- Drop the existing policies
DROP POLICY IF EXISTS "Users can delete only their own created events" ON events;
DROP POLICY IF EXISTS "Users can update their own events" ON events;

-- Create more granular delete policy
CREATE POLICY "Users can delete their own events" ON events
FOR DELETE 
USING (
  -- Main user can delete their own events
  (auth.uid() IS NOT NULL AND auth.uid() = user_id AND (created_by_type IS NULL OR created_by_type != 'sub_user'))
  OR
  -- Sub-users can only delete events they created
  (auth.uid() IS NOT NULL 
   AND created_by_type = 'sub_user' 
   AND created_by_name IN (
     SELECT users.email FROM auth.users WHERE users.id = auth.uid()
     UNION
     SELECT sub_users.fullname FROM sub_users 
     WHERE sub_users.board_owner_id = events.user_id 
     AND lower(sub_users.email) = lower((SELECT users.email FROM auth.users WHERE users.id = auth.uid()))
   ))
);

-- Create more granular update policy  
CREATE POLICY "Users can update their own events" ON events
FOR UPDATE 
USING (
  -- Main user can update their own events
  (auth.uid() IS NOT NULL AND auth.uid() = user_id AND (created_by_type IS NULL OR created_by_type != 'sub_user'))
  OR
  -- Sub-users can only update events they created
  (auth.uid() IS NOT NULL 
   AND created_by_type = 'sub_user' 
   AND created_by_name IN (
     SELECT users.email FROM auth.users WHERE users.id = auth.uid()
     UNION
     SELECT sub_users.fullname FROM sub_users 
     WHERE sub_users.board_owner_id = events.user_id 
     AND lower(sub_users.email) = lower((SELECT users.email FROM auth.users WHERE users.id = auth.uid()))
   ))
  OR
  -- Allow updates for events that were edited by the current sub-user
  (auth.uid() IS NOT NULL 
   AND last_edited_by_type = 'sub_user' 
   AND last_edited_by_name IN (
     SELECT users.email FROM auth.users WHERE users.id = auth.uid()
     UNION
     SELECT sub_users.fullname FROM sub_users 
     WHERE sub_users.board_owner_id = events.user_id 
     AND lower(sub_users.email) = lower((SELECT users.email FROM auth.users WHERE users.id = auth.uid()))
   ))
);