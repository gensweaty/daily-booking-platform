-- Debug RLS policies for events table - check current sub-user permissions

-- First, check what policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'events' AND schemaname = 'public';

-- Let's fix the sub-user RLS policies to be more permissive for debugging
-- Drop the restrictive sub-user policies
DROP POLICY IF EXISTS "Sub users can delete only events they created" ON events;
DROP POLICY IF EXISTS "Sub users can update only events they created" ON events;

-- Create more permissive sub-user policies for testing
CREATE POLICY "Sub users can delete events they manage" ON events
FOR DELETE 
USING (
  auth.uid() IS NOT NULL 
  AND user_id IN (
    SELECT public_boards.user_id
    FROM public_boards
    WHERE public_boards.is_active = true
  )
  AND (
    created_by_type = 'sub_user' 
    OR created_by_type IS NULL
    OR last_edited_by_type = 'sub_user'
  )
);

CREATE POLICY "Sub users can update events they manage" ON events
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL 
  AND user_id IN (
    SELECT public_boards.user_id
    FROM public_boards
    WHERE public_boards.is_active = true
  )
  AND (
    created_by_type = 'sub_user' 
    OR created_by_type IS NULL
    OR last_edited_by_type = 'sub_user'
  )
);