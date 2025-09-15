-- Fix RLS policy for customer_files_new to allow external board file uploads
-- Drop the existing problematic policy
DROP POLICY IF EXISTS "cf_insert_owner_or_sub" ON customer_files_new;

-- Create a new policy that allows external board users to upload files
CREATE POLICY "customer_files_insert_policy" 
ON customer_files_new
FOR INSERT
WITH CHECK (
  -- Allow if user owns the file
  (user_id = auth.uid()) 
  OR 
  -- Allow if user is a sub-user of the board owner
  (EXISTS ( 
    SELECT 1
    FROM (profiles p JOIN sub_users su ON ((lower(su.email) = lower(p.username))))
    WHERE ((p.id = auth.uid()) AND (su.board_owner_id = customer_files_new.user_id))
  ))
  OR
  -- Allow for public boards (external access)
  (user_id IN ( 
    SELECT public_boards.user_id
    FROM public_boards
    WHERE (public_boards.is_active = true)
  ))
);