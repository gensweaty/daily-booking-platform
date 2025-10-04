-- Fix RLS policies for events table - sub-users should ONLY manage events they created themselves

-- Drop existing permissive policies 
DROP POLICY IF EXISTS "Sub users can delete events they manage" ON events;
DROP POLICY IF EXISTS "Sub users can update events they manage" ON events;

-- Create strict sub-user policies that only allow access to events they personally created
CREATE POLICY "Sub users can delete only their own created events" ON events
FOR DELETE 
USING (
  auth.uid() IS NOT NULL 
  AND created_by_type = 'sub_user' 
  AND created_by_name IN (
    -- Check against the authenticated user's email from auth.users
    SELECT users.email FROM auth.users WHERE users.id = auth.uid()
    UNION
    -- Check against sub_users table for fullname match
    SELECT sub_users.fullname FROM sub_users 
    WHERE sub_users.board_owner_id = events.user_id 
    AND lower(sub_users.email) = lower((SELECT users.email FROM auth.users WHERE users.id = auth.uid()))
  )
);

CREATE POLICY "Sub users can update only their own created events" ON events
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL 
  AND (
    -- Allow if they created the event
    (created_by_type = 'sub_user' 
     AND created_by_name IN (
       SELECT users.email FROM auth.users WHERE users.id = auth.uid()
       UNION
       SELECT sub_users.fullname FROM sub_users 
       WHERE sub_users.board_owner_id = events.user_id 
       AND lower(sub_users.email) = lower((SELECT users.email FROM auth.users WHERE users.id = auth.uid()))
     ))
    OR
    -- Allow if they were the last to edit it (and it was created by sub_user)
    (created_by_type = 'sub_user' 
     AND last_edited_by_type = 'sub_user' 
     AND last_edited_by_name IN (
       SELECT users.email FROM auth.users WHERE users.id = auth.uid()
       UNION
       SELECT sub_users.fullname FROM sub_users 
       WHERE sub_users.board_owner_id = events.user_id 
       AND lower(sub_users.email) = lower((SELECT users.email FROM auth.users WHERE users.id = auth.uid()))
     ))
  )
);