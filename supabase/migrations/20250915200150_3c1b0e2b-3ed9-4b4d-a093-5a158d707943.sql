-- Add public board access policy for customer_files_new table
-- This allows external users to view customer files when accessing through public boards

CREATE POLICY "Public board users can view customer files" 
ON public.customer_files_new 
FOR SELECT 
USING (
  user_id IN (
    SELECT user_id 
    FROM public_boards 
    WHERE is_active = true
  )
);