-- Fix RLS policies for events table - sub-users should only delete/update events they created

-- Drop existing conflicting policies
DROP POLICY IF EXISTS "Users can delete their own events" ON events;
DROP POLICY IF EXISTS "Users can update their own events" ON events;

-- Create specific policy for main users (non sub-users)
CREATE POLICY "Main users can delete their own events" ON events
FOR DELETE 
USING (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id 
  AND (created_by_type IS NULL OR created_by_type != 'sub_user')
);

-- Create specific policy for sub-users to delete only their own events
CREATE POLICY "Sub users can delete only events they created" ON events
FOR DELETE 
USING (
  auth.uid() IS NOT NULL 
  AND created_by_type = 'sub_user' 
  AND created_by_name IN (
    SELECT users.email FROM auth.users WHERE users.id = auth.uid()
    UNION
    SELECT sub_users.fullname FROM sub_users 
    WHERE sub_users.board_owner_id = events.user_id 
    AND lower(sub_users.email) = lower((SELECT users.email FROM auth.users WHERE users.id = auth.uid()))
  )
);

-- Create specific policy for main users (non sub-users) to update their events  
CREATE POLICY "Main users can update their own events" ON events
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id 
  AND (created_by_type IS NULL OR created_by_type != 'sub_user')
);

-- Create specific policy for sub-users to update only their own events
CREATE POLICY "Sub users can update only events they created" ON events
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL 
  AND (
    (created_by_type = 'sub_user' 
     AND created_by_name IN (
       SELECT users.email FROM auth.users WHERE users.id = auth.uid()
       UNION
       SELECT sub_users.fullname FROM sub_users 
       WHERE sub_users.board_owner_id = events.user_id 
       AND lower(sub_users.email) = lower((SELECT users.email FROM auth.users WHERE users.id = auth.uid()))
     ))
    OR
    (last_edited_by_type = 'sub_user' 
     AND last_edited_by_name IN (
       SELECT users.email FROM auth.users WHERE users.id = auth.uid()
       UNION
       SELECT sub_users.fullname FROM sub_users 
       WHERE sub_users.board_owner_id = events.user_id 
       AND lower(sub_users.email) = lower((SELECT users.email FROM auth.users WHERE users.id = auth.uid()))
     ))
  )
);